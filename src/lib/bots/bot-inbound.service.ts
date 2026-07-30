import {
  advanceBotRun,
  createBotRunState,
  findStartNode,
} from "@/lib/bots/bot-runtime.engine";
import { getBotFlowFromServer } from "@/lib/bots/bot-flow.repository";
import { loadBotLeadVariables } from "@/lib/bots/bot-lead.service";
import type { BotRunState } from "@/lib/bots/bot.types";
import {
  appendMessage,
  getConversation,
  setConversationBotRun,
} from "@/lib/chat/chat.repository";
import { evolutionSendText } from "@/lib/chat/evolution.adapter";
import { resolveChatbotRuntimeSelection } from "@/lib/config/chatbot-runtime-schedule";
import { loadSystemSettingsFromDisk } from "@/lib/config/settings.repository";

function shouldRestartRun(run: BotRunState | null | undefined, botId: string): boolean {
  if (!run) return true;
  if (run.flowId !== botId) return true;
  if (run.phase === "finished" || run.phase === "error" || run.phase === "idle") return true;
  return false;
}

/**
 * Executa o bot de expediente/fora conforme a grade (turnos) + horário de Brasília.
 * Retorna true se o bot tratou o inbound (IA não deve responder).
 */
export async function maybeRunChatbotRuntime(input: {
  conversationId: string;
  phone: string;
  inboundText: string;
}): Promise<boolean> {
  const conversation = await getConversation(input.conversationId);
  if (!conversation) return false;

  // Atendente humano assume a conversa
  if (conversation.assignedUserId) return false;

  const settings = await loadSystemSettingsFromDisk();
  const selection = resolveChatbotRuntimeSelection(settings.chatbotRuntime);
  const botId = selection.botId;
  if (!botId) return false;

  const flow = await getBotFlowFromServer(botId);
  if (!flow || !findStartNode(flow)) {
    console.warn("[chatbot-runtime] fluxo ausente ou sem Início", { botId, window: selection.window });
    return false;
  }

  let run = conversation.botRun ?? null;
  const inboundForAdvance =
    run && !shouldRestartRun(run, botId) && run.phase === "waiting_reply"
      ? input.inboundText
      : undefined;

  if (shouldRestartRun(run, botId)) {
    run = createBotRunState({ flow, testPhone: input.phone });
  }

  const leadVars = await loadBotLeadVariables({
    conversationId: input.conversationId,
    phone: input.phone,
  });
  run = {
    ...run,
    variables: {
      ...leadVars,
      ...run.variables,
    },
  };

  const advanced = await advanceBotRun({
    flow,
    run,
    inboundText: inboundForAdvance,
    conversationId: input.conversationId,
    phone: input.phone,
  });
  run = advanced.run;

  for (const text of advanced.outboundTexts) {
    const body = String(text || "").trim();
    if (!body) continue;
    await appendMessage({
      conversationId: input.conversationId,
      direction: "outbound",
      body,
      senderType: "ai",
      senderName: flow.name || "Bot Soma",
    });
    await evolutionSendText({ phone: input.phone, text: body });
  }

  await setConversationBotRun({
    conversationId: input.conversationId,
    botRun: run,
  });

  return true;
}
