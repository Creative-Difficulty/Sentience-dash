FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production && \
    rm -rf /root/.bun/install/cache

COPY --from=build /app/build ./build

EXPOSE 3000
USER bun
CMD ["bun", "run", "build/index.js"]
