import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const SIZE = 128;
const INNER_STOP = 0.1;
const OUTER_STOP = 0.5;
const MAX_ALPHA = 0.4;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(
  scriptDirectory,
  '../assets/collection-status-glow.png',
);
const png = new PNG({ width: SIZE, height: SIZE });
const center = (SIZE - 1) / 2;
const gradientRadius = SIZE / 2;

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const distance = Math.hypot(x - center, y - center) / gradientRadius;
    const opacity = distance <= INNER_STOP
      ? MAX_ALPHA
      : distance >= OUTER_STOP
        ? 0
        : MAX_ALPHA * ((OUTER_STOP - distance) / (OUTER_STOP - INNER_STOP));
    const offset = ((y * SIZE) + x) * 4;
    png.data[offset] = 255;
    png.data[offset + 1] = 255;
    png.data[offset + 2] = 255;
    png.data[offset + 3] = Math.round(opacity * 255);
  }
}

fs.writeFileSync(outputPath, PNG.sync.write(png));
