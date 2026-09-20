#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import { PNG } from 'pngjs';

const screenshotPaths = process.argv.slice(2);

if (screenshotPaths.length === 0) {
  console.error('Usage: node scripts/assert-native-route-window.mjs <route-screenshot.png> [...]');
  process.exit(2);
}

const colorAt = (png, x, y) => {
  const offset = ((png.width * y) + x) * 4;
  return [png.data[offset], png.data[offset + 1], png.data[offset + 2]];
};

const colorDistance = (left, right) => (
  Math.abs(left[0] - right[0])
  + Math.abs(left[1] - right[1])
  + Math.abs(left[2] - right[2])
);

const failures = [];

for (const screenshotPath of screenshotPaths) {
  const png = PNG.sync.read(fs.readFileSync(screenshotPath));
  if (png.width < 280 || png.height < 480) {
    failures.push(`${screenshotPath}: unexpected full-window screenshot size ${png.width}x${png.height}`);
    continue;
  }

  // Production route surfaces are intentionally clear along the extreme left
  // edge. Compare physical system-bar pixels with the same page surface well
  // inside the safe area. The prior defect produced rgb(0,0,0) at both ends of
  // Collection while the page itself was rgb(17,17,17).
  const xs = [1, Math.max(2, Math.round(png.width * 0.008))];
  const interiorYs = [
    Math.round(png.height * 0.18),
    Math.round(png.height * 0.5),
    Math.round(png.height * 0.82),
  ];
  const systemYs = [1, png.height - 2];
  let largestDifference = { distance: -1, x: 0, y: 0 };

  for (const x of xs) {
    const reference = colorAt(png, x, interiorYs[1]);
    for (const y of [...systemYs, ...interiorYs]) {
      const distance = colorDistance(reference, colorAt(png, x, y));
      if (distance > largestDifference.distance) {
        largestDifference = { distance, x, y };
      }
    }
  }

  const maximumDifference = 9;
  if (largestDifference.distance > maximumDifference) {
    failures.push(
      `${screenshotPath}: route surface stops before the physical window edge; `
      + `sample at (${largestDifference.x}, ${largestDifference.y}) differs by `
      + `${largestDifference.distance} RGB levels`,
    );
  }

  console.log(
    `Full-window route coverage: ${screenshotPath} `
    + `(${png.width}x${png.height}, max sampled difference ${largestDifference.distance})`,
  );
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
