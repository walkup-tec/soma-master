import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  BotOff,
  ImagePlus,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  StickyNote,
  X,
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
  appendChatImageChunkFn,
  finalizeAndSendChatImageFn,
  getChatThreadFn,
  initChatImageUploadFn,
  joinChatConversationFn,
  listChatConversationsFn,
  sendChatMessageFn,
  setChatAiGlobalEnabledFn,
  setChatConversationAiFn,
} from "@/lib/chat/chat.server";
import {
  CHAT_IMAGE_ACCEPT,
  CHAT_IMAGE_CHUNK_BYTES,
  CHAT_IMAGE_MAX_BYTES,
} from "@/lib/chat/chat-media.constants";
import { readFileInChunks } from "@/lib/clients/upload-file-chunks";
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
  const initImageUpload = useServerFn(initChatImageUploadFn);
  const appendImageChunk = useServerFn(appendChatImageChunkFn);
  const finalizeAndSendImage = useServerFn(finalizeAndSendChatImageFn);
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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState<ComposerMode>("reply");
  const [aiGlobalEnabled, setAiGlobalEnabled] = useState(bootstrap.aiSettings.aiGlobalEnabled);
  const [togglingAiGlobal, setTogglingAiGlobal] = useState(false);
  // Nome/WhatsApp digitados no formulário Vincular ao CRM — o cabeçalho Contato espelha
  const [contactDraft, setContactDraft] = useState<{ name: string; phone: string }>({
    name: "",
    phone: "",
  });
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

  function clearSelectedImage() {
    if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
    setSelectedImage(null);
    setSelectedImageUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function chooseImage(file: File | undefined) {
    if (!file) return;
    if (!CHAT_IMAGE_ACCEPT.split(",").includes(file.type)) {
      toast.error("Use uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (file.size <= 0 || file.size > CHAT_IMAGE_MAX_BYTES) {
      toast.error("A imagem deve ter no máximo 10 MB.");
      return;
    }
    if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
    setSelectedImage(file);
    setSelectedImageUrl(URL.createObjectURL(file));
  }

  async function refreshList() {
    const next = await listConversations();
    setConversations(next);
  }

  async function openConversation(id: string) {
    setSelectedId(id);
    setContactDraft({ name: "", phone: "" });
    clearSelectedImage();
    setLoadingThread(true);
    try {
      // Abrir conversa atribui ao usuário, mas preserva o estado individual da IA.
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

  async function handleSendImage() {
    if (!selectedId || !selectedImage || !selectedImageUrl) return;
    const file = selectedImage;
    const previewUrl = selectedImageUrl;
    const caption = text.trim();
    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const optimistic: ChatMessage = {
      id: tempId,
      conversationId: selectedId,
      direction: "outbound",
      body: caption,
      messageType: "image",
      mediaId: null,
      mediaMimeType: file.type,
      mediaFileName: file.name,
      mediaPreviewUrl: previewUrl,
      senderType: "agent",
      senderUserId: userId,
      senderName: active?.assignedUserName ?? "Você",
      waMessageId: null,
      createdAt: now,
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setActive((prev) =>
      prev
        ? {
            ...prev,
            lastMessageAt: now,
            lastMessagePreview: `📷 ${caption || "Imagem"}`,
            assignedUserId: prev.assignedUserId ?? userId,
            aiEnabled: false,
          }
        : prev,
    );
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedId
          ? {
              ...conversation,
              lastMessageAt: now,
              lastMessagePreview: `📷 ${caption || "Imagem"}`,
              assignedUserId: conversation.assignedUserId ?? userId,
              aiEnabled: false,
            }
          : conversation,
      ),
    );

    setSending(true);
    try {
      const totalChunks = Math.ceil(file.size / CHAT_IMAGE_CHUNK_BYTES);
      const upload = await initImageUpload({
        data: {
          conversationId: selectedId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          totalChunks,
        },
      });
      await readFileInChunks(file, CHAT_IMAGE_CHUNK_BYTES, async (chunkIndex, _total, base64) => {
        await appendImageChunk({
          data: { mediaId: upload.mediaId, chunkIndex, chunkBase64: base64 },
        });
      });
      const result = await finalizeAndSendImage({
        data: { mediaId: upload.mediaId, caption },
      });
      setMessages((prev) => prev.map((message) => (message.id === tempId ? result.message : message)));
      if (result.conversation) {
        setActive(result.conversation);
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === result.conversation?.id
              ? { ...conversation, ...result.conversation }
              : conversation,
          ),
        );
      }
      clearSelectedImage();
      if (!result.evolution.ok) {
        toast.message("Imagem salva no CRM", {
          description: result.evolution.error ?? "Evolution não enviou a imagem.",
        });
      }
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      setText(caption);
      toast.error(error instanceof Error ? error.message : "Falha ao enviar imagem");
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    if (!selectedId || (!text.trim() && !selectedImage)) return;
    if (selectedImage) {
      await handleSendImage();
      return;
    }
    const body = text.trim();
    const tempId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const optimistic: ChatMessage = {
      id: tempId,
      conversationId: selectedId,
      direction: "outbound",
      body,
      messageType: "text",
      mediaId: null,
      mediaMimeType: null,
      mediaFileName: null,
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
      // O comando geral aplica o estado a todas; depois cada chat pode sobrescrever.
      setConversations((prev) =>
        prev.map((conversation) => ({
          ...conversation,
          aiEnabled: saved.aiGlobalEnabled,
        })),
      );
      setActive((prev) =>
        prev ? { ...prev, aiEnabled: saved.aiGlobalEnabled } : prev,
      );
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
              size="icon"
              variant="outline"
              className={cn(
                "size-9 shrink-0 cursor-pointer transition-colors",
                aiGlobalEnabled
                  ? "border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700 hover:text-white"
                  : "border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              disabled={togglingAiGlobal}
              aria-pressed={aiGlobalEnabled}
              aria-label={
                aiGlobalEnabled
                  ? "Desligar IA em todos os atendimentos"
                  : "Ligar IA em todos os atendimentos"
              }
              title={
                aiGlobalEnabled
                  ? "Desligar IA em todos os atendimentos"
                  : "Ligar IA em todos os atendimentos"
              }
              onClick={() => void handleToggleAiGlobal()}
            >
              {togglingAiGlobal ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
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
                    "w-full cursor-pointer rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted",
                    selectedId === conv.id &&
                      "border-primary bg-transparent hover:bg-transparent dark:border-primary dark:bg-transparent",
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
                type="button"
                size="icon"
                variant="outline"
                className={cn(
                  "size-9 shrink-0 cursor-pointer transition-colors",
                  active?.aiEnabled
                    ? "border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700 hover:text-white"
                    : "border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-pressed={Boolean(active?.aiEnabled)}
                aria-label={
                  active?.aiEnabled ? "Pausar IA nesta conversa" : "Ativar IA nesta conversa"
                }
                title={active?.aiEnabled ? "Pausar IA nesta conversa" : "Ativar IA nesta conversa"}
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
                <Sparkles className="size-4" />
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
                          {msg.messageType === "image" &&
                          (msg.mediaPreviewUrl || msg.mediaId) ? (
                            <img
                              src={
                                msg.mediaPreviewUrl ??
                                `/api/chat/media/${encodeURIComponent(msg.mediaId!)}`
                              }
                              alt={msg.body || msg.mediaFileName || "Imagem do WhatsApp"}
                              className="max-h-80 w-auto max-w-full rounded-xl object-contain"
                              loading="lazy"
                            />
                          ) : null}
                          {msg.body ? (
                            <p
                              className={cn(
                                "whitespace-pre-wrap",
                                msg.messageType === "image" && "mt-1.5",
                              )}
                            >
                              {msg.body}
                            </p>
                          ) : null}
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
                <div className="space-y-2">
                  {selectedImageUrl ? (
                    <div className="relative inline-flex max-w-[220px] rounded-lg border border-border bg-muted/30 p-1">
                      <img
                        src={selectedImageUrl}
                        alt="Imagem selecionada para envio"
                        className="max-h-32 rounded-md object-contain"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute -right-2 -top-2 size-6 cursor-pointer rounded-full"
                        aria-label="Remover imagem"
                        onClick={clearSelectedImage}
                        disabled={sending}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept={CHAT_IMAGE_ACCEPT}
                      className="sr-only"
                      onChange={(event) => chooseImage(event.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="shrink-0 cursor-pointer"
                      aria-label="Enviar imagem"
                      title="Enviar imagem (JPG, PNG ou WEBP; até 10 MB)"
                      disabled={sending}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <ImagePlus className="size-4" />
                    </Button>
                    <Input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={
                        selectedImage
                          ? "Legenda opcional… (Enter envia)"
                          : "Escreva para o cliente… (Enter envia)"
                      }
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
                      disabled={sending || (!text.trim() && !selectedImage)}
                      aria-busy={sending}
                    >
                      {sending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </Button>
                  </div>
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
              {contactDraft.name || active.clientName || active.contactName || "Sem nome"}
            </h3>
            <p className="text-xs text-muted-foreground">{contactDraft.phone || active.phone}</p>
          </div>
          <div className="p-4">
            <ChatContactPanel
              conversation={active}
              attendanceStatuses={attendanceStatuses}
              products={products}
              banks={banks}
              onDraftChange={setContactDraft}
              onUpdated={(next) => {
                setContactDraft({ name: "", phone: "" });
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
