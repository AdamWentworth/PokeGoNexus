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
const nativePvpSources = [
  'apps/mobile/src/screens/NativePvpScreen.tsx',
  'apps/mobile/src/components/tools/NativePvpTeamBuilder.tsx',
  'apps/mobile/src/components/tools/NativePvpBattleLab.tsx',
  'apps/mobile/src/components/tools/NativePvpTeamBattle.tsx',
  'apps/mobile/src/components/tools/NativePvpIvRank.tsx',
].map((file) => readFileSync(path.resolve(frontendDirectory, file), 'utf8')).join('\n');

const requiredPvpInteractions = [
  ['interaction.pvp.workspace-result', 'pvp_workspace_result_painted'],
  ['interaction.pvp.league-result', 'pvp_league_result_painted'],
  ['interaction.pvp.cup-result', 'pvp_cup_result_painted'],
  ['interaction.pvp.rules-result', 'pvp_rules_result_painted'],
  ['interaction.pvp.scope-result', 'pvp_scope_result_painted'],
  ['interaction.pvp.role-result', 'pvp_role_result_painted'],
  ['interaction.pvp.search-result', 'pvp_search_result_painted'],
  ['interaction.pvp.ranking-detail', 'pvp_ranking_detail_painted'],
  ['interaction.pvp.more-result', 'pvp_more_result_painted'],
  ['interaction.pvp.team.selection-result', 'pvp_team_selection_result_painted'],
  ['interaction.pvp.team.search-result', 'pvp_team_search_result_painted'],
  ['interaction.pvp.team.evaluation-result', 'pvp_team_evaluation_result_painted'],
  ['interaction.pvp.team.evidence-result', 'pvp_team_evidence_result_painted'],
  ['interaction.pvp.battle.mode-result', 'pvp_battle_mode_result_painted'],
  ['interaction.pvp.battle.selection-result', 'pvp_battle_selection_result_painted'],
  ['interaction.pvp.battle.search-result', 'pvp_battle_picker_search_result_painted'],
  ['interaction.pvp.battle.condition-result', 'pvp_battle_condition_result_painted'],
  ['interaction.pvp.battle.simulation-result', 'pvp_battle_result_painted'],
  ['interaction.pvp.team-battle.selection-result', 'pvp_team_battle_selection_result_painted'],
  ['interaction.pvp.team-battle.policy-result', 'pvp_team_battle_policy_result_painted'],
  ['interaction.pvp.team-battle.condition-result', 'pvp_team_battle_condition_result_painted'],
  ['interaction.pvp.team-battle.search-result', 'pvp_team_battle_search_result_painted'],
  ['interaction.pvp.team-battle.simulation-result', 'pvp_team_battle_result_painted'],
  ['interaction.pvp.team-battle.field-result', 'pvp_team_field_result_painted'],
  ['interaction.pvp.iv.scope-result', 'pvp_iv_scope_result_painted'],
  ['interaction.pvp.iv.search-result', 'pvp_iv_search_result_painted'],
  ['interaction.pvp.iv.selection-result', 'pvp_iv_selection_result_painted'],
  ['interaction.pvp.iv.adjust-result', 'pvp_iv_adjust_result_painted'],
  ['interaction.pvp.iv.level-result', 'pvp_iv_level_result_painted'],
];

test('every bounded PvP interaction has Vite and physical-native performance evidence', () => {
  const interactions = new Map(contract.interactions.map((entry) => [entry.id, entry]));
  for (const [scenarioId, nativeEvent] of requiredPvpInteractions) {
    assert.equal(interactions.get(scenarioId)?.nativeEvent, nativeEvent, `${scenarioId} contract mapping`);
    assert.match(browserCollector, new RegExp(`['"]${scenarioId.replaceAll('.', '\\.')}['"]`), `${scenarioId} Vite measurement`);
    assert.match(androidReporter, new RegExp(`${nativeEvent}: ['"]${scenarioId.replaceAll('.', '\\.')}['"]`), `${scenarioId} Android report mapping`);
    assert.ok(nativePvpSources.includes(nativeEvent), `${nativeEvent} native paint trace`);
  }
});
