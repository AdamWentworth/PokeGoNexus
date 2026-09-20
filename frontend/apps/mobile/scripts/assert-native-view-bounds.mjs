#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';

const [hierarchyPath, resourceId, expectedWidthValue, expectedHeightValue] = process.argv.slice(2);
const expectedWidth = Number(expectedWidthValue);
const expectedHeight = Number(expectedHeightValue);

if (
  !hierarchyPath
  || !resourceId
  || !Number.isInteger(expectedWidth)
  || !Number.isInteger(expectedHeight)
  || expectedWidth <= 0
  || expectedHeight <= 0
) {
  console.error(
    'Usage: node scripts/assert-native-view-bounds.mjs '
    + '<hierarchy.xml> <resource-id> <display-width> <display-height>',
  );
  process.exit(2);
}

const hierarchy = fs.readFileSync(hierarchyPath, 'utf8');
const nodes = hierarchy.match(/<node\b[^>]*>/g) ?? [];
const matchingBounds = [];

for (const node of nodes) {
  const resourceMatch = node.match(/\bresource-id="([^"]*)"/);
  if (resourceMatch?.[1] !== resourceId) continue;

  const boundsMatch = node.match(/\bbounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (boundsMatch) matchingBounds.push(boundsMatch.slice(1).map(Number));
}

if (matchingBounds.length === 0) {
  console.error(`FAIL: hierarchy has no measurable node with resource-id="${resourceId}"`);
  process.exit(1);
}

const expectedBounds = [0, 0, expectedWidth, expectedHeight];
const fullWindowBounds = matchingBounds.find((bounds) => (
  bounds.every((value, index) => value === expectedBounds[index])
));

if (!fullWindowBounds) {
  const renderedBounds = matchingBounds
    .map(([left, top, right, bottom]) => `[${left},${top}][${right},${bottom}]`)
    .join(', ');
  console.error(
    `FAIL: ${resourceId} bounds are ${renderedBounds}; expected `
    + `[0,0][${expectedWidth},${expectedHeight}]`,
  );
  process.exit(1);
}

console.log(
  `Full-window native view bounds: ${resourceId} `
  + `[0,0][${expectedWidth},${expectedHeight}]`,
);
