import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import type { ChatAiExample, ChatAiKnowledgeItem, ChatAiSettings } from "@/lib/chat/chat.types";

type EducationPayload = {
  settings: ChatAiSettings;
  knowledge: ChatAiKnowledgeItem[];
  examples: ChatAiExample[];
  openAiConfigured: boolean;
};

const btnPrimary =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90";
const btnSecondary =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80";
const btnGhostDanger =
  "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-destructive hover:bg-muted";
const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const textareaClass =
  "flex min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function ChatAiEducationScreen({
  initial,
  embedded = false,
  flashOk,
  flashErr,
}: {
  initial: EducationPayload;
  embedded?: boolean;
  flashOk?: string;
  flashErr?: string;
}) {
  const returnPath = embedded ? "" : "/app/chat/ia";
  const { settings, knowledge, examples } = initial;

  return (
    <div className={embedded ? "space-y-6" : "mx-auto max-w-4xl space-y-6"}>
      {flashOk ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {flashOk === "salva"
            ? "Configuração da IA salva."
            : flashOk === "conhecimento"
              ? "Conhecimento adicionado."
              : flashOk === "exemplo"
                ? "Exemplo adicionado."
                : flashOk === "removido"
                  ? "Item removido."
                  : "Operação concluída."}
        </p>
      ) : null}
      {flashErr ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {flashErr === "conhecimento" || flashErr === "exemplo"
            ? "Preencha todos os campos obrigatórios."
            : "Não foi possível salvar. Tente novamente."}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {!embedded ? (
            <a
              href="/app/chat"
              className="mb-1 inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-sm hover:bg-muted"
            >
              <ArrowLeft className="size-4" /> Voltar ao inbox
            </a>
          ) : null}
          <h1 className="font-display text-2xl font-bold tracking-tight">Educação da IA</h1>
          <p className="text-sm text-muted-foreground">
            Prompt + base de conhecimento + exemplos (sem fine-tune). Salve com os formulários
            abaixo.
          </p>
        </div>
      </div>

      {!initial.openAiConfigured ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          Configure <code className="text-xs">OPENAI_API_KEY</code> no{" "}
          <code className="text-xs">.env.local</code> para respostas automáticas.
        </div>
      ) : null}

      <form
        method="post"
        action="/api/settings/chatbot/education"
        className="space-y-4 rounded-xl border border-border/60 bg-card p-6 shadow-soft"
      >
        <input type="hidden" name="kind" value="save-settings" />
        {returnPath ? <input type="hidden" name="returnPath" value={returnPath} /> : null}
        <div>
          <h2 className="text-base font-semibold">Controle geral</h2>
          <p className="text-sm text-muted-foreground">
            Desliga a IA em todas as conversas. Atendente no chat ainda pode pausar só aquela
            conversa.
          </p>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <span>
            <span className="block text-sm font-medium">IA ligada no chatbot</span>
            <span className="block text-xs text-muted-foreground">
              Afeta conversas novas/recebidas
            </span>
          </span>
          <input
            type="checkbox"
            name="aiGlobalEnabled"
            value="true"
            defaultChecked={settings.aiGlobalEnabled}
            className="size-4 cursor-pointer accent-primary"
          />
        </label>
        <div className="space-y-2">
          <label htmlFor="openai-model" className="text-sm font-medium">
            Modelo OpenAI
          </label>
          <input
            id="openai-model"
            name="openaiModel"
            defaultValue={settings.openaiModel}
            placeholder="gpt-4o-mini"
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="system-prompt" className="text-sm font-medium">
            Instruções (system prompt)
          </label>
          <textarea
            id="system-prompt"
            name="systemPrompt"
            defaultValue={settings.systemPrompt}
            className={`${textareaClass} min-h-[160px]`}
          />
        </div>
        <button type="submit" className={btnPrimary}>
          <Save className="size-4" aria-hidden /> Salvar IA
        </button>
      </form>

      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6 shadow-soft">
        <div>
          <h2 className="text-base font-semibold">Base de conhecimento</h2>
          <p className="text-sm text-muted-foreground">FAQ e fatos que a IA pode citar.</p>
        </div>
        <form method="post" action="/api/settings/chatbot/education" className="grid gap-2">
          <input type="hidden" name="kind" value="add-knowledge" />
          {returnPath ? <input type="hidden" name="returnPath" value={returnPath} /> : null}
          <input name="title" placeholder="Título (ex.: Horário de atendimento)" className={inputClass} />
          <textarea name="content" placeholder="Conteúdo..." className={textareaClass} />
          <button type="submit" className={btnSecondary}>
            <Plus className="size-4" aria-hidden /> Adicionar
          </button>
        </form>
        <ul className="space-y-2">
          {knowledge.map((item) => (
            <li key={item.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {item.content}
                  </p>
                </div>
                <form method="post" action="/api/settings/chatbot/education">
                  <input type="hidden" name="kind" value="delete-knowledge" />
                  {returnPath ? <input type="hidden" name="returnPath" value={returnPath} /> : null}
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className={btnGhostDanger} title="Remover">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6 shadow-soft">
        <div>
          <h2 className="text-base font-semibold">Exemplos de atendimento</h2>
          <p className="text-sm text-muted-foreground">Few-shot: tom e formato das respostas.</p>
        </div>
        <form method="post" action="/api/settings/chatbot/education" className="grid gap-2">
          <input type="hidden" name="kind" value="add-example" />
          {returnPath ? <input type="hidden" name="returnPath" value={returnPath} /> : null}
          <textarea name="userSays" placeholder="Cliente diz..." className={textareaClass} />
          <textarea
            name="assistantReplies"
            placeholder="Assistente responde..."
            className={textareaClass}
          />
          <button type="submit" className={btnSecondary}>
            <Plus className="size-4" aria-hidden /> Adicionar exemplo
          </button>
        </form>
        <ul className="space-y-2">
          {examples.map((item) => (
            <li key={item.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex justify-between gap-2">
                <div>
                  <p>
                    <span className="font-medium">Cliente:</span> {item.userSays}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    <span className="font-medium text-foreground">IA:</span>{" "}
                    {item.assistantReplies}
                  </p>
                </div>
                <form method="post" action="/api/settings/chatbot/education">
                  <input type="hidden" name="kind" value="delete-example" />
                  {returnPath ? <input type="hidden" name="returnPath" value={returnPath} /> : null}
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className={btnGhostDanger} title="Remover">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
