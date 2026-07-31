import {
  advanceBotRun,
  createBotRunState,
  findStartNode,
} from "@/lib/bots/bot-runtime.engine";
import { getBotFlowFromServer } from "@/lib/bots/bot-flow.repository";
import { loadBotLeadVariables } from "@/lib/bots/bot-lead.service";
import type { BotOutboundPayload, BotRunState } from "@/lib/bots/bot.types";
import {
  appendMessage,
  getConversation,
  setConversationAiEnabled,
  setConversationBotEnabled,
  setConversationBotRun,
} from "@/lib/chat/chat.repository";
import {
  evolutionSendButtons,
  evolutionSendText,
} from "@/lib/chat/evolution.adapter";
import { resolveChatbotRuntimeSelection } from "@/lib/config/chatbot-runtime-schedule";
import { loadSystemSettingsFromDisk } from "@/lib/config/settings.repository";

/** Serializa execuções do bot por conversa (evita reinício por race em mensagens rápidas). */
const conversationBotLocks = new Map<string, Promise<unknown>>();

async function withConversationBotLock<T>(conversationId: string, fn: () => Promise<T>): Promise<T> {
  const previous = conversationBotLocks.get(conversationId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  conversationBotLocks.set(
    conversationId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

function shouldRestartRun(run: BotRunState | null | undefined, botId: string): boolean {
  if (!run) return true;
  if (run.flowId !== botId) return true;
  // Em andamento / aguardando resposta: NUNCA reinicia — continua o fluxo.
  if (run.phase === "waiting_reply" || run.phase === "running" || run.phase === "starting") {
    return false;
  }
  if (run.phase === "finished" || run.phase === "error" || run.phase === "idle") return true;
  return false;
}

function isGhostButtonsPayload(raw: unknown): boolean {
  const text = JSON.stringify(raw ?? "");
  // Só viewOnce é fantasma. Em 2.4.0+, nativeFlowMessage sem viewOnce é botão válido.
  return text.includes("viewOnceMessage");
}

async function dispatchBotOutbound(input: {
  conversationId: string;
  phone: string;
  botName: string;
  payloads: BotOutboundPayload[];
}): Promise<void> {
  for (const payload of input.payloads) {
    if (payload.type === "text") {
      const body = String(payload.text || "").trim();
      if (!body) continue;
      await appendMessage({
        conversationId: input.conversationId,
        direction: "outbound",
        body,
        senderType: "ai",
        senderName: input.botName,
      });
      const send = await evolutionSendText({ phone: input.phone, text: body });
      if (!send.ok) {
        console.error("[chatbot-runtime] sendText falhou", {
          phone: input.phone,
          error: send.error,
        });
        await appendMessage({
          conversationId: input.conversationId,
          direction: "outbound",
          body: `⚠️ Bot salvou no CRM, mas não entregou no WhatsApp: ${send.error ?? "erro desconhecido"}`,
          senderType: "system",
          senderName: "Sistema",
        });
      }
      continue;
    }

    const interactive = payload.interactive;
    const body = String(interactive.text || "").trim();
    if (!body) continue;

    const optionLabels = interactive.options.map((opt) => opt.label).filter(Boolean);
    const numbered = `${body}\n\n${interactive.options
      .map((opt, index) => `${index + 1}. ${opt.label}`)
      .join("\n")}`;
    const crmBody =
      optionLabels.length > 0
        ? `${body}\n\n${optionLabels.map((label) => `• ${label}`).join("\n")}`
        : body;

    await appendMessage({
      conversationId: input.conversationId,
      direction: "outbound",
      body: crmBody,
      senderType: "ai",
      senderName: input.botName,
    });

    // Botões reply via Evolution. Em 2.4.0+ o payload válido usa interactive/nativeFlow
    // (sem viewOnce). Se falhar ou vier fantasma, cai para texto numerado.
    if (interactive.kind === "buttons" && optionLabels.length > 0) {
      const buttonsSend = await evolutionSendButtons({
        phone: input.phone,
        title: body.slice(0, 60),
        description: body.length > 60 ? body : undefined,
        buttons: interactive.options.slice(0, 3).map((opt) => ({
          id: opt.id,
          displayText: opt.label.slice(0, 20),
        })),
      });
      if (buttonsSend.ok && !isGhostButtonsPayload(buttonsSend.raw)) {
        continue;
      }
      console.warn("[chatbot-runtime] sendButtons indisponível/fantasma neste Evolution", {
        error: buttonsSend.error,
        ghost: isGhostButtonsPayload(buttonsSend.raw),
      });
    }

    const textSend = await evolutionSendText({ phone: input.phone, text: numbered });
    if (!textSend.ok) {
      console.error("[chatbot-runtime] sendText (opções) falhou", {
        phone: input.phone,
        error: textSend.error,
      });
      await appendMessage({
        conversationId: input.conversationId,
        direction: "outbound",
        body: `⚠️ Bot salvou no CRM, mas não entregou no WhatsApp: ${textSend.error ?? "erro desconhecido"}`,
        senderType: "system",
        senderName: "Sistema",
      });
    }
  }
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
  return withConversationBotLock(input.conversationId, async () => {
    // Releitura dentro do lock — evita dois "Oi" criarem dois runs em paralelo.
    const conversation = await getConversation(input.conversationId);
    if (!conversation) return false;

    // Atendente assume a conversa — mas se o bot já está ativo (ex.: enviado manualmente),
    // continua o fluxo para não perder a resposta dos botões.
    if (conversation.assignedUserId) {
      const phase = conversation.botRun?.phase;
      const botActive =
        conversation.botEnabled !== false &&
        (phase === "waiting_reply" || phase === "running" || phase === "starting");
      if (!botActive) return false;
    }
    // Bot pausado nesta conversa
    if (!conversation.botEnabled) return false;

    const settings = await loadSystemSettingsFromDisk();
    const selection = resolveChatbotRuntimeSelection(settings.chatbotRuntime);
    const botId = selection.botId;
    if (!botId) return false;

    const flow = await getBotFlowFromServer(botId);
    if (!flow || !findStartNode(flow)) {
      console.warn("[chatbot-runtime] fluxo ausente ou sem Início", {
        botId,
        window: selection.window,
      });
      return false;
    }

    let run = conversation.botRun ?? null;
    const continueWaiting =
      Boolean(run) && !shouldRestartRun(run, botId) && run?.phase === "waiting_reply";
    const inboundForAdvance = continueWaiting ? input.inboundText : undefined;

    if (shouldRestartRun(run, botId)) {
      run = createBotRunState({ flow, testPhone: input.phone });
    }

    const leadVars = await loadBotLeadVariables({
      conversationId: input.conversationId,
      phone: input.phone,
    });
    run = {
      ...run!,
      variables: {
        ...leadVars,
        ...run!.variables,
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

    // Persiste o estado ANTES do envio WhatsApp — reduz janela de race no próximo inbound.
    await setConversationBotRun({
      conversationId: input.conversationId,
      botRun: run,
    });

    await dispatchBotOutbound({
      conversationId: input.conversationId,
      phone: input.phone,
      botName: flow.name || "Bot Soma",
      payloads: advanced.outbound,
    });

    return true;
  });
}

/**
 * Atendente inicia manualmente um bot na conversa aberta (composer).
 * Reinicia o fluxo do bot escolhido e envia as primeiras mensagens no WhatsApp.
 */
export async function startBotOnConversation(input: {
  conversationId: string;
  botId: string;
  startedByName?: string;
}): Promise<{ ok: true; flowName: string; outboundCount: number } | { ok: false; error: string }> {
  const conversationId = String(input.conversationId || "").trim();
  const botId = String(input.botId || "").trim();
  if (!conversationId || !botId) {
    return { ok: false, error: "Conversa e bot são obrigatórios." };
  }

  return withConversationBotLock(conversationId, async () => {
    const conversation = await getConversation(conversationId);
    if (!conversation) return { ok: false, error: "Conversa não encontrada." };

    const flow = await getBotFlowFromServer(botId);
    if (!flow || !findStartNode(flow)) {
      return { ok: false, error: "Bot não encontrado ou sem node Início." };
    }

    // Liga bot / desliga IA para o fluxo continuar nas próximas respostas.
    await setConversationBotEnabled({ conversationId, botEnabled: true });
    await setConversationAiEnabled({ conversationId, aiEnabled: false });

    const leadVars = await loadBotLeadVariables({
      conversationId,
      phone: conversation.phone,
    });
    let run = createBotRunState({ flow, testPhone: conversation.phone });
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
      conversationId,
      phone: conversation.phone,
    });
    run = advanced.run;

    await setConversationBotRun({ conversationId, botRun: run });

    const starter = String(input.startedByName || "").trim();
    await appendMessage({
      conversationId,
      direction: "outbound",
      body: starter
        ? `${starter} iniciou o bot “${flow.name || "Bot"}”.`
        : `Bot “${flow.name || "Bot"}” iniciado neste atendimento.`,
      senderType: "system",
      senderName: "Sistema",
    });

    await dispatchBotOutbound({
      conversationId,
      phone: conversation.phone,
      botName: flow.name || "Bot Soma",
      payloads: advanced.outbound,
    });

    return {
      ok: true,
      flowName: flow.name || "Bot",
      outboundCount: advanced.outbound.length,
    };
  });
}
