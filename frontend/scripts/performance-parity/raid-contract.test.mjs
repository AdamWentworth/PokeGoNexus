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
const nativeRaidSources = [
  'apps/mobile/src/screens/NativeRaidScreen.tsx',
  'apps/mobile/src/components/tools/NativeRaidBossSetupPanel.tsx',
  'apps/mobile/src/components/tools/NativeRaidPartyBuilder.tsx',
  'apps/mobile/src/components/tools/NativeRaidCalibrationPanel.tsx',
  'apps/mobile/src/components/tools/NativeRaidSettingsPanel.tsx',
].map((file) => readFileSync(path.resolve(frontendDirectory, file), 'utf8')).join('\n');

const requiredRaidInteractions = [
  ['interaction.raid.mode-boss', 'raid_boss_mode_painted'],
  ['interaction.raid.type-result', 'raid_type_result_painted'],
  ['interaction.raid.search-result', 'raid_search_result_painted'],
  ['interaction.raid.moveset-result', 'raid_moveset_result_painted'],
  ['interaction.raid.settings-open', 'raid_settings_painted'],
  ['interaction.raid.modifier-result', 'raid_modifier_result_painted'],
  ['interaction.raid.sort-result', 'raid_sort_result_painted'],
  ['interaction.raid.row-detail', 'raid_row_detail_painted'],
  ['interaction.raid.boss-search', 'raid_boss_search_result_painted'],
  ['interaction.raid.boss-selected', 'raid_boss_selected_result_painted'],
  ['interaction.raid.setup-open', 'raid_setup_painted'],
  ['interaction.raid.party-open', 'raid_party_painted'],
  ['interaction.raid.party-simulate', 'raid_party_result_painted'],
  ['interaction.raid.party-optimize', 'raid_party_optimization_painted'],
  ['interaction.raid.calibration-open', 'raid_calibration_dialog_painted'],
  ['interaction.raid.battle-settings-open', 'raid_battle_settings_painted'],
];

test('every bounded Raid interaction has Vite and physical-native performance evidence', () => {
  const interactions = new Map(contract.interactions.map((entry) => [entry.id, entry]));
  for (const [scenarioId, nativeEvent] of requiredRaidInteractions) {
    assert.equal(interactions.get(scenarioId)?.nativeEvent, nativeEvent, `${scenarioId} contract mapping`);
    assert.match(browserCollector, new RegExp(`['"]${scenarioId.replaceAll('.', '\\.')}['"]`), `${scenarioId} Vite measurement`);
    assert.match(androidReporter, new RegExp(`${nativeEvent}: ['"]${scenarioId.replaceAll('.', '\\.')}['"]`), `${scenarioId} Android report mapping`);
    assert.ok(nativeRaidSources.includes(nativeEvent), `${nativeEvent} native paint trace`);
  }
});
