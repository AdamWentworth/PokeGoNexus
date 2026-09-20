import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const frontendDirectory = path.resolve(import.meta.dirname, '../..');
const motion = readFileSync(
  path.resolve(frontendDirectory, 'apps/mobile/src/components/useNativeSegmentedWorkspaceMotion.ts'),
  'utf8',
);
const screens = [
  ['Raid', 'apps/mobile/src/screens/NativeRaidScreen.tsx', 'native-raid-workspace-motion'],
  ['PvP', 'apps/mobile/src/screens/NativePvpScreen.tsx', 'native-pvp-workspace-motion'],
  ['Rankings', 'apps/mobile/src/screens/NativeRankingsScreen.tsx', 'native-rankings-workspace-motion'],
  ['Max Battles', 'apps/mobile/src/screens/NativeMaxScreen.tsx', 'native-max-workspace-motion'],
];

test('segmented feature pages move their workspace content as well as the active control', () => {
  assert.match(motion, /webCssVarTokens\.motionSeconds\.fast \* 1_000/);
  assert.match(motion, /NATIVE_SEGMENTED_WORKSPACE_DISTANCE_PX = 16/);
  assert.match(motion, /useNativeDriver:\s*true/);
  assert.match(motion, /isInteraction:\s*false/);
  assert.match(motion, /requestAnimationFrame/);

  for (const [label, sourcePath, motionTestId] of screens) {
    const source = readFileSync(path.resolve(frontendDirectory, sourcePath), 'utf8');
    assert.match(source, /<NativeSlidingSegmentedControl/, `${label} uses the shared moving control`);
    assert.match(source, /useNativeSegmentedWorkspaceMotion\(/, `${label} uses shared content motion`);
    assert.match(source, new RegExp(`testID=["']${motionTestId}["']`), `${label} exposes its moving workspace`);
    assert.match(source, /workspaceMotion\.stationaryStyle/, `${label} keeps its product header and control stationary`);
  }
});
