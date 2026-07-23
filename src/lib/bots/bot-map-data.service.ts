import { BOT_MAP_FIELD_OPTIONS, type BotMapFieldId } from "@/lib/bots/bot.types";
import { isOpenAiConfigured } from "@/lib/chat/openai.adapter";
import { getChatAiSettings } from "@/lib/chat/chat.repository";

export type MapDataExtractInput = {
  /** Base64 puro ou data URI */
  mediaBase64: string;
  mimeType?: string;
  fields: BotMapFieldId[];
  productId?: string;
};

export type MapDataExtractResult = {
  ok: boolean;
  data: Partial<Record<BotMapFieldId, string | number | null>>;
  rawText?: string;
  error?: string;
};

function stripDataUri(input: string): { base64: string; mime: string | null } {
  const raw = String(input || "").trim();
  const match = /^data:([^;]+);base64,(.+)$/i.exec(raw);
  if (match) return { mime: match[1], base64: match[2] };
  return { mime: null, base64: raw.replace(/\s+/g, "") };
}

function emptyResult(fields: BotMapFieldId[]): Partial<Record<BotMapFieldId, string | number | null>> {
  const data: Partial<Record<BotMapFieldId, string | number | null>> = {};
  for (const field of fields) data[field] = null;
  return data;
}

/**
 * Mapear dados: OCR (visão) + LLM → JSON padronizado dos campos selecionados.
 */
export async function extractMappedClientData(
  input: MapDataExtractInput,
): Promise<MapDataExtractResult> {
  const fields = (input.fields?.length ? input.fields : BOT_MAP_FIELD_OPTIONS.map((f) => f.id)).filter(
    (id, index, arr) => arr.indexOf(id) === index,
  );

  if (!isOpenAiConfigured()) {
    return {
      ok: false,
      data: emptyResult(fields),
      error: "OPENAI_API_KEY não configurada.",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const settings = await getChatAiSettings();
  const model = settings.openaiModel || "gpt-4o-mini";
  const { base64, mime } = stripDataUri(input.mediaBase64);
  if (!base64) {
    return { ok: false, data: emptyResult(fields), error: "Mídia vazia." };
  }

  const mimeType = input.mimeType || mime || "application/pdf";
  const fieldGuide = BOT_MAP_FIELD_OPTIONS.filter((f) => fields.includes(f.id))
    .map((f) => `- ${f.id}: ${f.label}`)
    .join("\n");

  const system = [
    "Você extrai dados estruturados de documentos (PDF/imagem) de clientes.",
    "Use OCR mental/visão e retorne APENAS JSON válido, sem markdown.",
    "Chaves exatamente iguais aos ids solicitados. Valores string ou number; use null se não encontrar.",
    "CPF só dígitos. Datas em dd/mm/aaaa quando possível.",
  ].join(" ");

  const userText = `Extraia estes campos:\n${fieldGuide}\n\nRetorne JSON no formato: {${fields
    .map((f) => `"${f}": null`)
    .join(", ")}}`;

  const content: Array<Record<string, unknown>> = [{ type: "text", text: userText }];

  if (mimeType.startsWith("image/")) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${base64}` },
    });
  } else {
    // PDF: enviamos como texto base64 truncado + instrução; modelos com file input variam.
    // Preferimos imagem quando possível; para PDF pedimos OCR textual do conteúdo embutido.
    content.push({
      type: "text",
      text: `Documento MIME=${mimeType}. Conteúdo base64 (início): ${base64.slice(0, 120_000)}`,
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        ok: false,
        data: emptyResult(fields),
        error: `OpenAI HTTP ${response.status}: ${errText.slice(0, 240)}`,
      };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawText = json.choices?.[0]?.message?.content || "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return { ok: false, data: emptyResult(fields), error: "Resposta LLM não é JSON.", rawText };
    }

    const data = emptyResult(fields);
    for (const field of fields) {
      const value = parsed[field];
      if (value == null || value === "") {
        data[field] = null;
      } else if (typeof value === "number") {
        data[field] = value;
      } else {
        data[field] = String(value).trim();
      }
    }

    return { ok: true, data, rawText };
  } catch (error) {
    return {
      ok: false,
      data: emptyResult(fields),
      error: error instanceof Error ? error.message : "Falha no Mapear dados",
    };
  }
}
