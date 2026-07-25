import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  Clock3,
  GraduationCap,
  Link2,
  QrCode,
  RefreshCw,
  Tags,
  Wifi,
  WifiOff,
} from "lucide-react";
import { ChatAiEducationScreen } from "@/components/chat/chat-ai-education-screen";
import { ChatbotTagsSettings } from "@/components/settings/chatbot-tags-settings";
import { ChatbotRuntimeSettings } from "@/components/settings/chatbot-runtime-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChatAiExample, ChatAiKnowledgeItem, ChatAiSettings } from "@/lib/chat/chat.types";
import type { EvolutionConnectionState, EvolutionQrPayload } from "@/lib/chat/evolution.adapter";
import {
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

export type ChatbotEvoPayload = {
  configured: boolean;
  apiUrlHost: string | null;
  instance: string | null;
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

function EvoConnectionActions({
  configured,
  state,
}: {
  configured: boolean;
  state: EvolutionConnectionState;
}) {
  const router = useRouter();
  const refreshStatus = useServerFn(getEvolutionConnectionStatusFn);
  const refreshQr = useServerFn(refreshEvolutionQrFn);
  const [busy, setBusy] = useState<"status" | "qr" | null>(null);
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);

  async function run(kind: "status" | "qr") {
    setBusy(kind);
    setLocalMsg(null);
    setLocalErr(null);
    try {
      if (kind === "status") {
        const result = await refreshStatus();
        if (!result.ok) setLocalErr(result.error ?? "Falha ao atualizar status.");
        else setLocalMsg("Status atualizado.");
      } else {
        const result = await refreshQr();
        if (!result.ok) setLocalErr(result.error ?? "Falha ao gerar QR.");
        else if (result.state === "open") setLocalMsg("WhatsApp já conectado nesta Evolution.");
        else setLocalMsg("QR gerado — escaneie no WhatsApp (expira ~60s).");
      }
      await router.invalidate();
    } catch (error) {
      setLocalErr(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {localMsg ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {localMsg}
        </p>
      ) : null}
      {localErr ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {localErr}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void run("status")}
          className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${busy === "status" ? "animate-spin" : ""}`} aria-hidden />
          {busy === "status" ? "Atualizando…" : "Atualizar status"}
        </button>
        <button
          type="button"
          disabled={!configured || state === "open" || busy !== null}
          onClick={() => void run("qr")}
          className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <QrCode className="size-4" aria-hidden />
          {busy === "qr" ? "Gerando…" : "Gerar / renovar QR Code"}
        </button>
      </div>
    </div>
  );
}

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
          Webhook aplicado na instância Evolution.
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
          Conexão WhatsApp, webhook, tags, educação da IA e bot ativo com expediente.
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
            <Clock3 className="size-4" /> Bot Ativo e Expediente
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conexao" className="space-y-4">
          {evo ? (
            <>
              <FlashMessages flashOk={flashOk} flashErr={flashErr} error={evo.error} />
              <section className="rounded-xl border border-border/60 bg-card text-card-foreground shadow-soft">
                <div className="space-y-1.5 p-6">
                  <h4 className="flex items-center gap-2 font-display text-base font-semibold">
                    <QrCode className="size-4 text-primary" />
                    Conexão WhatsApp
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Instância isolada <code className="text-xs">soma-crm</code> — não altera números
                    do WABA.
                  </p>
                </div>
                <div className="space-y-4 p-6 pt-0">
                  <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">API</p>
                      <p className="font-medium">{evo.apiUrlHost ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Instância</p>
                      <p className="font-medium">{evo.instance ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {evo.state === "open" ? (
                        <Wifi className="size-4 text-success" />
                      ) : (
                        <WifiOff className="size-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="font-medium">{stateLabel(evo.state)}</p>
                      </div>
                    </div>
                  </div>

                  {!evo.configured ? (
                    <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                      Evolution não configurada. Defina <code className="text-xs">EVOLUTION_*</code>{" "}
                      no <code className="text-xs">.env.local</code> e reinicie o servidor.
                    </div>
                  ) : null}

                  {evo.error && evo.configured && flashErr !== "webhook" ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {evo.error}
                    </div>
                  ) : null}

                  <EvoConnectionActions configured={evo.configured} state={evo.state} />

                  {evo.qr.base64 ? (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-6">
                      <img
                        src={evo.qr.base64}
                        alt="QR Code Evolution WhatsApp"
                        className="size-56 rounded-lg border border-border bg-white object-contain p-2"
                      />
                      <p className="max-w-sm text-center text-xs text-muted-foreground">
                        WhatsApp → Dispositivos conectados → Conectar um dispositivo.
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
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
                    Informe o domínio público do CRM; o backend cadastra o webhook na Evolution.
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
