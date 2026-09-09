#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const valueArgs = new Map();
const listArgs = new Map();
for (let index = 0; index < args.length; index += 1) {
  const name = args[index];
  if (!name.startsWith('--')) throw new Error(`Unexpected argument: ${name}`);
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`);
  index += 1;
  if (['--logcat', '--gfxinfo', '--frame-timeline', '--meminfo'].includes(name)) {
    listArgs.set(name, [...(listArgs.get(name) ?? []), value]);
  } else {
    valueArgs.set(name, value);
  }
}

const output = valueArgs.get('--output');
const profile = valueArgs.get('--profile') ?? 'android-diagnostic';
const runtime = valueArgs.get('--runtime') ?? null;
const refreshHz = Number(valueArgs.get('--refresh-hz') ?? 60);
const frameBudgetMs = Number.isFinite(refreshHz) && refreshHz > 0 ? 1_000 / refreshHz : 16.67;
if (!output) {
  console.error('Usage: build-android-performance-report.mjs --output report.json [--profile physical-android] [--logcat file] [--frame-timeline file] [--gfxinfo file] [--meminfo file]');
  process.exit(2);
}
if (profile === 'physical-android' && (
  valueArgs.get('--device-kind') !== 'physical' || runtime !== 'standalone'
)) {
  console.error('physical-android evidence requires a physical device and a standalone release APK.');
  process.exit(2);
}

const eventScenarios = {
  action_menu_surface_painted: 'interaction.action-menu.open',
  theme_visible_palette_committed: 'interaction.theme.toggle',
  home_hint_dismiss_result_painted: 'interaction.home.hint-dismiss',
  home_guest_explore_result_painted: 'interaction.home.guest-explore',
  home_onboarding_dismiss_result_painted: 'interaction.home.onboarding-dismiss',
  auth_login_password_visibility_painted: 'interaction.auth.login.password-visibility',
  auth_recovery_open_painted: 'interaction.auth.recovery.open',
  auth_recovery_request_result_painted: 'interaction.auth.recovery.request-result',
  auth_registration_method_painted: 'interaction.auth.registration.method-result',
  auth_registration_step_painted: 'interaction.auth.registration.step-result',
  auth_registration_same_name_painted: 'interaction.auth.registration.same-name-result',
  auth_password_reset_result_painted: 'interaction.auth.password-reset.result',
  information_faq_category_result_painted: 'interaction.information.faq.category-result',
  information_faq_answer_result_painted: 'interaction.information.faq.answer-result',
  information_faq_search_result_painted: 'interaction.information.faq.search-result',
  information_faq_clear_result_painted: 'interaction.information.faq.clear-result',
  profile_edit_result_painted: 'interaction.profile.edit-result',
  profile_title_result_painted: 'interaction.profile.title-result',
  profile_showcase_picker_painted: 'interaction.profile.showcase-picker',
  profile_showcase_selection_result_painted: 'interaction.profile.showcase-selection-result',
  profile_showcase_reorder_result_painted: 'interaction.profile.showcase-reorder-result',
  profile_relationship_confirmation_painted: 'interaction.profile.relationship-confirmation',
  profile_relationship_result_painted: 'interaction.profile.relationship-result',
  profile_save_result_painted: 'interaction.profile.save-result',
  trade_board_section_result_painted: 'interaction.trade-board.section-result',
  trade_board_theme_result_painted: 'interaction.trade-board.theme-result',
  trade_board_identity_result_painted: 'interaction.trade-board.identity-result',
  trade_board_copy_result_painted: 'interaction.trade-board.copy-result',
  friends_view_result_painted: 'interaction.friends.view-result',
  friends_search_result_painted: 'interaction.friends.search-result',
  friends_confirmation_painted: 'interaction.friends.confirmation',
  friends_command_result_painted: 'interaction.friends.command-result',
  settings_selection_result_painted: 'interaction.settings.selection-result',
  settings_toggle_result_painted: 'interaction.settings.toggle-result',
  settings_save_result_painted: 'interaction.settings.save-result',
  account_confirmation_painted: 'interaction.account.confirmation',
  account_update_result_painted: 'interaction.account.update-result',
  account_provider_result_painted: 'interaction.account.provider-result',
  collection_search_menu_painted: 'interaction.collection.search-open',
  collection_sort_menu_painted: 'interaction.collection.sort-open',
  collection_filter_result_revealed: 'interaction.collection.filter',
  collection_tag_touch_to_slide_started: 'interaction.collection.tag-slide',
  collection_tag_result_painted: 'interaction.collection.tag-result',
  collection_query_result_painted: 'interaction.collection.query-result',
  collection_typed_query_result_painted: 'interaction.collection.typed-query',
  collection_sort_result_painted: 'interaction.collection.sort-result',
  collection_evolution_result_painted: 'interaction.collection.evolution-result',
  collection_clear_tag_dialog_painted: 'interaction.collection.clear-tag-dialog',
  collection_selection_painted: 'interaction.collection.selection',
  collection_organizer_painted: 'interaction.collection.organizer',
  instance_overlay_target_committed: 'interaction.instance.navigate',
  instance_edit_result_painted: 'interaction.instance.edit-result',
  instance_save_result_painted: 'interaction.instance.save-result',
  trade_section_result_painted: 'interaction.trades.section-result',
  trade_preferences_mode_result_painted: 'interaction.trades.preference-mode-result',
  trade_preferences_picker_painted: 'interaction.trades.preference-picker',
  trade_preferences_selection_result_painted: 'interaction.trades.preference-selection-result',
  trade_preferences_edit_result_painted: 'interaction.trades.preference-edit-result',
  trade_preferences_rules_result_painted: 'interaction.trades.preference-rules-result',
  trade_preferences_rule_result_painted: 'interaction.trades.preference-rule-result',
  trade_preferences_candidate_result_painted: 'interaction.trades.preference-candidate-result',
  trade_preferences_query_result_painted: 'interaction.trades.preference-query-result',
  trade_preferences_save_result_painted: 'interaction.trades.preference-save-result',
  trade_preferences_discard_dialog_painted: 'interaction.trades.preference-discard-dialog',
  trade_activity_status_result_painted: 'interaction.trades.activity-status-result',
  trade_activity_details_result_painted: 'interaction.trades.activity-details-result',
  trade_activity_partner_result_painted: 'interaction.trades.activity-partner-result',
  trade_activity_confirmation_painted: 'interaction.trades.activity-confirmation',
  trade_activity_action_result_painted: 'interaction.trades.activity-action-result',
  search_mode_result_painted: 'interaction.search.mode-result',
  search_display_result_painted: 'interaction.search.display-result',
  search_modify_result_painted: 'interaction.search.modify-result',
  search_pokemon_picker_painted: 'interaction.search.pokemon-picker',
  search_pokemon_selection_painted: 'interaction.search.pokemon-selection',
  search_ownership_result_painted: 'interaction.search.ownership-result',
  search_filters_painted: 'interaction.search.filters-open',
  search_filter_section_painted: 'interaction.search.filter-section',
  search_filter_result_painted: 'interaction.search.filter-result',
  search_results_painted: 'interaction.search.results',
  search_details_result_painted: 'interaction.search.details-result',
  search_map_selection_result_painted: 'interaction.search.map-selection',
  search_trainer_query_result_painted: 'interaction.search.trainer-query-result',
  search_trainer_clear_result_painted: 'interaction.search.trainer-clear-result',
  pokedex_advanced_result_painted: 'interaction.pokedex.advanced-result',
  pokedex_category_result_painted: 'interaction.pokedex.category-result',
  pokedex_facet_result_painted: 'interaction.pokedex.facet-result',
  pokedex_region_index_painted: 'interaction.pokedex.region-index',
  pokedex_search_result_painted: 'interaction.pokedex.search-result',
  pokedex_region_section_painted: 'interaction.pokedex.region-section',
  pokedex_bulk_dialog_painted: 'interaction.pokedex.bulk-dialog',
  pokedex_registration_result_painted: 'interaction.pokedex.registration-result',
  pokedex_detail_painted: 'interaction.pokedex.detail-open',
  pokedex_detail_slot_result_painted: 'interaction.pokedex.detail.slot-result',
  pokedex_detail_gender_result_painted: 'interaction.pokedex.detail.gender-result',
  pokedex_detail_tab_result_painted: 'interaction.pokedex.detail.tab-result',
  pokedex_detail_combo_section_painted: 'interaction.pokedex.detail.combo-section',
  pokedex_detail_combo_filter_result_painted: 'interaction.pokedex.detail.combo-filter',
  pokedex_detail_combo_query_result_painted: 'interaction.pokedex.detail.combo-query',
  pokedex_detail_bulk_dialog_painted: 'interaction.pokedex.detail.bulk-dialog',
  pokedex_detail_registration_result_painted: 'interaction.pokedex.detail.registration-result',
  raid_boss_mode_painted: 'interaction.raid.mode-boss',
  raid_roster_result_painted: 'interaction.raid.roster-result',
  raid_type_result_painted: 'interaction.raid.type-result',
  raid_search_result_painted: 'interaction.raid.search-result',
  raid_moveset_result_painted: 'interaction.raid.moveset-result',
  raid_settings_painted: 'interaction.raid.settings-open',
  raid_modifier_result_painted: 'interaction.raid.modifier-result',
  raid_sort_result_painted: 'interaction.raid.sort-result',
  raid_row_detail_painted: 'interaction.raid.row-detail',
  raid_boss_search_result_painted: 'interaction.raid.boss-search',
  raid_boss_selected_result_painted: 'interaction.raid.boss-selected',
  raid_setup_painted: 'interaction.raid.setup-open',
  raid_party_painted: 'interaction.raid.party-open',
  raid_party_result_painted: 'interaction.raid.party-simulate',
  raid_party_optimization_painted: 'interaction.raid.party-optimize',
  raid_calibration_dialog_painted: 'interaction.raid.calibration-open',
  raid_battle_settings_painted: 'interaction.raid.battle-settings-open',
  max_view_result_painted: 'interaction.max.view-result',
  max_scope_result_painted: 'interaction.max.scope-result',
  max_role_result_painted: 'interaction.max.role-result',
  max_type_result_painted: 'interaction.max.type-result',
  max_query_result_painted: 'interaction.max.query-result',
  max_more_result_painted: 'interaction.max.more-result',
  max_method_result_painted: 'interaction.max.method-result',
  max_boss_query_result_painted: 'interaction.max.boss-query-result',
  max_boss_result_painted: 'interaction.max.boss-result',
  max_trainer_result_painted: 'interaction.max.trainer-result',
  max_party_result_painted: 'interaction.max.party-result',
  max_advanced_result_painted: 'interaction.max.advanced-result',
  max_execution_result_painted: 'interaction.max.execution-result',
  max_difficulty_result_painted: 'interaction.max.difficulty-result',
  max_hp_result_painted: 'interaction.max.hp-result',
  max_reset_result_painted: 'interaction.max.reset-result',
  rankings_mode_result_painted: 'interaction.rankings.mode-result',
  rankings_category_result_painted: 'interaction.rankings.category-result',
  rankings_collection_result_painted: 'interaction.rankings.collection-result',
  rankings_query_result_painted: 'interaction.rankings.query-result',
  rankings_clear_result_painted: 'interaction.rankings.clear-result',
  rankings_more_result_painted: 'interaction.rankings.more-result',
  rankings_method_result_painted: 'interaction.rankings.method-result',
  rankings_quick_controls_painted: 'interaction.rankings.quick-controls',
  pvp_workspace_result_painted: 'interaction.pvp.workspace-result',
  pvp_league_result_painted: 'interaction.pvp.league-result',
  pvp_cup_result_painted: 'interaction.pvp.cup-result',
  pvp_rules_result_painted: 'interaction.pvp.rules-result',
  pvp_scope_result_painted: 'interaction.pvp.scope-result',
  pvp_role_result_painted: 'interaction.pvp.role-result',
  pvp_search_result_painted: 'interaction.pvp.search-result',
  pvp_ranking_detail_painted: 'interaction.pvp.ranking-detail',
  pvp_more_result_painted: 'interaction.pvp.more-result',
  pvp_team_selection_result_painted: 'interaction.pvp.team.selection-result',
  pvp_team_search_result_painted: 'interaction.pvp.team.search-result',
  pvp_team_evaluation_result_painted: 'interaction.pvp.team.evaluation-result',
  pvp_team_evidence_result_painted: 'interaction.pvp.team.evidence-result',
  pvp_battle_mode_result_painted: 'interaction.pvp.battle.mode-result',
  pvp_battle_selection_result_painted: 'interaction.pvp.battle.selection-result',
  pvp_battle_picker_search_result_painted: 'interaction.pvp.battle.search-result',
  pvp_battle_condition_result_painted: 'interaction.pvp.battle.condition-result',
  pvp_battle_result_painted: 'interaction.pvp.battle.simulation-result',
  pvp_team_battle_selection_result_painted: 'interaction.pvp.team-battle.selection-result',
  pvp_team_battle_policy_result_painted: 'interaction.pvp.team-battle.policy-result',
  pvp_team_battle_condition_result_painted: 'interaction.pvp.team-battle.condition-result',
  pvp_team_battle_search_result_painted: 'interaction.pvp.team-battle.search-result',
  pvp_team_battle_result_painted: 'interaction.pvp.team-battle.simulation-result',
  pvp_team_field_result_painted: 'interaction.pvp.team-battle.field-result',
  pvp_iv_scope_result_painted: 'interaction.pvp.iv.scope-result',
  pvp_iv_search_result_painted: 'interaction.pvp.iv.search-result',
  pvp_iv_selection_result_painted: 'interaction.pvp.iv.selection-result',
  pvp_iv_adjust_result_painted: 'interaction.pvp.iv.adjust-result',
  pvp_iv_level_result_painted: 'interaction.pvp.iv.level-result',
};
const eventSampleSelection = {
  collection_search_menu_painted: 'first',
  information_faq_search_result_painted: 'last',
  collection_typed_query_result_painted: 'last',
  pokedex_search_result_painted: 'last',
  pokedex_detail_combo_query_result_painted: 'last',
  raid_search_result_painted: 'last',
  raid_boss_search_result_painted: 'last',
  max_query_result_painted: 'last',
  max_boss_query_result_painted: 'last',
  max_hp_result_painted: 'last',
  max_type_result_painted: 'first',
  rankings_mode_result_painted: 'first',
  rankings_query_result_painted: 'last',
  pvp_search_result_painted: 'last',
  pvp_role_result_painted: 'first',
  pvp_team_search_result_painted: 'last',
  pvp_battle_picker_search_result_painted: 'last',
  pvp_team_battle_search_result_painted: 'last',
  pvp_iv_search_result_painted: 'last',
  search_trainer_query_result_painted: 'last',
  trade_preferences_query_result_painted: 'last',
  trade_preferences_edit_result_painted: 'first',
  trade_preferences_candidate_result_painted: 'first',
  trade_activity_status_result_painted: 'first',
};

const samples = [];
const indexes = new Map();
const addSample = (scenarioId, metric, value, unit = 'ms') => {
  if (!Number.isFinite(value) || value < 0) return;
  const key = `${scenarioId}\u0000${metric}`;
  const sampleIndex = indexes.get(key) ?? 0;
  indexes.set(key, sampleIndex + 1);
  samples.push({ scenarioId, metric, unit, direction: 'lower', value, sampleIndex });
};

const readInteractionLatencies = (text, event) => {
  const eventPattern = new RegExp(`\\[mobile:ui-perf\\] ${event}(?![a-zA-Z0-9_])`, 'g');
  return [...text.matchAll(eventPattern)].flatMap((match) => {
    const block = text.slice(match.index, match.index + 1_500).split('\n').slice(0, 8).join('\n');
    const latency = block.match(/interactionLatencyMs:\s*(\d+(?:\.\d+)?)/);
    return latency ? [Number(latency[1])] : [];
  });
};

for (const logPath of listArgs.get('--logcat') ?? []) {
  const text = readFileSync(resolve(logPath), 'utf8');
  for (const [event, scenarioId] of Object.entries(eventScenarios)) {
    const latencies = readInteractionLatencies(text, event);
    const selection = eventSampleSelection[event];
    const selectedLatencies = selection === 'first'
      ? latencies.slice(0, 1)
      : selection === 'last'
        ? latencies.slice(-1)
        : latencies;
    for (const latency of selectedLatencies) {
      addSample(scenarioId, 'interaction_ready_ms', latency);
    }
  }
  for (const latency of readInteractionLatencies(text, 'global_touch_next_frame')) {
    addSample('global.runtime', 'touch_to_next_frame_ms', latency);
  }
}

const parseFrameStats = (text) => {
  const lines = text.split(/\r?\n/);
  const frames = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith('Flags,')) continue;
    const headers = lines[index].split(',');
    const intendedIndex = headers.indexOf('IntendedVsync');
    const completedIndex = headers.indexOf('FrameCompleted');
    const workloadTargetIndex = headers.indexOf('WorkloadTarget');
    if (intendedIndex < 0 || completedIndex < 0) continue;
    for (const row of lines.slice(index + 1)) {
      if (row === '---PROFILEDATA---') break;
      if (!/^\d+,/.test(row)) continue;
      const values = row.split(',').map(Number);
      if (values[0] !== 0) continue;
      const durationMs = (values[completedIndex] - values[intendedIndex]) / 1_000_000;
      const workloadTarget = workloadTargetIndex >= 0 ? values[workloadTargetIndex] : NaN;
      if (Number.isFinite(durationMs) && durationMs >= 0 && durationMs < 10_000) {
        frames.push({
          budgetMs: Number.isFinite(workloadTarget) && workloadTarget > 0
            ? workloadTarget / 1_000_000
            : null,
          durationMs,
        });
      }
    }
  }
  return frames;
};

const percentile = (values, fraction) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
};

const frameTimelinePaths = listArgs.get('--frame-timeline') ?? [];
for (const frameTimelinePath of frameTimelinePaths) {
  const timeline = JSON.parse(readFileSync(resolve(frameTimelinePath), 'utf8'));
  if (timeline.frameTimePercentile !== 95) {
    throw new Error(`FrameTimeline report lacks verified p95 semantics: ${frameTimelinePath}. Reprocess its trace with the corrected query.`);
  }
  addSample('global.runtime', 'frame_time_p95_ms', Number(timeline.frameTimeP95Ms));
  addSample(
    'global.runtime',
    'janky_frames_percent',
    Number(timeline.jankyFramesPercent),
    'percent',
  );
}

// Preserve gfxinfo as a compatibility fallback for older diagnostic runs.
// Authoritative physical runs provide SurfaceFlinger FrameTimeline evidence,
// which observes the real content surface in both Chrome and React Native.
if (!frameTimelinePaths.length) {
  for (const gfxPath of listArgs.get('--gfxinfo') ?? []) {
    const frames = parseFrameStats(readFileSync(resolve(gfxPath), 'utf8'));
    if (!frames.length) continue;
    const p95 = percentile(frames.map((frame) => frame.durationMs), 0.95);
    const jankyPercent = frames.filter(
      (frame) => frame.durationMs > (frame.budgetMs ?? frameBudgetMs),
    ).length / frames.length * 100;
    addSample('global.runtime', 'frame_time_p95_ms', p95);
    addSample('global.runtime', 'janky_frames_percent', jankyPercent, 'percent');
  }
}

const parseTotalPssBytes = (text) => {
  const explicit = text.match(/TOTAL PSS:\s*([\d,]+)\s*(?:KB|kB)?/i);
  if (explicit) return Number(explicit[1].replaceAll(',', '')) * 1024;
  const totalRow = text.match(/^\s*TOTAL\s+([\d,]+)/m);
  return totalRow ? Number(totalRow[1].replaceAll(',', '')) * 1024 : null;
};

for (const memoryPath of listArgs.get('--meminfo') ?? []) {
  const bytes = parseTotalPssBytes(readFileSync(resolve(memoryPath), 'utf8'));
  if (bytes != null) addSample('global.runtime', 'memory_pss_bytes', bytes, 'bytes');
}

let commit = null;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: resolve(dirname(new URL(import.meta.url).pathname), '../../../..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  // Reports remain valid outside a Git checkout.
}

const report = {
  schemaVersion: 1,
  implementation: 'native-android',
  profile,
  createdAt: new Date().toISOString(),
  commit,
  environment: {
    deviceId: valueArgs.get('--device-id') ?? null,
    deviceIdentity: valueArgs.get('--device-id') ?? null,
    deviceKind: valueArgs.get('--device-kind') ?? null,
    runtime,
    repetitions: Number(valueArgs.get('--repetitions')) || null,
    source: frameTimelinePaths.length
      ? 'adb-logcat-surfaceflinger-frametimeline-meminfo'
      : 'adb-logcat-gfxinfo-meminfo',
    refreshHz,
    workloadId: valueArgs.get('--workload-id') ?? null,
    frameWorkloadId: valueArgs.get('--frame-workload-id') ?? null,
    catalogEntries: Number(valueArgs.get('--catalog-entries')) || null,
    instanceEntries: Number(valueArgs.get('--instance-entries')) || null,
    pvpEntries: Number(valueArgs.get('--pvp-entries')) || null,
  },
  samples,
};
mkdirSync(dirname(resolve(output)), { recursive: true });
writeFileSync(resolve(output), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`Android performance report: ${resolve(output)} (${samples.length} samples)\n`);
