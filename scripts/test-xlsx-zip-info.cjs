const { readFileSync } = require("node:fs");

function listZipEntries(buffer) {
  let offset = 0;
  const entries = [];
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
    entries.push({ name, compression, compressedSize, uncompressedSize });
    offset = dataStart + compressedSize;
  }
  return entries;
}

const buf = readFileSync("data/uploads/upload-96ac9ced-2ec/file.bin");
const entries = listZipEntries(buf).filter((e) => e.name.includes("sheet") || e.name.includes("workbook"));
for (const e of entries) console.log(e);
