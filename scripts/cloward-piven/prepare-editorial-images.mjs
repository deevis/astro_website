import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error('Pass the directory containing the generated image originals.');
const images = {
  paperwork: 'exec-7e6032cf-3d87-4ef6-9c74-c50c272973ba.png',
  classroom: 'exec-72b16158-cb25-4ac3-b63b-2a1842216bab.png',
  staircase: 'exec-7b03ca57-2158-46a6-a0b6-c0e5dc489d7a.png',
  rescue: 'exec-540bc7a4-c161-4122-913d-5fa7b7565278.png',
};
const destination = path.join(root, 'public/images/articles/cloward-piven');
await fs.mkdir(destination, { recursive: true });
for (const [name, filename] of Object.entries(images)) {
  for (const width of [640, 1200, 1774]) {
    const output = path.join(destination, `${name}-${width}.webp`);
    await sharp(path.join(sourceDirectory, filename))
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 84, effort: 6 })
      .toFile(output);
    console.log(`${path.basename(output)}: ${Math.round((await fs.stat(output)).size / 1024)} KB`);
  }
}
