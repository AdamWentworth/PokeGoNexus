import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const frontendDirectory = path.resolve(import.meta.dirname, '../..');
const read = (file) => readFileSync(path.resolve(frontendDirectory, file), 'utf8');
const contract = JSON.parse(read('performance-parity/contract.json'));
const browserCollector = read('apps/web/tests/browser/performance-parity-report.spec.ts');
const androidReporter = read('apps/mobile/scripts/build-android-performance-report.mjs');
const nativeProfileFixture = read('apps/mobile/src/app/device-smoke/profile.tsx');
const nativeTrainerSources = [
  read('apps/mobile/src/screens/NativeTrainerProfileScreen.tsx'),
  read('apps/mobile/src/features/social/NativeTrainerShowcasePicker.tsx'),
  read('apps/mobile/src/screens/NativeFriendsScreen.tsx'),
  read('apps/mobile/src/screens/NativeTrainerSettingsScreen.tsx'),
  read('apps/mobile/src/screens/NativeAccountSecurityScreen.tsx'),
].join('\n');

const requiredTrainerInteractions = [
  ['interaction.profile.edit-result', 'profile_edit_result_painted'],
  ['interaction.profile.title-result', 'profile_title_result_painted'],
  ['interaction.profile.showcase-picker', 'profile_showcase_picker_painted'],
  ['interaction.profile.showcase-selection-result', 'profile_showcase_selection_result_painted'],
  ['interaction.profile.showcase-reorder-result', 'profile_showcase_reorder_result_painted'],
  ['interaction.profile.relationship-confirmation', 'profile_relationship_confirmation_painted'],
  ['interaction.profile.relationship-result', 'profile_relationship_result_painted'],
  ['interaction.profile.save-result', 'profile_save_result_painted'],
  ['interaction.friends.view-result', 'friends_view_result_painted'],
  ['interaction.friends.search-result', 'friends_search_result_painted'],
  ['interaction.friends.confirmation', 'friends_confirmation_painted'],
  ['interaction.friends.command-result', 'friends_command_result_painted'],
  ['interaction.settings.selection-result', 'settings_selection_result_painted'],
  ['interaction.settings.toggle-result', 'settings_toggle_result_painted'],
  ['interaction.settings.save-result', 'settings_save_result_painted'],
  ['interaction.account.confirmation', 'account_confirmation_painted'],
  ['interaction.account.update-result', 'account_update_result_painted'],
  ['interaction.account.provider-result', 'account_provider_result_painted'],
];

test('every bounded trainer-workspace interaction has Vite and physical-native performance evidence', () => {
  const interactions = new Map(contract.interactions.map((entry) => [entry.id, entry]));
  for (const [scenarioId, nativeEvent] of requiredTrainerInteractions) {
    assert.equal(interactions.get(scenarioId)?.nativeEvent, nativeEvent, `${scenarioId} contract mapping`);
    assert.match(
      browserCollector,
      new RegExp(`['"]${scenarioId.replaceAll('.', '\\.')}['"]`),
      `${scenarioId} Vite measurement`,
    );
    assert.match(
      androidReporter,
      new RegExp(`${nativeEvent}: ['"]${scenarioId.replaceAll('.', '\\.')}['"]`),
      `${scenarioId} Android report mapping`,
    );
    assert.ok(nativeTrainerSources.includes(nativeEvent), `${nativeEvent} native paint trace`);
  }
});

test('the native trainer-profile picker uses the canonical 180-instance workload', () => {
  assert.match(
    nativeProfileFixture,
    /PERFORMANCE_HIGHLIGHT_CANDIDATE_COUNT\s*=\s*180/,
  );
  assert.match(
    nativeProfileFixture,
    /PERFORMANCE_HIGHLIGHT_CANDIDATE_COUNT\s*-\s*CORE_HIGHLIGHT_CANDIDATES\.length/,
  );
});
