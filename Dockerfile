# Soma Promotora CRM — Node + Nitro (TanStack Start) para Easypanel
# Doc: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
# Porta interna: 3000
#
# Importante: o `vite build` DEVE rodar sob Node (não `bun run`), senão o Nitro/srvx
# embute Bun.serve e o container Node cai com "Bun is not defined".

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
# Usa o Node embutido na imagem Bun — evita preset Bun no output
RUN node ./node_modules/vite/bin/vite.js build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# App sempre em 3000. Entrypoint ignora PORT=80 injetado pelo Easypanel.
ENV PORT=3000
ENV NITRO_PORT=3000
ENV HOST=0.0.0.0
ENV NITRO_HOST=0.0.0.0

COPY --from=build /app/.output ./.output
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh \
  && groupadd -r app \
  && useradd -r -g app app \
  && chown -R app:app /app

USER app
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
