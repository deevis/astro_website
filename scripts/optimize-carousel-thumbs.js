import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const CARD_WIDTH = 720;
const WEBP_QUALITY = 74;

function collectSources() {
  const sources = [];
  const showcaseDir = path.join(PUBLIC_DIR, 'html_showcase');

  for (const entry of fs.readdirSync(showcaseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const thumb = path.join(showcaseDir, entry.name, 'thumb.png');
    if (fs.existsSync(thumb)) sources.push(thumb);
  }

  for (const folder of ['images/games', 'images/apps']) {
    const abs = path.join(PUBLIC_DIR, folder);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      if (!/\.(png|jpe?g|webp)$/i.test(name)) continue;
      if (name.includes('-card.')) continue;
      sources.push(path.join(abs, name));
    }
  }

  return sources;
}

function destFor(source) {
  return source.replace(/\.(png|jpe?g|webp)$/i, '-card.webp');
}

async function optimize(source) {
  const dest = destFor(source);
  const srcStat = fs.statSync(source);
  if (fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= srcStat.mtimeMs) {
    const kb = Math.round(fs.statSync(dest).size / 1024);
    console.log(`skip ${path.relative(PUBLIC_DIR, dest)} (${kb}KB)`);
    return { dest, skipped: true, before: srcStat.size, after: fs.statSync(dest).size };
  }

  await sharp(source)
    .resize({ width: CARD_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(dest);

  const after = fs.statSync(dest).size;
  console.log(
    `${path.relative(PUBLIC_DIR, source)} ${Math.round(srcStat.size / 1024)}KB → ${path.basename(dest)} ${Math.round(after / 1024)}KB`
  );
  return { dest, skipped: false, before: srcStat.size, after };
}

const results = [];
for (const source of collectSources()) {
  results.push(await optimize(source));
}

const before = results.reduce((sum, item) => sum + item.before, 0);
const after = results.reduce((sum, item) => sum + item.after, 0);
console.log(
  `\n${results.length} card images: ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB`
);
