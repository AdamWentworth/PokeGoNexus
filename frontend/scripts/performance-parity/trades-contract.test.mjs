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
const viteTradesRoute = readFileSync(
  path.resolve(frontendDirectory, 'packages/app-core/src/pages/Trades/Trades.tsx'),
  'utf8',
);
const nativeTradesRoute = readFileSync(
  path.resolve(frontendDirectory, 'apps/mobile/src/app/native/trades.tsx'),
  'utf8',
);
const nativeTradeSources = [
  'apps/mobile/src/app/native/trades.tsx',
  'apps/mobile/src/screens/NativeTradePreferencesScreen.tsx',
  'apps/mobile/src/screens/NativeTradeActivityScreen.tsx',
].map((file) => readFileSync(path.resolve(frontendDirectory, file), 'utf8')).join('\n');

const requiredTradeInteractions = [
  ['interaction.trades.section-result', 'trade_section_result_painted'],
  ['interaction.trades.preference-mode-result', 'trade_preferences_mode_result_painted'],
  ['interaction.trades.preference-picker', 'trade_preferences_picker_painted'],
  ['interaction.trades.preference-selection-result', 'trade_preferences_selection_result_painted'],
  ['interaction.trades.preference-edit-result', 'trade_preferences_edit_result_painted'],
  ['interaction.trades.preference-rules-result', 'trade_preferences_rules_result_painted'],
  ['interaction.trades.preference-rule-result', 'trade_preferences_rule_result_painted'],
  ['interaction.trades.preference-candidate-result', 'trade_preferences_candidate_result_painted'],
  ['interaction.trades.preference-query-result', 'trade_preferences_query_result_painted'],
  ['interaction.trades.preference-save-result', 'trade_preferences_save_result_painted'],
  ['interaction.trades.preference-discard-dialog', 'trade_preferences_discard_dialog_painted'],
  ['interaction.trades.activity-status-result', 'trade_activity_status_result_painted'],
  ['interaction.trades.activity-details-result', 'trade_activity_details_result_painted'],
  ['interaction.trades.activity-partner-result', 'trade_activity_partner_result_painted'],
  ['interaction.trades.activity-confirmation', 'trade_activity_confirmation_painted'],
  ['interaction.trades.activity-action-result', 'trade_activity_action_result_painted'],
];

test('every bounded Trades interaction has Vite and physical-native performance evidence', () => {
  const interactions = new Map(contract.interactions.map((entry) => [entry.id, entry]));
  for (const [scenarioId, nativeEvent] of requiredTradeInteractions) {
    assert.equal(interactions.get(scenarioId)?.nativeEvent, nativeEvent, `${scenarioId} contract mapping`);
    assert.match(browserCollector, new RegExp(`['"]${scenarioId.replaceAll('.', '\\.')}['"]`), `${scenarioId} Vite measurement`);
    assert.match(androidReporter, new RegExp(`${nativeEvent}: ['"]${scenarioId.replaceAll('.', '\\.')}['"]`), `${scenarioId} Android report mapping`);
    assert.ok(nativeTradeSources.includes(nativeEvent), `${nativeEvent} native paint trace`);
  }
  assert.match(
    androidReporter,
    /trade_preferences_candidate_result_painted:\s*'first'/,
    'candidate timing selects the same one toggle per repetition as Vite',
  );
  assert.match(
    androidReporter,
    /trade_preferences_edit_result_painted:\s*'first'/,
    'edit timing selects the same first edit transition per repetition as Vite',
  );
  assert.match(
    androidReporter,
    /trade_activity_status_result_painted:\s*'first'/,
    'status timing selects the same one status change per repetition as Vite',
  );
});

test('Trades keeps its product header outside the sliding Preferences and Activity body', () => {
  assert.ok(
    viteTradesRoute.indexOf('<ProductPageHeader') < viteTradesRoute.indexOf('<HorizontalPageSlider'),
    'Vite reference keeps its header outside the page slider',
  );
  assert.equal(
    nativeTradesRoute.match(/<NativeTradeHubHeader\b/g)?.length,
    1,
    'Native renders one shared trade header',
  );
  assert.ok(
    nativeTradesRoute.indexOf('\n      <NativeTradeHubHeader')
      < nativeTradesRoute.indexOf('\n      <NativeHorizontalPageSlider'),
    'Native keeps its shared header before the moving track',
  );
  assert.doesNotMatch(
    nativeTradesRoute,
    /pageHeader=\{/,
    'Neither sliding panel owns another copy of the product header',
  );
});
