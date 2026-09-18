import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  completeMetaEmbeddedSignupFn,
  getMetaEmbeddedSignupConfigFn,
} from "@/lib/chat/chat.server";
import {
  buildMetaEsFbLoginOptions,
  isMetaEsFinishEvent,
} from "@/lib/chat/meta-cloud/meta-es-fb-login";

type MetaPublicConfig = {
  ok: boolean;
  appId?: string;
  configId?: string;
  graphVersion: string;
};

type SessionAssets = {
  wabaId: string;
  phoneNumberId: string;
  businessId: string;
  verifiedName: string;
};

declare global {
  interface Window {
    FB?: {
      init: (opts: {
        appId: string;
        cookie: boolean;
        autoLogAppEvents: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        cb: (response: { authResponse?: { code?: string } | null }) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

function loadFacebookSdk(config: MetaPublicConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.FB?.login === "function") {
      resolve();
      return;
    }
    window.fbAsyncInit = () => {
      if (config.appId) {
        window.FB?.init({
          appId: config.appId,
          cookie: true,
          autoLogAppEvents: true,
          xfbml: true,
          version: config.graphVersion || "v26.0",
        });
      }
      resolve();
    };
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/pt_BR/sdk.js";
      script.onerror = () => reject(new Error("SDK da Meta não carregou."));
      document.body.appendChild(script);
    }
    window.setTimeout(() => {
      if (typeof window.FB?.login === "function") resolve();
    }, 2500);
  });
}

export function MetaCloudSignupPanel({
  configured,
  onConnected,
  hasExisting = false,
}: {
  configured: boolean;
  onConnected: () => Promise<void>;
  hasExisting?: boolean;
}) {
  const loadConfig = useServerFn(getMetaEmbeddedSignupConfigFn);
  const complete = useServerFn(completeMetaEmbeddedSignupFn);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);
  const sessionRef = useRef<SessionAssets>({
    wabaId: "",
    phoneNumberId: "",
    businessId: "",
    verifiedName: "",
  });
  const codeRef = useRef("");
  const finishingRef = useRef(false);

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    const code = codeRef.current;
    if (!code) return;
    finishingRef.current = true;
    setBusy(true);
    setLocalErr(null);
    try {
      const result = await complete({
        data: {
          code,
          wabaId: sessionRef.current.wabaId,
          phoneNumberId: sessionRef.current.phoneNumberId,
          businessId: sessionRef.current.businessId,
          verifiedName: sessionRef.current.verifiedName,
          label: label.trim(),
        },
      });
      toast.success(
        result.phone
          ? `Número oficial conectado (${result.phone})`
          : "Número oficial conectado",
      );
      if (!result.wabaRelayOk) {
        toast.warning(
          result.wabaRelayError ||
            "Número salvo, mas o WABA ainda não está relaying o webhook. Aplique o patch no WABA.",
        );
      }
      setLabel("");
      await onConnected();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao concluir o Embedded Signup.";
      setLocalErr(message);
      toast.error(message);
    } finally {
      finishingRef.current = false;
      setBusy(false);
      codeRef.current = "";
    }
  }, [complete, label, onConnected]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const origin = String(event.origin || "");
      if (!origin.endsWith("facebook.com")) return;
      let payload: Record<string, unknown> | null = null;
      try {
        payload =
          typeof event.data === "string"
            ? (JSON.parse(event.data) as Record<string, unknown>)
            : event.data && typeof event.data === "object"
              ? (event.data as Record<string, unknown>)
              : null;
      } catch {
        return;
      }
      if (!payload) return;
      const inner =
        payload.data && typeof payload.data === "object"
          ? (payload.data as Record<string, unknown>)
          : payload;
      const nested =
        inner.data && typeof inner.data === "object"
          ? (inner.data as Record<string, unknown>)
          : {};
      const eventName = String(payload.event || inner.event || "");
      const wabaId = String(inner.waba_id || inner.wabaId || nested.waba_id || "").trim();
      const phoneId = String(
        inner.phone_number_id || inner.phoneNumberId || nested.phone_number_id || "",
      ).trim();
      const businessId = String(inner.business_id || inner.businessId || nested.business_id || "").trim();
      const verifiedName = String(
        inner.business_name || inner.whatsapp_business_account_name || inner.name || "",
      ).trim();
      if (wabaId) sessionRef.current.wabaId = wabaId;
      if (phoneId) sessionRef.current.phoneNumberId = phoneId;
      if (businessId) sessionRef.current.businessId = businessId;
      if (verifiedName) sessionRef.current.verifiedName = verifiedName;
      if (eventName === "CANCEL" || eventName === "ERROR") {
        setBusy(false);
        if (eventName === "ERROR") {
          setLocalErr(String(inner.error_message || "Erro no Embedded Signup da Meta."));
        }
        return;
      }
      if (codeRef.current && (phoneId || isMetaEsFinishEvent(eventName))) {
        void finish();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [finish]);

  async function startSignup() {
    setLocalErr(null);
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      setLocalErr("A Meta exige HTTPS para o Embedded Signup. Use o domínio público do CRM.");
      return;
    }
    setBusy(true);
    try {
      const config = (await loadConfig()) as MetaPublicConfig;
      if (!config.ok || !config.appId || !config.configId) {
        throw new Error(
          "Embedded Signup indisponível. Configure META_APP_ID, META_APP_SECRET e META_CONFIG_ID (mesmo App do Drax).",
        );
      }
      await loadFacebookSdk(config);
      if (typeof window.FB?.login !== "function") {
        throw new Error("SDK da Meta não carregou. Verifique bloqueador de anúncios.");
      }
      const options = buildMetaEsFbLoginOptions(config.configId);
      if (!options) throw new Error("config_id da Meta ausente.");
      window.FB.login((response) => {
        const code = String(response?.authResponse?.code || "").trim();
        if (!code) {
          setBusy(false);
          setLocalErr("A Meta não devolveu o código. Tente de novo.");
          return;
        }
        codeRef.current = code;
        window.setTimeout(() => {
          void finish();
        }, 1200);
      }, options);
    } catch (error) {
      setBusy(false);
      setLocalErr(error instanceof Error ? error.message : "Falha ao abrir o Embedded Signup.");
    }
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
        API oficial indisponível neste servidor. Defina <code className="text-xs">META_APP_ID</code>,{" "}
        <code className="text-xs">META_APP_SECRET</code> e <code className="text-xs">META_CONFIG_ID</code>{" "}
        (mesmo App já autorizado no Drax/WABA).
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1.5">
          <span className="text-sm font-medium">Nome do canal (opcional)</span>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Ex.: Comercial oficial"
            disabled={busy}
          />
        </label>
        <Button type="button" className="cursor-pointer" disabled={busy} onClick={() => void startSignup()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
          {busy ? "Conectando…" : hasExisting ? "Conectar outro número" : "Conectar número oficial"}
        </Button>
      </div>
      {localErr ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {localErr}
        </p>
      ) : null}
    </div>
  );
}
