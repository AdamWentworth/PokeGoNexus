#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import { PNG } from 'pngjs';

const screenshotPaths = process.argv.slice(2);

if (screenshotPaths.length === 0) {
  console.error('Usage: node scripts/assert-native-loading-window.mjs <loading-screenshot.png> [...]');
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

  // The loader is intentionally a uniform opaque surface except for the
  // centered spinner and system icons. Sample away from those controls across
  // the physical top and bottom rows. Any exposed action-menu gradient or
  // destination page creates a large color difference in these points.
  const reference = colorAt(png, Math.round(png.width * 0.08), Math.round(png.height * 0.5));
  const xs = [
    1,
    Math.round(png.width * 0.08),
    Math.round(png.width * 0.25),
    Math.round(png.width * 0.75),
    Math.round(png.width * 0.92),
    png.width - 2,
  ];
  const ys = [
    1,
    // Expo's Android development client owns a floating native gear over the
    // upper-right of debug builds. The physical top row still proves status-
    // bar coverage; sample below that dev-only control for interior coverage.
    Math.round(png.height * 0.16),
    Math.round(png.height * 0.35),
    Math.round(png.height * 0.65),
    Math.round(png.height * 0.92),
    png.height - 2,
  ];
  let largestDifference = { distance: -1, x: 0, y: 0, color: reference };

  for (const x of xs) {
    for (const y of ys) {
      const color = colorAt(png, x, y);
      const distance = colorDistance(reference, color);
      if (distance > largestDifference.distance) {
        largestDifference = { color, distance, x, y };
      }
    }
  }

  const maximumDifference = 9;
  if (largestDifference.distance > maximumDifference) {
    failures.push(
      `${screenshotPath}: loader does not cover the full physical window; sample at `
      + `(${largestDifference.x}, ${largestDifference.y}) differs from the overlay by `
      + `${largestDifference.distance} RGB levels`,
    );
  }

  console.log(
    `Opaque loading-window coverage: ${screenshotPath} `
    + `(${png.width}x${png.height}, background rgb(${reference.join(',')}), `
    + `max sampled difference ${largestDifference.distance})`,
  );
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
