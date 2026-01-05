FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

COPY pnpm-workspace.yaml package.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app
RUN pnpm -r install --frozen-lockfile || pnpm -r install

WORKDIR /app/apps/api
RUN pnpm build

EXPOSE 8080
CMD ["node","dist/server.js"]
