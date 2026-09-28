// Regenerates every derived app icon from src-tauri/icons/icon.png in one pass:
//
//  1. Android adaptive-icon foreground PNGs — transparent canvas with the centered
//     black mark, written to both src-tauri/icons/android and the live
//     gen/android/app/src/main/res tree (background comes from
//     @color/ic_launcher_background). MARK_RATIO controls mark size relative to
//     the 108dp foreground canvas.
//
//  2. Full-bleed 1024px store icon — lime canvas sampled from the source mark,
//     written to src-tauri/icons/app-icon-fullbleed.png (Play Store listing /
//     PWA chrome asset; `tauri icon` does not produce this form).
//
// IMPORTANT: this project ships ADAPTIVE-ONLY launcher icons. Density-qualified
// legacy PNGs (mipmap-*/ic_launcher.png) must NOT exist: the Pixel launcher loads
// icons via getDrawableForDensity(), which prefers a density PNG over the
// anydpi-v26 adaptive XML and then "normalizes" the full-bleed bitmap (shrinks it
// to ~0.8 and paints a pale palette-color ring behind it). Pre-API-26 fallbacks
// live in the unqualified mipmap/ folder only.
// After `yarn tauri icon` (which rewrites these with its own defaults), run this
// script and delete the density ic_launcher.png / ic_launcher_round.png it recreates.
//
// Usage: node src-tauri/scripts/gen-icons.mjs   (from any cwd; paths resolve
// relative to this file). Optional env: MARK_RATIO (default 0.62).
import sharp from 'sharp';
import { writeFileSync, existsSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'src-tauri/icons/icon.png');
const FULLBLEED_OUT = path.join(ROOT, 'src-tauri/icons/app-icon-fullbleed.png');
const MARK_RATIO = Number(process.env.MARK_RATIO || 0.62);
const DENSITIES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const TARGETS = ['src-tauri/icons/android', 'src-tauri/gen/android/app/src/main/res'];

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const isMark = (i) => data[i + 3] > 10 && data[i] < 90 && data[i + 1] < 90 && data[i + 2] < 90;

// Bounding box of the black mark.
let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    if (isMark(i)) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
}
const markW = maxX - minX + 1, markH = maxY - minY + 1;

// Extract the mark region, recolored #101513 on transparent.
const markBuf = Buffer.alloc(markW * markH * 4);
for (let y = minY; y <= maxY; y++) {
  for (let x = minX; x <= maxX; x++) {
    const i = (y * info.width + x) * 4;
    const o = ((y - minY) * markW + (x - minX)) * 4;
    if (isMark(i)) {
      markBuf[o] = 16; markBuf[o + 1] = 21; markBuf[o + 2] = 19; markBuf[o + 3] = data[i + 3];
    }
  }
}
const scaledMark = async (target) => {
  const scale = target / Math.max(markW, markH);
  return sharp(markBuf, { raw: { width: markW, height: markH, channels: 4 } })
    .resize(Math.round(markW * scale), Math.round(markH * scale), { fit: 'fill', kernel: 'lanczos3' })
    .png()
    .toBuffer();
};

// 1. Android adaptive foregrounds (all densities, both target trees) + defensive
//    strip of legacy density icons if a regeneration reintroduced them.
for (const [density, size] of Object.entries(DENSITIES)) {
  const mark = await scaledMark(Math.round(size * MARK_RATIO));
  const fg = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer();
  for (const root of TARGETS) {
    writeFileSync(path.join(ROOT, root, `mipmap-${density}`, 'ic_launcher_foreground.png'), fg);
    for (const legacy of ['ic_launcher.png', 'ic_launcher_round.png']) {
      const p = path.join(ROOT, root, `mipmap-${density}`, legacy);
      if (existsSync(p)) rmSync(p);
    }
  }
}

// 2. Full-bleed 1024px store icon on the lime canvas sampled from the source
//    (Chrome fills ~100% of the visible circle; adaptive safe zone is 66%).
const SIZE = 1024;
let lime = [176, 244, 6];
outer: for (let y = 30; y < info.height / 2; y++) {
  const i = (y * info.width + Math.floor(info.width / 2) - 120) * 4;
  if (data[i + 1] > 200 && data[i] > 120 && data[i + 2] < 120) { lime = [data[i], data[i + 1], data[i + 2]]; break outer; }
}
const bg = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: lime[0], g: lime[1], b: lime[2], alpha: 255 } } })
  .png()
  .toBuffer();
await sharp(bg)
  .composite([{ input: await scaledMark(Math.round(SIZE * MARK_RATIO)), gravity: 'center' }])
  .png()
  .toFile(FULLBLEED_OUT);

console.log('icons regenerated — mark', markW, 'x', markH, '| ratio', MARK_RATIO, '| lime', lime);
