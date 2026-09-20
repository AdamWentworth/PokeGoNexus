import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { FlatList, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type {
  MaxRankingEntry,
  MaxRole,
  MaxRoleCandidates,
} from '@pokemongonexus/app-core/max-battle-model';
import {
  getDefaultMaxBattleTier,
  getMaxBattleBossPreset,
  getMaxBattleTierOptions,
  MAX_BATTLE_EXECUTION_PRESETS,
  simulateMaxBattle,
  type MaxBattleExecution,
  type MaxBattleSimulationOutcome,
  type MaxBattleSimulationTeam,
  type MaxBattleTier,
} from '@pokemongonexus/app-core/max-battle-simulation';
import type { PokemonVariant } from '@pokemongonexus/shared-contracts/variants';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../../observability/nativeUiInteractionTiming';

type Props = {
  assetBaseUrl: string;
  boss: PokemonVariant;
  candidates: MaxRoleCandidates;
  initialDifficulty?: MaxBattleTier | null;
  initialTrainerCount?: number | null;
  onDifficultyChange?: (difficulty: MaxBattleTier) => void;
  onTrainerCountChange?: (trainerCount: number | null) => void;
  rosterScope: 'catalog' | 'owned';
};

type TeamSelection = Record<MaxRole, string>;

const ROLES: MaxRole[] = ['damage', 'tank', 'healing'];
const ROLE_LABELS: Record<MaxRole, string> = {
  damage: 'Damage',
  tank: 'Tank',
  healing: 'Healing',
};
const ROLE_ICONS: Record<MaxRole, string> = {
  damage: 'ϟ',
  tank: '◆',
  healing: '♥',
};
const OUTCOME_COPY: Record<MaxBattleSimulationOutcome, { detail: string; label: string }> = {
  'likely-clear': {
    detail: 'Useful time and survival reserve remain in this model.',
    label: 'Likely clear',
  },
  'close-call': {
    detail: 'Small execution, moveset, or teammate differences could decide it.',
    label: 'Close call',
  },
  unlikely: {
    detail: 'The group runs out of damage or endurance before the limit.',
    label: 'More help needed',
  },
};

const absoluteUri = (base: string, value?: string | null) => {
  if (!value) return undefined;
  try { return new URL(value, base).toString(); } catch { return undefined; }
};

const entryKey = (entry: MaxRankingEntry): string =>
  `${entry.variant.variant_id}::${entry.fastMove.move_id}::${entry.maxMoveType}`;

const recommendedSelection = (candidates: MaxRoleCandidates): TeamSelection => {
  const usedVariants = new Set<string>();
  const selection: TeamSelection = { damage: '', tank: '', healing: '' };
  ROLES.forEach((role) => {
    const entry = candidates[role].find(
      (candidate) => !usedVariants.has(candidate.variant.variant_id),
    ) ?? candidates[role][0];
    if (!entry) return;
    selection[role] = entryKey(entry);
    usedVariants.add(entry.variant.variant_id);
  });
  return selection;
};

const resolveTeam = (
  candidates: MaxRoleCandidates,
  selection: TeamSelection,
): MaxBattleSimulationTeam | null => {
  const damage = candidates.damage.find((entry) => entryKey(entry) === selection.damage)
    ?? candidates.damage[0];
  const tank = candidates.tank.find((entry) => entryKey(entry) === selection.tank)
    ?? candidates.tank[0];
  const healing = candidates.healing.find((entry) => entryKey(entry) === selection.healing)
    ?? candidates.healing[0];
  return damage && tank && healing ? { damage, tank, healing } : null;
};

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds)) return '—';
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
};

const formatNumber = (value: number): string => Math.round(value).toLocaleString();

export const NativeMaxBattleSimulator = ({
  assetBaseUrl,
  boss,
  candidates,
  initialDifficulty = null,
  initialTrainerCount = null,
  onDifficultyChange,
  onTrainerCountChange,
  rosterScope,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const difficultyOptions = useMemo(() => getMaxBattleTierOptions(boss), [boss]);
  const defaultDifficulty = useMemo(() => (
    initialDifficulty && difficultyOptions.includes(initialDifficulty)
      ? initialDifficulty
      : getDefaultMaxBattleTier(boss)
  ), [boss, difficultyOptions, initialDifficulty]);
  const [difficulty, setDifficulty] = useState<MaxBattleTier>(defaultDifficulty);
  const preset = useMemo(
    () => getMaxBattleBossPreset(boss, difficulty),
    [boss, difficulty],
  );
  const defaults = useMemo(() => recommendedSelection(candidates), [candidates]);
  const [selection, setSelection] = useState<TeamSelection>(defaults);
  const [trainerCount, setTrainerCount] = useState(() => {
    const initialPreset = getMaxBattleBossPreset(boss, defaultDifficulty);
    return initialTrainerCount == null
      ? initialPreset.defaultTrainers
      : Math.min(initialPreset.maxTrainers, Math.max(1, Math.round(initialTrainerCount)));
  });
  const [execution, setExecution] = useState<MaxBattleExecution>('standard');
  const [advanced, setAdvanced] = useState(false);
  const [advancedDetailsReady, setAdvancedDetailsReady] = useState(false);
  const [bossHp, setBossHp] = useState(() => getMaxBattleBossPreset(boss, defaultDifficulty).bossHp);
  const [pickerRole, setPickerRole] = useState<MaxRole | null>(null);
  const [partyReady, setPartyReady] = useState(process.env.NODE_ENV === 'test');
  const advancedDetailsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const performanceStartsRef = useRef(new Map<string, number>());
  const beginPerformance = useCallback((event: string) => {
    performanceStartsRef.current.set(event, Date.now());
  }, []);
  const finishPerformance = useCallback((event: string) => {
    const startedAt = performanceStartsRef.current.get(event);
    if (startedAt == null) return;
    performanceStartsRef.current.delete(event);
    markNativeUiPerformanceAfterPaint(event, startedAt);
  }, []);

  const team = useMemo(
    () => resolveTeam(candidates, selection),
    [candidates, selection],
  );
  const deferredDifficulty = useDeferredValue(difficulty);
  const deferredBossHp = useDeferredValue(bossHp);
  const deferredTeam = useDeferredValue(team);
  const deferredTrainerCount = useDeferredValue(trainerCount);
  const scenarios = useMemo(() => deferredTeam ? {
    standard: simulateMaxBattle({
      boss,
      bossHp: deferredBossHp,
      execution: 'standard',
      trainerCount: deferredTrainerCount,
      team: deferredTeam,
      tier: deferredDifficulty,
    }),
    'stress-test': simulateMaxBattle({
      boss,
      bossHp: deferredBossHp,
      execution: 'stress-test',
      trainerCount: deferredTrainerCount,
      team: deferredTeam,
      tier: deferredDifficulty,
    }),
  } : null, [boss, deferredBossHp, deferredDifficulty, deferredTeam, deferredTrainerCount]);
  const result = scenarios?.[execution] ?? null;

  useEffect(() => {
    finishPerformance('max_trainer_result_painted');
    finishPerformance('max_execution_result_painted');
    finishPerformance('max_difficulty_result_painted');
    finishPerformance('max_party_result_painted');
    finishPerformance('max_hp_result_painted');
    finishPerformance('max_reset_result_painted');
  }, [bossHp, difficulty, execution, finishPerformance, result, selection, trainerCount]);
  useEffect(() => finishPerformance('max_advanced_result_painted'), [advanced, finishPerformance]);
  useEffect(() => finishPerformance('max_party_picker_painted'), [finishPerformance, pickerRole]);
  useEffect(() => {
    if (partyReady) return undefined;
    const timer = setTimeout(() => setPartyReady(true), 350);
    return () => clearTimeout(timer);
  }, [partyReady]);
  useEffect(() => () => {
    if (advancedDetailsTimerRef.current) clearTimeout(advancedDetailsTimerRef.current);
  }, []);

  const selectCandidate = (role: MaxRole, key: string) => {
    beginPerformance('max_party_result_painted');
    setSelection((current) => ({ ...current, [role]: key }));
    setPickerRole(null);
  };

  const setBoundedTrainers = (value: number) => {
    const next = Math.min(preset.maxTrainers, Math.max(1, Math.round(value)));
    beginPerformance('max_trainer_result_painted');
    setTrainerCount(next);
    onTrainerCountChange?.(next === preset.defaultTrainers ? null : next);
  };
  const changeDifficulty = (tier: MaxBattleTier) => {
    if (tier === difficulty) return;
    const option = getMaxBattleBossPreset(boss, tier);
    beginPerformance('max_difficulty_result_painted');
    setDifficulty(tier);
    setBossHp(option.bossHp);
    setTrainerCount(option.defaultTrainers);
    onDifficultyChange?.(tier);
    onTrainerCountChange?.(null);
  };
  const changeExecution = (next: MaxBattleExecution) => {
    if (next === execution) return;
    beginPerformance('max_execution_result_painted');
    setExecution(next);
  };
  const changeBossHp = (value: string) => {
    beginPerformance('max_hp_result_painted');
    setBossHp(Math.max(1, Number(value.replace(/[^0-9]/g, '')) || 1));
  };
  const resetRecommendations = () => {
    beginPerformance('max_reset_result_painted');
    setSelection(defaults);
    setBossHp(preset.bossHp);
    setExecution('standard');
  };
  const toggleAdvanced = () => {
    beginPerformance('max_advanced_result_painted');
    const next = !advanced;
    setAdvanced(next);
    if (advancedDetailsTimerRef.current) clearTimeout(advancedDetailsTimerRef.current);
    if (!next) {
      setAdvancedDetailsReady(false);
      advancedDetailsTimerRef.current = null;
      return;
    }
    advancedDetailsTimerRef.current = setTimeout(() => {
      advancedDetailsTimerRef.current = null;
      setAdvancedDetailsReady(true);
    }, 120);
  };

  return (
    <View accessibilityLabel="Max Battle simulator" style={[styles.root, light && styles.rootLight]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>RECOMMENDED PARTY</Text>
          <Text style={[styles.title, light && styles.textLight]}>Can this group beat {boss.name}?</Text>
        </View>
        <View style={styles.profile}>
          <Text style={[styles.profileLabel, light && styles.textLight]}>{preset.label}</Text>
          <Text style={styles.confidence}>{preset.confidence} profile</Text>
        </View>
      </View>

      {team && result ? (
        <>
          <View style={[styles.decision, styles[`decision_${result.outcome}`]]}>
            <View style={styles.decisionCopy}>
              <Text style={styles.decisionLabel}>{OUTCOME_COPY[result.outcome].label}</Text>
              <Text style={styles.decisionMetric}>
                {Math.round(result.damagePercent * 100)}% modeled damage · {formatDuration(result.estimatedClearSeconds)} clear
              </Text>
              <Text style={styles.decisionDetail}>{OUTCOME_COPY[result.outcome].detail}</Text>
            </View>
            <View style={[styles.trainerControl, light && styles.controlLight]}>
              <Text style={[styles.trainerLabel, light && styles.mutedLight]}>TRAINERS</Text>
              <View style={styles.trainerButtons}>
                <Pressable
                  accessibilityLabel="Remove one Trainer"
                  accessibilityRole="button"
                  disabled={trainerCount <= 1}
                  onPress={() => setBoundedTrainers(trainerCount - 1)}
                  style={styles.trainerButton}
                >
                  <Text style={styles.trainerButtonText}>−</Text>
                </Pressable>
                <Text accessibilityLabel={`${trainerCount} Trainers`} style={[styles.trainerCount, light && styles.textLight]}>{trainerCount}</Text>
                <Pressable
                  accessibilityLabel="Add one Trainer"
                  accessibilityRole="button"
                  disabled={trainerCount >= preset.maxTrainers}
                  onPress={() => setBoundedTrainers(trainerCount + 1)}
                  style={styles.trainerButton}
                >
                  <Text style={styles.trainerButtonText}>+</Text>
                </Pressable>
              </View>
              <Text style={[styles.trainerLimit, light && styles.mutedLight]}>up to {preset.maxTrainers}</Text>
            </View>
          </View>

          {partyReady ? <><View accessibilityLabel="Recommended three-Pokémon party" style={styles.party}>
            {ROLES.map((role) => {
              const entry = team[role];
              return (
                <Pressable
                  accessibilityLabel={`${ROLE_LABELS[role]} team member, ${entry.displayName}. Choose another recommendation.`}
                  accessibilityRole="button"
                  key={role}
                  onPress={() => {
                    beginPerformance('max_party_picker_painted');
                    setPickerRole(role);
                  }}
                  style={[styles.member, light && styles.memberLight]}
                >
                  <Text style={[styles.role, styles[`role_${role}`]]}>{ROLE_ICONS[role]} {ROLE_LABELS[role]}</Text>
                  <ExpoImage
                    cachePolicy="memory-disk"
                    contentFit="contain"
                    source={{ uri: absoluteUri(assetBaseUrl, entry.variant.currentImage || entry.variant.image_url) }}
                    style={styles.image}
                    transition={0}
                  />
                  <Text numberOfLines={2} style={[styles.memberName, light && styles.textLight]}>{entry.displayName}</Text>
                  <Text numberOfLines={1} style={[styles.memberMove, light && styles.mutedLight]}>{entry.maxMoveName}</Text>
                  {candidates[role].length > 1 ? <Text style={styles.change}>Choose teammate</Text> : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: advanced }}
            onPress={toggleAdvanced}
            style={styles.advancedToggle}
          >
            <View style={styles.advancedCopy}>
              <Text style={[styles.advancedLabel, light && styles.textLight]}>Advanced setup</Text>
              <Text style={[styles.advancedDetail, light && styles.mutedLight]}>Boss HP and model details</Text>
            </View>
            <Text style={styles.advancedChevron}>{advanced ? '⌃' : '⌄'}</Text>
          </Pressable>

          {scenarios ? (
            <View
              accessibilityElementsHidden={!advanced}
              importantForAccessibility={advanced ? 'auto' : 'no-hide-descendants'}
              style={[styles.advanced, light && styles.advancedLight, !advanced && styles.hidden]}
            >
              <View style={styles.metrics}>
                <View style={styles.metric}><Text style={[styles.metricLabel, light && styles.mutedLight]}>CLEAR TIME</Text><Text style={[styles.metricValue, light && styles.textLight]}>{formatDuration(result.estimatedClearSeconds)}</Text></View>
                <View style={styles.metric}><Text style={[styles.metricLabel, light && styles.mutedLight]}>LOBBY DAMAGE</Text><Text style={[styles.metricValue, light && styles.textLight]}>{result.lobbyDps.toFixed(1)}/s</Text></View>
                <View style={styles.metric}><Text style={[styles.metricLabel, light && styles.mutedLight]}>MAX PHASES</Text><Text style={[styles.metricValue, light && styles.textLight]}>{result.estimatedMaxPhases}</Text></View>
              </View>
              {advancedDetailsReady ? <>
              <Text style={[styles.assumption, light && styles.mutedLight]}>
                Standard: {OUTCOME_COPY[scenarios.standard.outcome].label}, {formatDuration(scenarios.standard.estimatedClearSeconds)} · Stress: {OUTCOME_COPY[scenarios['stress-test'].outcome].label}, {formatDuration(scenarios['stress-test'].estimatedClearSeconds)}.
              </Text>
              <Text style={[styles.assumption, light && styles.mutedLight]}>
                {rosterScope === 'owned'
                  ? 'Uses your recorded level, IVs, Fast Move, and unlocked Max Move levels.'
                  : 'Catalog entries use level 50, perfect IVs, and level-3 Max Moves.'}
              </Text>
              <Text style={[styles.assumption, light && styles.mutedLight]}>
                Charge plan: {result.meterPlan.fastMove.name}{result.meterPlan.chargedMove ? ` + ${result.meterPlan.chargedMove.name}` : ' only'} · limiting window {formatDuration(result.limitingSeconds)}.
              </Text>
              <View accessibilityLabel="Execution model" style={styles.execution}>
                {(Object.keys(MAX_BATTLE_EXECUTION_PRESETS) as MaxBattleExecution[]).map((value) => {
                  const selected = execution === value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={value}
                      onPress={() => changeExecution(value)}
                      style={[styles.executionButton, light && styles.controlLight, selected && styles.executionActive]}
                    >
                      <Text style={[styles.executionText, light && styles.textLight, selected && styles.executionTextActive]}>{MAX_BATTLE_EXECUTION_PRESETS[value].label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.executionDetail, light && styles.mutedLight]}>{MAX_BATTLE_EXECUTION_PRESETS[execution].detail}</Text>
              {difficultyOptions.length > 1 ? (
                <View accessibilityLabel="Max Battle difficulty" style={styles.optionRow}>
                  <Text style={[styles.metricLabel, styles.fullWidth, light && styles.mutedLight]}>BATTLE DIFFICULTY</Text>
                  {difficultyOptions.map((tier) => {
                    const option = getMaxBattleBossPreset(boss, tier);
                    const selected = difficulty === tier;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={tier}
                        onPress={() => changeDifficulty(tier)}
                        style={[styles.option, light && styles.controlLight, selected && styles.optionActive]}
                      >
                        <Text style={[styles.optionText, light && styles.textLight, selected && styles.optionTextActive]}>
                          {option.label} · {formatNumber(option.bossHp)} HP
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Text style={[styles.assumption, styles.fullWidth, light && styles.mutedLight]}>Use the tier shown at the Power Spot.</Text>
                </View>
              ) : null}
              <View style={styles.advancedActions}>
                <View style={styles.hpField}>
                  <Text style={[styles.metricLabel, light && styles.mutedLight]}>BOSS HP ESTIMATE</Text>
                  <TextInput
                    accessibilityLabel="Boss HP estimate"
                    keyboardType="number-pad"
                    onChangeText={changeBossHp}
                    style={[styles.hpInput, light && styles.hpInputLight]}
                    value={String(bossHp)}
                  />
                  <Text style={[styles.assumption, light && styles.mutedLight]}>Editable when an event uses different HP.</Text>
                </View>
                <Pressable
                  accessibilityLabel="Reset recommendations"
                  accessibilityRole="button"
                  onPress={resetRecommendations}
                  style={[styles.reset, light && styles.controlLight]}
                >
                  <Text style={[styles.resetText, light && styles.textLight]}>↻  Reset recommendations</Text>
                </Pressable>
              </View>
              <View style={styles.assumptionsBlock}>
                <Text style={[styles.assumption, light && styles.mutedLight]}>
                  Encounter profile:{' '}
                  {preset.sourceUrl ? (
                    <Text
                      accessibilityRole="link"
                      onPress={() => { void Linking.openURL(preset.sourceUrl as string); }}
                      style={styles.sourceLink}
                    >
                      {preset.sourceName || 'Catalog source'}
                    </Text>
                  ) : (
                    <Text style={[styles.assumptionStrong, light && styles.textLight]}>
                      {preset.source === 'catalog' ? preset.sourceName || 'Catalog profile' : 'Estimated fallback'}
                    </Text>
                  )}
                  {preset.notes ? ` — ${preset.notes}` : ''}
                </Text>
                <Text style={[styles.assumption, light && styles.mutedLight]}>
                  {result.trainerCount} equivalent Trainers in {result.subgroupCount} four-person subgroup{result.subgroupCount === 1 ? '' : 's'}, each bringing the displayed party. Support actions are used when the selected tier and unlocked moves justify them; remaining actions attack.
                </Text>
                <Text style={[styles.assumption, light && styles.mutedLight]}>
                  The estimate compares Fast Move-only play with every legal charged rotation under this tier&apos;s Max Meter rules. The selected plan reaches each Max phase in about {formatDuration(result.meterPlan.meterSeconds)}. It also uses per-boss damage, scheduled 15-second shared-meter orbs, Max Move levels, three Max actions, and a {formatDuration(preset.enrageSeconds)} enrage window. It excludes cheering, Power Spot bonuses, Max Mushrooms, and network latency. {rosterScope === 'owned' ? 'Other Trainers are modeled at the same strength as your selected trio.' : 'Catalog entries use level 50, perfect IVs, and level-3 Max Moves.'}
                </Text>
                <Text style={[styles.assumption, light && styles.mutedLight]}>
                  Modeled damage before the limiting window: {formatNumber(result.damageBeforeLimit)} / {formatNumber(result.bossHp)} HP. The limiting window is {formatDuration(result.limitingSeconds)} due to {result.limitedBySurvival ? 'team endurance' : 'enrage'}.
                </Text>
              </View>
              </> : null}
            </View>
          ) : null}</> : (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.partyPlaceholder}>
              {ROLES.map((role) => <View key={role} style={[styles.memberPlaceholder, light && styles.memberLight]} />)}
            </View>
          )}
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, light && styles.textLight]}>A complete three-Pokémon party is required</Text>
          <Text style={[styles.detail, light && styles.mutedLight]}>Add eligible Damage, Tank, and Healing Pokémon to this roster.</Text>
        </View>
      )}
      {pickerRole ? <Modal
        animationType="none"
        onRequestClose={() => setPickerRole(null)}
        statusBarTranslucent
        transparent
        visible
      >
        <View accessibilityViewIsModal style={styles.pickerBackdrop}>
          <View style={[styles.pickerSheet, light && styles.pickerSheetLight]}>
            <View style={styles.pickerHeader}>
              <View style={styles.pickerHeaderCopy}>
                <Text style={styles.eyebrow}>RECOMMENDED PARTY</Text>
                <Text style={[styles.pickerTitle, light && styles.textLight]}>
                  Choose {pickerRole ? ROLE_LABELS[pickerRole] : ''} team member
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close team member picker"
                accessibilityRole="button"
                onPress={() => setPickerRole(null)}
                style={[styles.pickerClose, light && styles.controlLight]}
              >
                <Text style={[styles.pickerCloseText, light && styles.textLight]}>×</Text>
              </Pressable>
            </View>
            <FlatList
              contentContainerStyle={styles.pickerList}
              data={candidates[pickerRole]}
              initialNumToRender={9}
              keyExtractor={entryKey}
              maxToRenderPerBatch={8}
              renderItem={({ item: candidate }) => {
                const key = entryKey(candidate);
                const selected = selection[pickerRole] === key;
                return (
                  <Pressable
                    accessibilityLabel={`Select ${candidate.displayName} for ${ROLE_LABELS[pickerRole]}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={key}
                    onPress={() => selectCandidate(pickerRole, key)}
                    style={[styles.pickerOption, light && styles.controlLight, selected && styles.pickerOptionSelected]}
                  >
                    <ExpoImage
                      cachePolicy="memory-disk"
                      contentFit="contain"
                      source={{ uri: absoluteUri(assetBaseUrl, candidate.variant.currentImage || candidate.variant.image_url) }}
                      style={styles.pickerImage}
                      transition={0}
                    />
                    <View style={styles.pickerOptionCopy}>
                      <Text style={[styles.pickerOptionName, light && styles.textLight]}>{candidate.displayName}</Text>
                      <Text style={[styles.pickerOptionMove, light && styles.mutedLight]}>{candidate.fastMove.name} · {candidate.maxMoveName}</Text>
                    </View>
                    {selected ? <Text style={styles.pickerSelected}>SELECTED</Text> : null}
                  </Pressable>
                );
              }}
              windowSize={5}
            />
          </View>
        </View>
      </Modal> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: 10, marginTop: 10, borderWidth: 1, borderColor: '#365a5c', borderRadius: 12, padding: 11, backgroundColor: '#101a1b' },
  rootLight: { borderColor: '#9bbabb', backgroundColor: '#f7fbfb' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerCopy: { minWidth: 0, flex: 1 },
  eyebrow: { color: '#57d9cb', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 2, color: '#fff', fontSize: 17, lineHeight: 21, fontWeight: '900' },
  textLight: { color: '#112a2b' },
  mutedLight: { color: '#5d7273' },
  profile: { alignItems: 'flex-end' },
  profileLabel: { color: '#eef9f8', fontSize: 9, fontWeight: '900' },
  confidence: { marginTop: 3, color: '#57d9cb', fontSize: 7, fontWeight: '900', textTransform: 'capitalize' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  option: { minHeight: 34, justifyContent: 'center', borderWidth: 1, borderColor: '#405253', borderRadius: 8, paddingHorizontal: 9, backgroundColor: '#141f20' },
  controlLight: { borderColor: '#b5c7c7', backgroundColor: '#fff' },
  optionActive: { borderColor: '#e9bd4f', backgroundColor: '#f0cf6c' },
  optionText: { color: '#b8c5c4', fontSize: 8, fontWeight: '900' },
  optionTextActive: { color: '#171b1b' },
  decision: { flexDirection: 'row', alignItems: 'stretch', gap: 8, borderLeftWidth: 4, borderRadius: 8, padding: 9, backgroundColor: '#142323' },
  'decision_likely-clear': { borderLeftColor: '#36cb82' },
  'decision_close-call': { borderLeftColor: '#f0c857' },
  decision_unlikely: { borderLeftColor: '#ec6681' },
  decisionCopy: { minWidth: 0, flex: 1 },
  decisionLabel: { color: '#57d9cb', fontSize: 13, fontWeight: '900' },
  decisionMetric: { marginTop: 2, color: '#fff', fontSize: 10, lineHeight: 14, fontWeight: '800' },
  decisionDetail: { marginTop: 3, color: '#a7b8b7', fontSize: 8.5, lineHeight: 12 },
  detail: { marginTop: 3, color: '#99acab', fontSize: 8.5, lineHeight: 12 },
  trainerControl: { minWidth: 94, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3b4e4f', borderRadius: 8, padding: 5, backgroundColor: '#0d1718' },
  trainerLabel: { color: '#91a5a4', fontSize: 7, fontWeight: '900' },
  trainerButtons: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  trainerButton: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#296d68' },
  trainerButtonText: { color: '#fff', fontSize: 17, lineHeight: 18, fontWeight: '900' },
  trainerCount: { minWidth: 20, color: '#fff', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  trainerLimit: { marginTop: 2, color: '#899d9c', fontSize: 7 },
  party: { flexDirection: 'row', gap: 6 },
  partyPlaceholder: { flexDirection: 'row', gap: 6 },
  member: { minWidth: 0, flex: 1, minHeight: 155, alignItems: 'center', borderWidth: 1, borderColor: '#385052', borderRadius: 9, padding: 6, backgroundColor: '#111c1d' },
  memberPlaceholder: { minWidth: 0, minHeight: 155, flex: 1, borderWidth: 1, borderColor: '#263d3e', borderRadius: 9, backgroundColor: '#101a1b' },
  memberLight: { borderColor: '#b8caca', backgroundColor: '#fff' },
  role: { alignSelf: 'stretch', fontSize: 8, fontWeight: '900', textAlign: 'center' },
  role_damage: { color: '#ee6692' },
  role_tank: { color: '#73d9d1' },
  role_healing: { color: '#f1c65b' },
  image: { width: 70, height: 70, marginTop: 2 },
  memberName: { minHeight: 28, color: '#fff', fontSize: 10, lineHeight: 13, fontWeight: '900', textAlign: 'center' },
  memberMove: { marginTop: 2, color: '#9daead', fontSize: 7.5, textAlign: 'center' },
  change: { marginTop: 'auto', color: '#4dcfc2', fontSize: 7, fontWeight: '800' },
  execution: { flexDirection: 'row', gap: 6 },
  executionButton: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3b4d4e', borderRadius: 8, backgroundColor: '#111c1d' },
  executionActive: { borderColor: '#45d6c8', backgroundColor: '#225f5c' },
  executionText: { color: '#a9b8b7', fontSize: 9, fontWeight: '900' },
  executionTextActive: { color: '#fff' },
  executionDetail: { marginTop: -5, color: '#92a5a4', fontSize: 8, lineHeight: 11, textAlign: 'center' },
  advancedToggle: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#314748', paddingTop: 7 },
  advancedCopy: { minWidth: 0, flex: 1 },
  advancedLabel: { color: '#eef7f6', fontSize: 10, fontWeight: '900' },
  advancedDetail: { marginTop: 2, color: '#9aacaa', fontSize: 8 },
  advancedChevron: { color: '#58d7cb', fontSize: 15 },
  advanced: { gap: 8, borderRadius: 8, padding: 9, backgroundColor: '#0b1516' },
  hidden: { display: 'none' },
  advancedLight: { backgroundColor: '#eaf2f2' },
  advancedActions: { gap: 9, borderTopWidth: 1, borderTopColor: '#314748', paddingTop: 9 },
  assumptionsBlock: { gap: 7, borderTopWidth: 1, borderTopColor: '#314748', paddingTop: 9 },
  assumptionStrong: { color: '#eef8f7', fontWeight: '900' },
  sourceLink: { color: '#58d7cb', fontWeight: '900', textDecorationLine: 'underline' },
  fullWidth: { width: '100%' },
  hpField: { gap: 5 },
  hpInput: { minHeight: 42, borderWidth: 1, borderColor: '#405455', borderRadius: 8, paddingHorizontal: 11, color: '#eef8f7', backgroundColor: '#101b1c', fontSize: 13, fontWeight: '800' },
  hpInputLight: { borderColor: '#9eb4b5', color: '#112a2b', backgroundColor: '#fff' },
  reset: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#405455', borderRadius: 8, backgroundColor: '#121d1e' },
  resetText: { color: '#eef8f7', fontSize: 10, fontWeight: '900' },
  metrics: { flexDirection: 'row', gap: 5 },
  metric: { minWidth: 0, flex: 1 },
  metricLabel: { color: '#8fa3a2', fontSize: 6.5, fontWeight: '900' },
  metricValue: { marginTop: 2, color: '#fff', fontSize: 11, fontWeight: '900' },
  assumption: { color: '#9aacaa', fontSize: 8, lineHeight: 12 },
  empty: { alignItems: 'center', gap: 3, paddingVertical: 18 },
  emptyTitle: { color: '#fff', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.72)' },
  pickerSheet: { maxHeight: '78%', gap: 10, borderTopWidth: 1, borderColor: '#3c7774', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 30, backgroundColor: '#0d1718' },
  pickerSheetLight: { borderColor: '#7aa6a3', backgroundColor: '#f7fbfb' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickerHeaderCopy: { minWidth: 0, flex: 1 },
  pickerTitle: { marginTop: 2, color: '#fff', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  pickerClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#405455', borderRadius: 20, backgroundColor: '#121d1e' },
  pickerCloseText: { marginTop: -2, color: '#eef8f7', fontSize: 27, lineHeight: 30 },
  pickerList: { gap: 7, paddingBottom: 10 },
  pickerOption: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#344c4d', borderRadius: 10, paddingHorizontal: 9, backgroundColor: '#111c1d' },
  pickerOptionSelected: { borderColor: '#45d6c8', backgroundColor: '#173f3d' },
  pickerImage: { width: 52, height: 52 },
  pickerOptionCopy: { minWidth: 0, flex: 1 },
  pickerOptionName: { color: '#eef8f7', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  pickerOptionMove: { marginTop: 3, color: '#9aacaa', fontSize: 8.5, lineHeight: 12 },
  pickerSelected: { color: '#58d7cb', fontSize: 7, fontWeight: '900' },
});
