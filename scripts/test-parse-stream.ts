import { iterateXlsxRowsFromPath } from "../src/lib/clients/xlsx-zip-stream";

const filePath = process.argv[2] ?? "data/uploads/upload-96ac9ced-2ec/file.bin";
const started = Date.now();
let firstBatch: Record<string, string>[] = [];

const result = await iterateXlsxRowsFromPath(
  filePath,
  true,
  async (rows) => {
    if (firstBatch.length === 0) firstBatch = rows.slice(0, 2);
    throw new Error("STOP_AFTER_FIRST_BATCH");
  },
  { batchSize: 2000, onPhase: (label) => console.log(label) },
);

console.log("processed:", result.totalRows);
