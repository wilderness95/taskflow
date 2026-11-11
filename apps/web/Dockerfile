# syntax=docker/dockerfile:1
# Build context: a repó gyökere (docker-compose.yml: build.context = .)

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
# A gyökér devDependency-k (typescript) is kellenek a build-hez; a natív api-függőség nem.
RUN npm ci -w @taskflow/web --include-workspace-root --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @taskflow/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
