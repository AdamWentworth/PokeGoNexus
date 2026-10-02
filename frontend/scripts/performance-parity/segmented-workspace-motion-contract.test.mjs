import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const frontendDirectory = path.resolve(import.meta.dirname, '../..');
const read = (file) => readFileSync(path.resolve(frontendDirectory, file), 'utf8');
const motion = read('apps/mobile/src/components/useNativeWorkspaceMotion.ts');
const slider = read('apps/mobile/src/components/NativeHorizontalPageSlider.tsx');
const control = read('apps/mobile/src/components/NativeSlidingSegmentedControl.tsx');
const retainedPage = read('apps/mobile/src/components/NativeRetainedWorkspacePage.tsx');
const screens = [
  ['Raid', 'apps/mobile/src/screens/NativeRaidScreen.tsx', 'native-raid-workspace-motion'],
  ['PvP', 'apps/mobile/src/screens/NativePvpScreen.tsx', 'native-pvp-workspace-motion'],
  ['Rankings', 'apps/mobile/src/screens/NativeRankingsScreen.tsx', 'native-rankings-workspace-motion'],
  ['Max Battles', 'apps/mobile/src/screens/NativeMaxScreen.tsx', 'native-max-workspace-motion'],
];

test('workspace content and indicators share the canonical native-driven page clock', () => {
  assert.match(motion, /new Animated\.Value\(initialIndex \* windowWidth\)/);
  assert.match(motion, /Animated\.divide\(scrollX, Math\.max\(width, 1\)\)/);
  assert.match(motion, /return \{ onLayout, progress, scrollX \}/);
  assert.match(slider, /collectionExperienceParityContract\.pageTransitionMs/);
  assert.match(slider, /transitionDuration = NATIVE_HORIZONTAL_PAGE_TRANSITION_MS/);
  assert.match(slider, /pageScrollX = scrollX \?\? internalScrollX/);
  const animation = slider.match(/Animated\.timing\(pageScrollX, \{([\s\S]*?)\}\)/)?.[1];
  assert.ok(animation, 'the page track animates the shared scroll value');
  assert.match(animation, /duration:\s*transitionDuration/);
  assert.match(animation, /toValue:\s*nextIndex \* width/);
  assert.match(animation, /useNativeDriver:\s*true/);
  assert.match(animation, /isInteraction:\s*false/);
  assert.match(control, /Animated\.multiply\(progress \?\? indicatorPosition, metrics\.itemOffset\)/);
  assert.match(control, /if \(progress\) return;/);
  assert.match(control, /if \(!progress\) moveIndicator\(index\);/);
});

test('workspace pages retain their content after the first visit', () => {
  assert.match(retainedPage, /useState\(active\)/);
  assert.match(retainedPage, /if \(active && !hasOpened\) setHasOpened\(true\)/);
  assert.match(retainedPage, /return active \|\| hasOpened \? children : null/);
});

for (const [label, sourcePath, motionTestId] of screens) {
  test(`${label} slides retained workspaces beneath its stationary header`, () => {
    const source = read(sourcePath);
    assert.match(source, /useNativeWorkspaceMotion\(/, `${label} uses shared content motion`);
    assert.match(source, /<NativeSlidingSegmentedControl[\s\S]*?progress=\{motion\.progress\}/,
      `${label} drives the active control from the page track`);
    const headerTestId = motionTestId.replace('workspace-motion', 'stationary-header');
    assert.match(source, new RegExp(
      `<View[^>]*testID=["']${headerTestId}["'][^>]*>[\\s\\S]*?</View>\\s*`
      + `<View onLayout=\\{motion\\.onLayout\\}[^>]*testID=["']${motionTestId}["'][^>]*>\\s*`
      + '<NativeHorizontalPageSlider',
    ), `${label} keeps its header outside the measured sliding viewport`);
    const workspace = source.match(/<NativeHorizontalPageSlider\b[\s\S]*?<\/NativeHorizontalPageSlider>/)?.[0];
    assert.ok(workspace, `${label} renders the shared page slider`);
    assert.match(workspace, /scrollX=\{motion\.scrollX\}/, `${label} shares the page clock`);
    assert.match(workspace, /<NativeRetainedWorkspacePage active=\{/,
      `${label} preserves workspace state after switching pages`);
  });
}
