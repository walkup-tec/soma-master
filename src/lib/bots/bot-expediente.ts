/**
 * Turno de expediente pelo horário de Brasília (America/Sao_Paulo).
 * - Bom dia: 00:01–12:00
 * - Boa tarde: 12:01–18:00
 * - Boa noite: 18:01–00:00
 */

export type BotExpedienteTurnoId = "bom_dia" | "boa_tarde" | "boa_noite";

export type BotExpedienteTurno = {
  id: BotExpedienteTurnoId;
  label: string;
  handle: BotExpedienteTurnoId;
  hour: number;
  minute: number;
  timeLabel: string;
};

const BRASILIA_TZ = "America/Sao_Paulo";

export function getBrasiliaParts(now = new Date()): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: BRASILIA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return { hour, minute };
}

export function resolveBrasiliaExpedienteTurno(now = new Date()): BotExpedienteTurno {
  const { hour, minute } = getBrasiliaParts(now);
  const total = hour * 60 + minute;
  // 00:00 (0) → boa noite; 00:01 (1) … 12:00 (720) → bom dia;
  // 12:01 (721) … 18:00 (1080) → boa tarde; 18:01 (1081) … 23:59 → boa noite
  let id: BotExpedienteTurnoId;
  let label: string;
  if (total >= 1 && total <= 12 * 60) {
    id = "bom_dia";
    label = "Bom dia";
  } else if (total >= 12 * 60 + 1 && total <= 18 * 60) {
    id = "boa_tarde";
    label = "Boa tarde";
  } else {
    id = "boa_noite";
    label = "Boa noite";
  }
  const timeLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { id, label, handle: id, hour, minute, timeLabel };
}
