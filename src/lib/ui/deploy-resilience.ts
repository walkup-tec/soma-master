/**
 * Resiliência de deploy (modelo WABA index.html):
 * - Vigia /api/health em segundo plano; ao detectar queda (502/504, JSON do
 *   Traefik "bad-gateway" ou rede), mostra o overlay "ATUALIZANDO O SISTEMA".
 * - Só opera no host oficial de produção e exige duas falhas consecutivas,
 *   evitando ativação local ou por oscilação isolada de rede.
 * - Segue sondando a cada 2s; com 3 sondas estáveis (ou drift de serverBootId,
 *   que indica que o novo deploy subiu), fecha o modal e recarrega a tela.
 * - Registra o service worker (v4) que preserva a shell HTML e, se não houver
 *   cache, devolve um fallback embutido com o modal — evitando a tela JSON
 *   "Cannot GET /api/errors/bad-gateway" no refresh pós-deploy.
 * Roda sem React — igual ao bootstrap do tema — para não depender da hidratação.
 */
export const SOMA_DEPLOY_RESILIENCE_BOOTSTRAP_SCRIPT = `(function () {
  var POLL_MS = 2000;
  var WATCH_MS = 3000;
  var STABLE_PROBES_REQUIRED = 3;
  var FAILURE_PROBES_REQUIRED = 2;
  var COMPLETE_RELOAD_DELAY_MS = 600;
  var LONG_WAIT_MS = 120000;
  var OVERLAY_ID = "soma-deploy-overlay";
  var SW_REGISTER_URL = "/sw-deploy-resilience.js?v=4";

  var pollTimer = null;
  var watchTimer = null;
  var confirmFailureTimer = null;
  var recoveryActive = false;
  var pollStartedAt = 0;
  var stableStreak = 0;
  var failureStreak = 0;
  var baselineBootId = "";

  function isProductionHost() {
    var host = String(window.location.hostname || "").toLowerCase();
    return host === "app.somaconecta.com.br";
  }

  function looksLikeGatewayPayload(data, status) {
    if (status >= 502 && status <= 504) return true;
    if (!data || typeof data !== "object") return false;
    var message = "";
    try {
      message = JSON.stringify(data);
    } catch (_) {
      message = "";
    }
    return /bad-gateway|Cannot GET|Not Found/i.test(message);
  }

  function ensureStyles() {
    var STYLE_ID = "soma-deploy-overlay-style";
    var STYLE_VERSION = "soma-brand-v3";
    var existing = document.getElementById(STYLE_ID);
    if (existing && existing.getAttribute("data-version") === STYLE_VERSION) return;
    if (existing) existing.remove();
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.setAttribute("data-version", STYLE_VERSION);
    // Paleta oficial Soma: magenta #be1c6a · lima #ecf759 · azul #2775e5 · neutros
    // Sem pink Tailwind (#ec4899), roxo (#a855f7), ciano (#22d3ee) ou verde WABA.
    style.textContent =
      "#" + OVERLAY_ID + "{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(5,9,18,.94);backdrop-filter:blur(8px)}" +
      "#" + OVERLAY_ID + "[hidden]{display:none!important}" +
      ".soma-deploy-card{max-width:22rem;width:100%;padding:28px 24px 24px;border-radius:18px;border:1px solid rgba(190,28,106,.5);background:#0e1828;color:#eef3fb;text-align:center;box-shadow:0 24px 48px rgba(0,0,0,.5);font-family:Manrope,ui-sans-serif,system-ui,sans-serif;transition:border-color .35s ease}" +
      ".soma-deploy-card.is-stabilizing{border-color:rgba(236,247,89,.6)}" +
      ".soma-deploy-brand{margin:0 0 14px;font-family:Sora,Manrope,ui-sans-serif,system-ui,sans-serif;font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#be1c6a}" +
      ".soma-deploy-visual{margin-bottom:18px}" +
      ".soma-deploy-spinner{width:56px;height:56px;margin:0 auto 16px;border-radius:50%;border:3px solid rgba(39,117,229,.22);border-top-color:#be1c6a;animation:soma-deploy-orbit 1.2s linear infinite}" +
      ".soma-deploy-progress-track{height:4px;border-radius:999px;background:rgba(245,245,245,.14);overflow:hidden;margin:0 auto;max-width:180px}" +
      ".soma-deploy-progress-bar{height:100%;width:42%;border-radius:inherit;background:#be1c6a;animation:soma-deploy-progress-slide 1.35s ease-in-out infinite}" +
      ".soma-deploy-card.is-stabilizing .soma-deploy-progress-bar{width:100%;animation:soma-deploy-progress-fill .9s ease-out forwards;background:#ecf759}" +
      ".soma-deploy-card.is-complete .soma-deploy-spinner{border-top-color:#ecf759;animation:none}" +
      ".soma-deploy-title{margin:0 0 12px;font-family:Sora,Manrope,ui-sans-serif,system-ui,sans-serif;font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#be1c6a}" +
      ".soma-deploy-card.is-stabilizing .soma-deploy-title{color:#ecf759}" +
      ".soma-deploy-card p{margin:0 0 10px;color:#eef3fb;line-height:1.55;font-size:.92rem}" +
      ".soma-deploy-accent{margin-bottom:0!important;color:#ecf759!important;font-size:.88rem}" +
      "@keyframes soma-deploy-orbit{to{transform:rotate(360deg)}}" +
      "@keyframes soma-deploy-progress-slide{0%{transform:translateX(-120%)}100%{transform:translateX(280%)}}" +
      "@keyframes soma-deploy-progress-fill{from{transform:translateX(-8%)}to{transform:translateX(0)}}";
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    var existing = document.getElementById(OVERLAY_ID);
    if (existing) {
      ensureStyles();
      return existing;
    }
    if (!document.body) return null;
    ensureStyles();
    var el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.setAttribute("hidden", "");
    el.innerHTML =
      '<div class="soma-deploy-card" role="status" aria-live="polite" aria-busy="true">' +
      '<p class="soma-deploy-brand">Soma Promotora</p>' +
      '<div class="soma-deploy-visual" aria-hidden="true">' +
      '<div class="soma-deploy-spinner"></div>' +
      '<div class="soma-deploy-progress-track"><div class="soma-deploy-progress-bar"></div></div>' +
      "</div>" +
      '<h1 class="soma-deploy-title">ATUALIZANDO O SISTEMA</h1>' +
      '<p id="soma-deploy-message">Estamos aplicando melhorias para oferecer uma experi\\u00eancia cada vez melhor.</p>' +
      '<p class="soma-deploy-accent">Em poucos segundos sua tela ser\\u00e1 atualizada automaticamente e voc\\u00ea poder\\u00e1 continuar normalmente.</p>' +
      "</div>";
    document.body.appendChild(el);
    return el;
  }

  function setPhase(phase) {
    var card = document.querySelector("#" + OVERLAY_ID + " .soma-deploy-card");
    if (!card) return;
    card.classList.remove("is-stabilizing", "is-complete");
    if (phase === "stabilizing") card.classList.add("is-stabilizing");
    if (phase === "complete") card.classList.add("is-complete");
  }

  function showOverlay(message, phase) {
    if (!isProductionHost()) return;
    var el = ensureOverlay();
    if (!el) return;
    var msgEl = document.getElementById("soma-deploy-message");
    if (msgEl && message) msgEl.textContent = message;
    setPhase(phase || "deploying");
    el.removeAttribute("hidden");
  }

  function hideOverlay() {
    var el = document.getElementById(OVERLAY_ID);
    if (el) el.setAttribute("hidden", "");
  }

  function completeRecovery() {
    setPhase("complete");
    window.setTimeout(function () {
      window.location.reload();
    }, COMPLETE_RELOAD_DELAY_MS);
  }

  async function probeHealth() {
    try {
      var response = await fetch("/api/health", { cache: "no-store", credentials: "same-origin" });
      var data = null;
      try {
        data = await response.json();
      } catch (_) {
        data = null;
      }
      if (looksLikeGatewayPayload(data, response.status) || (response.status >= 502 && response.status <= 504)) {
        return { stable: false, gateway: true };
      }
      if (!response.ok || !data || data.ok !== true) return { stable: false, gateway: false };
      return { stable: true, gateway: false, bootId: String(data.serverBootId || "") };
    } catch (_) {
      return { stable: false, gateway: true };
    }
  }

  async function pollUntilReady() {
    if (!recoveryActive) return;
    showOverlay();
    var probe = await probeHealth();
    if (probe.stable) {
      stableStreak += 1;
      setPhase("stabilizing");
      if (stableStreak >= STABLE_PROBES_REQUIRED || (baselineBootId && probe.bootId && probe.bootId !== baselineBootId)) {
        completeRecovery();
        return;
      }
    } else {
      stableStreak = 0;
      setPhase("deploying");
      if (Date.now() - pollStartedAt >= LONG_WAIT_MS) {
        showOverlay(
          "A atualiza\\u00e7\\u00e3o est\\u00e1 demorando mais que o usual. Continuamos verificando automaticamente \\u2014 aguarde nesta tela.",
          "deploying"
        );
      }
    }
    pollTimer = window.setTimeout(function () {
      pollTimer = null;
      void pollUntilReady();
    }, POLL_MS);
  }

  function startRecovery() {
    if (!isProductionHost()) return;
    if (recoveryActive) return;
    if (confirmFailureTimer) {
      window.clearTimeout(confirmFailureTimer);
      confirmFailureTimer = null;
    }
    recoveryActive = true;
    pollStartedAt = Date.now();
    stableStreak = 0;
    void pollUntilReady();
  }

  function confirmProductionDeployFailure() {
    if (!isProductionHost() || recoveryActive) return;
    failureStreak += 1;
    if (failureStreak >= FAILURE_PROBES_REQUIRED) {
      startRecovery();
      return;
    }
    if (!confirmFailureTimer) {
      confirmFailureTimer = window.setTimeout(function () {
        confirmFailureTimer = null;
        void watchInBackground();
      }, POLL_MS);
    }
  }

  async function watchInBackground() {
    if (!isProductionHost() || recoveryActive) return;
    var probe = await probeHealth();
    if (!probe.stable) {
      // JSON Traefik / 502: overlay na hora (não esperar 2 falhas).
      if (probe.gateway) {
        startRecovery();
        return;
      }
      confirmProductionDeployFailure();
      return;
    }
    failureStreak = 0;
    if (!baselineBootId && probe.bootId) {
      baselineBootId = probe.bootId;
      return;
    }
    if (baselineBootId && probe.bootId && probe.bootId !== baselineBootId) {
      showOverlay();
      setPhase("stabilizing");
      recoveryActive = true;
      window.setTimeout(completeRecovery, 900);
    }
  }

  if (!isProductionHost()) return;

  window.somaDeployResilience = {
    show: showOverlay,
    hide: hideOverlay,
    startRecovery: startRecovery,
  };

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(SW_REGISTER_URL, { scope: "/" }).catch(function () {});
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    void probeHealth().then(function (probe) {
      if (probe.stable && probe.bootId) baselineBootId = probe.bootId;
      if (!probe.stable) {
        if (probe.gateway) startRecovery();
        else confirmProductionDeployFailure();
      }
    });
    watchTimer = window.setInterval(function () {
      void watchInBackground();
    }, WATCH_MS);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") void watchInBackground();
    });
  });
})();`;
