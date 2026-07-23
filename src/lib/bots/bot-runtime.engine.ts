import { getBotNodeDefinition } from "@/lib/bots/bot-node.registry";
import { resolveBrasiliaExpedienteTurno } from "@/lib/bots/bot-expediente";
import { generateSaudacaoText } from "@/lib/bots/bot-saudacao.service";
import type {
  BotFlowDraft,
  BotFlowNode,
  BotJson,
  BotNodeExecuteContext,
  BotNodeExecuteResult,
  BotNodeLogEntry,
  BotRunState,
} from "@/lib/bots/bot.types";

function nowIso() {
  return new Date().toISOString();
}

function log(
  level: BotNodeLogEntry["level"],
  message: string,
  data?: Record<string, BotJson>,
): BotNodeLogEntry {
  return { at: nowIso(), level, message, data };
}

function resolveTemplate(template: string, variables: Record<string, BotJson>): string {
  return String(template || "").replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, rawPath: string) => {
    const path = rawPath.trim().split(".");
    let current: BotJson | undefined = variables as BotJson;
    for (const key of path) {
      if (current && typeof current === "object" && !Array.isArray(current) && key in current) {
        current = current[key];
      } else {
        return "";
      }
    }
    if (current == null) return "";
    if (typeof current === "object") return JSON.stringify(current);
    return String(current);
  });
}

function evalSimpleCondition(expression: string, variables: Record<string, BotJson>): boolean {
  const resolved = resolveTemplate(expression, variables).trim().toLowerCase();
  if (!resolved) return false;
  if (resolved.includes(" contém ")) {
    const [left, right] = resolved.split(" contém ").map((part) => part.trim());
    return left.includes(right);
  }
  if (resolved.includes("==")) {
    const [left, right] = resolved.split("==").map((part) => part.trim().replace(/^["']|["']$/g, ""));
    return left === right;
  }
  return ["1", "true", "sim", "yes", "ok"].includes(resolved);
}

/**
 * Executa um node isoladamente (teste individual ou passo do motor).
 * Modular: cada kind tem handler local; novos kinds entram no switch/registry.
 */
export async function executeBotNode(
  ctx: BotNodeExecuteContext,
): Promise<BotNodeExecuteResult> {
  const { node, variables, dryRun } = ctx;
  const { kind, config } = node.data;
  const definition = getBotNodeDefinition(kind);

  try {
    switch (kind) {
      case "start":
        return { ok: true, status: "success", message: "Fluxo iniciado", nextHandle: "out" };

      case "end":
        return { ok: true, status: "success", message: "Fluxo finalizado", nextHandle: undefined };

      case "message":
      case "buttons":
      case "list":
      case "menu": {
        const text = resolveTemplate(config.text || definition?.label || "", variables);
        return {
          ok: true,
          status: "success",
          message: dryRun ? `Simulado: ${text}` : `Mensagem preparada`,
          nextHandle: "out",
          outboundText: text,
          data: { options: (config.options || []) as unknown as BotJson },
        };
      }

      case "image":
      case "pdf":
      case "audio":
      case "video":
        return {
          ok: true,
          status: config.mediaUrl ? "success" : "error",
          message: config.mediaUrl
            ? `Mídia ${kind} pronta`
            : `Informe a URL da mídia (${kind})`,
          nextHandle: config.mediaUrl ? "out" : undefined,
          outboundText: config.mediaCaption
            ? resolveTemplate(config.mediaCaption, variables)
            : undefined,
          data: { mediaUrl: config.mediaUrl || null, kind },
        };

      case "delay": {
        const seconds = Math.max(0, Number(config.delaySeconds) || 0);
        if (!dryRun && seconds > 0 && seconds <= 10) {
          await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        }
        return {
          ok: true,
          status: "success",
          message: `Delay ${seconds}s`,
          nextHandle: "out",
        };
      }

      case "wait_reply":
        return {
          ok: true,
          status: "waiting",
          message: "Aguardando resposta do contato",
          waitForReply: true,
          nextHandle: "out",
          variables: {
            [config.outputVariable || "ultima_resposta"]:
              variables[config.outputVariable || "ultima_resposta"] ?? null,
          },
        };

      case "condition": {
        const ok = evalSimpleCondition(config.expression || "", variables);
        return {
          ok: true,
          status: "success",
          message: ok ? "Condição verdadeira" : "Condição falsa",
          nextHandle: ok ? "true" : "false",
        };
      }

      case "expediente": {
        const turno = resolveBrasiliaExpedienteTurno();
        const outKey = config.outputVariable || "turno";
        return {
          ok: true,
          status: "success",
          message: `Expediente Brasília ${turno.timeLabel}: ${turno.label}`,
          nextHandle: turno.handle,
          variables: {
            [outKey]: turno.id,
            saudacao_turno: turno.label,
            expediente_horario: turno.timeLabel,
          },
          data: {
            turno: turno.id,
            label: turno.label,
            horario: turno.timeLabel,
          },
        };
      }

      case "switch": {
        const value = resolveTemplate(config.expression || "{{ultima_resposta}}", variables)
          .trim()
          .toLowerCase();
        const match = (config.cases || []).find(
          (item) => String(item.value || "").trim().toLowerCase() === value,
        );
        return {
          ok: true,
          status: "success",
          message: match ? `Caso ${match.label}` : "Caso padrão",
          nextHandle: match?.id || "default",
        };
      }

      case "loop": {
        const key = config.outputVariable || "loop_index";
        const current = Number(variables[key] || 0);
        const max = Math.max(1, Number(config.maxIterations) || 1);
        if (current >= max) {
          return {
            ok: true,
            status: "success",
            message: "Loop concluído",
            nextHandle: "done",
            variables: { [key]: current },
          };
        }
        return {
          ok: true,
          status: "success",
          message: `Loop iteração ${current + 1}/${max}`,
          nextHandle: "body",
          variables: { [key]: current + 1 },
        };
      }

      case "prompt":
      case "saudacao":
      case "calc_margin":
      case "map_data":
      case "confirm_data": {
        if (kind === "saudacao") {
          const generated = await generateSaudacaoText({
            prompt: resolveTemplate(config.prompt || "", variables),
            institutionalText: resolveTemplate(config.institutionalText || "", variables),
            dryRun: Boolean(dryRun),
            model: config.model,
          });
          const outKey = config.outputVariable || "saudacao";
          return {
            ok: generated.ok || Boolean(generated.text),
            status: generated.text ? "success" : "error",
            message: generated.error
              ? `Saudação: ${generated.error}`
              : `Saudação (${generated.turnoLabel} · ${generated.timeLabel})`,
            nextHandle: "out",
            outboundText: generated.text,
            variables: {
              [outKey]: generated.text,
              saudacao_turno: generated.turnoLabel,
              expediente_horario: generated.timeLabel,
              turno:
                generated.turnoLabel === "Bom dia"
                  ? "bom_dia"
                  : generated.turnoLabel === "Boa tarde"
                    ? "boa_tarde"
                    : "boa_noite",
            },
            data: {
              turno: generated.turnoLabel,
              horario: generated.timeLabel,
            },
          };
        }
        if (kind === "confirm_data") {
          const payload = variables.dados_mapeados || variables;
          const text = `${config.text || "Confirme os dados:"}\n${JSON.stringify(payload, null, 2)}`;
          return {
            ok: true,
            status: "waiting",
            message: "Aguardando confirmação do contato",
            waitForReply: true,
            outboundText: text,
            nextHandle: "confirmed",
            variables: {
              [config.outputVariable || "dados_confirmados"]: payload,
            },
          };
        }
        if (kind === "calc_margin") {
          const p = config.marginParams || {};
          const bruto = Number(variables[p.salarioBrutoVar || "salario_bruto"] || 0);
          const descontos = Number(variables[p.descontosVar || "descontos"] || 0);
          const pct = Number(variables[p.percentualVar || "percentual_margem"] || 30);
          const margem = Math.max(0, ((bruto - descontos) * pct) / 100);
          const outKey = config.outputVariable || "margem_calculada";
          return {
            ok: true,
            status: "success",
            message: `Margem calculada: ${margem.toFixed(2)}`,
            nextHandle: "out",
            variables: { [outKey]: Number(margem.toFixed(2)) },
            data: { bruto, descontos, pct, margem },
          };
        }
        if (kind === "map_data") {
          const existing = variables.dados_mapeados;
          if (existing && typeof existing === "object") {
            return {
              ok: true,
              status: "success",
              message: "Dados já mapeados no contexto",
              nextHandle: "out",
              variables: {
                [config.outputVariable || "dados_mapeados"]: existing,
              },
            };
          }
          return {
            ok: true,
            status: "ready",
            message: "Aguardando PDF/imagem para OCR+LLM (use teste do node ou envio do contato)",
            nextHandle: "out",
            data: { fields: (config.mapFields || []) as unknown as BotJson },
          };
        }
        // prompt
        const prompt = resolveTemplate(config.prompt || "", variables);
        return {
          ok: true,
          status: dryRun ? "success" : "ready",
          message: dryRun ? `Prompt simulado (${prompt.slice(0, 80)}…)` : "Prompt pronto para LLM",
          nextHandle: "out",
          variables: {
            [config.outputVariable || "resposta_ia"]: dryRun
              ? `[simulado] ${prompt.slice(0, 120)}`
              : null,
          },
          data: { prompt, model: config.model || "gpt-4o-mini" },
        };
      }

      case "create_lead":
      case "update_lead":
      case "add_tags":
      case "add_status":
      case "transfer_agent": {
        const label = definition?.label || kind;
        return {
          ok: true,
          status: "success",
          message: dryRun ? `${label} (simulado)` : `${label} enfileirado no sistema`,
          nextHandle: "out",
          variables:
            kind === "create_lead"
              ? { [config.outputVariable || "lead_id"]: `lead-sim-${Date.now()}` }
              : undefined,
          data: {
            tags: (config.tags || null) as BotJson,
            statusId: config.statusId || null,
            attendantUserId: config.attendantUserId || null,
            leadFields: (config.leadFields || null) as BotJson,
          },
        };
      }

      default:
        return {
          ok: false,
          status: "error",
          message: `Handler não implementado: ${kind}`,
        };
    }
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : "Falha ao executar node",
    };
  }
}

export function findStartNode(draft: BotFlowDraft): BotFlowNode | null {
  return draft.nodes.find((node) => node.data.kind === "start") || null;
}

export function findNextNode(
  draft: BotFlowDraft,
  sourceId: string,
  handle = "out",
): BotFlowNode | null {
  const edge =
    draft.edges.find((item) => item.source === sourceId && (item.sourceHandle || "out") === handle) ||
    draft.edges.find((item) => item.source === sourceId && !item.sourceHandle);
  if (!edge) return null;
  return draft.nodes.find((node) => node.id === edge.target) || null;
}

export function createBotRunState(input: {
  flow: BotFlowDraft;
  testPhone: string;
}): BotRunState {
  const start = findStartNode(input.flow);
  return {
    id: `run-${crypto.randomUUID().slice(0, 8)}`,
    flowId: input.flow.id,
    flowName: input.flow.name,
    testPhone: input.testPhone,
    phase: "starting",
    currentNodeId: start?.id || null,
    variables: { telefone_teste: input.testPhone },
    logs: [log("info", `Execução iniciada para ${input.testPhone}`)],
    startedAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export async function advanceBotRun(input: {
  flow: BotFlowDraft;
  run: BotRunState;
  inboundText?: string;
}): Promise<{ run: BotRunState; outboundTexts: string[] }> {
  const outboundTexts: string[] = [];
  let run: BotRunState = {
    ...input.run,
    updatedAt: nowIso(),
    variables: { ...input.run.variables },
    logs: [...input.run.logs],
  };

  if (input.inboundText != null) {
    run.variables.ultima_resposta = input.inboundText;
    run.logs.push(log("info", "Resposta recebida", { text: input.inboundText }));
    run.phase = "running";
  }

  let guard = 0;
  while (guard < 40) {
    guard += 1;
    const nodeId = run.currentNodeId;
    if (!nodeId) {
      run.phase = "finished";
      run.logs.push(log("info", "Sem node atual — fluxo encerrado"));
      break;
    }
    const node = input.flow.nodes.find((item) => item.id === nodeId);
    if (!node) {
      run.phase = "error";
      run.error = "Node atual não encontrado";
      break;
    }

    run.phase = "running";
    const result = await executeBotNode({
      node,
      variables: run.variables,
      testPhone: run.testPhone,
      dryRun: false,
    });

    run.logs.push(
      log(result.ok ? "info" : "error", `[${node.data.title}] ${result.message}`, result.data),
    );
    if (result.variables) {
      run.variables = { ...run.variables, ...result.variables };
    }
    if (result.outboundText) outboundTexts.push(result.outboundText);

    if (!result.ok) {
      run.phase = "error";
      run.error = result.message;
      break;
    }

    if (result.waitForReply && input.inboundText == null) {
      run.phase = "waiting_reply";
      break;
    }

    if (node.data.kind === "end" || !result.nextHandle) {
      run.phase = "finished";
      run.currentNodeId = nodeId;
      break;
    }

    // Após wait_reply com inbound, segue pela saída
    const next = findNextNode(input.flow, nodeId, result.nextHandle);
    if (!next) {
      run.phase = "finished";
      run.logs.push(log("warn", `Sem conexão na saída "${result.nextHandle}"`));
      break;
    }
    run.currentNodeId = next.id;

    // Evita processar o mesmo wait novamente no mesmo tick após inbound
    if (node.data.kind === "wait_reply" && input.inboundText != null) {
      input = { ...input, inboundText: undefined };
    }
  }

  run.updatedAt = nowIso();
  return { run, outboundTexts };
}
