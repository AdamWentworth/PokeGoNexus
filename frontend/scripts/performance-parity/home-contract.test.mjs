import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const frontendDirectory = path.resolve(import.meta.dirname, '../..');
const read = (file) => readFileSync(path.resolve(frontendDirectory, file), 'utf8');
const contract = JSON.parse(read('performance-parity/contract.json'));
const browserCollector = read('apps/web/tests/browser/performance-parity-report.spec.ts');
const androidReporter = read('apps/mobile/scripts/build-android-performance-report.mjs');
const nativeHomeSources = [
  read('apps/mobile/src/components/NativeActionMenuHint.tsx'),
  read('apps/mobile/src/components/NativeHomeOnboarding.tsx'),
  read('apps/mobile/src/screens/NativeGuestHomeScreen.tsx'),
].join('\n');

const requiredHomeInteractions = [
  ['interaction.home.hint-dismiss', 'home_hint_dismiss_result_painted'],
  ['interaction.home.guest-explore', 'home_guest_explore_result_painted'],
  ['interaction.home.onboarding-dismiss', 'home_onboarding_dismiss_result_painted'],
];

test('every bounded Home interaction has Vite and physical-native performance evidence', () => {
  const interactions = new Map(contract.interactions.map((entry) => [entry.id, entry]));
  for (const [scenarioId, nativeEvent] of requiredHomeInteractions) {
    assert.equal(interactions.get(scenarioId)?.nativeEvent, nativeEvent, `${scenarioId} contract mapping`);
    assert.match(browserCollector, new RegExp(`['"]${scenarioId.replaceAll('.', '\\.')}['"]`), `${scenarioId} Vite measurement`);
    assert.match(androidReporter, new RegExp(`${nativeEvent}: ['"]${scenarioId.replaceAll('.', '\\.')}['"]`), `${scenarioId} Android report mapping`);
    assert.ok(nativeHomeSources.includes(nativeEvent), `${nativeEvent} native paint trace`);
  }
});
