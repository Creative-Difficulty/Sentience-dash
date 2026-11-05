# SvelteKit (adapter-node) dashboard, served by bun.
#
#   docker build -t sentience-dash .
#   docker run -p 3000:3000 -e DATABASE_URL=postgres://... sentience-dash
#
# The build needs no database: the DB client is created on first request.

# Pinned by version AND digest; bump both together.
ARG BUN_IMAGE=oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a

FROM ${BUN_IMAGE} AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM ${BUN_IMAGE} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM ${BUN_IMAGE} AS runtime
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="sentience-dash" \
      org.opencontainers.image.description="Sentience dashboard (SvelteKit, adapter-node)" \
      org.opencontainers.image.source="https://github.com/Creative-Difficulty/Sentience-dash" \
      org.opencontainers.image.revision="${VCS_REF}"
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Only runtime `dependencies` are installed; devDependencies (drizzle, postgres,
# ...) are bundled into build/ by adapter-node.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production \
    && rm -rf /root/.bun/install/cache

# App files stay root-owned and read-only for the unprivileged `bun` user.
COPY --from=build /app/build ./build

EXPOSE 3000
USER bun
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1
CMD ["bun", "run", "build/index.js"]
