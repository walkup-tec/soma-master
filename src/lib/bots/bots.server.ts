import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionCanAccessMenu } from "@/lib/auth/menu-access";
import { sessionConfig, type SessionData } from "@/lib/auth/session-config";
import { extractMappedClientData } from "@/lib/bots/bot-map-data.service";
import {
  advanceBotRun,
  createBotRunState,
  executeBotNode,
  findStartNode,
} from "@/lib/bots/bot-runtime.engine";
import { normalizeBotDraft } from "@/lib/bots/bot-flow.normalize";
import type { BotFlowDraft, BotFlowNode, BotMapFieldId, BotRunState } from "@/lib/bots/bot.types";
import {
  SOMA_EVOLUTION_INSTANCE_DEFAULT,
  evolutionSendText,
  isEvolutionConfigured,
} from "@/lib/chat/evolution.adapter";
import { normalizeWhatsAppPhone } from "@/lib/chat/phone";

async function requireBotsAccess(): Promise<SessionData> {
  const session = await getSession(sessionConfig);
  const user = session.data as SessionData | undefined;
  if (!user?.userId) throw new Error("Não autenticado.");
  if (!sessionCanAccessMenu(user, "bots") && !sessionCanAccessMenu(user, "marketing")) {
    throw new Error("Sem permissão para Bots.");
  }
  return user;
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const runs = new Map<string, BotRunState>();

function parseFlow(data: unknown): BotFlowDraft {
  return normalizeBotDraft(data);
}

export const testBotNodeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = (data && typeof data === "object" ? data : {}) as {
      node?: BotFlowNode;
      variables?: Record<string, unknown>;
    };
    return {
      node: body.node as BotFlowNode,
      variables:
        body.variables && typeof body.variables === "object"
          ? (body.variables as Record<string, import("@/lib/bots/bot.types").BotJson>)
          : {},
    };
  })
  .handler(async ({ data }) => {
    await requireBotsAccess();
    if (!data.node?.data?.kind) throw new Error("Node inválido.");
    const result = await executeBotNode({
      node: data.node,
      variables: data.variables,
      // IA (ex.: Saudação) pode chamar OpenAI no teste individual
      dryRun: data.node.data?.executionKind !== "llm",
    });
    return toPlain(result);
  });

export const mapBotDataFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = (data && typeof data === "object" ? data : {}) as {
      mediaBase64?: string;
      mimeType?: string;
      fields?: BotMapFieldId[];
      productId?: string;
    };
    return {
      mediaBase64: String(body.mediaBase64 || ""),
      mimeType: body.mimeType ? String(body.mimeType) : undefined,
      fields: Array.isArray(body.fields) ? (body.fields as BotMapFieldId[]) : [],
      productId: body.productId ? String(body.productId) : undefined,
    };
  })
  .handler(async ({ data }) => {
    await requireBotsAccess();
    return toPlain(await extractMappedClientData(data));
  });

export const startBotTestRunFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = (data && typeof data === "object" ? data : {}) as {
      flow?: unknown;
      testPhone?: string;
    };
    return {
      flow: parseFlow(body.flow),
      testPhone: String(body.testPhone || "").trim(),
    };
  })
  .handler(async ({ data }) => {
    await requireBotsAccess();
    const phone = normalizeWhatsAppPhone(data.testPhone);
    if (!phone || phone.length < 10) {
      return { ok: false as const, error: "Informe um WhatsApp válido para o teste." };
    }
    if (!findStartNode(data.flow)) {
      return { ok: false as const, error: "O fluxo precisa de um node Início." };
    }

    let run = createBotRunState({ flow: data.flow, testPhone: phone });
    const advanced = await advanceBotRun({ flow: data.flow, run });
    run = advanced.run;
    runs.set(run.id, run);

    const sent: string[] = [];
    if (isEvolutionConfigured() && advanced.outboundTexts.length > 0) {
      const instance = SOMA_EVOLUTION_INSTANCE_DEFAULT;
      for (const text of advanced.outboundTexts) {
        const result = await evolutionSendText({
          instanceName: instance,
          phone,
          text,
        });
        if (result.ok) sent.push(text);
        else {
          run.logs.push({
            at: new Date().toISOString(),
            level: "warn",
            message: `Falha ao enviar via Evolution: ${result.error || "erro"}`,
          });
        }
      }
      runs.set(run.id, run);
    }

    return toPlain({
      ok: true as const,
      run,
      sentCount: sent.length,
      evolutionConfigured: isEvolutionConfigured(),
      message:
        advanced.outboundTexts.length === 0
          ? "Execução iniciada (sem mensagem de saída neste passo)."
          : isEvolutionConfigured()
            ? `Execução iniciada · ${sent.length} mensagem(ns) enviada(s) para ${phone}.`
            : `Execução iniciada em modo local (Evolution off). Mensagens: ${advanced.outboundTexts.length}.`,
    });
  });

export const continueBotTestRunFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = (data && typeof data === "object" ? data : {}) as {
      flow?: unknown;
      runId?: string;
      inboundText?: string;
    };
    return {
      flow: parseFlow(body.flow),
      runId: String(body.runId || ""),
      inboundText: body.inboundText != null ? String(body.inboundText) : undefined,
    };
  })
  .handler(async ({ data }) => {
    await requireBotsAccess();
    const current = runs.get(data.runId);
    if (!current) return { ok: false as const, error: "Execução não encontrada." };

    const advanced = await advanceBotRun({
      flow: data.flow,
      run: current,
      inboundText: data.inboundText,
    });
    let run = advanced.run;
    runs.set(run.id, run);

    if (isEvolutionConfigured() && advanced.outboundTexts.length > 0) {
      const instance = SOMA_EVOLUTION_INSTANCE_DEFAULT;
      for (const text of advanced.outboundTexts) {
        await evolutionSendText({
          instanceName: instance,
          phone: run.testPhone,
          text,
        });
      }
    }

    return toPlain({ ok: true as const, run, outboundTexts: advanced.outboundTexts });
  });

export const getBotTestRunFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const body = (data && typeof data === "object" ? data : {}) as { runId?: string };
    return { runId: String(body.runId || "") };
  })
  .handler(async ({ data }) => {
    await requireBotsAccess();
    const run = runs.get(data.runId) || null;
    return toPlain({ ok: Boolean(run), run });
  });
