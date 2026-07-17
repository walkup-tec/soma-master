const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Garante que o nome do arquivo tenha extensão coerente com o MIME.
 * Sem isso, downloads como "imagem-recebida" saem sem extensão e o SO
 * não sabe com qual programa abrir.
 */
export function ensureFileNameExtension(fileName: string, mimeType: string | null): string {
  const cleanName = fileName.trim() || "arquivo";
  const normalizedMime = (mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const expected = EXTENSION_BY_MIME_TYPE[normalizedMime];
  if (!expected) return cleanName;

  const currentExtension = cleanName.includes(".")
    ? cleanName.split(".").pop()?.toLowerCase() ?? ""
    : "";
  const aliases = expected === "jpg" ? ["jpg", "jpeg"] : [expected];
  if (aliases.includes(currentExtension)) return cleanName;

  return `${cleanName}.${expected}`;
}
