import { resolveBrasiliaExpedienteTurno } from "@/lib/bots/bot-expediente";
import { isOpenAiConfigured } from "@/lib/chat/openai.adapter";
import { getChatAiSettings } from "@/lib/chat/chat.repository";

export async function generateSaudacaoText(input: {
  prompt: string;
  institutionalText: string;
  dryRun?: boolean;
  model?: string;
}): Promise<{ ok: boolean; text: string; turnoLabel: string; timeLabel: string; error?: string }> {
  const turno = resolveBrasiliaExpedienteTurno();
  const institutional = String(input.institutionalText || "").trim();
  const instructions = String(input.prompt || "").trim();

  const fallback = institutional
    ? `${turno.label}! ${institutional}`
    : `${turno.label}! Em que posso ajudar?`;

  if (input.dryRun || !isOpenAiConfigured()) {
    return {
      ok: true,
      text: fallback,
      turnoLabel: turno.label,
      timeLabel: turno.timeLabel,
      error: input.dryRun ? undefined : isOpenAiConfigured() ? undefined : "OPENAI_API_KEY ausente — fallback local",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const settings = await getChatAiSettings();
  const model = input.model || settings.openaiModel || "gpt-4o-mini";

  const system = [
    "Você escreve saudações iniciais de atendimento WhatsApp.",
    "Responda somente com o texto da saudação, sem aspas e sem markdown.",
  ].join(" ");

  const user = [
    `Turno atual (Brasília ${turno.timeLabel}): ${turno.label}`,
    institutional ? `Institucional:\n${institutional}` : "Institucional: (não informado)",
    instructions ? `Instruções:\n${instructions}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 180,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        ok: false,
        text: fallback,
        turnoLabel: turno.label,
        timeLabel: turno.timeLabel,
        error: `OpenAI HTTP ${response.status}: ${errText.slice(0, 180)}`,
      };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = String(json.choices?.[0]?.message?.content || "").trim() || fallback;
    return { ok: true, text, turnoLabel: turno.label, timeLabel: turno.timeLabel };
  } catch (error) {
    return {
      ok: false,
      text: fallback,
      turnoLabel: turno.label,
      timeLabel: turno.timeLabel,
      error: error instanceof Error ? error.message : "Falha na saudação IA",
    };
  }
}
