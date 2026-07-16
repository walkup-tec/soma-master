# Soma Promotora CRM — Node + Nitro (TanStack Start) para Easypanel
# Doc: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
# Doc Nitro PORT: https://nitro.build/deploy/runtimes/node
#
# PORT do Easypanel = porta do domínio/Traefik. App escuta essa porta (ex.: 80).
# Scripts .sh devem ser LF (ver .gitattributes + sed abaixo).

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
ENV PORT=80
ENV NITRO_PORT=80
ENV HOST=0.0.0.0
ENV NITRO_HOST=0.0.0.0

COPY --from=build /app/.output ./.output
COPY docker-entrypoint.sh docker-start.mjs docker-signal-log.mjs ./

# CRLF do Windows quebra shebang/exec no Linux → sem "Listening"
RUN sed -i 's/\r$//' docker-entrypoint.sh \
  && chmod +x docker-entrypoint.sh \
  && sed -i 's/\r$//' docker-start.mjs docker-signal-log.mjs 2>/dev/null || true

# root: bind em portas <1024 (PORT=80 do Easypanel)
EXPOSE 80
ENTRYPOINT ["./docker-entrypoint.sh"]
