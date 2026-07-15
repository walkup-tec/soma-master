import {
  iterateXlsxRowsFromPath,
  parseXlsxPreviewLimited,
} from "@/lib/clients/xlsx-zip-stream";

export type ServerExcelPreview = {
  hasHeader: boolean;
  headers: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
};

export async function parseExcelPreviewFromPath(
  filePath: string,
  hasHeader: boolean,
  onPhase?: (label: string) => void,
): Promise<ServerExcelPreview> {
  const preview = await parseXlsxPreviewLimited(filePath, hasHeader, { onPhase });
  return {
    hasHeader,
    headers: preview.headers,
    previewRows: preview.previewRows,
    totalRows: preview.totalRows,
  };
}

export async function iterateExcelRowsFromPath(
  filePath: string,
  hasHeader: boolean,
  onBatch: (rows: Record<string, string>[], progress: { processed: number; total: number }) => Promise<void>,
  options?: {
    batchSize?: number;
    onPhase?: (label: string) => void;
    shouldAbort?: () => Promise<boolean>;
  },
): Promise<{ totalRows: number }> {
  return iterateXlsxRowsFromPath(filePath, hasHeader, onBatch, options);
}
