# Soma Promotora CRM — Node + Nitro (TanStack Start) para Easypanel
# Doc: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
# Doc Nitro PORT: https://nitro.build/deploy/runtimes/node
#
# Porta: respeitar PORT do Easypanel (ex.: 80). Domínio HTTP no painel = mesma porta.
# Importante: vite build sob Node (não bun run) — evita "Bun is not defined".

FROM oven/bun:1.3 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DEPLOY_TARGET=node
ENV NITRO_PRESET=node-server
ENV NODE_ENV=production
RUN node ./node_modules/vite/bin/vite.js build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Default se o painel não injetar PORT; Easypanel costuma sobrescrever com 80
ENV PORT=80
ENV NITRO_PORT=80
ENV HOST=0.0.0.0
ENV NITRO_HOST=0.0.0.0

COPY --from=build /app/.output ./.output
COPY docker-entrypoint.sh ./docker-entrypoint.sh
COPY docker-signal-log.mjs ./docker-signal-log.mjs

# root: necessário para bind em :80 (PORT do Easypanel). Sem isso EACCES e restart.
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["./docker-entrypoint.sh"]
