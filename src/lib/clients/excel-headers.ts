/** Decodifica entidades XML comuns de células Excel. */
export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Corrige rótulos corrompidos do tipo "FoneFoneFoneFone…"
 * (comum em sharedStrings com rich text / fonética mal concatenada).
 */
export function collapseRepeatedHeaderToken(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 4) return trimmed;

  const maxToken = Math.min(24, Math.floor(trimmed.length / 2));
  for (let len = 1; len <= maxToken; len++) {
    const token = trimmed.slice(0, len);
    if (!token.trim() || token !== token.trim()) continue;

    let pos = 0;
    let repeats = 0;
    while (pos + len <= trimmed.length && trimmed.slice(pos, pos + len) === token) {
      pos += len;
      repeats += 1;
    }
    if (repeats < 2) continue;

    const remainder = trimmed.slice(pos);
    const covered = pos / trimmed.length;
    // Aceita sobra curta (corte visual/corrupção) desde que a maior parte seja repetição.
    if (
      covered >= 0.6 &&
      (remainder.length === 0 || token.startsWith(remainder) || remainder.length < len)
    ) {
      return token;
    }
  }

  return trimmed;
}

/** Normaliza e garante unicidade dos cabeçalhos da planilha. */
export function normalizeExcelHeaders(rawHeaders: string[]): string[] {
  const used = new Map<string, number>();

  return rawHeaders.map((raw, index) => {
    const cleaned = collapseRepeatedHeaderToken(decodeXmlEntities(String(raw ?? "").trim()));
    let label = cleaned || `Coluna ${index + 1}`;
    const count = (used.get(label) ?? 0) + 1;
    used.set(label, count);
    if (count > 1) label = `${label} (${count})`;
    return label;
  });
}
