/** Normaliza telefone BR/WhatsApp para match (somente dígitos, com DDI 55 quando 10–11 dígitos). */

export function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

export function normalizeWhatsAppPhone(value: string): string {
  let digits = digitsOnly(value);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  return digits;
}

export function isLidJid(value: string): boolean {
  return /@lid$/i.test(String(value || "").trim());
}

export function isGroupOrBroadcastJid(value: string): boolean {
  const jid = String(value || "").trim().toLowerCase();
  return jid.includes("@g.us") || jid.includes("@broadcast") || jid.includes("@newsletter");
}

/**
 * Telefone real do contato. O Baileys/Evolution entrega `remoteJid` em `@lid`
 * e o número fica em `remoteJidAlt` / `senderPn`.
 */
export function extractWhatsAppPhoneFromInbound(input: {
  remoteJid?: unknown;
  remoteJidAlt?: unknown;
  senderPn?: unknown;
  participant?: unknown;
  participantAlt?: unknown;
  senderLid?: unknown;
}): string {
  const candidates = [
    input.remoteJidAlt,
    input.senderPn,
    input.participantAlt,
    input.remoteJid,
    input.participant,
    input.senderLid,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (candidates.some(isGroupOrBroadcastJid)) return "";
  const phoneJid = candidates.find((jid) => /@s\.whatsapp\.net$/i.test(jid) && !isLidJid(jid));
  if (phoneJid) return normalizeWhatsAppPhone(phoneJid.split("@")[0] ?? "");
  const nonLid = candidates.find((jid) => jid && !isLidJid(jid));
  if (nonLid) return normalizeWhatsAppPhone(nonLid.split("@")[0] ?? "");
  const any = candidates[0];
  return any ? normalizeWhatsAppPhone(any.split("@")[0] ?? "") : "";
}

export function phonesMatch(a: string, b: string): boolean {
  const left = normalizeWhatsAppPhone(a);
  const right = normalizeWhatsAppPhone(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const trim = (p: string) => (p.startsWith("55") && p.length > 12 ? p.slice(0, 4) + p.slice(5) : p);
  return trim(left) === trim(right) || left.endsWith(right.slice(-10)) || right.endsWith(left.slice(-10));
}
