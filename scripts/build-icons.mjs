/**
 * One-off icon rasteriser.
 *
 * Regenerates the PWA PNGs from the SVG sources so the manifest icons match the
 * new mark. Uses the `sharp` already present in node_modules (Next ships it for
 * image optimisation), so no new dependency is added.
 *
 *   node scripts/build-icons.mjs
 */

import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const icons = join(root, 'public', 'icons');

const jobs = [
  { src: 'icon.svg', out: 'icon-192.png', size: 192 },
  { src: 'icon.svg', out: 'icon-512.png', size: 512 },
  { src: 'icon-maskable.svg', out: 'icon-maskable-192.png', size: 192 },
  { src: 'icon-maskable.svg', out: 'icon-maskable-512.png', size: 512 },
];

for (const { src, out, size } of jobs) {
  const svg = await readFile(join(icons, src));
  const png = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(join(icons, out), png);
  console.log(`${out.padEnd(26)} ${size}x${size}  ${png.length} bytes`);
}

// Apple touch icon. iOS ignores SVG favicons and manifest icons for
// "Add to Home Screen", so it needs its own PNG.
const apple = await sharp(await readFile(join(icons, 'icon.svg')), { density: 384 })
  .resize(180, 180)
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(join(root, 'src', 'app', 'apple-icon.png'), apple);
console.log(`apple-icon.png             180x180  ${apple.length} bytes`);

/**
 * favicon.ico
 *
 * sharp cannot emit ICO, but ICO is only a container and Vista-era browsers
 * onward accept a PNG payload inside it. So we hand-assemble a single-frame
 * 32x32 PNG-in-ICO: 6-byte header, 16-byte directory entry, then the PNG.
 *
 * Modern browsers prefer app/icon.svg anyway; this exists so older clients and
 * bookmark UIs stop showing the previous purple orb.
 */
const ico32 = await sharp(await readFile(join(icons, 'icon.svg')), { density: 384 })
  .resize(32, 32)
  .png({ compressionLevel: 9 })
  .toBuffer();

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type 1 = icon
header.writeUInt16LE(1, 4); // one image

const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0); // width
entry.writeUInt8(32, 1); // height
entry.writeUInt8(0, 2); // palette colours (0 = none)
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // colour planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(ico32.length, 8); // payload size
entry.writeUInt32LE(header.length + 16, 12); // payload offset

await writeFile(
  join(root, 'src', 'app', 'favicon.ico'),
  Buffer.concat([header, entry, ico32])
);
console.log(
  `favicon.ico                32x32  ${header.length + 16 + ico32.length} bytes`
);
