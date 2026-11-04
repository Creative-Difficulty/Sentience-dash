// Contract test: the hand-written drizzle mirror (src/lib/server/db/schema.ts)
// must match the real unidb schema (unidb-schema/schema/*.sql).
//
// Needs CONTRACT_DATABASE_URL pointing at a database on which
// `cat unidb-schema/schema/*.sql | psql` has been applied (no data needed).
// The test only reads the catalog.
//
// Every difference is reported. Differences that are understood and accepted
// are listed in KNOWN_DRIFT with a reason; anything else fails the test, and so
// does a KNOWN_DRIFT entry that no longer occurs (so fixed drift gets removed).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { is } from 'drizzle-orm';
import { PgTable, getTableConfig, isPgEnum, type PgColumn, type PgEnum } from 'drizzle-orm/pg-core';
import * as schema from '../../src/lib/server/db/schema';

const url = process.env.CONTRACT_DATABASE_URL;

// `table.column: problem` -> why it is accepted
const KNOWN_DRIFT: Record<string, string> = {
	'foreign key vestibule_users(intro_message_id) -> messages(message_id): missing in drizzle':
		'circular table reference (messages -> discord_accounts -> vestibule_users -> messages) ' +
		"breaks drizzle's type inference; the dashboard never writes vestibule_users"
};

// int8 columns that hold small counters and may safely map to a JS number.
// Everything else that is int8 is a Discord snowflake (> 2^53) and must not.
const SAFE_NUMBER_BIGINTS = new Set([
	'media_assets.size_bytes',
	'youtube_videos.total_views',
	'youtube_videos.total_likes',
	'youtube_videos.total_comments'
]);

type DbColumn = {
	table: string;
	column: string;
	type: string;
	not_null: boolean;
	has_default: boolean;
};

const normType = (t: string) =>
	t
		.toLowerCase()
		.replace(/"/g, '')
		.replace(/^public\./, '')
		.replace(/\s+/g, ' ')
		.trim();

const drizzleTables = Object.values(schema as Record<string, unknown>).filter((v): v is PgTable =>
	is(v, PgTable)
);
const drizzleEnums = Object.values(schema as Record<string, unknown>).filter(
	(v): v is PgEnum<[string, ...string[]]> => isPgEnum(v)
);

describe.skipIf(!url)('drizzle schema matches the unidb catalog', () => {
	let sql: postgres.Sql;
	let dbColumns: DbColumn[];
	let dbPks: Map<string, string[]>;
	let dbUniques: Set<string>;
	let dbEnums: Map<string, string[]>;
	let dbFks: Set<string>;
	let dbIndexes: Set<string>;
	let dbChecks: Set<string>;
	const drift: string[] = [];

	beforeAll(async () => {
		sql = postgres(url!, { max: 1, onnotice: () => {} });
		dbColumns = await sql<DbColumn[]>`
			SELECT c.relname AS table, a.attname AS column,
			       format_type(a.atttypid, a.atttypmod) AS type,
			       a.attnotnull AS not_null, a.atthasdef AS has_default
			FROM pg_attribute a
			JOIN pg_class c ON c.oid = a.attrelid
			JOIN pg_namespace n ON n.oid = c.relnamespace
			WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
			  AND a.attnum > 0 AND NOT a.attisdropped
			ORDER BY c.relname, a.attnum`;
		const pkRows = await sql<{ table: string; cols: string[] }[]>`
			SELECT c.relname AS table,
			       array_agg(a.attname ORDER BY array_position(i.indkey, a.attnum)) AS cols
			FROM pg_index i
			JOIN pg_class c ON c.oid = i.indrelid
			JOIN pg_namespace n ON n.oid = c.relnamespace
			JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (i.indkey)
			WHERE n.nspname = 'public' AND i.indisprimary
			GROUP BY c.relname`;
		dbPks = new Map(pkRows.map((r) => [r.table, [...r.cols].sort()]));
		const uqRows = await sql<{ table: string; cols: string[] }[]>`
			SELECT c.relname AS table,
			       array_agg(a.attname ORDER BY a.attname) AS cols
			FROM pg_constraint k
			JOIN pg_class c ON c.oid = k.conrelid
			JOIN pg_namespace n ON n.oid = c.relnamespace
			JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (k.conkey)
			WHERE n.nspname = 'public' AND k.contype = 'u'
			GROUP BY k.oid, c.relname`;
		dbUniques = new Set(uqRows.map((r) => `${r.table}(${r.cols.join(',')})`));
		const enumRows = await sql<{ name: string; labels: string[] }[]>`
			SELECT t.typname AS name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
			FROM pg_type t
			JOIN pg_enum e ON e.enumtypid = t.oid
			JOIN pg_namespace n ON n.oid = t.typnamespace
			WHERE n.nspname = 'public'
			GROUP BY t.typname`;
		dbEnums = new Map(enumRows.map((r) => [r.name, r.labels]));
		const fkRows = await sql<{ sig: string }[]>`
			SELECT c.relname || '(' ||
			         (SELECT string_agg(a.attname, ',' ORDER BY u.ord)
			            FROM unnest(k.conkey) WITH ORDINALITY u(attnum, ord)
			            JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.attnum)
			       || ') -> ' || f.relname || '(' ||
			         (SELECT string_agg(a.attname, ',' ORDER BY u.ord)
			            FROM unnest(k.confkey) WITH ORDINALITY u(attnum, ord)
			            JOIN pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = u.attnum)
			       || ')' AS sig
			FROM pg_constraint k
			JOIN pg_class c ON c.oid = k.conrelid
			JOIN pg_class f ON f.oid = k.confrelid
			JOIN pg_namespace n ON n.oid = c.relnamespace
			WHERE n.nspname = 'public' AND k.contype = 'f'`;
		dbFks = new Set(fkRows.map((r) => r.sig));
		// plain indexes only (not the ones backing PRIMARY KEY / UNIQUE constraints)
		const idxRows = await sql<{ sig: string }[]>`
			SELECT c.relname || '.' || i.relname AS sig
			FROM pg_index x
			JOIN pg_class i ON i.oid = x.indexrelid
			JOIN pg_class c ON c.oid = x.indrelid
			JOIN pg_namespace n ON n.oid = c.relnamespace
			WHERE n.nspname = 'public'
			  AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = x.indexrelid)`;
		dbIndexes = new Set(idxRows.map((r) => r.sig));
		const ckRows = await sql<{ sig: string }[]>`
			SELECT c.relname || '.' || k.conname AS sig
			FROM pg_constraint k
			JOIN pg_class c ON c.oid = k.conrelid
			JOIN pg_namespace n ON n.oid = c.relnamespace
			WHERE n.nspname = 'public' AND k.contype = 'c'`;
		dbChecks = new Set(ckRows.map((r) => r.sig));
	});

	afterAll(async () => {
		await sql?.end();
	});

	it('reports every drift and fails on unknown drift', () => {
		const dbByTable = new Map<string, Map<string, DbColumn>>();
		for (const c of dbColumns) {
			if (!dbByTable.has(c.table)) dbByTable.set(c.table, new Map());
			dbByTable.get(c.table)!.set(c.column, c);
		}

		const seenTables = new Set<string>();
		for (const table of drizzleTables) {
			const cfg = getTableConfig(table);
			seenTables.add(cfg.name);
			const dbCols = dbByTable.get(cfg.name);
			if (!dbCols) {
				drift.push(`${cfg.name}: table missing in database`);
				continue;
			}
			const seenCols = new Set<string>();
			for (const col of cfg.columns as PgColumn[]) {
				const id = `${cfg.name}.${col.name}`;
				seenCols.add(col.name);
				const db = dbCols.get(col.name);
				if (!db) {
					drift.push(`${id}: column missing in database`);
					continue;
				}
				const dzType = normType(col.getSQLType());
				const dbType = normType(db.type);
				if (dzType !== dbType) drift.push(`${id}: type drizzle=${dzType} db=${dbType}`);
				if (col.notNull !== db.not_null)
					drift.push(`${id}: nullability drizzle notNull=${col.notNull} db notNull=${db.not_null}`);
				if (col.hasDefault !== db.has_default)
					drift.push(`${id}: default drizzle=${col.hasDefault} db=${db.has_default}`);
				if (dbType === 'bigint' && col.columnType === 'PgBigInt53' && !SAFE_NUMBER_BIGINTS.has(id))
					drift.push(
						`${id}: int8 snowflake mapped to JS number (mode 'number') - loses precision above 2^53`
					);
				if (col.isUnique && !dbUniques.has(`${cfg.name}(${col.name})`))
					drift.push(`${id}: unique in drizzle but not in database`);
			}
			for (const name of dbCols.keys()) {
				if (!seenCols.has(name)) drift.push(`${cfg.name}.${name}: column missing in drizzle`);
			}

			const dzPk = [
				...(cfg.columns as PgColumn[]).filter((c) => c.primary).map((c) => c.name),
				...cfg.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name))
			].sort();
			const dbPk = dbPks.get(cfg.name) ?? [];
			if (dzPk.join(',') !== dbPk.join(','))
				drift.push(`${cfg.name}: primary key drizzle=(${dzPk}) db=(${dbPk})`);

			for (const uq of cfg.uniqueConstraints) {
				const key = `${cfg.name}(${uq.columns
					.map((c) => c.name)
					.sort()
					.join(',')})`;
				if (!dbUniques.has(key)) drift.push(`${key}: unique in drizzle but not in database`);
			}
		}
		for (const t of dbByTable.keys()) {
			if (!seenTables.has(t)) drift.push(`${t}: table missing in drizzle`);
		}

		// foreign keys, indexes and check constraints (by signature / name)
		const dzFks = new Set<string>();
		const dzIndexes = new Set<string>();
		const dzChecks = new Set<string>();
		for (const table of drizzleTables) {
			const cfg = getTableConfig(table);
			for (const fk of cfg.foreignKeys) {
				const ref = fk.reference();
				const ft = getTableConfig(ref.foreignTable).name;
				dzFks.add(
					`${cfg.name}(${ref.columns.map((c) => c.name)}) -> ${ft}(${ref.foreignColumns.map((c) => c.name)})`
				);
			}
			for (const idx of cfg.indexes) dzIndexes.add(`${cfg.name}.${idx.config.name}`);
			for (const ck of cfg.checks) dzChecks.add(`${cfg.name}.${ck.name}`);
		}
		const diffSets = (kind: string, dz: Set<string>, db: Set<string>) => {
			for (const x of db) if (!dz.has(x)) drift.push(`${kind} ${x}: missing in drizzle`);
			for (const x of dz) if (!db.has(x)) drift.push(`${kind} ${x}: missing in database`);
		};
		diffSets('foreign key', dzFks, dbFks);
		diffSets('index', dzIndexes, dbIndexes);
		diffSets('check', dzChecks, dbChecks);

		const seenEnums = new Set<string>();
		for (const e of drizzleEnums) {
			seenEnums.add(e.enumName);
			const db = dbEnums.get(e.enumName);
			if (!db) drift.push(`enum ${e.enumName}: missing in database`);
			else if (db.join(',') !== e.enumValues.join(','))
				drift.push(`enum ${e.enumName}: drizzle=[${e.enumValues}] db=[${db}]`);
		}
		for (const name of dbEnums.keys()) {
			if (!seenEnums.has(name)) drift.push(`enum ${name}: missing in drizzle`);
		}

		console.log(
			`schema contract: ${drizzleTables.length} drizzle tables, ${dbByTable.size} db tables, ` +
				`${drift.length} drift(s)\n` +
				drift.map((d) => `  - ${d}${KNOWN_DRIFT[d] ? '  [known]' : ''}`).join('\n')
		);

		const unknown = drift.filter((d) => !(d in KNOWN_DRIFT));
		const stale = Object.keys(KNOWN_DRIFT).filter((d) => !drift.includes(d));
		expect(unknown, 'unexpected schema drift').toEqual([]);
		expect(stale, 'KNOWN_DRIFT entries that no longer occur').toEqual([]);
	});
});

describe.skipIf(!!url)('schema contract (skipped)', () => {
	it.skip('set CONTRACT_DATABASE_URL to a database with unidb-schema/schema/*.sql applied', () => {});
});
