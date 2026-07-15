import * as XLSX from "xlsx";
import { normalizeExcelHeaders } from "@/lib/clients/excel-headers";

export type ParsedExcel = {
  hasHeader: boolean;
  headers: string[];
  rows: Record<string, string>[];
  previewRows: Record<string, string>[];
};

export type ParseExcelOptions = {
  hasHeader?: boolean;
  onPhase?: (label: string) => void;
};

const LARGE_FILE_BYTES = 20 * 1024 * 1024;
export const SERVER_IMPORT_THRESHOLD_BYTES = 5 * 1024 * 1024;
export const UPLOAD_CHUNK_BYTES = 1024 * 1024;

function buildHeadersFromMatrix(
  matrix: (string | number | boolean | null)[][],
  hasHeader: boolean,
): string[] {
  const columnCount = matrix.reduce((max, line) => Math.max(max, line?.length ?? 0), 0);
  if (columnCount === 0) return [];

  if (hasHeader) {
    const raw = Array.from({ length: columnCount }, (_, index) => {
      const label = String(matrix[0]?.[index] ?? "").trim();
      return label || `Coluna ${index + 1}`;
    });
    return normalizeExcelHeaders(raw);
  }

  return Array.from({ length: columnCount }, (_, index) => `Coluna ${index + 1}`);
}

function matrixToRows(
  matrix: (string | number | boolean | null)[][],
  headers: string[],
  hasHeader: boolean,
): Record<string, string>[] {
  const dataLines = hasHeader ? matrix.slice(1) : matrix;

  return dataLines
    .map((line) => {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = String(line?.[index] ?? "").trim();
      });
      return row;
    })
    .filter((row) => Object.values(row).some((value) => value.length > 0));
}

export function formatExcelFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isLargeExcelFile(bytes: number): boolean {
  return bytes >= LARGE_FILE_BYTES;
}

export function shouldUseServerImport(bytes: number): boolean {
  return bytes >= SERVER_IMPORT_THRESHOLD_BYTES;
}

export async function parseExcelFile(file: File, options: ParseExcelOptions = {}): Promise<ParsedExcel> {
  const hasHeader = options.hasHeader !== false;
  const onPhase = options.onPhase;

  onPhase?.("Carregando arquivo na memória…");
  const buffer = await file.arrayBuffer();

  if (isLargeExcelFile(file.size)) {
    onPhase?.(`Arquivo grande (${formatExcelFileSize(file.size)}) — interpretando planilha…`);
  } else {
    onPhase?.("Interpretando planilha…");
  }

  const workbook = XLSX.read(buffer, {
    type: "array",
    dense: true,
    cellDates: false,
    cellNF: false,
    cellStyles: false,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("O arquivo Excel não contém planilhas.");
  }

  onPhase?.("Convertendo linhas…");
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (matrix.length === 0) {
    throw new Error("A planilha está vazia.");
  }

  if (hasHeader && matrix.length < 2) {
    throw new Error("Com cabeçalho, a planilha precisa de ao menos uma linha de dados além da primeira linha.");
  }

  const headers = buildHeadersFromMatrix(matrix, hasHeader);
  if (headers.length === 0) {
    throw new Error("Nenhuma coluna foi encontrada na planilha.");
  }

  const rows = matrixToRows(matrix, headers, hasHeader);
  if (rows.length === 0) {
    throw new Error("Nenhuma linha com dados foi encontrada na planilha.");
  }

  return {
    hasHeader,
    headers,
    rows,
    previewRows: rows.slice(0, 5),
  };
}
