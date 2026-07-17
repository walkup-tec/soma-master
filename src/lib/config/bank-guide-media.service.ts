import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { randomUUID } from "node:crypto";

const BANK_GUIDES_DIR = join(process.cwd(), "data", "bank-guides");
const MAX_PDF_BYTES = 15 * 1024 * 1024;

function ensureDir(): void {
  if (!existsSync(BANK_GUIDES_DIR)) mkdirSync(BANK_GUIDES_DIR, { recursive: true });
}

function sanitizeFileName(value: string): string {
  const base = basename(String(value || "roteiro.pdf").trim()) || "roteiro.pdf";
  return base.replace(/[^\w.\-()+\s]/g, "_").slice(0, 120);
}

export function saveBankOperationalGuidePdf(input: {
  buffer: Buffer;
  fileName: string;
}): { storageId: string; fileName: string } {
  if (!input.buffer?.length || input.buffer.length > MAX_PDF_BYTES) {
    throw new Error("PDF inválido ou maior que 15 MB.");
  }
  const header = input.buffer.subarray(0, 4).toString("utf8");
  if (header !== "%PDF") {
    throw new Error("Envie um arquivo PDF.");
  }

  ensureDir();
  const storageId = randomUUID();
  const rawName = String(input.fileName || "roteiro.pdf");
  const fileName = sanitizeFileName(rawName.toLowerCase().endsWith(".pdf") ? rawName : `${rawName}.pdf`);
  writeFileSync(join(BANK_GUIDES_DIR, `${storageId}-${fileName}`), input.buffer);
  return { storageId, fileName };
}
