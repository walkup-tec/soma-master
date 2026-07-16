# Soma Promotora CRM — Node + Nitro (TanStack Start) para Easypanel
# Doc: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
# Doc Easypanel proxy port: https://easypanel.io/docs/services/app
# Porta interna/proxy: 3000 (igual Sinal Verde). Domínio HTTP no painel = 3000.

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
ENV PORT=3000
ENV NITRO_PORT=3000
ENV HOST=0.0.0.0
ENV NITRO_HOST=0.0.0.0

COPY --from=build /app/.output ./.output
COPY docker-entrypoint.sh docker-start.mjs docker-signal-log.mjs ./

RUN sed -i 's/\r$//' docker-entrypoint.sh \
  && chmod +x docker-entrypoint.sh \
  && sed -i 's/\r$//' docker-start.mjs docker-signal-log.mjs 2>/dev/null || true \
  && groupadd -r app \
  && useradd -r -g app app \
  && chown -R app:app /app

USER app
EXPOSE 3000

# Swarm/Easypanel usam isto para não matar o task antes do Nitro estabilizar.
# Path dedicado ( "/" redireciona para /login → healthcheck com curl -f falha).
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=4 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
