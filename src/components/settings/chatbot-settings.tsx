import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  Clock3,
  GraduationCap,
  Link2,
  Plus,
  QrCode,
  RefreshCw,
  Tags,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { ChatAiEducationScreen } from "@/components/chat/chat-ai-education-screen";
import { ChatbotTagsSettings } from "@/components/settings/chatbot-tags-settings";
import { ChatbotRuntimeSettings } from "@/components/settings/chatbot-runtime-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChatAiExample, ChatAiKnowledgeItem, ChatAiSettings } from "@/lib/chat/chat.types";
import type { EvolutionConnectionState, EvolutionQrPayload } from "@/lib/chat/evolution.adapter";
import {
  createChatWhatsappInstanceFn,
  deleteChatWhatsappInstanceFn,
  getEvolutionConnectionStatusFn,
  refreshEvolutionQrFn,
} from "@/lib/chat/chat.server";
import type { SystemSettings } from "@/lib/config/settings-types";

export type ChatbotPanelId = "evo" | "ia";

export type ChatbotSubId =
  | "conexao"
  | "webhook"
  | "tags"
  | "educacao-ia"
  | "bot-expediente";

export const CHATBOT_SUBS: ChatbotSubId[] = [
  "conexao",
  "webhook",
  "tags",
  "educacao-ia",
  "bot-expediente",
];

export function parseChatbotSub(value: unknown): ChatbotSubId {
  const raw = String(value ?? "conexao");
  return (CHATBOT_SUBS.includes(raw as ChatbotSubId) ? raw : "conexao") as ChatbotSubId;
}

export type ChatbotChannelPayload = {
  id: string;
  instanceName: string;
  label: string;
  phone: string | null;
  state: EvolutionConnectionState;
  qr: EvolutionQrPayload;
  error?: string | null;
};

export type ChatbotEvoPayload = {
  configured: boolean;
  apiUrlHost: string | null;
  instance: string | null;
  channels?: ChatbotChannelPayload[];
  state: EvolutionConnectionState;
  qr: EvolutionQrPayload;
  error?: string | null;
  webhookUrl?: string | null;
  webhookPublicBaseUrl?: string;
  webhookReady?: boolean;
};

export type ChatbotEducationPayload = {
  settings: ChatAiSettings;
  knowledge: ChatAiKnowledgeItem[];
  examples: ChatAiExample[];
  openAiConfigured: boolean;
};

function stateLabel(state: EvolutionConnectionState): string {
  switch (state) {
    case "open":
      return "Conectado";
    case "connecting":
      return "Aguardando leitura do QR";
    case "close":
      return "Desconectado";
    default:
      return "Status desconhecido";
  }
}

type Props = {
  sub: ChatbotSubId;
  onSubChange: (sub: ChatbotSubId) => void;
  evo?: ChatbotEvoPayload | null;
  education?: ChatbotEducationPayload | null;
  settings: SystemSettings;
  onSettingsChange: (next: SystemSettings, section: "chatTags" | "chatbotRuntime") => void | Promise<unknown>;
  flashOk?: string;
  flashErr?: string;
};

function FlashMessages({ flashOk, flashErr, error }: { flashOk?: string; flashErr?: string; error?: string | null }) {
  return (
    <>
      {flashOk === "conectado" ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          WhatsApp já conectado nesta Evolution.
        </p>
      ) : null}
      {flashOk === "qr" ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          QR gerado — escaneie no WhatsApp (expira ~60s).
        </p>
      ) : null}
      {flashOk === "webhook" ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          Webhook aplicado nas instâncias Evolution.
        </p>
      ) : null}
      {flashOk === "status" ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          Status atualizado.
        </p>
      ) : null}
      {flashErr ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {flashErr === "config"
            ? "Evolution não configurada no .env.local."
            : flashErr === "webhook"
              ? error || "Não foi possível aplicar o webhook (precisa URL HTTPS pública)."
              : flashErr === "teste"
                ? "Informe telefone (DDD+número) e texto para o teste."
                : flashErr === "qr" || flashErr === "instancia"
                  ? error || "Falha ao gerar QR / garantir instância."
                  : "Não foi possível atualizar. Tente novamente."}
        </p>
      ) : null}
    </>
  );
}

function ChannelCard({
  channel,
  configured,
  apiUrlHost,
  canDelete,
  onChanged,
}: {
  channel: ChatbotChannelPayload;
  configured: boolean;
  apiUrlHost: string | null;
  canDelete: boolean;
  onChanged: () => Promise<void>;
}) {
  const refreshStatus = useServerFn(getEvolutionConnectionStatusFn);
  const refreshQr = useServerFn(refreshEvolutionQrFn);
  const deleteInstance = useServerFn(deleteChatWhatsappInstanceFn);
  const [busy, setBusy] = useState<"status" | "qr" | "delete" | null>(null);
  const [state, setState] = useState(channel.state);
  const [qr, setQr] = useState(channel.qr);
  const [phone, setPhone] = useState(channel.phone);
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [integratedAlert, setIntegratedAlert] = useState(false);

  useEffect(() => {
    setState(channel.state);
    setQr(channel.qr);
    setPhone(channel.phone);
  }, [channel.state, channel.qr, channel.phone, channel.instanceName]);

  // Canal já conectado sem número no banco → busca uma vez na Evolution.
  useEffect(() => {
    if (state !== "open" || phone) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await refreshStatus({ data: { instanceName: channel.instanceName } });
        if (cancelled) return;
        if (result.phone) setPhone(result.phone);
        if (result.state) setState(result.state);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, phone, channel.instanceName, refreshStatus]);

  // Poll enquanto o QR estiver visível — fecha e alerta ao conectar.
  useEffect(() => {
    if (!qr.base64 || state === "open") return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const result = await refreshStatus({ data: { instanceName: channel.instanceName } });
          if (cancelled) return;
          if (result.state === "open") {
            setState("open");
            setQr({});
            if (result.phone) setPhone(result.phone);
            setIntegratedAlert(true);
            setLocalMsg(null);
            window.setTimeout(() => setIntegratedAlert(false), 4500);
            await onChanged();
          }
        } catch {
          /* ignore poll errors */
        }
      })();
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [qr.base64, state, channel.instanceName, refreshStatus, onChanged]);

  async function runStatus() {
    setBusy("status");
    setLocalMsg(null);
    setLocalErr(null);
    try {
      const result = await refreshStatus({ data: { instanceName: channel.instanceName } });
      if (!result.ok) setLocalErr(result.error ?? "Falha ao atualizar status.");
      else {
        setState(result.state);
        setLocalMsg("Status atualizado.");
        if (result.state === "open") {
          setQr({});
          if (result.phone) setPhone(result.phone);
        }
      }
      await onChanged();
    } catch (error) {
      setLocalErr(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy(null);
    }
  }

  async function runQr() {
    setBusy("qr");
    setLocalMsg(null);
    setLocalErr(null);
    setIntegratedAlert(false);
    try {
      const result = await refreshQr({ data: { instanceName: channel.instanceName } });
      if (!result.ok) setLocalErr(result.error ?? "Falha ao gerar QR.");
      else if (result.state === "open" || result.connected) {
        setState("open");
        setQr({});
        if (result.phone) setPhone(result.phone);
        setIntegratedAlert(true);
        window.setTimeout(() => setIntegratedAlert(false), 4500);
      } else {
        setState(result.state);
        setQr(result.qr ?? {});
        setLocalMsg("QR gerado — escaneie no WhatsApp (expira ~60s).");
      }
      await onChanged();
    } catch (error) {
      setLocalErr(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy(null);
    }
  }

  async function runDelete() {
    if (!canDelete) return;
    if (!window.confirm(`Excluir o canal "${channel.label}" (${channel.instanceName})?`)) return;
    setBusy("delete");
    setLocalErr(null);
    try {
      await deleteInstance({ data: { instanceName: channel.instanceName } });
      toast.success("Canal removido");
      await onChanged();
    } catch (error) {
      setLocalErr(error instanceof Error ? error.message : "Falha ao excluir canal");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold">{channel.label}</p>
          <p className="text-xs text-muted-foreground">
            Instância <code className="text-[11px]">{channel.instanceName}</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state === "open" ? (
            <Wifi className="size-4 text-success" />
          ) : (
            <WifiOff className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">{stateLabel(state)}</span>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">API</p>
          <p className="font-medium">{apiUrlHost ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Número</p>
          <p className="font-medium">{phone || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Canal</p>
          <p className="font-medium">{channel.label}</p>
        </div>
      </div>

      {integratedAlert ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200"
        >
          Número Integrado
        </p>
      ) : null}
      {localMsg ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {localMsg}
        </p>
      ) : null}
      {localErr || channel.error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {localErr || channel.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy !== null}
          className="cursor-pointer"
          onClick={() => void runStatus()}
        >
          <RefreshCw className={`size-4 ${busy === "status" ? "animate-spin" : ""}`} />
          {busy === "status" ? "Atualizando…" : "Atualizar status"}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!configured || state === "open" || busy !== null}
          className="cursor-pointer"
          onClick={() => void runQr()}
        >
          <QrCode className="size-4" />
          {busy === "qr" ? "Gerando…" : "Gerar / renovar QR Code"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canDelete || busy !== null}
          className="cursor-pointer text-destructive hover:text-destructive"
          onClick={() => void runDelete()}
        >
          <Trash2 className="size-4" />
          {busy === "delete" ? "Excluindo…" : "Excluir"}
        </Button>
      </div>

      {qr.base64 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-6">
          <img
            src={qr.base64}
            alt={`QR Code ${channel.label}`}
            className="size-56 rounded-lg border border-border bg-white object-contain p-2"
          />
          <p className="max-w-sm text-center text-xs text-muted-foreground">
            WhatsApp → Dispositivos conectados → Conectar um dispositivo.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function WhatsappChannelsPanel({ evo }: { evo: ChatbotEvoPayload }) {
  const router = useRouter();
  const createInstance = useServerFn(createChatWhatsappInstanceFn);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const refresh = useCallback(async () => {
    await router.invalidate();
  }, [router]);
  const channels = evo.channels?.length
    ? evo.channels
    : evo.instance
      ? [
          {
            id: "legacy",
            instanceName: evo.instance,
            label: "Principal",
            phone: null,
            state: evo.state,
            qr: evo.qr,
            error: evo.error,
          },
        ]
      : [];

  async function handleCreate() {
    const name = label.trim();
    if (!name) {
      toast.error("Informe um nome para o canal.");
      return;
    }
    setCreating(true);
    try {
      await createInstance({ data: { label: name } });
      setLabel("");
      toast.success("Canal adicionado");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao adicionar canal");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="rounded-xl border border-border/60 bg-card text-card-foreground shadow-soft">
      <div className="space-y-1.5 p-6">
        <h4 className="flex items-center gap-2 font-display text-base font-semibold">
          <QrCode className="size-4 text-primary" />
          Conexão WhatsApp
        </h4>
        <p className="text-sm text-muted-foreground">
          Vários canais (instâncias <code className="text-xs">soma-*</code>) no mesmo Evolution — o Chat
          atende entradas de todos eles.
        </p>
      </div>
      <div className="space-y-4 p-6 pt-0">
        {!evo.configured ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            Evolution não configurada. Defina <code className="text-xs">EVOLUTION_API_URL</code> e{" "}
            <code className="text-xs">EVOLUTION_API_KEY</code> no <code className="text-xs">.env.local</code> e
            reinicie o servidor.
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 space-y-1.5">
            <span className="text-sm font-medium">Novo canal</span>
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ex.: Comercial SP"
              disabled={!evo.configured || creating}
            />
          </label>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={!evo.configured || creating || !label.trim()}
            onClick={() => void handleCreate()}
          >
            <Plus className="size-4" />
            {creating ? "Adicionando…" : "Adicionar instância"}
          </Button>
        </div>

        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum canal cadastrado ainda.</p>
        ) : (
          <div className="space-y-4">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                configured={evo.configured}
                apiUrlHost={evo.apiUrlHost}
                canDelete={channels.length > 1}
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Bot e Integrações — subpáginas (mesmo padrão das abas de Configurações).
 */
export function ChatbotSettings({
  sub,
  onSubChange,
  evo,
  education,
  settings,
  onSettingsChange,
  flashOk,
  flashErr,
}: Props) {
  const needsEvo = sub === "conexao" || sub === "webhook";
  if (needsEvo && !evo) {
    return <p className="text-sm text-muted-foreground">Carregando Bot e Integrações…</p>;
  }
  if (sub === "educacao-ia" && !education) {
    return <p className="text-sm text-muted-foreground">Carregando educação da IA…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">Bot e Integrações</h3>
        <p className="text-sm text-muted-foreground">
          Conexão WhatsApp, webhook, tags, educação da IA e bots de expediente / fora do expediente.
        </p>
      </div>

      <Tabs
        value={sub}
        onValueChange={(next) => onSubChange(parseChatbotSub(next))}
        className="space-y-6"
      >
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="conexao" className="gap-2">
            <QrCode className="size-4" /> Conexão WhatsApp
          </TabsTrigger>
          <TabsTrigger value="webhook" className="gap-2">
            <Link2 className="size-4" /> Webhook
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-2">
            <Tags className="size-4" /> Tags
          </TabsTrigger>
          <TabsTrigger value="educacao-ia" className="gap-2">
            <GraduationCap className="size-4" /> Educação da IA
          </TabsTrigger>
          <TabsTrigger value="bot-expediente" className="gap-2">
            <Clock3 className="size-4" /> Bot expediente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conexao" className="space-y-4">
          {evo ? (
            <>
              <FlashMessages flashOk={flashOk} flashErr={flashErr} error={evo.error} />
              <WhatsappChannelsPanel evo={evo} />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="webhook" className="space-y-4">
          {evo ? (
            <>
              <FlashMessages flashOk={flashOk} flashErr={flashErr} error={evo.error} />
              <section className="rounded-xl border border-border/60 bg-card text-card-foreground shadow-soft">
                <div className="space-y-1.5 p-6">
                  <h4 className="flex items-center gap-2 font-display text-base font-semibold">
                    <Link2 className="size-4 text-primary" />
                    Webhook
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Informe o domínio público do CRM; o backend cadastra o webhook em todas as
                    instâncias soma-*.
                  </p>
                </div>
                <div className="space-y-4 p-6 pt-0">
                  <form
                    method="post"
                    action="/api/settings/chatbot/evolution"
                    className="space-y-3"
                    data-processing-label="Aplicando webhook na Evolution…"
                  >
                    <input type="hidden" name="kind" value="webhook" />
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium">URL pública do CRM (só o domínio HTTPS)</span>
                      <input
                        name="webhookPublicBaseUrl"
                        defaultValue={evo.webhookPublicBaseUrl || ""}
                        placeholder="https://app.somaconecta.com.br"
                        className="flex h-9 w-full cursor-text rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Webhook na EVO:{" "}
                      <code className="text-[11px]">
                        {evo.webhookUrl ?? "(ainda sem URL pública — normal no localhost)"}
                      </code>
                      {evo.webhookReady ? " · pronto" : " · aguardando domínio"}
                    </p>
                    <button
                      type="submit"
                      disabled={!evo.configured}
                      className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                    >
                      Salvar e aplicar webhook na EVO
                    </button>
                  </form>

                  <div className="rounded-lg border border-dashed border-border px-4 py-3">
                    <p className="mb-2 text-sm font-medium">Teste local</p>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Simula mensagem recebida no Inbox sem domínio público.
                    </p>
                    <form
                      method="post"
                      action="/api/settings/chatbot/evolution"
                      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                      data-processing-label="Enviando teste para o Inbox…"
                    >
                      <input type="hidden" name="kind" value="test-inbound" />
                      <input
                        name="phone"
                        placeholder="5511999999999"
                        className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                      />
                      <input
                        name="text"
                        placeholder="Olá, quero simular um lead"
                        defaultValue="Olá, mensagem de teste no Chat Soma"
                        className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                      />
                      <button
                        type="submit"
                        className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
                      >
                        Enviar teste → Inbox
                      </button>
                    </form>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="tags">
          <ChatbotTagsSettings
            settings={settings}
            onChange={(next) => onSettingsChange(next, "chatTags")}
          />
        </TabsContent>

        <TabsContent value="educacao-ia" className="space-y-3">
          {education ? (
            <ChatAiEducationScreen
              initial={education}
              embedded
              flashOk={
                flashOk === "salva" || flashOk === "item" || flashOk === "exemplo" ? flashOk : undefined
              }
              flashErr={flashErr === "ia" ? flashErr : undefined}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="bot-expediente">
          <ChatbotRuntimeSettings
            settings={settings}
            onChange={(next) => onSettingsChange(next, "chatbotRuntime")}
          />
        </TabsContent>
      </Tabs>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bot className="size-3.5" />
        Atendimento humano fica em <strong className="font-medium text-foreground">Chat WhatsApp</strong>
        .
      </p>
    </div>
  );
}
