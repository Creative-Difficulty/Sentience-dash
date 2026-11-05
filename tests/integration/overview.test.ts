// Runs the overview page's server `load` against a real seeded database.
//
// INTEGRATION_DATABASE_URL must point at a THROWAWAY database with
// unidb-schema + tests/e2e/seed.sql loaded: the test temporarily sets the
// database's TimeZone and inserts (then removes) an ingest-style placeholder
// message.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';

const url = process.env.INTEGRATION_DATABASE_URL;

type Overview = {
	twentyfourHourChart: { hour: number; count: number }[];
	totalMessages: number;
	totalMessagesLasttwoFourH: number;
	totalMessagesprevTwoFourH: number;
	allTimeChart: { day: number; count: number }[];
	totalHourlyMessages: { hour: number | string; messageAmount: number }[];
	error?: string;
};

describe.skipIf(!url)('overview load()', () => {
	let admin: postgres.Sql;
	let data: Overview;
	let expected: {
		total: number;
		last24: number;
		prev24: number;
		byUtcHour: Map<number, number>;
		last24Buckets: { hour: number; count: number }[];
		days: number;
	};
	// ingest inserts this for reply parents that no longer exist on Discord
	const PLACEHOLDER_ID = '199999999999999999';

	beforeAll(async () => {
		admin = postgres(url!, { max: 1, onnotice: () => {} });
		const [{ db }] = await admin<{ db: string }[]>`SELECT current_database() AS db`;
		// A session TimeZone far from UTC (+13:45 / +12:45 with DST).
		await admin.unsafe(`ALTER DATABASE "${db}" SET timezone = 'Pacific/Chatham'`);
		await admin`
			INSERT INTO messages (message_id, channel_id, sent_by, content, sent_at, deleted_at)
			SELECT ${PLACEHOLDER_ID}::bigint, 1001, discord_user_id, '[deleted message]',
			       TIMESTAMPTZ '1970-01-01 00:00:00+00', TIMESTAMPTZ '1970-01-01 00:00:00+00'
			FROM discord_accounts ORDER BY discord_user_id LIMIT 1
			ON CONFLICT DO NOTHING`;

		const [t] = await admin<{ total: number; last24: number; prev24: number; days: number }[]>`
			SELECT
			  count(*) FILTER (WHERE deleted_at IS NULL)::int AS total,
			  count(*) FILTER (WHERE deleted_at IS NULL
			    AND sent_at >= date_trunc('hour', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' - interval '23 hours')::int AS last24,
			  count(*) FILTER (WHERE deleted_at IS NULL
			    AND sent_at >= now() - interval '48 hours' AND sent_at < now() - interval '24 hours')::int AS prev24,
			  (date_trunc('day', now() AT TIME ZONE 'UTC')::date
			     - min(date_trunc('day', sent_at AT TIME ZONE 'UTC')) FILTER (WHERE deleted_at IS NULL)::date + 1)::int AS days
			FROM messages`;
		const hours = await admin<{ hour: number; n: number }[]>`
			SELECT extract(hour FROM sent_at AT TIME ZONE 'UTC')::int AS hour, count(*)::int AS n
			FROM messages WHERE deleted_at IS NULL GROUP BY 1`;
		// one bucket per UTC hour, oldest first; hour 0 = the current UTC hour
		const buckets = await admin<{ hour: number; count: number }[]>`
			SELECT h AS hour, (
			  SELECT count(*)::int FROM messages
			  WHERE deleted_at IS NULL
			    AND sent_at >= (date_trunc('hour', now() AT TIME ZONE 'UTC') - h * interval '1 hour') AT TIME ZONE 'UTC'
			    AND sent_at < (date_trunc('hour', now() AT TIME ZONE 'UTC') - (h - 1) * interval '1 hour') AT TIME ZONE 'UTC'
			) AS count
			FROM generate_series(23, 0, -1) h`;
		expected = {
			...t,
			byUtcHour: new Map(hours.map((h) => [h.hour, h.n])),
			last24Buckets: buckets.map((b) => ({ hour: b.hour, count: b.count }))
		};

		process.env.DATABASE_URL = url;
		const { load } = await import('../../src/routes/+page.server');
		data = (await (load as unknown as () => Promise<Overview>)()) as Overview;
	});

	afterAll(async () => {
		if (!admin) return;
		const [{ db }] = await admin<{ db: string }[]>`SELECT current_database() AS db`;
		await admin.unsafe(`ALTER DATABASE "${db}" RESET timezone`);
		await admin`DELETE FROM messages WHERE message_id = ${PLACEHOLDER_ID}::bigint`;
		await admin.end();
		const { default: db2 } = await import('../../src/lib');
		await (db2.$client as postgres.Sql).end();
	});

	it('loads without error', () => {
		expect(data.error).toBeUndefined();
	});

	it('24h chart: 24 UTC-hour buckets, deleted messages excluded', () => {
		expect(data.twentyfourHourChart).toHaveLength(24);
		expect(data.twentyfourHourChart.map((b) => ({ hour: b.hour, count: b.count }))).toEqual(
			expected.last24Buckets
		);
		const sum = data.twentyfourHourChart.reduce((a, b) => a + b.count, 0);
		expect(sum).toBe(expected.last24);
		expect(data.totalMessagesLasttwoFourH).toBe(expected.last24);
	});

	it('previous-24h count excludes deleted messages', () => {
		expect(data.totalMessagesprevTwoFourH).toBe(expected.prev24);
	});

	it('all-time chart: one bucket per UTC day since the first real message, deleted excluded', () => {
		expect(data.allTimeChart).toHaveLength(expected.days);
		const sum = data.allTimeChart.reduce((a, b) => a + b.count, 0);
		expect(sum).toBe(data.totalMessages);
		expect(data.totalMessages).toBe(expected.total);
	});

	it('hour-of-day chart is in UTC regardless of the session TimeZone', () => {
		const got = new Map(data.totalHourlyMessages.map((h) => [Number(h.hour), h.messageAmount]));
		expect(got).toEqual(expected.byUtcHour);
	});
});
