import {
  getChatAiSettings,
  listAiExamples,
  listAiKnowledge,
  listMessages,
} from "@/lib/chat/chat.repository";

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function buildAiSystemPrompt(): Promise<string> {
  const [settings, knowledge, examples] = await Promise.all([
    getChatAiSettings(),
    listAiKnowledge(),
    listAiExamples(),
  ]);

  const knowledgeBlock = knowledge
    .filter((k) => k.enabled)
    .map((k) => `### ${k.title}\n${k.content}`)
    .join("\n\n");

  const examplesBlock = examples
    .filter((e) => e.enabled)
    .map((e) => `Cliente: ${e.userSays}\nAssistente: ${e.assistantReplies}`)
    .join("\n\n");

  return [
    settings.systemPrompt.trim(),
    knowledgeBlock ? `\n\n## Base de conhecimento\n${knowledgeBlock}` : "",
    examplesBlock ? `\n\n## Exemplos de atendimento\n${examplesBlock}` : "",
  ]
    .join("")
    .trim();
}

export async function generateAiReply(input: {
  conversationId: string;
  latestUserMessage: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");

  const settings = await getChatAiSettings();
  const system = await buildAiSystemPrompt();
  const history = await listMessages(input.conversationId, 24);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: system },
  ];

  for (const msg of history) {
    if (msg.senderType === "system") continue;
    if (msg.direction === "inbound") {
      messages.push({ role: "user", content: msg.body });
    } else if (msg.senderType === "ai" || msg.senderType === "agent") {
      messages.push({ role: "assistant", content: msg.body });
    }
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || last.content !== input.latestUserMessage) {
    messages.push({ role: "user", content: input.latestUserMessage });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.openaiModel || "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 500,
      messages,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI HTTP ${response.status}`);
  }

  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI retornou resposta vazia.");
  return text;
}
