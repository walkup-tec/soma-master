import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useSystemSettings } from "@/hooks/use-system-settings";
import type { ClientFieldId } from "@/lib/config/client-fields";
import type { ProductConfig } from "@/lib/config/settings-types";
import {
  formatExcelFileSize,
  isLargeExcelFile,
  parseExcelFile,
  shouldUseServerImport,
  UPLOAD_CHUNK_BYTES,
} from "@/lib/clients/parse-excel";
import { chunkArray } from "@/lib/clients/chunk-array";
import { productFieldsForImport } from "@/lib/clients/product-fields";
import { readFileInChunks } from "@/lib/clients/upload-file-chunks";
import {
  appendImportUploadChunkFn,
  cancelImportJobFn,
  finalizeImportUploadFn,
  getImportJobStatusFn,
  importClientsFn,
  initImportUploadFn,
  listUsersForImportFn,
  parseImportUploadPreviewFn,
  startServerImportJobFn,
} from "@/lib/clients/clients.server";
import type { LeadDistribution } from "@/lib/clients/client.types";
import {
  buildLeadDistribution,
  isDistributionValid,
  LeadDistributionForm,
} from "@/components/clients/lead-distribution-form";
import {
  ClientImportProgress,
  type ImportProgressState,
} from "@/components/clients/client-import-progress";
import { useEffect } from "react";

const IMPORT_CHUNK_SIZE = 50;

type ImportParsedData = {
  hasHeader: boolean;
  headers: string[];
  previewRows: Record<string, string>[];
  rowCount: number;
  serverMode: boolean;
  uploadId?: string;
  clientRows?: Record<string, string>[];
};

type ImportUser = {
  id: string;
  name: string;
  email: string;
  categoryId: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

const STEPS = ["Produto", "Arquivo", "Indexação", "Distribuição"] as const;

export function ClientImportWizard({ open, onOpenChange, onImported }: Props) {
  const { settings } = useSystemSettings();
  const importClients = useServerFn(importClientsFn);
  const listUsers = useServerFn(listUsersForImportFn);
  const initUpload = useServerFn(initImportUploadFn);
  const appendUploadChunk = useServerFn(appendImportUploadChunkFn);
  const finalizeUpload = useServerFn(finalizeImportUploadFn);
  const parseUploadPreview = useServerFn(parseImportUploadPreviewFn);
  const startServerImport = useServerFn(startServerImportJobFn);
  const getImportJobStatus = useServerFn(getImportJobStatusFn);
  const cancelImportJob = useServerFn(cancelImportJobFn);

  const importAbortRef = useRef(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cancellingImport, setCancellingImport] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgressState | null>(null);
  const [productId, setProductId] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [selectedFileMeta, setSelectedFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [parsed, setParsed] = useState<ImportParsedData | null>(null);
  const [columnMapping, setColumnMapping] = useState<Partial<Record<ClientFieldId, string>>>({});
  const [distributionType, setDistributionType] = useState<LeadDistribution["type"]>("all");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [scheduleContactDate, setScheduleContactDate] = useState("");
  const [importUsers, setImportUsers] = useState<ImportUser[]>([]);

  const product = settings.products.find((item) => item.id === productId) as ProductConfig | undefined;
  const fieldGroups = useMemo(() => (product ? productFieldsForImport(product) : null), [product]);

  const mappedFieldIds = useMemo(() => {
    return Object.entries(columnMapping)
      .filter(([, header]) => Boolean(header))
      .map(([fieldId]) => fieldId as ClientFieldId);
  }, [columnMapping]);

  const sortedExcelHeaders = useMemo(() => {
    if (!parsed) return [];
    return [...parsed.headers].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [parsed]);

  const headersForField = (fieldId: ClientFieldId) => {
    const usedByOthers = new Set(
      Object.entries(columnMapping)
        .filter(([id, header]) => id !== fieldId && header)
        .map(([, header]) => header as string),
    );
    return sortedExcelHeaders.filter((header) => !usedByOthers.has(header));
  };

  useEffect(() => {
    if (!open) return;
    listUsers()
      .then(setImportUsers)
      .catch(() => setImportUsers([]));
  }, [open, listUsers]);

  const reset = () => {
    setStep(0);
    setProductId("");
    setHasHeader(true);
    setLastFile(null);
    setSelectedFileMeta(null);
    setParsed(null);
    setColumnMapping({});
    setDistributionType("all");
    setCategoryIds([]);
    setUserIds([]);
    setScheduleContactDate("");
    setImportProgress(null);
    setActiveJobId(null);
    setCancellingImport(false);
    importAbortRef.current = false;
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const setMapping = (fieldId: ClientFieldId, header: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (!header) delete next[fieldId];
      else next[fieldId] = header;
      return next;
    });
  };

  const throwIfImportAborted = () => {
    if (importAbortRef.current) {
      throw new Error("IMPORT_CANCELLED");
    }
  };

  const handleCancelImport = async () => {
    if (cancellingImport) return;
    setCancellingImport(true);
    importAbortRef.current = true;

    try {
      if (activeJobId) {
        await cancelImportJob({ data: { jobId: activeJobId } });
      }
    } catch {
      // O abort local interrompe upload/importação no navegador mesmo se a API falhar.
    }
  };

  const canGoNext = () => {
    if (step === 0) return Boolean(productId);
    if (step === 1) return Boolean(parsed);
    if (step === 2) {
      if (!fieldGroups) return false;
      return fieldGroups.required.every((field) => columnMapping[field.id]);
    }
    if (step === 3) {
      return isDistributionValid(distributionType, categoryIds, userIds);
    }
    return true;
  };

  const goNext = () => {
    if (step < STEPS.length - 1) setStep((value) => value + 1);
  };

  /** Lista (Clientes/Agenda/etc.) + Kanban — sem escolha de layout na importação. */
  const buildImportDisplay = () => {
    const visibleFieldIds =
      mappedFieldIds.length > 0
        ? mappedFieldIds
        : (fieldGroups?.required.map((field) => field.id) ?? []);
    return { mode: "table" as const, visibleFieldIds };
  };

  const loadServerPreview = async (uploadId: string, withHeader: boolean) => {
    setImportProgress({
      phase: "parsing",
      label: "Analisando planilha no servidor…",
      current: 0,
      total: 1,
    });
    const preview = await parseUploadPreview({ data: { uploadId, hasHeader: withHeader } });
    setParsed({
      hasHeader: preview.hasHeader,
      headers: preview.headers,
      previewRows: preview.previewRows,
      rowCount: preview.totalRows,
      serverMode: true,
      uploadId,
    });
    setColumnMapping({});
    toast.success(`${preview.totalRows.toLocaleString("pt-BR")} linha(s) detectada(s) na planilha.`);
  };

  const uploadFileToServer = async (file: File, withHeader: boolean) => {
    const totalChunks = Math.ceil(file.size / UPLOAD_CHUNK_BYTES);
    const meta = await initUpload({
      data: { fileName: file.name, fileSize: file.size, totalChunks },
    });

    await readFileInChunks(file, UPLOAD_CHUNK_BYTES, async (chunkIndex, chunks, base64) => {
      throwIfImportAborted();
      await appendUploadChunk({
        data: { uploadId: meta.uploadId, chunkIndex, chunkBase64: base64 },
      });
      setImportProgress({
        phase: "uploading",
        label: `Enviando ${file.name} (${chunkIndex + 1}/${chunks})`,
        current: chunkIndex + 1,
        total: chunks,
      });
    });

    setImportProgress({
      phase: "parsing",
      label: "Montando arquivo no servidor…",
      current: 0,
      total: 1,
    });
    throwIfImportAborted();
    await finalizeUpload({ data: { uploadId: meta.uploadId } });
    throwIfImportAborted();
    await loadServerPreview(meta.uploadId, withHeader);
  };

  const parseUploadedFile = async (file: File, withHeader: boolean) => {
    setLoading(true);
    setImportProgress({
      phase: shouldUseServerImport(file.size) ? "uploading" : "parsing",
      label: file.name,
      current: 0,
      total: 1,
    });
    try {
      if (shouldUseServerImport(file.size)) {
        await uploadFileToServer(file, withHeader);
      } else {
        const result = await parseExcelFile(file, {
          hasHeader: withHeader,
          onPhase: (label) => {
            setImportProgress({ phase: "parsing", label, current: 0, total: 1 });
          },
        });
        setParsed({
          hasHeader: result.hasHeader,
          headers: result.headers,
          previewRows: result.previewRows,
          rowCount: result.rows.length,
          serverMode: false,
          clientRows: result.rows,
        });
        setColumnMapping({});
        toast.success(`${result.rows.length} linha(s) detectada(s) na planilha.`);
      }
    } catch (err) {
      if (err instanceof Error && err.message === "IMPORT_CANCELLED") {
        toast.info("Importação cancelada.");
        setParsed(null);
        setColumnMapping({});
        setImportProgress(null);
        return;
      }
      setParsed(null);
      setColumnMapping({});
      toast.error(err instanceof Error ? err.message : "Não foi possível ler o Excel.");
    } finally {
      setLoading(false);
      setImportProgress(null);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setLastFile(file);
    setSelectedFileMeta({ name: file.name, size: file.size });
    await parseUploadedFile(file, hasHeader);
  };

  const handleHasHeaderChange = (withHeader: boolean) => {
    setHasHeader(withHeader);
    if (!lastFile) return;

    if (parsed?.serverMode && parsed.uploadId) {
      setLoading(true);
      void loadServerPreview(parsed.uploadId, withHeader)
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a prévia.");
        })
        .finally(() => {
          setLoading(false);
          setImportProgress(null);
        });
      return;
    }

    void parseUploadedFile(lastFile, withHeader);
  };

  const pollServerImportJob = async (jobId: string, totalRows: number) => {
    for (let attempt = 0; attempt < 60 * 60 * 6; attempt += 1) {
      const job = await getImportJobStatus({ data: { jobId } });

      if (job.status === "error") {
        throw new Error(job.error ?? "Falha na importação no servidor.");
      }

      if (job.status === "cancelled") {
        setImportProgress({
          phase: "done",
          label: job.phaseLabel,
          current: job.imported,
          total: job.total || totalRows,
        });
        toast.info(job.phaseLabel);
        if (job.imported > 0) onImported();
        await new Promise((resolve) => setTimeout(resolve, 700));
        close();
        return;
      }

      if (job.status === "done") {
        setImportProgress({
          phase: "done",
          label: job.phaseLabel,
          current: job.imported,
          total: job.total || totalRows,
        });
        toast.success(`${job.imported.toLocaleString("pt-BR")} cliente(s) importado(s).`);
        onImported();
        await new Promise((resolve) => setTimeout(resolve, 700));
        close();
        return;
      }

      setImportProgress({
        phase: job.status === "parsing" ? "parsing" : "importing",
        label: job.phaseLabel,
        current: job.processed,
        total: job.total || totalRows,
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error("Tempo limite excedido aguardando a importação.");
  };

  const handleImport = async () => {
    if (!parsed || !product) return;
    setLoading(true);

    const distribution = buildLeadDistribution(distributionType, categoryIds, userIds);
    const display = buildImportDisplay();
    const scheduleDate = scheduleContactDate.trim() || undefined;
    const totalRows = parsed.rowCount;

    importAbortRef.current = false;
    setActiveJobId(null);

    setImportProgress({
      phase: "importing",
      label: `0 de ${totalRows.toLocaleString("pt-BR")} clientes`,
      current: 0,
      total: totalRows,
    });

    try {
      if (parsed.serverMode && parsed.uploadId) {
        const { jobId } = await startServerImport({
          data: {
            uploadId: parsed.uploadId,
            productId: product.id,
            hasHeader: parsed.hasHeader,
            columnMapping,
            distribution,
            display,
            scheduleContactDate: scheduleDate,
          },
        });
        setActiveJobId(jobId);
        await pollServerImportJob(jobId, totalRows);
        return;
      }

      const rows = parsed.clientRows ?? [];
      const chunks = chunkArray(rows, IMPORT_CHUNK_SIZE);
      let processed = 0;
      let batchId: string | undefined;

      for (const chunk of chunks) {
        if (importAbortRef.current) break;

        const result = await importClients({
          data: {
            productId: product.id,
            columnMapping,
            rows: chunk,
            distribution,
            display,
            batchId,
            scheduleContactDate: scheduleDate,
          },
        });

        batchId = result.batchId;
        processed += result.imported;

        setImportProgress({
          phase: "importing",
          label: `${processed} de ${totalRows} clientes importados`,
          current: processed,
          total: totalRows,
        });
      }

      if (importAbortRef.current) {
        setImportProgress({
          phase: "done",
          label: `${processed.toLocaleString("pt-BR")} cliente(s) importados — importação cancelada`,
          current: processed,
          total: totalRows,
        });
        toast.info(
          processed > 0
            ? `${processed.toLocaleString("pt-BR")} cliente(s) mantidos no sistema. Importação cancelada.`
            : "Importação cancelada.",
        );
        if (processed > 0) onImported();
        await new Promise((resolve) => setTimeout(resolve, 700));
        close();
        return;
      }

      setImportProgress({
        phase: "done",
        label: `${processed} cliente(s) importado(s) com sucesso`,
        current: processed,
        total: totalRows,
      });

      toast.success(`${processed} cliente(s) importado(s).`);
      onImported();
      await new Promise((resolve) => setTimeout(resolve, 700));
      close();
    } catch (err) {
      if (err instanceof Error && err.message === "IMPORT_CANCELLED") {
        setImportProgress(null);
        toast.info("Importação cancelada.");
        close();
        return;
      }
      setImportProgress(null);
      toast.error(err instanceof Error ? err.message : "Falha na importação.");
    } finally {
      setLoading(false);
      setCancellingImport(false);
      setActiveJobId(null);
      importAbortRef.current = false;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !loading) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl gap-0 overflow-hidden p-0">
        <div className="relative flex max-h-[90dvh] flex-col gap-6 overflow-y-auto p-6">
          {importProgress ? (
            <ClientImportProgress
              progress={importProgress}
              onCancel={loading ? () => void handleCancelImport() : undefined}
              cancelling={cancellingImport}
            />
          ) : null}
          <DialogHeader className="pr-8">
          <DialogTitle>Importar clientes</DialogTitle>
          <DialogDescription>
            Passo {step + 1} de {STEPS.length}: {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {STEPS.map((label, index) => (
            <Badge key={label} variant={index === step ? "default" : index < step ? "secondary" : "outline"}>
              {index + 1}. {label}
            </Badge>
          ))}
        </div>

        {step === 0 ? (
          <div className="space-y-3">
            <Label>Produto</Label>
            <p className="text-xs text-muted-foreground">
              O produto define quais campos são obrigatórios e opcionais na indexação.
            </p>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {settings.products.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {product && fieldGroups ? (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                <p>
                  <strong>{fieldGroups.required.length}</strong> obrigatório(s) ·{" "}
                  <strong>{fieldGroups.optional.length}</strong> disponível(is)
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>A planilha tem cabeçalho na primeira linha?</Label>
              <p className="text-xs text-muted-foreground">
                Informe se a primeira linha contém os nomes das colunas ou se todas as linhas são dados de clientes.
              </p>
              <RadioGroup
                value={hasHeader ? "yes" : "no"}
                onValueChange={(value) => handleHasHeaderChange(value === "yes")}
              >
                <label className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
                  <RadioGroupItem value="yes" />
                  <span className="text-sm">Sim — a primeira linha é o cabeçalho</span>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
                  <RadioGroupItem value="no" />
                  <span className="text-sm">Não — todas as linhas são dados (colunas numeradas)</span>
                </label>
              </RadioGroup>
            </div>
            {selectedFileMeta ? (
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  isLargeExcelFile(selectedFileMeta.size)
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                    : "border-border/60 bg-muted/30 text-muted-foreground"
                }`}
              >
                <strong className="text-foreground">{selectedFileMeta.name}</strong> ·{" "}
                {formatExcelFileSize(selectedFileMeta.size)}
                {shouldUseServerImport(selectedFileMeta.size) ? (
                  <p className="mt-1">
                    Arquivo grande: será enviado e processado no servidor. Aguarde o indicador de progresso.
                  </p>
                ) : null}
              </div>
            ) : null}
            <Label>Arquivo Excel (.xlsx, .xls, .csv)</Label>
            <label
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 px-6 py-8 hover:bg-muted/40 ${loading ? "pointer-events-none opacity-60" : ""}`}
            >
              <Upload className="size-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                {loading ? "Processando planilha…" : "Clique para enviar planilha"}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={loading}
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
            </label>
            {parsed ? (
              <div className="space-y-3 rounded-lg border border-border/60 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <FileSpreadsheet className="size-4" /> {parsed.rowCount.toLocaleString("pt-BR")} linhas ·{" "}
                  {parsed.headers.length} colunas
                  {parsed.serverMode ? (
                    <Badge variant="secondary" className="ml-2">
                      Servidor
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {parsed.hasHeader
                    ? "Cabeçalho detectado na primeira linha."
                    : "Sem cabeçalho — colunas numeradas automaticamente."}
                </p>
                <p className="text-xs text-muted-foreground">Colunas: {parsed.headers.join(", ")}</p>
                {parsed.previewRows.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border border-border/60">
                    <table className="w-full min-w-[480px] text-left text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          {parsed.headers.map((header) => (
                            <th key={header} className="whitespace-nowrap px-2 py-1.5 font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.previewRows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-t border-border/60">
                            {parsed.headers.map((header) => (
                              <td key={header} className="max-w-[160px] truncate px-2 py-1.5 text-muted-foreground">
                                {row[header] || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="border-t border-border/60 px-2 py-1 text-[10px] text-muted-foreground">
                      Prévia das primeiras {parsed.previewRows.length} linha(s)
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 && fieldGroups && parsed ? (
          <div className="space-y-5">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Campos obrigatórios</h3>
              {fieldGroups.required.map((field) => (
                <div key={field.id} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                  <span className="text-sm">
                    {field.label} <Badge className="ml-1">Obrigatório</Badge>
                  </span>
                  <Select
                    value={columnMapping[field.id] ?? "__empty__"}
                    onValueChange={(value) => setMapping(field.id, value === "__empty__" ? "" : value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Coluna do Excel" className="truncate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__" disabled>
                        Coluna do Excel
                      </SelectItem>
                      {headersForField(field.id).map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {fieldGroups.optional.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Campos disponíveis (opcional)</h3>
                {fieldGroups.optional.map((field) => (
                  <div key={field.id} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                    <span className="text-sm">{field.label}</span>
                    <Select
                      value={columnMapping[field.id] ?? "__none__"}
                      onValueChange={(value) =>
                        setMapping(field.id, value === "__none__" ? "" : value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Não indexar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Não indexar</SelectItem>
                        {headersForField(field.id).map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <LeadDistributionForm
            distributionType={distributionType}
            onDistributionTypeChange={setDistributionType}
            categoryIds={categoryIds}
            onCategoryIdsChange={setCategoryIds}
            userIds={userIds}
            onUserIdsChange={setUserIds}
            categories={settings.categories}
            users={importUsers}
            scheduleContactDate={scheduleContactDate}
            onScheduleContactDateChange={setScheduleContactDate}
          />
        ) : null}

        <DialogFooter className="mt-2 flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={loading}
            onClick={step === 0 ? close : () => setStep((value) => value - 1)}
          >
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" className="w-full sm:w-auto" disabled={!canGoNext() || loading} onClick={goNext}>
              Próximo
            </Button>
          ) : (
            <Button type="button" className="w-full sm:w-auto" disabled={!canGoNext() || loading} onClick={() => void handleImport()}>
              {loading ? "Importando…" : "Importar clientes"}
            </Button>
          )}
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
