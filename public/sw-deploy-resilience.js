/**
 * Service worker Soma — mantém a shell do app disponível durante redeploy.
 * Se uma navegação retornar 502/503/504 ou o JSON de erro do Traefik
 * ("Cannot GET /api/errors/bad-gateway"), devolve a última shell HTML válida
 * para o overlay de deploy assumir na tela do sistema.
 */
const CACHE_SHELL = "soma-deploy-shell-v3";

function isNavigationRequest(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return request.method === "GET" && accept.includes("text/html");
}

function isProbeRequest(request) {
  try {
    const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    return pathname === "/api/health" || pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function isHtmlResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/html");
}

function isGatewayFailure(response) {
  if (response.status >= 502 && response.status <= 504) return true;
  // Traefik do Easypanel responde JSON 404 "Cannot GET /api/errors/bad-gateway"
  // em navegações enquanto o backend reinicia.
  if (response.status >= 400 && !isHtmlResponse(response)) return true;
  return false;
}

async function readCachedShell(cache, request) {
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  return cache.match("/", { ignoreSearch: true });
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_SHELL).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || isProbeRequest(request)) return;
  if (!isNavigationRequest(request)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      try {
        const response = await fetch(request);
        if (response.ok && isHtmlResponse(response)) {
          cache.put(request, response.clone()).catch(() => {});
          return response;
        }
        if (isGatewayFailure(response)) {
          const cached = await readCachedShell(cache, request);
          if (cached) return cached;
        }
        return response;
      } catch {
        const cached = await readCachedShell(cache, request);
        if (cached) return cached;
        throw new Error("offline");
      }
    })(),
  );
});
