# syntax=docker/dockerfile:1
# Build context: a repó gyökere (docker-compose.yml: build.context = .)

# --- függőségek (a natív better-sqlite3-hoz build eszközök kellenek, ha nincs előre fordított bináris) ---
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mcp/package.json apps/mcp/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev -w @taskflow/api --include-workspace-root=false

# --- futtatókörnyezet ---
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=/data/taskflow.db
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/shared packages/shared
COPY apps/mcp apps/mcp
COPY apps/api apps/api
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
WORKDIR /app/apps/api
# A migrációk az indulásakor automatikusan lefutnak (src/index.ts).
CMD ["node", "--import", "tsx", "src/index.ts"]
