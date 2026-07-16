import { Bot, GraduationCap, Link2, QrCode, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { ChatAiEducationScreen } from "@/components/chat/chat-ai-education-screen";
import type { ChatAiExample, ChatAiKnowledgeItem, ChatAiSettings } from "@/lib/chat/chat.types";
import type { EvolutionConnectionState, EvolutionQrPayload } from "@/lib/chat/evolution.adapter";

export type ChatbotPanelId = "evo" | "ia";

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
  panel?: ChatbotPanelId;
  evo?: ChatbotEvoPayload | null;
  education?: ChatbotEducationPayload | null;
  flashOk?: string;
  flashErr?: string;
};

/**
 * Integração EVO — única tela de parametrização do Chatbot
 * (conexão WhatsApp + webhook + educação da IA).
 */
export function ChatbotSettings({ evo, education, flashOk, flashErr }: Props) {
  if (!evo || !education) {
    return <p className="text-sm text-muted-foreground">Carregando Integração EVO…</p>;
  }

  const {
    configured,
    apiUrlHost,
    instance,
    state,
    qr,
    error,
    webhookUrl,
    webhookPublicBaseUrl = "",
    webhookReady,
  } = evo;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">Integração EVO</h3>
        <p className="text-sm text-muted-foreground">
          Conexão WhatsApp (Evolution), webhook de mensagens e parametrização da IA — tudo nesta
          tela.
        </p>
      </div>

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

      {/* 1) Conexão */}
      <section className="rounded-xl border border-border/60 bg-card text-card-foreground shadow-soft">
        <div className="space-y-1.5 p-6">
          <h4 className="flex items-center gap-2 font-display text-base font-semibold">
            <QrCode className="size-4 text-primary" />
            1. Conexão WhatsApp
          </h4>
          <p className="text-sm text-muted-foreground">
            Instância isolada <code className="text-xs">soma-crm</code> — não altera números do WABA.
          </p>
        </div>
        <div className="space-y-4 p-6 pt-0">
          <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">API</p>
              <p className="font-medium">{apiUrlHost ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Instância</p>
              <p className="font-medium">{instance ?? "—"}</p>
            </div>
            <div className="flex items-center gap-2">
              {state === "open" ? (
                <Wifi className="size-4 text-success" />
              ) : (
                <WifiOff className="size-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium">{stateLabel(state)}</p>
              </div>
            </div>
          </div>

          {!configured ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
              Evolution não configurada. Defina <code className="text-xs">EVOLUTION_*</code> no{" "}
              <code className="text-xs">.env.local</code> e reinicie o servidor.
            </div>
          ) : null}

          {error && configured && flashErr !== "webhook" ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <form method="post" action="/api/settings/chatbot/evolution">
              <input type="hidden" name="kind" value="status" />
              <button
                type="submit"
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-muted"
              >
                <RefreshCw className="size-4" aria-hidden />
                Atualizar status
              </button>
            </form>
            <form method="post" action="/api/settings/chatbot/evolution">
              <input type="hidden" name="kind" value="refresh" />
              <button
                type="submit"
                disabled={!configured || state === "open"}
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <QrCode className="size-4" aria-hidden />
                Gerar / renovar QR Code
              </button>
            </form>
          </div>

          {qr.base64 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-6">
              <img
                src={qr.base64}
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

      {/* 2) Webhook */}
      <section className="rounded-xl border border-border/60 bg-card text-card-foreground shadow-soft">
        <div className="space-y-1.5 p-6">
          <h4 className="flex items-center gap-2 font-display text-base font-semibold">
            <Link2 className="size-4 text-primary" />
            2. Webhook (receber mensagens do WhatsApp)
          </h4>
          <p className="text-sm text-muted-foreground">
            Você <strong className="font-medium text-foreground">não copia</strong> um link na
            Evolution. Informe o endereço público deste CRM; o backend monta o webhook e cadastra na
            EVO.
          </p>
        </div>
        <div className="space-y-4 p-6 pt-0">
          <ol className="list-decimal space-y-1.5 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 pl-8 text-sm text-muted-foreground">
            <li>
              Em desenvolvimento neste PC: <strong className="text-foreground">pule esta seção</strong>{" "}
              e use o <em>Teste local</em> abaixo (localhost não recebe WhatsApp real).
            </li>
            <li>
              Em produção: use a URL HTTPS do CRM no ar (ex.:{" "}
              <code className="text-xs">https://crm.seudominio.com.br</code>) — só o domínio, sem{" "}
              <code className="text-xs">/app</code>.
            </li>
            <li>
              Clique em <strong className="text-foreground">Salvar e aplicar</strong>. O sistema gera{" "}
              <code className="text-xs">…/api/chat/whatsapp-webhook</code> e registra na instância{" "}
              <code className="text-xs">soma-crm</code>.
            </li>
          </ol>

          <form method="post" action="/api/settings/chatbot/evolution" className="space-y-3">
            <input type="hidden" name="kind" value="webhook" />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">URL pública do CRM (só o domínio HTTPS)</span>
              <input
                name="webhookPublicBaseUrl"
                defaultValue={webhookPublicBaseUrl}
                placeholder="https://crm.seudominio.com.br"
                className="flex h-9 w-full cursor-text rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Webhook que será cadastrado na EVO:{" "}
              <code className="text-[11px]">
                {webhookUrl ?? "(ainda sem URL pública — normal no localhost)"}
              </code>
              {webhookReady ? " · pronto" : " · aguardando domínio"}
            </p>
            <button
              type="submit"
              disabled={!configured}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              Salvar e aplicar webhook na EVO
            </button>
          </form>

          <div className="rounded-lg border border-dashed border-border px-4 py-3">
            <p className="mb-2 text-sm font-medium">Agora no PC: teste local (recomendado)</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Simula uma mensagem recebida e abre o Chat WhatsApp — sem precisar de domínio público.
            </p>
            <form
              method="post"
              action="/api/settings/chatbot/evolution"
              className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
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

      {/* 3) IA */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <GraduationCap className="size-4 text-primary" />
          <h4 className="font-display text-base font-semibold">3. Inteligência artificial</h4>
        </div>
        <ChatAiEducationScreen
          initial={education}
          embedded
          flashOk={flashOk === "salva" || flashOk === "item" || flashOk === "exemplo" ? flashOk : undefined}
          flashErr={flashErr === "ia" ? flashErr : undefined}
        />
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bot className="size-3.5" />
        Atendimento humano fica em <strong className="font-medium text-foreground">Chat WhatsApp</strong>
        .
      </p>
    </div>
  );
}
