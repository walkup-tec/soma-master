/**
 * One-shot: apaga conversa do chatbot pelo telefone.
 * Uso: bun run scripts/delete-chat-contact-by-phone.ts 51999666841
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) throw new Error(".env.local não encontrado");
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = trimmed.indexOf("=");
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D+/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

async function main() {
  loadEnvLocal();
  const raw = process.argv[2] || "51999666841";
  const phone = normalizePhone(raw);
  const last11 = phone.slice(-11);
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL ausente");

  const sql = postgres(url, {
    ssl:
      process.env.DATABASE_SSL_INSECURE === "true"
        ? { rejectUnauthorized: false }
        : "require",
    max: 1,
  });

  try {
    const found = await sql<
      Array<{
        id: string;
        phone: string;
        unread_count: number;
        assigned_user_id: string | null;
        contact_name: string | null;
      }>
    >`
      select id, phone, unread_count, assigned_user_id, contact_name
      from crm.chat_conversations
      where phone = ${phone}
         or right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 11) = ${last11}
    `;

    console.log(
      JSON.stringify(
        {
          phone,
          found: found.map((r) => ({
            id: r.id,
            phone: r.phone,
            unread: r.unread_count,
            assigned: r.assigned_user_id,
            name: r.contact_name,
          })),
        },
        null,
        2,
      ),
    );

    if (found.length === 0) {
      console.log("Nenhuma conversa encontrada — já estava limpo.");
      return;
    }

    const ids = found.map((r) => r.id);
    const messages = await sql`
      delete from crm.chat_messages where conversation_id in ${sql(ids)} returning id
    `;
    let mediaCount = 0;
    try {
      const media = await sql`
        delete from crm.chat_media where conversation_id in ${sql(ids)} returning id
      `;
      mediaCount = media.length;
    } catch {
      /* tabela pode não existir */
    }
    const conversations = await sql`
      delete from crm.chat_conversations where id in ${sql(ids)} returning id, phone
    `;

    console.log(
      JSON.stringify(
        {
          deletedMessages: messages.length,
          deletedMedia: mediaCount,
          deletedConversations: conversations,
        },
        null,
        2,
      ),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
