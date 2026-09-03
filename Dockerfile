# Multi-stage build: full deps → build SPA, prod deps → slim runtime.
# The runtime stage needs tsconfig.json: Bun resolves the "@/*" path aliases
# used by server/** from it at runtime.

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install

FROM deps AS build
COPY . .
RUN bun run build

FROM oven/bun:1 AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production

FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json tsconfig.json ./
COPY server ./server
COPY src ./src
EXPOSE 3000
CMD ["bun", "server/index.ts"]
