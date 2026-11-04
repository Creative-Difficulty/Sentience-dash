# CLAUDE.md — Sentience-dash

Full system spec: https://github.com/Vimothy-s-Vestibule/unidb-schema/blob/main/docs/SPEC.md
(lands with the unidb-schema docs PR; until merged, read `docs/SPEC.md` on that branch). §6 has every table with its
SQL / Rust / drizzle types, §7.4 the `/api/messages` contract.

## What this repo is

Read-only web dashboard for Sentience. SvelteKit 2 + Svelte 5 (runes forced on, `svelte.config.js`), adapter-node,
bun, drizzle-orm over `postgres` (postgres-js), carbon-components-svelte + @carbon/charts-svelte. It queries the shared
**unidb** Postgres directly; there is no backend of its own and no auth.

- **unidb-schema** owns the schema. `src/lib/server/db/schema.ts` is a **hand-written mirror** — never the source of truth.
- **sentience-workers** fills the tables: ingest (Discord messages, users, channels, reactions, attachments),
  fact-extractor (`user_facts_and_activities`), topic-sorter (`topic`, `topic_message_relation`). Its docker-compose does
  not include this app; it only needs to reach the same Postgres.

| Route                              | Server file                                            | Shows                                                                                        |
| ---------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `/`                                | `src/routes/+page.server.ts`                           | activity charts and top users                                                                |
| `/explorer`                        | `src/routes/explorer/+page.server.ts` + `+page.svelte` | channel picker; chat view fed by `/api/messages`, infinite scroll upwards, topic colouring   |
| `/api/messages?channelId=&before=` | `src/routes/api/messages/+server.ts`                   | 50 msgs/page, newest first, `{messages, hasMore, nextCursor}`; pass `nextCursor` as `before` |
| `/userdata`                        | `src/routes/userdata/+page.server.ts`                  | all Discord accounts + message counts                                                        |
| `/userdata/[id]`                   | `src/routes/userdata/[id]/+page.server.ts`             | `[id]` = vestibule user UUID: facts, accounts, ≤1000 messages                                |

## Commands (verified on main, bun 1.4.4)

```sh
bun install --frozen-lockfile
cp .env.example .env            # set DATABASE_URL=postgres://… (a local/dev DB with the unidb schema)
bun run dev                     # vite dev server
bun run check                   # svelte-check: 0 errors, 0 warnings
bun run lint                    # prettier --check . && eslint .  → FAILS on main (prettier, 6 files); eslint alone passes
bun run format                  # prettier --write .
DATABASE_URL=postgres://… bun run build        # build/ (adapter-node)
DATABASE_URL=postgres://… PORT=3000 bun run build/index.js
```

- `bun run build` **without** `DATABASE_URL` fails (`Error: DATABASE_URL is not set`, thrown at import of
  `src/lib/server/db/index.ts` during SvelteKit's post-build analysis). This also breaks `docker build .`; a fix is in
  flight. Until then pass `DATABASE_URL` to the build.
- There are **no tests** and no CI.
- Local DB with the unidb schema (from a sibling unidb-schema checkout):

  ```sh
  docker run -d --name unidb-local -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sentience \
    -p 127.0.0.1:5433:5432 pgvector/pgvector:pg17-trixie
  cat ../unidb-schema/schema/*.sql | docker exec -i unidb-local psql -U postgres -d sentience -v ON_ERROR_STOP=1
  ```

- **Never run `bun run db:push`, `db:migrate` or `db:generate` against a unidb database.** The drizzle mirror is lossy
  (see Gotchas) and `drizzle-kit push` would alter or drop shared tables used by the workers. `db:studio` can edit rows
  too — only use it on a local database.

## Environment

| Var            | Required                      | Notes                                                                                     |
| -------------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL` | yes, at **runtime and build** | read via `$env/dynamic/private` (`src/lib/server/db/index.ts`) and by `drizzle.config.ts` |
| `HOST`, `PORT` | no                            | adapter-node; Dockerfile sets `0.0.0.0` / `3000`                                          |
| `NODE_ENV`     | no                            | `production` makes vite bundle `@carbon/charts` for SSR (`vite.config.ts`)                |

## Conventions

- Drizzle tables/columns are camelCase TS identifiers with explicit snake_case SQL names
  (`sentAt: timestamp("sent_at", …)`). SQL and Rust are snake_case.
- **Snowflakes**: drizzle declares `bigint(..., { mode: "number" })`, which silently loses precision above 2^53. Any
  snowflake returned to the client must be selected as text: ``sql<string>`${messages.messageId}::text` `` (as all
  existing loaders do). Filter on the bigint column with the value cast in SQL, e.g.
  ``sql`${messages.channelId} = ${channelIdStr}::bigint` `` (validate it is numeric first); avoid the existing
  `${col}::text IN (...)` pattern, which defeats the bigint indexes.
- Timestamps use `mode: 'string'`: values are raw Postgres text such as `2026-11-04 02:18:52.534242+00`; their
  format depends on the DB session `TimeZone`.
- Deleted messages: filter `isNull(messages.deletedAt)`. Placeholders for vanished reply parents have
  `sent_by = 0` (account `deleteduser`), `content = '[deleted message]'`, `sent_at = deleted_at = 1970-01-01`.
- Topic: a message has at most one topic in practice; the API takes the first relation row.
- `$lib` (`src/lib/index.ts`) default-exports the server `db`. Import it only from `+page.server.ts` / `+server.ts`
  files, never from `.svelte` components.
- Svelte 5 runes (`$props`, `$state`, `$derived`); Carbon components; tabs, single quotes, width 100 (`.prettierrc`).

## Schema changes

Made in unidb-schema first (SQL + Rust model), then mirror them by hand in `src/lib/server/db/schema.ts`, then update
the queries here. Never introspect-and-push. Keep the drizzle declaration's column names/types equal to the SQL.

## Gotchas

- Known drizzle drift: `vestibule_users.intro_message_id` declared `text` (SQL `bigint`); `current_diagram` /
  `intro_diagram` declared `vector(1536)` (SQL `bytea`); vector columns declare 1536 dims (SQL has none);
  `discord_channel_type` lists `public_thread` last; evidence UNIQUE lacks `NULLS NOT DISTINCT`.
- No authentication; the app exposes every message and LLM-inferred personal facts. Do not expose it publicly.
- Loaders return `{ error: e.toString() }` and the layout shows it in a toast → raw SQL/params leak to the browser.
- `/api/messages` does not validate `channelId` / `before`: non-numeric input → 500.
- Overview SQL depends on the session time zone (`EXTRACT(HOUR …)`, `!= TIMESTAMP '1970-01-01 00:00:00'`); the 24 h
  chart counts deleted messages, totals exclude them.
- Layout uses a fixed `margin-left: 256px` with Carbon `SideNav isOpen fixed` — "janky on smaller screens" (README).
- Attachments are listed by S3 object key only (no download); custom emoji images are hot-linked from Discord's CDN.
