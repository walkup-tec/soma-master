/** Cor padrão quando o status ainda não tem color definida. */
export const DEFAULT_STATUS_COLOR = "#64748b";

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

export function normalizeStatusColor(value: unknown, fallback = DEFAULT_STATUS_COLOR): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (HEX_COLOR_RE.test(trimmed)) return trimmed.toLowerCase();
  return fallback;
}

/** Texto legível sobre o fundo do status (branco ou quase preto). */
export function contrastTextOnColor(hex: string): string {
  const normalized = normalizeStatusColor(hex);
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  // YIQ
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#1a1a1a" : "#ffffff";
}

/** Fundo suave (badge) a partir da cor sólida do status. */
export function softStatusBackground(hex: string, alpha = 0.18): string {
  const normalized = normalizeStatusColor(hex);
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
