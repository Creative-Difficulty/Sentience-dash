import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import postgres from 'postgres';

const dbUrl = process.env.E2E_DATABASE_URL!;
const sql = postgres(dbUrl, { max: 1 });
test.afterAll(async () => {
	await sql.end();
});

test.describe('/api/messages rejects malformed parameters with 400', () => {
	const cases: Record<string, string> = {
		'channelId missing': '',
		'channelId not a number': 'channelId=abc',
		'channelId negative': 'channelId=-1',
		'channelId zero': 'channelId=0',
		'channelId with SQL': "channelId=1001'%20OR%20'1'='1",
		'channelId fractional': 'channelId=1001.5',
		'channelId exponent': 'channelId=1e3',
		'channelId above int64': 'channelId=9223372036854775808',
		'before not a number': 'channelId=1001&before=xyz',
		'before above int64': 'channelId=1001&before=99999999999999999999'
	};
	for (const [name, qs] of Object.entries(cases)) {
		test(name, async ({ request }) => {
			const res = await request.get(`/api/messages?${qs}`);
			expect(res.status()).toBe(400);
			const text = await res.text();
			expect(text).not.toMatch(/select|query|postgres/i);
		});
	}

	test('max int64 is accepted (empty channel)', async ({ request }) => {
		const res = await request.get('/api/messages?channelId=9223372036854775807');
		expect(res.status()).toBe(200);
		expect(await res.json()).toEqual({ messages: [], hasMore: false, nextCursor: null });
	});
});

test.describe('/userdata/[id]', () => {
	test('non-UUID id is a 404 and leaks no SQL', async ({ request }) => {
		const res = await request.get('/userdata/not-a-uuid');
		expect(res.status()).toBe(404);
		const html = await res.text();
		expect(html).not.toMatch(/Failed query|select |invalid input syntax/i);
	});

	test('unknown UUID is a 404', async ({ request }) => {
		const res = await request.get('/userdata/ffffffff-ffff-4fff-8fff-ffffffffffff');
		expect(res.status()).toBe(404);
	});
});

test('responses carry a CSP and security headers', async ({ request }) => {
	for (const path of ['/', '/explorer', '/userdata']) {
		const res = await request.get(path);
		const h = res.headers();
		const csp = h['content-security-policy'] ?? '';
		expect(csp, path).toContain("default-src 'self'");
		expect(csp, path).toContain("object-src 'none'");
		expect(csp, path).toContain("frame-ancestors 'none'");
		expect(csp, path).toMatch(/script-src 'self' 'nonce-[^']+'/);
		expect(h['x-content-type-options'], path).toBe('nosniff');
		expect(h['x-frame-options'], path).toBe('DENY');
		expect(h['referrer-policy'], path).toBe('no-referrer');
	}
	const api = await request.get('/api/messages?channelId=1001');
	expect(api.headers()['x-content-type-options']).toBe('nosniff');
});

test('reply previews never reveal the content of deleted messages', async ({ request }) => {
	const rows = await sql<{ id: string; channel: string; parent: string }[]>`
		SELECT m.message_id::text AS id, m.channel_id::text AS channel, p.message_id::text AS parent
		FROM messages m JOIN messages p ON p.message_id = m.in_reply_to
		WHERE m.deleted_at IS NULL AND p.deleted_at IS NOT NULL
		ORDER BY m.message_id DESC LIMIT 1`;
	expect(rows.length, 'seed has a reply to a deleted message').toBe(1);
	const { id, channel } = rows[0];
	const res = await request.get(
		`/api/messages?channelId=${channel}&before=${(BigInt(id) + 1n).toString()}`
	);
	const body = await res.json();
	const msg = body.messages.find((m: { messageId: string }) => m.messageId === id);
	expect(msg).toBeTruthy();
	expect(msg.inReplyTo).toBe(rows[0].parent);
	expect(msg.reply).toBeNull();
});

test.describe('optional HTTP basic auth', () => {
	const port = Number(process.env.E2E_PORT ?? 4173) + 1;
	const base = `http://127.0.0.1:${port}`;
	let server: ChildProcess;

	test.beforeAll(async () => {
		server = spawn('node', ['build'], {
			env: {
				...process.env,
				DATABASE_URL: dbUrl,
				PORT: String(port),
				HOST: '127.0.0.1',
				DASH_BASIC_AUTH_USER: 'admin',
				DASH_BASIC_AUTH_PASSWORD: 'correct horse'
			},
			stdio: 'ignore'
		});
		for (let i = 0; i < 100; i++) {
			try {
				await fetch(`${base}/robots.txt`);
				return;
			} catch {
				await new Promise((r) => setTimeout(r, 100));
			}
		}
		throw new Error('auth server did not start');
	});
	test.afterAll(() => {
		server?.kill();
	});

	const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;

	test('pages and API require credentials', async () => {
		for (const path of ['/', '/explorer', '/userdata', '/api/messages?channelId=1001']) {
			const res = await fetch(base + path);
			expect(res.status, path).toBe(401);
			expect(res.headers.get('www-authenticate')).toMatch(/^Basic realm=/);
		}
		const wrong = await fetch(`${base}/`, { headers: { authorization: basic('admin', 'nope') } });
		expect(wrong.status).toBe(401);
		const wrongUser = await fetch(`${base}/`, {
			headers: { authorization: basic('root', 'correct horse') }
		});
		expect(wrongUser.status).toBe(401);
	});

	test('correct credentials are accepted', async () => {
		const res = await fetch(`${base}/api/messages?channelId=1001`, {
			headers: { authorization: basic('admin', 'correct horse') }
		});
		expect(res.status).toBe(200);
		expect((await res.json()).messages.length).toBe(50);
	});

	test('robots.txt and /healthz stay public', async () => {
		expect((await fetch(`${base}/robots.txt`)).status).toBe(200);
		expect((await fetch(`${base}/healthz`)).status).not.toBe(401);
	});
});
