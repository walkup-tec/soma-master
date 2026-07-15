const { readFileSync } = require("node:fs");
const { createInflateRaw } = require("node:zlib");

function findZipEntryMeta(buffer, fileName) {
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
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString("utf8", offset + 30, offset + 30 + nameLength);
    const dataStart = offset + 30 + nameLength + extraLength;
    if (name === fileName) {
      return buffer.subarray(dataStart, dataStart + compressedSize);
    }
    offset = dataStart + compressedSize;
  }
  return null;
}

function inflatePrefix(compressed, maxBytes = 200000) {
  return new Promise((resolve, reject) => {
    const inflater = createInflateRaw();
    let out = Buffer.alloc(0);
    inflater.on("data", (chunk) => {
      out = Buffer.concat([out, chunk]);
      if (out.length >= maxBytes) {
        inflater.destroy();
        resolve(out.subarray(0, maxBytes).toString("utf8"));
      }
    });
    inflater.on("error", reject);
    inflater.on("end", () => resolve(out.toString("utf8")));
    const feed = compressed.subarray(0, Math.min(compressed.length, 1024 * 1024));
    inflater.end(feed);
  });
}

(async () => {
  const buf = readFileSync("data/uploads/upload-96ac9ced-2ec/file.bin");
  const compressed = findZipEntryMeta(buf, "xl/worksheets/sheet1.xml");
  const xml = await inflatePrefix(compressed, 8000);
  console.log(xml.slice(0, 2500));
})();
