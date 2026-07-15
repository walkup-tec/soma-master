const path = require("node:path");

async function main() {
  const filePath = process.argv[2] || "data/uploads/upload-96ac9ced-2ec/file.bin";
  const started = Date.now();
  const { parseXlsxPreviewLimited } = await import(
    pathToFileURL(path.join(process.cwd(), "src/lib/clients/xlsx-zip-stream.ts")).href
  );

  const result = await parseXlsxPreviewLimited(filePath, true, {
    onPhase: (label) => console.log(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${label}`),
  });

  console.log("totalRows:", result.totalRows);
  console.log("headers:", result.headers.slice(0, 8).join(", "), "…");
  console.log("preview[0]:", JSON.stringify(result.previewRows[0]).slice(0, 200));
  console.log("elapsed:", ((Date.now() - started) / 1000).toFixed(1), "s");
}

const { pathToFileURL } = require("node:url");
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
