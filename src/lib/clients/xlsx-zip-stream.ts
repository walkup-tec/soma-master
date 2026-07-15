import { createInflateRaw } from "node:zlib";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { decodeXmlEntities, normalizeExcelHeaders } from "@/lib/clients/excel-headers";
import { ImportCancelledError } from "@/lib/clients/import-cancelled.error";
import { ImportLimitReachedError } from "@/lib/clients/import-limit.error";

type ZipEntry = {
  name: string;
  compression: number;
  compressed: Buffer;
  uncompressedSize: number;
};

function listZipEntries(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset < buffer.length - 30) {
    if (
      buffer[offset] !== 0x50 ||
      buffer[offset + 1] !== 0x4b ||
      buffer[offset + 2] !== 0x03 ||
      buffer[offset + 3] !== 0x04
    ) {
      offset += 1;
      continue;
    }

    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString("utf8", offset + 30, offset + 30 + nameLength);
    const dataStart = offset + 30 + nameLength + extraLength;

    entries.push({
      name,
      compression,
      compressed: buffer.subarray(dataStart, dataStart + compressedSize),
      uncompressedSize,
    });

    offset = dataStart + compressedSize;
  }

  return entries;
}

async function inflateEntryAsync(entry: ZipEntry): Promise<Buffer> {
  if (entry.compression === 0) return Buffer.from(entry.compressed);
  if (entry.compression !== 8) {
    throw new Error(`Compressão ZIP não suportada: ${entry.compression}`);
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const inflater = createInflateRaw();
    inflater.on("data", (chunk) => chunks.push(chunk));
    inflater.on("error", reject);
    inflater.on("end", () => resolve(Buffer.concat(chunks)));
    inflater.end(entry.compressed);
  });
}

function parseDimensionRef(xml: string): string | null {
  const match = xml.match(/<dimension[^>]+ref="([^"]+)"/);
  return match?.[1] ?? null;
}

function columnLettersToIndex(column: string): number {
  let index = 0;
  for (const char of column) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function parseSharedStringItem(itemXml: string): string {
  // Ignora anotações fonéticas (rPh) — senão o texto pode se multiplicar.
  const withoutPhonetic = itemXml
    .replace(/<rPh\b[\s\S]*?<\/rPh>/gi, "")
    .replace(/<phoneticPr\b[^>]*\/>/gi, "");

  const richRuns = [...withoutPhonetic.matchAll(/<r\b[\s\S]*?<\/r>/gi)];
  if (richRuns.length > 0) {
    const parts = richRuns.map((run) => {
      const texts = [...run[0].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((part) => part[1]);
      return texts.join("");
    });
    return decodeXmlEntities(parts.join(""));
  }

  const plain = [...withoutPhonetic.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((part) => part[1]);
  return decodeXmlEntities(plain.join(""));
}

function parseSharedStrings(xml: string): string[] {
  const values: string[] = [];
  const itemRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match = itemRegex.exec(xml);
  while (match) {
    values.push(parseSharedStringItem(match[1]));
    match = itemRegex.exec(xml);
  }
  return values;
}

function parseCellValue(cellXml: string, sharedStrings: string[]): string {
  const typeMatch = cellXml.match(/\bt="([^"]+)"/);
  const type = typeMatch?.[1];
  const valueMatch = cellXml.match(/<v>([^<]*)<\/v>/);
  const rawValue = valueMatch?.[1] ?? "";

  if (type === "s") return sharedStrings[Number(rawValue)] ?? "";
  if (type === "inlineStr") {
    const withoutPhonetic = cellXml
      .replace(/<rPh\b[\s\S]*?<\/rPh>/gi, "")
      .replace(/<phoneticPr\b[^>]*\/>/gi, "");
    const texts = [...withoutPhonetic.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((part) => part[1]);
    return decodeXmlEntities(texts.join(""));
  }
  return decodeXmlEntities(rawValue);
}

function parseRowXml(rowXml: string, sharedStrings: string[]): Record<string, string> {
  const cells: Record<string, string> = {};
  const cellRegex = /<c r="([A-Z]+)\d+"[^>]*>[\s\S]*?<\/c>/g;
  let match = cellRegex.exec(rowXml);
  while (match) {
    const column = match[1];
    cells[column] = parseCellValue(match[0], sharedStrings).trim();
    match = cellRegex.exec(rowXml);
  }
  return cells;
}

function rowToHeaderRecord(
  cells: Record<string, string>,
  columnHeaders: string[],
): Record<string, string> {
  const row: Record<string, string> = {};
  for (const [column, value] of Object.entries(cells)) {
    const index = columnLettersToIndex(column);
    const header = columnHeaders[index];
    if (header && value) row[header] = value;
  }
  return row;
}

function buildColumnHeaders(headerCells: Record<string, string>): string[] {
  const maxIndex = Math.max(
    -1,
    ...Object.keys(headerCells).map((column) => columnLettersToIndex(column)),
  );
  const headers = Array.from({ length: maxIndex + 1 }, (_, index) => `Coluna ${index + 1}`);
  for (const [column, value] of Object.entries(headerCells)) {
    headers[columnLettersToIndex(column)] = value || headers[columnLettersToIndex(column)];
  }
  return normalizeExcelHeaders(headers);
}

export function assertXlsxZipHeader(buffer: Buffer): void {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error(
      "Arquivo inválido ou corrompido após o envio. Selecione a planilha novamente e aguarde até o fim.",
    );
  }
}

function getSheet1Entry(buffer: Buffer): ZipEntry {
  const entry = listZipEntries(buffer).find((item) => item.name === "xl/worksheets/sheet1.xml");
  if (!entry) throw new Error("Planilha sem aba de dados (sheet1).");
  return entry;
}

async function readDimensionRefFromEntry(entry: ZipEntry): Promise<string> {
  const ref = await new Promise<string | null>((resolve, reject) => {
    const inflater = createInflateRaw();
    let xml = "";

    inflater.on("data", (chunk) => {
      xml += chunk.toString("utf8");
      const dimension = parseDimensionRef(xml);
      if (dimension) {
        inflater.destroy();
        resolve(dimension);
      } else if (xml.length > 500_000) {
        inflater.destroy();
        resolve(null);
      }
    });
    inflater.on("error", reject);
    inflater.on("end", () => resolve(parseDimensionRef(xml)));

    const chunkSize = 64 * 1024;
    let offset = 0;
    const push = () => {
      if (offset >= entry.compressed.length) {
        inflater.end();
        return;
      }
      const next = entry.compressed.subarray(offset, offset + chunkSize);
      offset += chunkSize;
      if (!inflater.write(next)) inflater.once("drain", push);
      else push();
    };
    push();
  });

  if (!ref) throw new Error("Não foi possível identificar o tamanho da planilha.");
  return ref;
}

function dimensionRefToRowCount(ref: string): number {
  const range = XLSX.utils.decode_range(ref);
  return range.e.r - range.s.r + 1;
}

export async function readXlsxDimensionRowCount(filePath: string): Promise<number> {
  const buffer = await readFile(filePath);
  assertXlsxZipHeader(buffer);
  const ref = await readDimensionRefFromEntry(getSheet1Entry(buffer));
  return dimensionRefToRowCount(ref);
}

async function readPreviewFromSheetStream(
  sheetEntry: ZipEntry,
  sharedStrings: string[],
  hasHeader: boolean,
  maxPreviewRows: number,
): Promise<{ headers: string[]; previewRows: Record<string, string>[] }> {
  const rowsToScan = hasHeader ? 1 + maxPreviewRows : maxPreviewRows;
  let rowNumber = 0;
  let columnHeaders: string[] = [];
  const previewRows: Record<string, string>[] = [];
  let pendingXml = "";

  const ensureColumnHeaders = (cells: Record<string, string>) => {
    const maxIndex = Math.max(
      columnHeaders.length - 1,
      ...Object.keys(cells).map((column) => columnLettersToIndex(column)),
    );
    while (columnHeaders.length <= maxIndex) {
      columnHeaders.push(`Coluna ${columnHeaders.length + 1}`);
    }
  };

  await new Promise<void>((resolve, reject) => {
    const inflater = createInflateRaw();
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };

    const handleRow = (rowXml: string) => {
      rowNumber += 1;
      const cells = parseRowXml(rowXml, sharedStrings);

      if (hasHeader && rowNumber === 1) {
        columnHeaders = buildColumnHeaders(cells);
        return;
      }

      ensureColumnHeaders(cells);
      const record = rowToHeaderRecord(cells, columnHeaders);
      if (Object.values(record).some((value) => value.length > 0)) {
        previewRows.push(record);
      }

      if (rowNumber >= rowsToScan || previewRows.length >= maxPreviewRows) {
        inflater.destroy();
        finish();
      }
    };

    inflater.on("data", (chunk) => {
      pendingXml += chunk.toString("utf8");

      let rowStart = pendingXml.indexOf("<row ");
      while (rowStart >= 0) {
        const rowEnd = pendingXml.indexOf("</row>", rowStart);
        if (rowEnd < 0) break;

        const rowXml = pendingXml.slice(rowStart, rowEnd + 6);
        pendingXml = pendingXml.slice(rowEnd + 6);
        handleRow(rowXml);
        if (settled) return;

        rowStart = pendingXml.indexOf("<row ");
      }
    });

    inflater.on("error", (error) => finish(error));
    inflater.on("end", () => finish());

    const chunkSize = 64 * 1024;
    let offset = 0;
    const push = () => {
      if (settled) return;
      if (offset >= sheetEntry.compressed.length) {
        inflater.end();
        return;
      }
      const next = sheetEntry.compressed.subarray(offset, offset + chunkSize);
      offset += chunkSize;
      if (!inflater.write(next)) inflater.once("drain", push);
      else push();
    };
    push();
  });

  return { headers: columnHeaders, previewRows: previewRows.slice(0, maxPreviewRows) };
}

async function loadSharedStrings(buffer: Buffer): Promise<string[]> {
  const entry = listZipEntries(buffer).find((item) => item.name === "xl/sharedStrings.xml");
  if (!entry) return [];
  const xmlBuffer = await inflateEntryAsync(entry);
  return parseSharedStrings(xmlBuffer.toString("utf8"));
}

export async function parseXlsxPreviewLimited(
  filePath: string,
  hasHeader: boolean,
  options?: { previewRowLimit?: number; onPhase?: (label: string) => void },
): Promise<{
  headers: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
}> {
  const previewRowLimit = options?.previewRowLimit ?? 6;
  options?.onPhase?.("Validando arquivo recebido…");
  const buffer = await readFile(filePath);
  assertXlsxZipHeader(buffer);

  options?.onPhase?.("Contando linhas da planilha…");
  const sheetEntry = getSheet1Entry(buffer);
  const dimensionRef = await readDimensionRefFromEntry(sheetEntry);
  const sheetRowCount = dimensionRefToRowCount(dimensionRef);
  const totalRows = hasHeader ? Math.max(0, sheetRowCount - 1) : sheetRowCount;
  if (totalRows === 0) {
    throw new Error("Nenhuma linha com dados foi encontrada na planilha.");
  }

  options?.onPhase?.("Lendo prévia da planilha…");
  const sharedStrings = await loadSharedStrings(buffer);
  const { headers, previewRows } = await readPreviewFromSheetStream(
    sheetEntry,
    sharedStrings,
    hasHeader,
    previewRowLimit,
  );

  if (headers.length === 0) {
    throw new Error("Não foi possível identificar as colunas da planilha.");
  }
  if (previewRows.length === 0) {
    throw new Error("Nenhuma linha de exemplo encontrada na planilha.");
  }

  return { headers, previewRows, totalRows };
}

export async function iterateXlsxRowsFromPath(
  filePath: string,
  hasHeader: boolean,
  onBatch: (
    rows: Record<string, string>[],
    progress: { processed: number; total: number },
  ) => Promise<void>,
  options?: {
    batchSize?: number;
    maxRows?: number;
    onPhase?: (label: string) => void;
    shouldAbort?: () => Promise<boolean>;
  },
): Promise<{ totalRows: number }> {
  const batchSize = options?.batchSize ?? 5000;
  const maxRows = options?.maxRows;
  const buffer = await readFile(filePath);
  assertXlsxZipHeader(buffer);

  options?.onPhase?.("Preparando leitura da planilha…");
  const sharedStrings = await loadSharedStrings(buffer);
  const sheetEntry = getSheet1Entry(buffer);
  const dimensionRef = await readDimensionRefFromEntry(sheetEntry);
  const sheetRowCount = dimensionRefToRowCount(dimensionRef);
  const sheetDataRows = hasHeader ? Math.max(0, sheetRowCount - 1) : sheetRowCount;
  if (sheetDataRows === 0) throw new Error("Nenhuma linha com dados foi encontrada na planilha.");
  const totalRows =
    maxRows !== undefined ? Math.min(sheetDataRows, maxRows) : sheetDataRows;

  let columnHeaders: string[] = [];
  let processed = 0;
  let batch: Record<string, string>[] = [];
  let rowNumber = 0;
  let pendingXml = "";
  let headerResolved = !hasHeader;
  let flushQueue = Promise.resolve();
  let parsePaused = false;
  let resumeParse: (() => void) | null = null;

  const pauseParseUntilFlush = () =>
    new Promise<void>((resolve) => {
      parsePaused = true;
      resumeParse = resolve;
    });

  const flushBatch = async (rows: Record<string, string>[]) => {
    if (rows.length === 0) return;
    if (options?.shouldAbort && (await options.shouldAbort())) {
      throw new ImportCancelledError(processed);
    }
    let rowsToFlush = rows;
    if (maxRows !== undefined) {
      const room = maxRows - processed;
      if (room <= 0) throw new ImportLimitReachedError(processed);
      if (rows.length > room) rowsToFlush = rows.slice(0, room);
    }
    processed += rowsToFlush.length;
    await onBatch(rowsToFlush, { processed, total: totalRows });
    if (maxRows !== undefined && processed >= maxRows) {
      throw new ImportLimitReachedError(processed);
    }
  };

  const enqueueFlush = () => {
    if (batch.length < batchSize) return;
    const rows = batch;
    batch = [];
    flushQueue = flushQueue
      .then(() => flushBatch(rows))
      .then(() => {
        if (parsePaused && resumeParse) {
          parsePaused = false;
          const resume = resumeParse;
          resumeParse = null;
          resume();
        }
      });
  };

  const ensureColumnHeaders = (cells: Record<string, string>) => {
    const maxIndex = Math.max(
      columnHeaders.length - 1,
      ...Object.keys(cells).map((column) => columnLettersToIndex(column)),
    );
    while (columnHeaders.length <= maxIndex) {
      columnHeaders.push(`Coluna ${columnHeaders.length + 1}`);
    }
  };

  const handleRowSync = (rowXml: string): boolean => {
    rowNumber += 1;
    const cells = parseRowXml(rowXml, sharedStrings);

    if (hasHeader && rowNumber === 1) {
      columnHeaders = buildColumnHeaders(cells);
      headerResolved = true;
      return false;
    }

    if (!headerResolved) {
      ensureColumnHeaders(cells);
      headerResolved = true;
    } else {
      ensureColumnHeaders(cells);
    }

    const record = rowToHeaderRecord(cells, columnHeaders);
    if (!Object.values(record).some((value) => value.length > 0)) return false;

    batch.push(record);
    if (batch.length >= batchSize) {
      enqueueFlush();
      return true;
    }
    return false;
  };

  options?.onPhase?.(`Importando ${totalRows.toLocaleString("pt-BR")} linhas…`);

  await new Promise<void>((resolve, reject) => {
    const inflater = createInflateRaw();
    let resolved = false;
    let parseLoop: (() => void) | null = null;

    const finish = (error?: Error) => {
      if (resolved) return;
      resolved = true;
      if (error) reject(error);
      else resolve();
    };

    const processPendingRows = () => {
      let rowStart = pendingXml.indexOf("<row ");
      while (rowStart >= 0) {
        const rowEnd = pendingXml.indexOf("</row>", rowStart);
        if (rowEnd < 0) break;

        const rowXml = pendingXml.slice(rowStart, rowEnd + 6);
        pendingXml = pendingXml.slice(rowEnd + 6);
        try {
          const shouldPause = handleRowSync(rowXml);
          if (shouldPause) {
            void pauseParseUntilFlush().then(() => parseLoop?.());
            return;
          }
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        rowStart = pendingXml.indexOf("<row ");
      }

      if (pendingXml.length > 2_000_000) {
        pendingXml = pendingXml.slice(-1_000_000);
      }
    };

    inflater.on("data", (chunk) => {
      pendingXml += chunk.toString("utf8");
      processPendingRows();
    });

    inflater.on("error", (error) => finish(error));
    inflater.on("end", () => {
      flushQueue
        .then(() => (batch.length > 0 ? flushBatch(batch) : undefined))
        .then(() => finish())
        .catch((error) => finish(error instanceof Error ? error : new Error(String(error))));
    });

    const chunkSize = 256 * 1024;
    let offset = 0;
    const push = () => {
      if (parsePaused) return;
      if (offset >= sheetEntry.compressed.length) {
        inflater.end();
        return;
      }
      const next = sheetEntry.compressed.subarray(offset, offset + chunkSize);
      offset += chunkSize;
      if (!inflater.write(next)) inflater.once("drain", push);
      else push();
    };
    parseLoop = push;
    push();
  });

  return { totalRows: processed };
}
