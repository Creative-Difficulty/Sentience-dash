import { describe, expect, it } from 'vitest';
import { is } from 'drizzle-orm';
import { PgTable, getTableConfig, type PgColumn } from 'drizzle-orm/pg-core';
import * as schema from './schema';

// int8 columns holding small counters; every other int8 column is a Discord
// snowflake (current ids are ~1.4e18, far above Number.MAX_SAFE_INTEGER).
const COUNTERS = new Set([
	'media_assets.size_bytes',
	'youtube_videos.total_views',
	'youtube_videos.total_likes',
	'youtube_videos.total_comments'
]);

const int8Columns = Object.values(schema as Record<string, unknown>)
	.filter((v): v is PgTable => is(v, PgTable))
	.flatMap((t) => {
		const cfg = getTableConfig(t);
		return (cfg.columns as PgColumn[])
			.filter((c) => c.getSQLType() === 'bigint')
			.map((c) => ({ id: `${cfg.name}.${c.name}`, col: c }));
	});

const snowflakeColumns = int8Columns.filter((c) => !COUNTERS.has(c.id));

describe('snowflake columns keep full int8 precision', () => {
	it('finds the snowflake columns', () => {
		expect(snowflakeColumns.length).toBeGreaterThanOrEqual(19);
	});

	// postgres-js hands int8 values to drizzle as decimal strings
	const samples = ['9007199254740993', '1234567890123456789', '9223372036854775807'];

	it.each(snowflakeColumns.map((c) => [c.id, c.col] as const))(
		'%s round-trips without rounding',
		(_id, col) => {
			for (const s of samples) {
				expect(String(col.mapFromDriverValue(s))).toBe(s);
				expect(String(col.mapToDriverValue(s))).toBe(s);
			}
		}
	);
});
