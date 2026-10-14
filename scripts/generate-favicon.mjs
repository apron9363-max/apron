// Generates favicon assets from public/favicon.svg using sharp.
// Output: favicon-16.png, favicon-32.png, favicon-48.png, apple-touch-icon.png (180),
//         icon-512.png, and favicon.ico (multi-resolution: 16/32/48).
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "..", "public");
const svgPath = resolve(publicDir, "favicon.svg");
const svg = readFileSync(svgPath);

const sizes = [16, 32, 48, 180, 512];

async function renderPng(size) {
  return sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

// Build a modern multi-resolution ICO file wrapping PNG entries.
function buildIco(pngEntries) {
  const count = pngEntries.length;
  const headerSize = 6 + 16 * count;
  let offset = headerSize;
  const dirEntries = [];
  const chunks = [];

  for (const { size, data } of pngEntries) {
    const w = size >= 256 ? 0 : size;
    const h = size >= 256 ? 0 : size;
    const entry = Buffer.alloc(16);
    entry.writeUInt8(w, 0);
    entry.writeUInt8(h, 1);
    entry.writeUInt8(0, 2); // color count (0 = no palette)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bit count
    entry.writeUInt32LE(data.length, 8); // bytes in resource
    entry.writeUInt32LE(offset, 12); // image offset
    dirEntries.push(entry);
    chunks.push(data);
    offset += data.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type (1 = icon)
  header.writeUInt16LE(count, 4); // count

  return Buffer.concat([header, ...dirEntries, ...chunks]);
}

async function main() {
  const pngs = [];
  for (const size of sizes) {
    const data = await renderPng(size);
    if (size === 180) {
      writeFileSync(resolve(publicDir, "apple-touch-icon.png"), data);
    } else if (size === 512) {
      writeFileSync(resolve(publicDir, "icon-512.png"), data);
    } else {
      writeFileSync(resolve(publicDir, `favicon-${size}.png`), data);
    }
    pngs.push({ size, data });
  }

  // favicon.ico contains 16, 32, 48 for maximum compatibility.
  const ico = buildIco(pngs.filter((p) => [16, 32, 48].includes(p.size)));
  writeFileSync(resolve(publicDir, "favicon.ico"), ico);

  console.log("Favicon assets generated in", publicDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
