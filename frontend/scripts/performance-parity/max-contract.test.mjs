import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const frontendDirectory = path.resolve(import.meta.dirname, '../..');
const contract = JSON.parse(readFileSync(
  path.resolve(frontendDirectory, 'performance-parity/contract.json'),
  'utf8',
));
const browserCollector = readFileSync(
  path.resolve(frontendDirectory, 'apps/web/tests/browser/performance-parity-report.spec.ts'),
  'utf8',
);
const androidReporter = readFileSync(
  path.resolve(frontendDirectory, 'apps/mobile/scripts/build-android-performance-report.mjs'),
  'utf8',
);
const viteMaxSource = readFileSync(
  path.resolve(frontendDirectory, 'packages/app-core/src/pages/Max/Max.tsx'),
  'utf8',
);
const nativeMaxScreen = readFileSync(
  path.resolve(frontendDirectory, 'apps/mobile/src/screens/NativeMaxScreen.tsx'),
  'utf8',
);
const nativeMaxSources = [
  'apps/mobile/src/screens/NativeMaxScreen.tsx',
  'apps/mobile/src/components/tools/NativeMaxBattleSimulator.tsx',
].map((file) => readFileSync(path.resolve(frontendDirectory, file), 'utf8')).join('\n');

const requiredMaxInteractions = [
  ['interaction.max.view-result', 'max_view_result_painted'],
  ['interaction.max.scope-result', 'max_scope_result_painted'],
  ['interaction.max.role-result', 'max_role_result_painted'],
  ['interaction.max.type-result', 'max_type_result_painted'],
  ['interaction.max.query-result', 'max_query_result_painted'],
  ['interaction.max.more-result', 'max_more_result_painted'],
  ['interaction.max.method-result', 'max_method_result_painted'],
  ['interaction.max.boss-query-result', 'max_boss_query_result_painted'],
  ['interaction.max.boss-result', 'max_boss_result_painted'],
  ['interaction.max.trainer-result', 'max_trainer_result_painted'],
  ['interaction.max.party-result', 'max_party_result_painted'],
  ['interaction.max.advanced-result', 'max_advanced_result_painted'],
  ['interaction.max.execution-result', 'max_execution_result_painted'],
  ['interaction.max.difficulty-result', 'max_difficulty_result_painted'],
  ['interaction.max.hp-result', 'max_hp_result_painted'],
  ['interaction.max.reset-result', 'max_reset_result_painted'],
];

test('every bounded Max Battles interaction has Vite and physical-native performance evidence', () => {
  const interactions = new Map(contract.interactions.map((entry) => [entry.id, entry]));
  for (const [scenarioId, nativeEvent] of requiredMaxInteractions) {
    assert.equal(interactions.get(scenarioId)?.nativeEvent, nativeEvent, `${scenarioId} contract mapping`);
    assert.match(browserCollector, new RegExp(`['"]${scenarioId.replaceAll('.', '\\.')}['"]`), `${scenarioId} Vite measurement`);
    assert.match(androidReporter, new RegExp(`${nativeEvent}: ['"]${scenarioId.replaceAll('.', '\\.')}['"]`), `${scenarioId} Android report mapping`);
    assert.ok(nativeMaxSources.includes(nativeEvent), `${nativeEvent} native paint trace`);
  }
});

test('Max Battles uses the reusable segmented control in Vite and Native', () => {
  assert.match(viteMaxSource, /<SegmentedControl/);
  assert.match(
    nativeMaxScreen,
    /<NativeSlidingSegmentedControl[\s\S]*?native-max-view-indicator/,
    'Native Max Battles must slide a shared indicator instead of jumping between active backgrounds',
  );
  assert.doesNotMatch(nativeMaxScreen, /view === value && styles\.viewActive/);
});
