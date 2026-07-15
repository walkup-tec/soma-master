const { readFileSync } = require("node:fs");
const { createInflateRaw } = require("node:zlib");
const XLSX = require("xlsx");

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

function readDimensionRef(compressed) {
  return new Promise((resolve, reject) => {
    const inflater = createInflateRaw();
    let xml = "";
    inflater.on("data", (chunk) => {
      xml += chunk.toString("utf8");
      const match = xml.match(/<dimension[^>]+ref="([^"]+)"/);
      if (match) {
        inflater.destroy();
        resolve(match[1]);
      } else if (xml.length > 500_000) {
        inflater.destroy();
        resolve(null);
      }
    });
    inflater.on("error", reject);
    inflater.on("end", () => resolve(null));

    const chunkSize = 64 * 1024;
    let offset = 0;
    const push = () => {
      if (offset >= compressed.length) {
        inflater.end();
        return;
      }
      const next = compressed.subarray(offset, offset + chunkSize);
      offset += chunkSize;
      if (!inflater.write(next)) {
        inflater.once("drain", push);
      } else {
        push();
      }
    };
    push();
  });
}

(async () => {
  const buf = readFileSync("data/uploads/upload-96ac9ced-2ec/file.bin");
  const compressed = findZipEntryMeta(buf, "xl/worksheets/sheet1.xml");
  const t0 = Date.now();
  const ref = await readDimensionRef(compressed);
  console.log("ref", ref, "ms", Date.now() - t0);
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    console.log("rows", range.e.r - range.s.r + 1);
  }
})();
