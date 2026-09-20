#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import { PNG } from 'pngjs';

const screenshotPaths = process.argv.slice(2);

if (screenshotPaths.length === 0) {
  console.error('Usage: node scripts/assert-native-action-menu-window.mjs <full-window-gradient-screenshot.png> [...]');
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

const sameColor = (left, right) => (
  left[0] === right[0] && left[1] === right[1] && left[2] === right[2]
);

const failures = [];

for (const screenshotPath of screenshotPaths) {
  const png = PNG.sync.read(fs.readFileSync(screenshotPath));
  if (png.width < 280 || png.height < 480) {
    failures.push(`${screenshotPath}: unexpected full-window screenshot size ${png.width}x${png.height}`);
    continue;
  }

  // The extreme left edge is deliberately free of menu controls. A valid
  // top-left-to-bottom-right gradient changes smoothly there through the
  // Android navigation-bar region. The previous SVG implementation stopped
  // early and exposed a flat fallback band across the bottom of the window.
  const sampleColumns = [
    Math.max(2, Math.round(png.width * 0.006)),
    Math.max(3, Math.round(png.width * 0.014)),
  ];
  const firstRow = Math.floor(png.height * 0.55);
  const lastRow = png.height - 2;
  let largestStep = { distance: -1, x: 0, y: 0 };
  let longestBottomFlatRun = 0;

  for (const x of sampleColumns) {
    for (let y = firstRow + 1; y <= lastRow; y += 1) {
      const distance = colorDistance(colorAt(png, x, y - 1), colorAt(png, x, y));
      if (distance > largestStep.distance) largestStep = { distance, x, y };
    }

    const bottomColor = colorAt(png, x, lastRow);
    let flatRun = 1;
    for (let y = lastRow - 1; y >= firstRow; y -= 1) {
      if (!sameColor(colorAt(png, x, y), bottomColor)) break;
      flatRun += 1;
    }
    longestBottomFlatRun = Math.max(longestBottomFlatRun, flatRun);
  }

  const maximumSmoothStep = 12;
  const maximumFlatRun = Math.max(12, Math.floor(png.height * 0.012));
  if (largestStep.distance > maximumSmoothStep) {
    failures.push(
      `${screenshotPath}: background seam at (${largestStep.x}, ${largestStep.y}); `
      + `adjacent-row RGB distance ${largestStep.distance} exceeds ${maximumSmoothStep}`,
    );
  }
  if (longestBottomFlatRun > maximumFlatRun) {
    failures.push(
      `${screenshotPath}: bottom ${longestBottomFlatRun}px is a flat color band; `
      + `expected the background gradient to continue through the system-navigation region`,
    );
  }

  console.log(
    `Full-window gradient coverage: ${screenshotPath} `
    + `(${png.width}x${png.height}, max step ${largestStep.distance}, `
    + `bottom flat run ${longestBottomFlatRun}px)`,
  );
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
