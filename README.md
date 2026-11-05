# Sentience dashboard

![Sentience dashboard](sentience.png)

This is the dashboard used to display all information gathered by the sentience bot. It uses SvelteKit and the IBM carbon components for Svelte as well as the carbon charts for svelte library. It also holds a conversation explorer page with data on all recorded messages and highlights them into topics (classified by `topic-sorter`) and a User data page with facts the the `fact-extractor` worker has extracted about users.
The site is not completely finished just yet, and is bit janky on smaller screens, as I have struggeled to get carbon components and carbon charts to accept anyhting other than fixed pixel values for size.

## Installation

It is dockerized, however not included in the docker-compose with the main sentience workers, as it lives in a different repository.
The docker installation exposes port 3000 for the site, visit `localhost:3000` on your machine to access it.

Make sure to pass in the `DATABASE_URL` to docker when running the image, otherwise the site will not work properly.

## Contribution

Please refer to the guide in the main sentience-workers repository.

## Credits

The owl drawing, which is displayed in the bottom left corner, as well as used as a favicon, was created by Sylvan Franklin: <https://sylvanfranklin.com>, provided by him and used with his permission.

## Development

```sh
bun install --frozen-lockfile
DATABASE_URL=postgres://user:pass@localhost:5432/unidb bun run dev
bun run lint    # prettier --check + eslint
bun run check   # svelte-check
```

### Database scripts

The database schema is owned by the `unidb-schema` repository (`schema/*.sql`); `src/lib/server/db/schema.ts` is only a hand-written mirror of it. `drizzle-kit push` would try to make the real database match that mirror (it drops constraints, indexes and changes column types it does not know about) and `drizzle-kit migrate` would add its own bookkeeping tables, so these are only available as `db:push:unsafe` / `db:migrate:unsafe` and refuse to run unless `DASH_ALLOW_SCHEMA_WRITE=yes-i-know-this-mutates-unidb` is set. Never run them against a shared database.

### Access control and security headers

The dashboard shows every recorded message and the facts the LLM inferred about users, so do not expose it publicly without access control. There is an optional built-in HTTP Basic auth gate (off by default):

```sh
DASH_BASIC_AUTH_USER=admin DASH_BASIC_AUTH_PASSWORD='long random secret' node build
```

- Enabled only when **both** variables are set; if only one is set every request gets a 500 (fails closed).
- Credentials are compared in constant time. Basic auth sends the password with every request, so only use it behind HTTPS (e.g. a TLS-terminating reverse proxy). For SSO, put the dashboard behind an authenticating proxy instead and leave these unset.
- `/robots.txt` and `/healthz` stay public; the hashed static build assets under `/_app` are served before the auth hook and contain no data.

Every page is served with a Content-Security-Policy (`kit.csp` in `svelte.config.js`; scripts are nonce-based, inline style attributes are allowed because Svelte/carbon use them, fonts come from IBM's CDN, emoji images from Discord's CDN) plus `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` and `Permissions-Policy` (`src/hooks.server.ts`). Database errors are logged on the server and the UI only shows a generic message.

### Tests

```sh
bun run test:unit                                   # unit + property tests (FC_NUM_RUNS=2000 by default)
CONTRACT_DATABASE_URL=postgres://... bun run test:contract   # drizzle schema vs a DB with unidb-schema applied
E2E_DATABASE_URL=postgres://... bun run test:e2e    # Playwright smoke; DB needs unidb-schema + tests/e2e/seed.sql
bun run test:mutation                               # Stryker on the pure modules
```
