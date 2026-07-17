import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ENV_KEYS = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SESSION_SECRET",
  "MAIL_MODE",
  "MAIL_FROM",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMP_PASS",
  "APP_URL",
  "PUBLIC_APP_URL",
  // Chat WhatsApp + IA (Evolution compartilhada do WABA; instância soma-*)
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "EVOLUTION_API_URL",
  "EVOLUTION_API_KEY",
  "EVOLUTION_INSTANCE",
  "CHAT_WEBHOOK_SECRET",
  "CHAT_PUBLIC_BASE_URL",
  "SOMA_PUSH_COMMUNITY_INVITE_LINK",
  "SOMA_PUSH_COMMUNITY_EVO_INSTANCE",
  "SOMA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID",
] as const;

function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    values[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return values;
}

/** Garante variáveis do `.env.local` no processo do servidor (Vite nem sempre injeta). */
export function loadLocalEnvFile(): void {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;

  const parsed = parseEnvFile(readFileSync(path, "utf8"));
  for (const key of ENV_KEYS) {
    const value = parsed[key];
    if (value) process.env[key] = value;
  }
}
