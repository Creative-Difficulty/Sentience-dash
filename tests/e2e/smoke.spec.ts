import { test as base, expect, type Page } from '@playwright/test';
import postgres from 'postgres';

const dbUrl = process.env.E2E_DATABASE_URL;
if (!dbUrl) throw new Error('E2E_DATABASE_URL must point at the seeded database the app uses');

// Every page must load without console errors, uncaught exceptions or dialogs
// (a dialog would mean an injected `alert(1)` from message content ran).
const test = base.extend<{ problems: string[] }>({
	problems: async ({ page }, use) => {
		const problems: string[] = [];
		page.on('console', (m) => {
			if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
		});
		page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
		page.on('dialog', (d) => {
			problems.push(`dialog: ${d.message()}`);
			void d.dismiss();
		});
		await use(problems);
		expect(problems, 'browser console problems').toEqual([]);
	}
});

const sql = postgres(dbUrl, { max: 1 });
test.afterAll(async () => {
	await sql.end();
});

async function pickChannel(page: Page, name: string) {
	const input = page.getByPlaceholder('Search channels...');
	await input.click();
	await input.fill(name);
	await page.getByRole('option', { name, exact: true }).click();
}

test('overview renders stats and charts', async ({ page, problems }) => {
	await page.goto('/');
	await expect(page.getByText('Messages recorded per hour in the last 24 hours')).toBeVisible();
	await expect(page.getByText('Channels by message share')).toBeVisible();
	await expect(page.locator('.cds--cc--chart-wrapper svg').first()).toBeVisible();
	await expect(page.getByText('Error', { exact: true })).toHaveCount(0);
	expect(problems).toEqual([]);
});

test('explorer loads a channel, escapes content and paginates on scroll', async ({
	page,
	problems
}) => {
	await page.goto('/explorer');
	await expect(page.getByText('Select a channel to start exploring messages')).toBeVisible();
	await pickChannel(page, 'general');

	const messages = page.locator('[data-mid]');
	await expect(messages).toHaveCount(50);

	// Scrolling to the top triggers the next page.
	await page.locator('.chat-window').evaluate((el) => (el.scrollTop = 0));
	await expect.poll(() => messages.count()).toBeGreaterThan(50);

	// Seeded messages in this channel contain `<b>html</b> & <script>alert(1)</script>`:
	// they must be shown as text, never parsed as markup.
	await pickChannel(page, 'borrow-checker-thread');
	await expect(messages.first()).toBeVisible();
	await expect(page.getByText('<script>alert(1)</script>', { exact: false }).first()).toBeVisible();
	expect(await page.locator('.chat-window script, .chat-window b').count()).toBe(0);
	expect(problems).toEqual([]);
});

test('/api/messages pages through a whole channel exactly once', async ({ request }) => {
	const [{ channel_id }] = await sql<{ channel_id: string }[]>`
		SELECT channel_id::text FROM discord_channels WHERE name = 'general'`;
	const expected = (
		await sql<{ id: string }[]>`
			SELECT message_id::text AS id FROM messages
			WHERE channel_id = ${channel_id}::bigint AND deleted_at IS NULL
			ORDER BY message_id DESC`
	).map((r) => r.id);
	expect(expected.length).toBeGreaterThan(50);

	const seen: string[] = [];
	let cursor: string | null = null;
	for (let i = 0; i < 1000; i++) {
		const params: Record<string, string> = cursor
			? { channelId: channel_id, before: cursor }
			: { channelId: channel_id };
		const res = await request.get('/api/messages', { params });
		expect(res.status()).toBe(200);
		const body: { messages: { messageId: string }[]; hasMore: boolean; nextCursor: string | null } =
			await res.json();
		expect(body.messages.length).toBeLessThanOrEqual(50);
		seen.push(...body.messages.map((m) => m.messageId));
		if (!body.hasMore) {
			expect(body.nextCursor).toBeNull();
			break;
		}
		expect(body.nextCursor).toBe(body.messages.at(-1)!.messageId);
		cursor = body.nextCursor;
	}
	// exact ids (no precision loss), newest first, no duplicates, nothing missing
	expect(seen).toEqual(expected);
});

test('user list links to a user detail page with facts', async ({ page, problems }) => {
	const users = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM discord_accounts`;
	await page.goto('/userdata');
	await expect(page.getByRole('cell', { name: '@user_1', exact: true })).toBeVisible();
	await expect(page.locator('tbody tr')).toHaveCount(Math.min(25, users[0].n));

	const [u] = await sql<{ id: string; nickname: string; facts: number }[]>`
		SELECT v.id::text, v.nickname,
		       (SELECT count(*)::int FROM user_facts_and_activities f WHERE f.user_id = v.id) AS facts
		FROM vestibule_users v JOIN discord_accounts a ON a.vestibule_user_id = v.id
		WHERE a.username = 'user_1'`;
	await page.goto(`/userdata/${u.id}`);
	await expect(page.getByRole('heading', { name: u.nickname })).toBeVisible();
	await expect(page.getByText('Discord accounts')).toBeVisible();
	expect(u.facts).toBeGreaterThan(0);
	await expect(page.getByText('Facts & Activities')).toBeVisible();
	expect(problems).toEqual([]);
});
