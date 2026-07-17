import { createFileRoute } from "@tanstack/react-router";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig } from "@/lib/auth/session-config";
import {
  deleteAiExample,
  deleteAiKnowledge,
  listAiExamples,
  listAiKnowledge,
  saveChatAiSettings,
  setAiEnabledForAllConversations,
  upsertAiExample,
  upsertAiKnowledge,
} from "@/lib/chat/chat.repository";

function redirectIa(extra: Record<string, string> = {}): Response {
  const returnPath = String(extra.returnPath ?? "").trim();
  if (returnPath.startsWith("/app/chat/ia")) {
    const params = new URLSearchParams();
    if (extra.ok) params.set("ok", extra.ok);
    if (extra.err) params.set("err", extra.err);
    const qs = params.toString();
    return new Response(null, {
      status: 303,
      headers: { Location: qs ? `${returnPath}?${qs}` : returnPath },
    });
  }
  const params = new URLSearchParams({ tab: "chatbot" });
  if (extra.ok) params.set("ok", extra.ok);
  if (extra.err) params.set("err", extra.err);
  return new Response(null, {
    status: 303,
    headers: { Location: `/app/configuracoes?${params.toString()}` },
  });
}

async function requireUser() {
  const session = await getSession(sessionConfig);
  const user = session.data;
  if (!user?.userId) return null;
  const allowed =
    user.role === "master" ||
    sessionCanAccessMenu(user, "configuracoes") ||
    sessionCanAccessMenu(user, "chat");
  if (!allowed) return null;
  return user;
}

export const Route = createFileRoute("/api/settings/chatbot/education")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await requireUser();
        if (!user) {
          return new Response(null, { status: 303, headers: { Location: "/login" } });
        }

        const form = await request.formData();
        const kind = String(form.get("kind") ?? "").trim();
        const returnPath = String(form.get("returnPath") ?? "").trim();
        const redirectExtra = { returnPath };

        try {
          if (kind === "save-settings") {
            const aiGlobalEnabled =
              form.get("aiGlobalEnabled") === "on" ||
              form.get("aiGlobalEnabled") === "true";
            await saveChatAiSettings({
              aiGlobalEnabled,
              openaiModel: String(form.get("openaiModel") ?? "").trim() || "gpt-4o-mini",
              systemPrompt: String(form.get("systemPrompt") ?? ""),
            });
            await setAiEnabledForAllConversations(aiGlobalEnabled);
            return redirectIa({ ...redirectExtra, ok: "salva" });
          }

          if (kind === "add-knowledge") {
            const title = String(form.get("title") ?? "").trim();
            const content = String(form.get("content") ?? "").trim();
            if (!title || !content) {
              return redirectIa({ ...redirectExtra, err: "conhecimento" });
            }
            const knowledge = await listAiKnowledge();
            await upsertAiKnowledge({
              id: `know-${crypto.randomUUID().slice(0, 8)}`,
              title,
              content,
              enabled: true,
              sortOrder: knowledge.length,
            });
            return redirectIa({ ...redirectExtra, ok: "conhecimento" });
          }

          if (kind === "delete-knowledge") {
            const id = String(form.get("id") ?? "").trim();
            if (id) await deleteAiKnowledge(id);
            return redirectIa({ ...redirectExtra, ok: "removido" });
          }

          if (kind === "add-example") {
            const userSays = String(form.get("userSays") ?? "").trim();
            const assistantReplies = String(form.get("assistantReplies") ?? "").trim();
            if (!userSays || !assistantReplies) {
              return redirectIa({ ...redirectExtra, err: "exemplo" });
            }
            const examples = await listAiExamples();
            await upsertAiExample({
              id: `ex-${crypto.randomUUID().slice(0, 8)}`,
              userSays,
              assistantReplies,
              enabled: true,
              sortOrder: examples.length,
            });
            return redirectIa({ ...redirectExtra, ok: "exemplo" });
          }

          if (kind === "delete-example") {
            const id = String(form.get("id") ?? "").trim();
            if (id) await deleteAiExample(id);
            return redirectIa({ ...redirectExtra, ok: "removido" });
          }

          return redirectIa({ ...redirectExtra, err: "acao" });
        } catch {
          return redirectIa({ ...redirectExtra, err: "salvar" });
        }
      },
    },
  },
});
