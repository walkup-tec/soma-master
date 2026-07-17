import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Bot,
  BotOff,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { ChatContactPanel } from "@/components/chat/chat-contact-panel";
import { StatusBadge } from "@/components/clients/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ChatAiSettings, ChatConversation, ChatMessage } from "@/lib/chat/chat.types";
import {
  addChatAttendanceNoteFn,
  getChatThreadFn,
  joinChatConversationFn,
  listChatConversationsFn,
  sendChatMessageFn,
  setChatAiGlobalEnabledFn,
  setChatConversationAiFn,
} from "@/lib/chat/chat.server";
import type { AttendanceStatusConfig, BankConfig, ProductConfig } from "@/lib/config/settings-types";

type Bootstrap = {
  conversations: ChatConversation[];
  aiSettings: ChatAiSettings;
  evolutionConfigured: boolean;
  openAiConfigured: boolean;
  currentUserId: string;
};

type FilterTab = "mine" | "unassigned" | "all";
type ComposerMode = "reply" | "note";

/**
 * Inbox estilo Chatwoot / BotConversa:
 * lista (Mine/Unassigned/All) | thread | cartão do contato.
 * Configurações ficam só em Configurações → Integração EVO.
 */
export function ChatInboxScreen({
  bootstrap,
  attendanceStatuses,
  products,
  banks,
}: {
  bootstrap: Bootstrap;
  attendanceStatuses: AttendanceStatusConfig[];
  products: ProductConfig[];
  banks: BankConfig[];
}) {
  const listConversations = useServerFn(listChatConversationsFn);
  const getThread = useServerFn(getChatThreadFn);
  const joinChat = useServerFn(joinChatConversationFn);
  const sendMessage = useServerFn(sendChatMessageFn);
  const setConvAi = useServerFn(setChatConversationAiFn);
  const setAiGlobal = useServerFn(setChatAiGlobalEnabledFn);
  const addNote = useServerFn(addChatAttendanceNoteFn);

  const [conversations, setConversations] = useState(bootstrap.conversations);
  const [selectedId, setSelectedId] = useState<string | null>(bootstrap.conversations[0]?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [active, setActive] = useState<ChatConversation | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState<ComposerMode>("reply");
  const [aiGlobalEnabled, setAiGlobalEnabled] = useState(bootstrap.aiSettings.aiGlobalEnabled);
  const [togglingAiGlobal, setTogglingAiGlobal] = useState(false);
  const userId = bootstrap.currentUserId;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...conversations]
      .sort((a, b) =>
        (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt),
      )
      .filter((conv) => {
        if (filter === "mine" && userId) return conv.assignedUserId === userId;
        if (filter === "unassigned") return !conv.assignedUserId;
        return true;
      })
      .filter((conv) => {
        if (!q) return true;
        const hay = `${conv.clientName ?? ""} ${conv.contactName ?? ""} ${conv.phone} ${conv.lastMessagePreview ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
  }, [conversations, filter, query, userId]);

  async function refreshList() {
    const next = await listConversations();
    setConversations(next);
  }

  async function openConversation(id: string) {
    setSelectedId(id);
    setLoadingThread(true);
    try {
      // Abrir conversa = assumir atendimento (atribui ao usuário e pausa IA local)
      await joinChat({ data: { conversationId: id } });
      const thread = await getThread({ data: { conversationId: id } });
      setActive(thread.conversation);
      setMessages(thread.messages);
      await refreshList();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao abrir conversa");
    } finally {
      setLoadingThread(false);
    }
  }

  useEffect(() => {
    if (selectedId) void openConversation(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll leve — novas mensagens via webhook / teste (não reatribui)
  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshList().then(() => {
        if (selectedId) {
          void getThread({ data: { conversationId: selectedId } }).then((thread) => {
            setActive(thread.conversation);
            setMessages(thread.messages);
          });
        }
      });
    }, 10_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function handleSend() {
    if (!selectedId || !text.trim()) return;
    const body = text.trim();
    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const optimistic: ChatMessage = {
      id: tempId,
      conversationId: selectedId,
      direction: "outbound",
      body,
      senderType: "agent",
      senderUserId: userId,
      senderName: active?.assignedUserName ?? "Você",
      waMessageId: null,
      createdAt: now,
    };

    // Feedback imediato — não espera Evolution / reload do thread
    setText("");
    setMessages((prev) => [...prev, optimistic]);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              lastMessageAt: now,
              lastMessagePreview: body.slice(0, 120),
              assignedUserId: c.assignedUserId ?? userId,
              aiEnabled: false,
            }
          : c,
      ),
    );
    if (active?.id === selectedId) {
      setActive({
        ...active,
        lastMessageAt: now,
        lastMessagePreview: body.slice(0, 120),
        assignedUserId: active.assignedUserId ?? userId,
        aiEnabled: false,
      });
    }

    setSending(true);
    try {
      const result = await sendMessage({ data: { conversationId: selectedId, text: body } });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? result.message : m)));
      if (result.conversation) {
        setActive(result.conversation);
        setConversations((prev) =>
          prev.map((c) => (c.id === result.conversation.id ? { ...c, ...result.conversation } : c)),
        );
      }
      if (!result.evolution.ok) {
        toast.message("Mensagem salva no CRM", {
          description: result.evolution.error ?? "Evolution não enviou (confira conexão).",
        });
      }
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(body);
      toast.error(error instanceof Error ? error.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  }

  async function handleToggleAiGlobal() {
    const next = !aiGlobalEnabled;
    setTogglingAiGlobal(true);
    setAiGlobalEnabled(next); // otimista
    try {
      const saved = await setAiGlobal({ data: { enabled: next } });
      setAiGlobalEnabled(saved.aiGlobalEnabled);
      toast.success(
        saved.aiGlobalEnabled
          ? "IA ligada em todos os atendimentos"
          : "IA desligada em todos os atendimentos",
      );
    } catch (error) {
      setAiGlobalEnabled(!next);
      toast.error(error instanceof Error ? error.message : "Falha ao alterar IA global");
    } finally {
      setTogglingAiGlobal(false);
    }
  }

  async function handleNote() {
    if (!selectedId || !note.trim()) return;
    try {
      await addNote({ data: { conversationId: selectedId, note: note.trim() } });
      setNote("");
      toast.success("Nota lançada no histórico de atendimento");
      await openConversation(selectedId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar nota");
    }
  }

  const filterTabs: Array<{ id: FilterTab; label: string }> = [
    { id: "mine", label: "Meus" },
    { id: "unassigned", label: "Não atribuídos" },
    { id: "all", label: "Todos" },
  ];

  return (
    <div className="flex h-[calc(100vh-5.5rem)] min-h-[520px] overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      {/* Lista — Chatwoot region 2 */}
      <aside className="flex w-full max-w-[300px] flex-col border-r border-border lg:max-w-[320px]">
        <div className="space-y-2 border-b border-border px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold">Inbox WhatsApp</h2>
              <p className="text-[11px] text-muted-foreground">
                IA global: {aiGlobalEnabled ? "ligada" : "desligada"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={aiGlobalEnabled ? "default" : "outline"}
              className="cursor-pointer shrink-0 gap-1.5"
              disabled={togglingAiGlobal}
              aria-pressed={aiGlobalEnabled}
              title={
                aiGlobalEnabled
                  ? "Desligar IA em todos os atendimentos"
                  : "Ligar IA em todos os atendimentos"
              }
              onClick={() => void handleToggleAiGlobal()}
            >
              {togglingAiGlobal ? (
                <Loader2 className="size-4 animate-spin" />
              ) : aiGlobalEnabled ? (
                <Bot className="size-4" />
              ) : (
                <BotOff className="size-4" />
              )}
              IA
            </Button>
          </div>
          <div
            className="inline-flex w-full gap-1 rounded-lg bg-muted p-1 text-muted-foreground"
            role="tablist"
          >
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "flex-1 cursor-pointer rounded-md px-2 py-1.5 text-[11px] font-medium transition-all",
                  filter === tab.id
                    ? "bg-background text-foreground shadow"
                    : "hover:bg-background/60 hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conversa…"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-0.5 p-2">
            {filtered.length === 0 ? (
              <div className="space-y-3 px-2 py-8 text-center text-sm text-muted-foreground">
                <p>
                  {conversations.length === 0
                    ? "Nenhuma conversa ainda."
                    : "Nenhum resultado neste filtro."}
                </p>
                {conversations.length === 0 ? (
                  <Button asChild size="sm" variant="secondary" className="cursor-pointer">
                    <Link to="/app/configuracoes" search={{ tab: "chatbot" }}>
                      Abrir Integração EVO
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => void openConversation(conv.id)}
                  className={cn(
                    "w-full cursor-pointer rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted",
                    selectedId === conv.id && "bg-primary-soft",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {conv.clientName || conv.contactName || conv.phone}
                    </span>
                    {conv.unreadCount > 0 ? (
                      <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {conv.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {conv.clientStatusLabel ? (
                      <StatusBadge
                        label={conv.clientStatusLabel}
                        color={conv.clientStatusColor ?? "#64748b"}
                        className="origin-left scale-90"
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {conv.assignedUserName ? conv.assignedUserName : "Não atribuído"}
                      </span>
                    )}
                    {!conv.aiEnabled ? <BotOff className="size-3 text-muted-foreground" /> : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {conv.lastMessagePreview ?? "—"}
                  </p>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          EVO {bootstrap.evolutionConfigured ? "OK" : "off"} · OpenAI{" "}
          {bootstrap.openAiConfigured ? "OK" : "off"}
        </div>
      </aside>

      {/* Thread — Chatwoot region 3 */}
      <section className="flex min-w-0 flex-1 flex-col">
        {!selectedId ? (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <MessageCircle className="size-10 opacity-40" />
              <p className="font-medium text-foreground">Selecione uma conversa</p>
              <p className="max-w-sm text-xs">
                Conecte o WhatsApp e configure o webhook em{" "}
                <Link
                  to="/app/configuracoes"
                  search={{ tab: "chatbot" }}
                  className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline"
                >
                  Integração EVO
                </Link>
                , ou use o teste de mensagem local.
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-display text-base font-semibold">
                  {active?.clientName || active?.contactName || active?.phone}
                </h3>
                <p className="text-xs text-muted-foreground">{active?.phone}</p>
              </div>
              <Button
                size="sm"
                variant={active?.aiEnabled ? "secondary" : "outline"}
                className="cursor-pointer"
                onClick={async () => {
                  try {
                    const next = await setConvAi({
                      data: { conversationId: selectedId, aiEnabled: !active?.aiEnabled },
                    });
                    setActive(next);
                    toast.success(
                      next?.aiEnabled ? "IA reativada nesta conversa" : "IA pausada nesta conversa",
                    );
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Falha ao alterar IA");
                  }
                }}
              >
                {active?.aiEnabled ? (
                  <Sparkles className="size-4" />
                ) : (
                  <Sparkles className="size-4 opacity-60" />
                )}
                IA {active?.aiEnabled ? "on" : "off"}
              </Button>
            </header>

            <ScrollArea className="flex-1 px-4 py-3">
              {loadingThread ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-2">
                  {messages.map((msg) => {
                    const mine = msg.direction === "outbound" && msg.senderType !== "system";
                    const isSystem = msg.senderType === "system";
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          isSystem ? "justify-center" : mine ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-soft",
                            isSystem && "bg-muted text-xs text-muted-foreground",
                            !isSystem &&
                              mine &&
                              msg.senderType === "ai" &&
                              "bg-secondary text-secondary-foreground",
                            !isSystem &&
                              mine &&
                              msg.senderType === "agent" &&
                              "bg-primary text-primary-foreground",
                            !isSystem && !mine && "bg-muted text-foreground",
                          )}
                        >
                          {!isSystem ? (
                            <div className="mb-0.5 text-[10px] opacity-70">
                              {msg.senderName ?? (msg.senderType === "ai" ? "IA" : "Contato")}
                            </div>
                          ) : null}
                          <p className="whitespace-pre-wrap">{msg.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <div className="border-t border-border p-3">
              <div className="mb-2 inline-flex gap-1 rounded-lg bg-muted p-1">
                {(
                  [
                    { id: "reply" as const, label: "Responder" },
                    { id: "note" as const, label: "Nota interna" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setComposer(tab.id)}
                    className={cn(
                      "cursor-pointer rounded-md px-3 py-1 text-xs font-medium",
                      composer === tab.id
                        ? "bg-background text-foreground shadow"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {composer === "note" ? (
                <div className="flex gap-2">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Nota de atendimento (histórico do cliente)"
                    className="min-h-[44px] resize-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => void handleNote()}
                    disabled={!note.trim()}
                  >
                    <StickyNote className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Escreva para o cliente… (Enter envia)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <Button
                    className="cursor-pointer"
                    onClick={() => void handleSend()}
                    disabled={!text.trim()}
                    aria-busy={sending}
                  >
                    {sending && !text.trim() ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Cartão do contato — Chatwoot region 4 / BotConversa */}
      {selectedId && active ? (
        <aside className="hidden w-[300px] flex-col overflow-y-auto border-l border-border xl:flex">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Contato
            </p>
            <h3 className="mt-1 truncate font-display text-sm font-semibold">
              {active.clientName || active.contactName || "Sem nome"}
            </h3>
            <p className="text-xs text-muted-foreground">{active.phone}</p>
          </div>
          <div className="p-4">
            <ChatContactPanel
              conversation={active}
              attendanceStatuses={attendanceStatuses}
              products={products}
              banks={banks}
              onUpdated={(next) => {
                setActive(next);
                void refreshList();
              }}
            />
          </div>
        </aside>
      ) : null}
    </div>
  );
}
