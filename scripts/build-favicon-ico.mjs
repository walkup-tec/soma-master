// Gera public/favicon.ico com PNGs do ícone Soma embutidos (formato PNG-in-ICO).
// Uso: node scripts/build-favicon-ico.mjs
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const publicDir = join(process.cwd(), "public");
const sources = [
  { file: "favicon-16.png", size: 16 },
  { file: "favicon-32.png", size: 32 },
  { file: "favicon-48.png", size: 48 },
];

const images = [];
for (const source of sources) {
  const data = await readFile(join(publicDir, source.file));
  images.push({ size: source.size, data });
}

const headerSize = 6;
const entrySize = 16;
let offset = headerSize + entrySize * images.length;

const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0); // reservado
header.writeUInt16LE(1, 2); // tipo: ícone
header.writeUInt16LE(images.length, 4);

const entries = [];
for (const image of images) {
  const entry = Buffer.alloc(entrySize);
  entry.writeUInt8(image.size === 256 ? 0 : image.size, 0); // largura
  entry.writeUInt8(image.size === 256 ? 0 : image.size, 1); // altura
  entry.writeUInt8(0, 2); // paleta
  entry.writeUInt8(0, 3); // reservado
  entry.writeUInt16LE(1, 4); // planos
  entry.writeUInt16LE(32, 6); // bits por pixel
  entry.writeUInt32LE(image.data.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += image.data.length;
  entries.push(entry);
}

const ico = Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
await writeFile(join(publicDir, "favicon.ico"), ico);
console.log(`favicon.ico gerado com ${images.length} tamanhos (${ico.length} bytes).`);
