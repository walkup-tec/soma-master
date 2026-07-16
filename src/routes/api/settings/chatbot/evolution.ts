import { createFileRoute } from "@tanstack/react-router";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig } from "@/lib/auth/session-config";
import {
  appendMessage,
  getChatAiSettings,
  getOrCreateConversationByPhone,
  saveChatAiSettings,
} from "@/lib/chat/chat.repository";
import {
  clearEvolutionQrFlash,
  putEvolutionQrFlash,
  takeEvolutionQrFlash,
} from "@/lib/chat/evolution-qr-flash";
import {
  ensureSomaEvolutionInstance,
  evolutionConnectQr,
  evolutionConnectionState,
  evolutionSetInstanceWebhook,
  getEvolutionPublicConfig,
} from "@/lib/chat/evolution.adapter";

function redirectChatbot(extra: Record<string, string> = {}): Response {
  const params = new URLSearchParams({ tab: "chatbot" });
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
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

export const Route = createFileRoute("/api/settings/chatbot/evolution")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await requireUser();
        if (!user) {
          return new Response(null, { status: 303, headers: { Location: "/login" } });
        }

        const form = await request.formData();
        const kind = String(form.get("kind") ?? "refresh").trim();

        if (kind === "webhook") {
          try {
            const base = String(form.get("webhookPublicBaseUrl") ?? "").trim();
            await saveChatAiSettings({ webhookPublicBaseUrl: base });
            const settings = await getChatAiSettings();
            const applied = await evolutionSetInstanceWebhook(null, settings.webhookPublicBaseUrl);
            if (!applied.ok) {
              putEvolutionQrFlash(user.userId, {
                state: takeEvolutionQrFlash(user.userId)?.state ?? "unknown",
                qr: takeEvolutionQrFlash(user.userId)?.qr ?? {},
                error: applied.error,
              });
              return redirectChatbot({ err: "webhook" });
            }
            return redirectChatbot({ ok: "webhook" });
          } catch {
            return redirectChatbot({ err: "webhook" });
          }
        }

        if (kind === "test-inbound") {
          try {
            const phone = String(form.get("phone") ?? "").replace(/\D/g, "");
            const text = String(form.get("text") ?? "").trim();
            const contactName = String(form.get("contactName") ?? "Contato teste").trim() || "Contato teste";
            if (phone.length < 10 || !text) {
              return redirectChatbot({ err: "teste" });
            }
            const conversation = await getOrCreateConversationByPhone({ phone, contactName });
            await appendMessage({
              conversationId: conversation.id,
              direction: "inbound",
              body: text,
              senderType: "contact",
              senderName: contactName,
              bumpUnread: true,
            });
            return new Response(null, {
              status: 303,
              headers: { Location: `/app/chat` },
            });
          } catch {
            return redirectChatbot({ err: "teste" });
          }
        }

        if (kind === "status") {
          try {
            const config = getEvolutionPublicConfig();
            if (!config.configured) {
              return redirectChatbot({ err: "config" });
            }
            const settings = await getChatAiSettings();
            await ensureSomaEvolutionInstance({
              webhookPublicBaseUrl: settings.webhookPublicBaseUrl,
            });
            const connected = await evolutionConnectionState();
            putEvolutionQrFlash(user.userId, {
              state: connected.state,
              qr:
                connected.state === "open"
                  ? {}
                  : (takeEvolutionQrFlash(user.userId)?.qr ?? {}),
              error: connected.error,
            });
            return redirectChatbot({ ok: "status" });
          } catch {
            return redirectChatbot({ err: "salvar" });
          }
        }

        try {
          const config = getEvolutionPublicConfig();
          if (!config.configured) {
            clearEvolutionQrFlash(user.userId);
            return redirectChatbot({ err: "config" });
          }

          const settings = await getChatAiSettings();
          const ensured = await ensureSomaEvolutionInstance({
            webhookPublicBaseUrl: settings.webhookPublicBaseUrl,
          });
          if (!ensured.ok) {
            putEvolutionQrFlash(user.userId, {
              state: "unknown",
              qr: {},
              error: ensured.error,
            });
            return redirectChatbot({ err: "instancia" });
          }

          const connected = await evolutionConnectionState();
          if (connected.ok && connected.state === "open") {
            clearEvolutionQrFlash(user.userId);
            return redirectChatbot({ ok: "conectado" });
          }

          const connect = await evolutionConnectQr();
          putEvolutionQrFlash(user.userId, {
            state: connect.state,
            qr: connect.qr ?? {},
            error: connect.error,
          });

          if (!connect.ok) {
            return redirectChatbot({ err: "qr" });
          }
          return redirectChatbot({ ok: "qr" });
        } catch {
          return redirectChatbot({ err: "salvar" });
        }
      },
    },
  },
});
