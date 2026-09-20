import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const frontendDirectory = path.resolve(import.meta.dirname, '../..');
const viteMotionTokens = readFileSync(
  path.resolve(frontendDirectory, 'packages/shared-ui-tokens/src/web.css'),
  'utf8',
);
const viteSegmentedControlStyles = readFileSync(
  path.resolve(frontendDirectory, 'packages/app-core/src/components/layout/SegmentedControl.css'),
  'utf8',
);
const nativeRankingsScreen = readFileSync(
  path.resolve(frontendDirectory, 'apps/mobile/src/screens/NativeRankingsScreen.tsx'),
  'utf8',
);
const nativeSlidingSegmentedControl = readFileSync(
  path.resolve(frontendDirectory, 'apps/mobile/src/components/NativeSlidingSegmentedControl.tsx'),
  'utf8',
);

test('Native Rankings preserves the canonical Vite mode-control motion', () => {
  assert.match(viteMotionTokens, /--motion-fast:\s*0\.2s;/, 'Vite fast motion duration');
  assert.match(
    viteSegmentedControlStyles,
    /transition:[\s\S]*?background-color var\(--motion-fast\) ease/,
    'Vite ranking mode control transitions instead of jumping',
  );
  assert.match(nativeRankingsScreen, /<NativeSlidingSegmentedControl[\s\S]*?native-rankings-mode-indicator/);
  assert.match(nativeSlidingSegmentedControl, /<Animated\.View/);
  assert.match(
    nativeSlidingSegmentedControl,
    /duration:\s*webCssVarTokens\.motionSeconds\.fast \* 1000/,
    'Native consumes the same 200 ms motion duration',
  );
  assert.match(
    nativeSlidingSegmentedControl,
    /moveIndicator\(index\);[\s\S]*?onChange\(item\.value\);/,
    'The reusable native control starts its indicator before a destination workspace changes',
  );
});
