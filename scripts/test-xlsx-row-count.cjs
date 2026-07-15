const { readFileSync } = require("node:fs");
const { inflateRawSync } = require("node:zlib");
const XLSX = require("xlsx");

function findZipEntry(buffer, fileName) {
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
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString("utf8", offset + 30, offset + 30 + nameLength);
    const dataStart = offset + 30 + nameLength + extraLength;
    if (name === fileName) {
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      if (compression === 8) return inflateRawSync(compressed);
      if (compression === 0) return Buffer.from(compressed);
      throw new Error(`Unsupported compression method: ${compression}`);
    }
    offset = dataStart + compressedSize;
  }
  return null;
}

const path = process.argv[2] || "data/uploads/upload-96ac9ced-2ec/file.bin";
const buf = readFileSync(path);
const xml = findZipEntry(buf, "xl/worksheets/sheet1.xml");
if (!xml) {
  console.error("sheet1.xml not found");
  process.exit(1);
}
const text = xml.toString("utf8");
const dimension = text.match(/<dimension[^>]+ref="([^"]+)"/);
console.log("xmlBytes", xml.length);
console.log("dimension", dimension?.[1]);
if (dimension) {
  const range = XLSX.utils.decode_range(dimension[1]);
  console.log("rowsFromDimension", range.e.r - range.s.r + 1);
}
console.log("rowTags", (text.match(/<row\b/g) || []).length);
