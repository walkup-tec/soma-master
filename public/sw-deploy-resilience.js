/**
 * Service worker Soma — mantém a shell do app disponível durante redeploy.
 * Se uma navegação retornar 502/503/504 ou o JSON do Traefik
 * ("Cannot GET /api/errors/bad-gateway"), devolve a última shell HTML válida
 * ou um fallback embutido com o modal "ATUALIZANDO O SISTEMA".
 */
const CACHE_SHELL = "soma-deploy-shell-v4";
const SW_VERSION = "v4";

const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Atualizando — Soma Promotora</title>
  <style>
    html,body{margin:0;min-height:100%;background:#050912;color:#eef3fb;font-family:Manrope,ui-sans-serif,system-ui,sans-serif}
    #wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(5,9,18,.94)}
    .card{max-width:22rem;width:100%;padding:28px 24px 24px;border-radius:18px;border:1px solid rgba(190,28,106,.5);background:#0e1828;text-align:center;box-shadow:0 24px 48px rgba(0,0,0,.5)}
    .brand{margin:0 0 14px;font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#be1c6a}
    .spinner{width:56px;height:56px;margin:0 auto 16px;border-radius:50%;border:3px solid rgba(39,117,229,.22);border-top-color:#be1c6a;animation:orbit 1.2s linear infinite}
    .title{margin:0 0 12px;font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#be1c6a}
    p{margin:0 0 10px;line-height:1.55;font-size:.92rem;color:#eef3fb}
    .accent{color:#ecf759;font-size:.88rem;margin-bottom:0}
    @keyframes orbit{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div id="wrap">
    <div class="card" role="status" aria-live="polite">
      <p class="brand">Soma Promotora</p>
      <div class="spinner" aria-hidden="true"></div>
      <h1 class="title">ATUALIZANDO O SISTEMA</h1>
      <p>Estamos aplicando melhorias. Em poucos segundos a tela será atualizada automaticamente.</p>
      <p class="accent" id="status">Aguardando o serviço voltar…</p>
    </div>
  </div>
  <script>
    (function () {
      var statusEl = document.getElementById("status");
      var tries = 0;
      async function probe() {
        tries += 1;
        try {
          var res = await fetch("/api/health", { cache: "no-store", credentials: "same-origin" });
          var data = await res.json().catch(function () { return null; });
          if (res.ok && data && data.ok === true) {
            if (statusEl) statusEl.textContent = "Sistema disponível. Recarregando…";
            window.location.replace("/");
            return;
          }
        } catch (_) {}
        if (statusEl) statusEl.textContent = "Aguardando o serviço voltar… (" + tries + ")";
        window.setTimeout(probe, 2000);
      }
      window.setTimeout(probe, 800);
    })();
  </script>
</body>
</html>`;

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

async function isGatewayFailure(response) {
  if (response.status >= 502 && response.status <= 504) return true;
  if (response.status >= 400 && !isHtmlResponse(response)) {
    try {
      const text = await response.clone().text();
      if (/bad-gateway|Bad Gateway|Cannot GET|application\/json/i.test(text) || text.trim().startsWith("{")) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

function fallbackShellResponse() {
  return new Response(FALLBACK_HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Soma-Deploy-Fallback": SW_VERSION,
    },
  });
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
          cache.put("/", response.clone()).catch(() => {});
          return response;
        }
        if (await isGatewayFailure(response)) {
          const cached = await readCachedShell(cache, request);
          return cached || fallbackShellResponse();
        }
        return response;
      } catch {
        const cached = await readCachedShell(cache, request);
        return cached || fallbackShellResponse();
      }
    })(),
  );
});
