// Refuses to run drizzle-kit commands that WRITE to the database
// (`push`, `migrate`) unless explicitly unlocked.
//
// The database this dashboard reads is the shared `unidb` schema owned by the
// unidb-schema repository (schema/*.sql). The drizzle schema in
// src/lib/server/db/schema.ts is only a hand-written mirror of it. Running
// `drizzle-kit push` against unidb would "reconcile" the real schema towards
// that mirror (dropping/altering columns, constraints, triggers and indexes it
// does not know about) and `drizzle-kit migrate` would create its own
// bookkeeping tables in it. Both are almost never what you want.
//
// Usage: node scripts/guard-schema-write.mjs && drizzle-kit push
// Unlock: DASH_ALLOW_SCHEMA_WRITE=yes-i-know-this-mutates-unidb
const UNLOCK = 'yes-i-know-this-mutates-unidb';

if (process.env.DASH_ALLOW_SCHEMA_WRITE !== UNLOCK) {
	console.error(
		[
			'Refusing to run a drizzle-kit command that writes to the database.',
			'The unidb schema is owned by the unidb-schema repository (schema/*.sql);',
			'src/lib/server/db/schema.ts is only a mirror and must not be pushed.',
			`If you really mean it (e.g. a throwaway local DB), set DASH_ALLOW_SCHEMA_WRITE=${UNLOCK}`
		].join('\n')
	);
	process.exit(1);
}
