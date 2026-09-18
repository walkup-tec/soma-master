/**
 * Service worker Soma — só na produção (app.somaconecta.com.br).
 * Em outros hosts o bootstrap desregistra este SW.
 * 502/504 do Traefik (Redeploy de outro projeto) NÃO injeta o modal de atualização.
 * Em falha de gateway devolve a última shell em cache, ou o 502 original.
 */
const CACHE_SHELL = "soma-deploy-shell-v7";
const PRODUCTION_HOST = "app.somaconecta.com.br";

function isProductionScope() {
  try {
    return String(self.location.hostname || "").toLowerCase() === PRODUCTION_HOST;
  } catch {
    return false;
  }
}

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

function isGatewayStatus(status) {
  return status >= 502 && status <= 504;
}

async function readCachedShell(cache, request) {
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const root = await cache.match("/", { ignoreSearch: true });
  if (root) return root;
  const login = await cache.match("/login", { ignoreSearch: true });
  if (login) return login;
  return null;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (!isProductionScope()) {
        await self.skipWaiting();
        return;
      }
      const cache = await caches.open(CACHE_SHELL);
      await Promise.all(
        ["/", "/login"].map(async (path) => {
          try {
            const response = await fetch(path, { cache: "reload", credentials: "same-origin" });
            if (response.ok && isHtmlResponse(response)) {
              await cache.put(path, response.clone());
            }
          } catch {
            /* ignore */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_SHELL).map((key) => caches.delete(key)));
      if (!isProductionScope()) {
        await self.registration.unregister();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (!isProductionScope()) return;
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
          cache.put("/", response.clone()).catch(() => {});
          return response;
        }
        if (isGatewayStatus(response.status)) {
          const cached = await readCachedShell(cache, request);
          return cached || response;
        }
        return response;
      } catch {
        const cached = await readCachedShell(cache, request);
        return cached || Response.error();
      }
    })(),
  );
});
