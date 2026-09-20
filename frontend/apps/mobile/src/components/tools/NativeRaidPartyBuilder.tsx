import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  NativeCombatEntry,
  NativeRaidBossEntry,
  NativeRaidSettings,
} from '../../features/tools/nativeBattleModels';
import { RAID_PARTY_MAX_TRAINERS } from '@pokemongonexus/app-core/raid-rules';
import {
  applyNativeRaidOptimization,
  createNativeRaidParty,
  createNativeRaidPartyTrainer,
  getNativeRaidTeam,
  getNativeRaidPartyScenarioKey,
  getNativeRaidScoreKey,
  nativeRaidEntryUsesMegaSlot,
  optimizeNativeRaidParty,
  simulateNativeRaidParty,
  type NativeRaidPartyOptimizationResult,
  type NativeRaidPartyResult,
  type NativeRaidPartyTrainerDraft,
  type NativeRaidTier,
} from '../../features/tools/nativeRaidPlannerModel';
import { useNativeModalAnimation } from '../../features/settings/useNativeMotion';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';
import { NativeUiIcon } from '../NativeUiIcon';
import { markNativeUiPerformanceAfterPaint } from '../../observability/nativeUiInteractionTiming';

type Props = {
  assetBaseUrl: string;
  boss: NativeRaidBossEntry;
  onResultChange: (
    result: NativeRaidPartyResult | null,
    source?: 'custom-party' | 'optimized-party',
    scenarioKey?: string,
  ) => void;
  scores: NativeCombatEntry[];
  settings: NativeRaidSettings;
  tier: NativeRaidTier;
};

type Picker = { slotIndex: number; trainerId: string } | null;
const assetUri = (base: string, value: string | null) => {
  if (!value) return undefined;
  try { return new URL(value, base).toString(); } catch { return undefined; }
};
const seconds = (value: number) => Number.isFinite(value) ? `${value.toFixed(1)}s` : 'No clear';

export const NativeRaidPartyBuilder = ({ assetBaseUrl, boss, onResultChange, scores, settings, tier }: Props) => {
  const light = useNativeColorScheme() === 'light';
  const animationType = useNativeModalAnimation('slide');
  const [open, setOpen] = useState(false);
  const [trainers, setTrainers] = useState<NativeRaidPartyTrainerDraft[]>(() => createNativeRaidParty(scores, settings));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(['trainer-1']));
  const [picker, setPicker] = useState<Picker>(null);
  const [result, setResult] = useState<NativeRaidPartyResult | null>(null);
  const [optimization, setOptimization] = useState<NativeRaidPartyOptimizationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState('');
  const workTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openStartedAtRef = useRef<number | null>(null);
  const onResultChangeRef = useRef(onResultChange);
  const previousInputsRef = useRef({ scores, settings });
  const candidates = useMemo(() => scores.slice(0, 80), [scores]);
  const scoreById = useMemo(() => new Map(candidates.map((entry) => [getNativeRaidScoreKey(entry), entry])), [candidates]);
  const selectedTrainer = picker ? trainers.find((trainer) => trainer.id === picker.trainerId) ?? null : null;
  const winRate = result?.distribution.winRate ?? 0;
  const outcome = !result
    ? null
    : winRate >= 1
      ? { label: 'Clear', style: styles.success }
      : winRate <= 0
        ? { label: 'Time expired', style: styles.failure }
        : winRate >= 0.5
          ? { label: 'Likely clear', style: styles.success }
          : { label: 'Risky', style: styles.risky };

  useEffect(() => {
    onResultChangeRef.current = onResultChange;
  }, [onResultChange]);

  useEffect(() => {
    if (previousInputsRef.current.scores === scores && previousInputsRef.current.settings === settings) return undefined;
    previousInputsRef.current = { scores, settings };
    const reconcileTimer = setTimeout(() => {
      if (workTimerRef.current) clearTimeout(workTimerRef.current);
      setRunning(false);
      setOptimizing(false);
      const availableIds = new Set(scores.map(getNativeRaidScoreKey));
      const defaults = getNativeRaidTeam(scores).map(getNativeRaidScoreKey);
      setTrainers((current) => current.map((trainer) => {
        const memberVariantIds = trainer.memberVariantIds.filter((id) => availableIds.has(id));
        defaults.forEach((id) => {
          if (memberVariantIds.length < 6 && !memberVariantIds.includes(id)) memberVariantIds.push(id);
        });
        return { ...trainer, memberVariantIds };
      }));
      setResult(null);
      setOptimization(null);
      setError('');
      onResultChangeRef.current(null);
    }, 0);
    return () => clearTimeout(reconcileTimer);
  }, [scores, settings]);

  useEffect(() => {
    if (!open || openStartedAtRef.current == null) return;
    markNativeUiPerformanceAfterPaint('raid_party_painted', openStartedAtRef.current);
    openStartedAtRef.current = null;
  }, [open]);

  useEffect(() => () => {
    if (workTimerRef.current) clearTimeout(workTimerRef.current);
  }, []);

  const cancelPendingWork = () => {
    if (workTimerRef.current) {
      clearTimeout(workTimerRef.current);
      workTimerRef.current = null;
    }
    setRunning(false);
    setOptimizing(false);
  };
  const updateTrainer = (id: string, update: (trainer: NativeRaidPartyTrainerDraft) => NativeRaidPartyTrainerDraft) => {
    cancelPendingWork();
    setTrainers((current) => current.map((trainer) => trainer.id === id ? update(trainer) : trainer));
    setResult(null);
    setOptimization(null);
    setError('');
    onResultChangeRef.current(null);
  };
  const run = () => {
    const startedAt = Date.now();
    if (workTimerRef.current) clearTimeout(workTimerRef.current);
    setRunning(true);
    setOptimization(null);
    setError('');
    workTimerRef.current = setTimeout(() => {
      workTimerRef.current = null;
      const request = { boss, drafts: trainers, scores, settings, tier };
      const next = simulateNativeRaidParty(request);
      const scenarioKey = getNativeRaidPartyScenarioKey(request);
      if (!scenarioKey) {
        setError('Every Trainer needs at least one valid team member.');
      } else if (!next) {
        setError('The boss has no usable raid movesets.');
      } else {
        setResult(next);
        onResultChangeRef.current(next, 'custom-party', scenarioKey);
      }
      setRunning(false);
      markNativeUiPerformanceAfterPaint('raid_party_result_painted', startedAt);
    }, 0);
  };
  const optimize = () => {
    const startedAt = Date.now();
    if (workTimerRef.current) clearTimeout(workTimerRef.current);
    setOptimizing(true);
    setError('');
    workTimerRef.current = setTimeout(() => {
      workTimerRef.current = null;
      const request = { boss, drafts: trainers, scores, settings, tier };
      const next = optimizeNativeRaidParty(request);
      if (!next) {
        setError('The optimizer could not build a legal raid party.');
      } else {
        const optimizedDrafts = applyNativeRaidOptimization(trainers, next);
        const scenarioKey = getNativeRaidPartyScenarioKey({ ...request, drafts: optimizedDrafts });
        setTrainers(optimizedDrafts);
        setOptimization(next);
        setResult(next.result);
        onResultChangeRef.current(next.result, 'optimized-party', scenarioKey ?? undefined);
      }
      setOptimizing(false);
      markNativeUiPerformanceAfterPaint('raid_party_optimization_painted', startedAt);
    }, 0);
  };
  const addTrainer = () => {
    if (trainers.length >= RAID_PARTY_MAX_TRAINERS) return;
    cancelPendingWork();
    const nextIndex = Math.max(0, ...trainers.map((trainer) => Number(trainer.id.match(/(\d+)$/)?.[1]) || 0));
    const next = createNativeRaidPartyTrainer(nextIndex, scores, settings);
    setTrainers((current) => [...current, next]);
    setExpandedIds(new Set([next.id]));
    setResult(null);
    setOptimization(null);
    onResultChangeRef.current(null);
  };
  const removeTrainer = (id: string) => {
    if (trainers.length <= 1) return;
    cancelPendingWork();
    setTrainers((current) => current.filter((trainer) => trainer.id !== id));
    setExpandedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setResult(null);
    setOptimization(null);
    onResultChangeRef.current(null);
  };
  const selectMember = (entry: NativeCombatEntry | null) => {
    if (!picker) return;
    updateTrainer(picker.trainerId, (trainer) => {
      const memberVariantIds = [...trainer.memberVariantIds];
      memberVariantIds[picker.slotIndex] = entry ? getNativeRaidScoreKey(entry) : '';
      return { ...trainer, memberVariantIds };
    });
    setPicker(null);
  };

  return (
    <View style={[styles.panel, light && styles.panelLight]}>
      <Pressable accessibilityLabel="Custom raid party" accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => { if (!open) openStartedAtRef.current = Date.now(); setOpen((current) => !current); }} style={styles.toggle}>
        <NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="trainers" size={18} />
        <View style={styles.flex}><Text style={[styles.toggleTitle, light && styles.textLight]}>Custom raid party</Text><Text style={[styles.meta, light && styles.mutedLight]}>Independent teams, dodges, relobbies, and contribution</Text></View>
        <Text style={[styles.chevron, light && styles.textLight]}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>

      {open ? (
        <View style={styles.content}>
          <View style={[styles.lobby, light && styles.controlLight]}>
            <View style={styles.lobbySummary}>
              <View><Text style={[styles.lobbyCount, light && styles.textLight]}>{trainers.length} Trainer{trainers.length === 1 ? '' : 's'}</Text><Text style={[styles.meta, light && styles.mutedLight]}>Lobby size</Text></View>
              <View style={styles.outcome}><Text style={[styles.outcomeTitle, outcome?.style, !result && light && styles.textLight]}>{outcome?.label ?? 'Ready to test'}</Text><Text style={[styles.meta, light && styles.mutedLight]}>{result ? `${seconds(result.projectedTimeToWinSeconds)} · ${Math.round(winRate * 100)}% clear` : 'Build and simulate this lobby'}</Text></View>
            </View>
            <View style={styles.lobbyActions}>
              <Pressable accessibilityLabel="Add Trainer" accessibilityRole="button" disabled={trainers.length >= RAID_PARTY_MAX_TRAINERS || running || optimizing} onPress={addTrainer} style={[styles.secondary, light && styles.controlLight, (running || optimizing) && styles.disabled]}><Text style={[styles.secondaryText, light && styles.textLight]}>＋ Add</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={scores.length === 0 || running || optimizing} onPress={run} style={[styles.primary, (running || optimizing) && styles.disabled]}><View style={styles.primaryContent}>{running ? <ActivityIndicator color="#061816" size="small" /> : <NativeUiIcon color="#061816" name="bolt" size={14} />}<Text style={styles.primaryText}>{running ? 'Running…' : 'Simulate'}</Text></View></Pressable>
              <Pressable accessibilityRole="button" disabled={scores.length === 0 || running || optimizing} onPress={optimize} style={[styles.optimize, (running || optimizing) && styles.disabled]}>{optimizing ? <ActivityIndicator color="#071214" size="small" /> : null}<Text style={styles.primaryText}>{optimizing ? 'Optimizing…' : '✦ Optimize'}</Text></Pressable>
            </View>
          </View>

          <View style={styles.trainers}>
            {trainers.map((trainer, trainerIndex) => {
              const expanded = expandedIds.has(trainer.id);
              const members = trainer.memberVariantIds.flatMap((id) => scoreById.get(id) ?? []);
              return (
                <View key={trainer.id} style={[styles.trainer, light && styles.controlLight]}>
                  <Pressable accessibilityLabel={`${trainer.label} settings`} accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpandedIds((current) => {
                    const next = new Set(current);
                    if (next.has(trainer.id)) next.delete(trainer.id);
                    else next.add(trainer.id);
                    return next;
                  })} style={styles.trainerHeader}>
                    <View style={styles.number}><Text style={styles.numberText}>{trainerIndex + 1}</Text></View>
                    <View style={styles.flex}><Text style={[styles.trainerTitle, light && styles.textLight]}>{trainer.label}</Text><Text style={[styles.meta, light && styles.mutedLight]}>{members.length} Pokémon{members.some(nativeRaidEntryUsesMegaSlot) ? ' · Mega/Primal' : ''}</Text></View>
                    <Text style={[styles.chevron, light && styles.textLight]}>{expanded ? '⌃' : '⌄'}</Text>
                  </Pressable>
                  {expanded ? (
                    <View style={styles.trainerContent}>
                      <View style={styles.field}><Text style={[styles.label, light && styles.mutedLight]}>TRAINER NAME</Text><TextInput accessibilityLabel={`${trainer.label} name`} onChangeText={(label) => updateTrainer(trainer.id, (current) => ({ ...current, label }))} style={[styles.input, light && styles.inputLight]} value={trainer.label} /></View>
                      <View style={styles.settingsGrid}>
                        <Setting label="Dodging" light={light} options={[['No dodging', 'none'], ['Charged attacks', 'charged']]} value={trainer.dodgeStrategy} onChange={(value) => updateTrainer(trainer.id, (current) => ({ ...current, dodgeStrategy: value as NativeRaidPartyTrainerDraft['dodgeStrategy'] }))} />
                        <Setting disabled={trainer.dodgeStrategy === 'none'} label="Dodge success" light={light} options={[['100%', 1], ['75%', .75], ['50%', .5], ['25%', .25]]} value={trainer.dodgeSuccessRate} onChange={(value) => updateTrainer(trainer.id, (current) => ({ ...current, dodgeSuccessRate: value as NativeRaidPartyTrainerDraft['dodgeSuccessRate'] }))} />
                        <Setting label="Relobby" light={light} options={[["5s", 5], ["10s", 10], ["15s", 15], ["20s", 20]]} value={trainer.relobbySeconds} onChange={(value) => updateTrainer(trainer.id, (current) => ({ ...current, relobbySeconds: value as NativeRaidPartyTrainerDraft['relobbySeconds'] }))} />
                        <Setting label="Action delay" light={light} options={[["None", 0], ["0.5s", .5], ["1.0s", 1]]} value={trainer.actionDelaySeconds} onChange={(value) => updateTrainer(trainer.id, (current) => ({ ...current, actionDelaySeconds: value as NativeRaidPartyTrainerDraft['actionDelaySeconds'] }))} />
                      </View>
                      <View style={styles.teamHeading}><Text style={[styles.trainerTitle, light && styles.textLight]}>Battle team</Text><Pressable accessibilityRole="button" onPress={() => updateTrainer(trainer.id, (current) => ({ ...current, memberVariantIds: getNativeRaidTeam(scores).map(getNativeRaidScoreKey) }))}><Text style={styles.autoFill}>↻ Auto fill</Text></Pressable></View>
                      <View accessibilityLabel={`${trainer.label} battle team`} style={styles.team}>
                        {Array.from({ length: 6 }, (_, slotIndex) => {
                          const member = scoreById.get(trainer.memberVariantIds[slotIndex] ?? '');
                          return (
                            <Pressable accessibilityLabel={`${trainer.label} team slot ${slotIndex + 1}`} accessibilityRole="button" key={`${trainer.id}-${slotIndex}`} onPress={() => setPicker({ slotIndex, trainerId: trainer.id })} style={[styles.teamSlot, light && styles.teamSlotLight]}>
                              <Text style={[styles.slotNumber, light && styles.mutedLight]}>{slotIndex + 1}</Text>
                              {member ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: assetUri(assetBaseUrl, member.imageUri) }} style={styles.teamImage} /> : <Text style={[styles.emptySlot, light && styles.mutedLight]}>＋</Text>}
                              <Text numberOfLines={1} style={[styles.teamName, light && styles.textLight]}>{member?.name ?? 'Empty'}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {trainers.length > 1 ? <Pressable accessibilityLabel={`Remove ${trainer.label}`} accessibilityRole="button" onPress={() => removeTrainer(trainer.id)} style={styles.remove}><Text style={styles.removeText}>⌫ Remove Trainer</Text></Pressable> : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          {result ? (
            <View accessibilityLabel="Raid party result" style={[styles.result, winRate >= .5 ? styles.resultClear : winRate > 0 ? styles.resultRisky : styles.resultFailed]}>
              <Text style={styles.resultTitle}>{outcome?.label} · {seconds(result.projectedTimeToWinSeconds)}</Text>
              <Text style={styles.resultMeta}>{result.dps.toFixed(1)} DPS · {Math.round(result.faints)} faints · {Math.round(result.relobbies)} relobbies</Text>
              {result.distribution.sampleCount > 1 ? <Text style={styles.resultMeta}>{Math.round(winRate * 100)}% of modeled outcomes clear</Text> : null}
              {result.superMega ? <Text style={styles.resultMeta}>{Math.round(result.superMega.shieldsBroken)} / {result.superMega.shieldCount} shields broken · {result.superMega.eligibleMegaTrainers} Mega-ready Trainers</Text> : null}
              {optimization ? <View style={styles.optimization}><Text style={styles.optimizationTitle}>Lobby optimized</Text><Text style={styles.resultMeta}>{optimization.evaluatedLineups} coordinated lineups checked · {optimization.beamWidth}-wide search</Text><Text style={styles.resultMeta}>{optimization.changedTrainerCount} teams changed{optimization.timeSavedSeconds >= .05 ? ` · ${optimization.timeSavedSeconds.toFixed(1)}s faster` : ''}{optimization.faintReduction >= .5 ? ` · ${optimization.faintReduction.toFixed(1)} fewer faints` : ''}{optimization.relobbyReduction >= .5 ? ` · ${optimization.relobbyReduction.toFixed(1)} fewer relobbies` : ''}</Text>{optimization.trainerChanges.map((change) => <Text key={change.trainerId} style={styles.resultMeta}>{change.label}: {change.reasons.join(' · ')}</Text>)}</View> : null}
              {result.trainers.map((trainer) => <View key={trainer.id} style={styles.contribution}><View style={styles.contributionCopy}><Text style={styles.contributionName}>{trainer.label}</Text><Text style={styles.contributionMeta}>{trainer.dps.toFixed(1)} DPS · {Math.round(trainer.damageShare * 100)}%</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.max(2, trainer.damageShare * 100)}%` }]} /></View></View>)}
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal animationType={animationType} onRequestClose={() => setPicker(null)} transparent visible={Boolean(picker)}>
        <View style={styles.backdrop}>
          <View style={[styles.picker, light && styles.pickerLight]}>
            <View style={styles.pickerHeader}><View style={styles.flex}><Text style={styles.eyebrow}>TEAM SLOT</Text><Text style={[styles.pickerTitle, light && styles.textLight]}>Choose an attacker</Text></View><Pressable accessibilityLabel="Close attacker picker" accessibilityRole="button" onPress={() => setPicker(null)} style={[styles.close, light && styles.controlLight]}><Text style={[styles.closeText, light && styles.textLight]}>×</Text></Pressable></View>
            <ScrollView contentContainerStyle={styles.candidateList}>
              <Pressable accessibilityRole="button" onPress={() => selectMember(null)} style={[styles.candidate, light && styles.controlLight]}><Text style={[styles.candidateName, light && styles.textLight]}>Empty slot</Text></Pressable>
              {candidates.map((entry) => {
                const id = getNativeRaidScoreKey(entry);
                const selectedId = selectedTrainer?.memberVariantIds[picker?.slotIndex ?? -1] ?? '';
                const anotherMegaSelected = selectedTrainer?.memberVariantIds.some((memberId, index) => {
                  const member = scoreById.get(memberId);
                  return index !== picker?.slotIndex && Boolean(member && nativeRaidEntryUsesMegaSlot(member));
                });
                const selectedElsewhere = selectedTrainer?.memberVariantIds.some((memberId, index) => memberId === id && index !== picker?.slotIndex);
                const disabled = Boolean(selectedElsewhere || (nativeRaidEntryUsesMegaSlot(entry) && anotherMegaSelected && selectedId !== id));
                return <Pressable accessibilityRole="button" disabled={disabled} key={id} onPress={() => selectMember(entry)} style={[styles.candidate, light && styles.controlLight, disabled && styles.disabled]}><Image fadeDuration={0} resizeMode="contain" source={{ uri: assetUri(assetBaseUrl, entry.imageUri) }} style={styles.candidateImage} /><View style={styles.flex}><Text numberOfLines={1} style={[styles.candidateName, light && styles.textLight]}>{entry.name}</Text><Text numberOfLines={1} style={[styles.meta, light && styles.mutedLight]}>{entry.fastMove?.name ?? '—'} · {entry.chargedMove?.name ?? '—'}</Text></View><Text style={styles.score}>{entry.score.toFixed(1)}</Text></Pressable>;
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const Setting = ({ disabled = false, label, light, onChange, options, value }: { disabled?: boolean; label: string; light: boolean; onChange: (value: string | number) => void; options: [string, string | number][]; value: string | number }) => (
  <View style={[styles.setting, disabled && styles.disabled]}><Text style={[styles.label, light && styles.mutedLight]}>{label.toLocaleUpperCase()}</Text><View style={styles.settingChoices}>{options.map(([optionLabel, optionValue]) => <Pressable accessibilityRole="button" accessibilityState={{ selected: value === optionValue }} disabled={disabled} key={String(optionValue)} onPress={() => onChange(optionValue)} style={[styles.settingChoice, light && styles.settingChoiceLight, value === optionValue && styles.settingActive]}><Text style={[styles.settingText, light && styles.textLight, value === optionValue && styles.settingTextActive]}>{optionLabel}</Text></Pressable>)}</View></View>
);

const styles = StyleSheet.create({
  panel: { overflow: 'hidden', borderRadius: 11, backgroundColor: '#172223' },
  panelLight: { backgroundColor: '#eef5f4' },
  toggle: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  toggleIcon: { color: '#55ddd4', fontSize: 18 },
  toggleTitle: { color: '#fff', fontSize: 12, fontWeight: '900' },
  meta: { marginTop: 1, color: '#9db0b1', fontSize: 8.5 },
  chevron: { color: '#eaf5f5', fontSize: 13, fontWeight: '900' },
  flex: { minWidth: 0, flex: 1 },
  content: { gap: 8, borderTopWidth: 1, borderTopColor: '#2c4243', padding: 8 },
  lobby: { gap: 8, borderWidth: 1, borderColor: '#3d5253', borderRadius: 10, padding: 8, backgroundColor: '#101819' },
  lobbySummary: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lobbyCount: { color: '#fff', fontSize: 13, fontWeight: '900' },
  outcome: { minWidth: 0, flex: 1, alignItems: 'flex-end' },
  outcomeTitle: { color: '#fff', fontSize: 11, fontWeight: '900' },
  success: { color: '#4be0ad' },
  failure: { color: '#ff8197' },
  risky: { color: '#ffd166' },
  lobbyActions: { flexDirection: 'row', gap: 5 },
  secondary: { minHeight: 39, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#44595a', borderRadius: 999, backgroundColor: '#202b2c' },
  secondaryText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  primary: { minHeight: 39, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#2fd6d0' },
  primaryContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  optimize: { minHeight: 39, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 999, backgroundColor: '#8b63cf' },
  primaryText: { color: '#071214', fontSize: 9, fontWeight: '900' },
  trainers: { gap: 6 },
  trainer: { overflow: 'hidden', borderWidth: 1, borderColor: '#3d5253', borderRadius: 10, backgroundColor: '#101819' },
  trainerHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  number: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#836414' },
  numberText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  trainerTitle: { color: '#fff', fontSize: 10.5, fontWeight: '900' },
  trainerContent: { gap: 9, borderTopWidth: 1, borderTopColor: '#2c4243', padding: 8 },
  field: { gap: 4 },
  label: { color: '#92a5a6', fontSize: 7, fontWeight: '900' },
  input: { minHeight: 42, borderWidth: 1, borderColor: '#45595a', borderRadius: 9, paddingHorizontal: 10, color: '#fff', backgroundColor: '#1b2526', fontSize: 11, fontWeight: '800' },
  inputLight: { borderColor: '#bdd0d0', color: '#142629', backgroundColor: '#fff' },
  settingsGrid: { gap: 8 },
  setting: { gap: 4 },
  settingChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  settingChoice: { minHeight: 34, justifyContent: 'center', borderWidth: 1, borderColor: '#435657', borderRadius: 999, paddingHorizontal: 9, backgroundColor: '#202a2b' },
  settingChoiceLight: { borderColor: '#bfd0d0', backgroundColor: '#fff' },
  settingActive: { borderColor: '#2fd6d0', backgroundColor: '#45dbc4' },
  settingText: { color: '#dce8e8', fontSize: 8, fontWeight: '900' },
  settingTextActive: { color: '#071214' },
  teamHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  autoFill: { color: '#55ddd4', fontSize: 9, fontWeight: '900' },
  team: { flexDirection: 'row', gap: 3 },
  teamSlot: { minWidth: 0, flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#3d5253', borderRadius: 7, padding: 2, backgroundColor: '#172223' },
  teamSlotLight: { borderColor: '#bfd0d0', backgroundColor: '#f4f8f8' },
  slotNumber: { alignSelf: 'flex-start', color: '#8fa2a3', fontSize: 6, fontWeight: '900' },
  teamImage: { width: 31, height: 31 },
  emptySlot: { height: 31, color: '#819596', fontSize: 20 },
  teamName: { maxWidth: '100%', color: '#e5efef', fontSize: 5.8, fontWeight: '900' },
  remove: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#8a3948', borderRadius: 999, backgroundColor: '#3b1720' },
  removeText: { color: '#ff9bad', fontSize: 9, fontWeight: '900' },
  result: { gap: 7, borderWidth: 1, borderRadius: 10, padding: 9 },
  resultClear: { borderColor: '#39c99d', backgroundColor: '#12372e' },
  resultRisky: { borderColor: '#d5a72f', backgroundColor: '#3c3013' },
  resultFailed: { borderColor: '#df5770', backgroundColor: '#39151e' },
  resultTitle: { color: '#fff', fontSize: 12, fontWeight: '900' },
  resultMeta: { color: '#dbe8e8', fontSize: 8.5 },
  error: { color: '#ff9bad', fontSize: 9, fontWeight: '800' },
  optimization: { gap: 3, borderRadius: 8, padding: 7, backgroundColor: 'rgba(139,99,207,.22)' },
  optimizationTitle: { color: '#fff', fontSize: 9.5, fontWeight: '900' },
  contribution: { gap: 3 },
  contributionCopy: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  contributionName: { color: '#fff', fontSize: 8.5, fontWeight: '900' },
  contributionMeta: { color: '#c8d9d9', fontSize: 8 },
  track: { height: 5, overflow: 'hidden', borderRadius: 999, backgroundColor: '#1a2526' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: '#45dbc4' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.72)' },
  picker: { maxHeight: '84%', gap: 8, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 12, paddingBottom: 28, backgroundColor: '#101819' },
  pickerLight: { backgroundColor: '#fff' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { color: '#55ddd4', fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  pickerTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  close: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#435657', borderRadius: 21, backgroundColor: '#202a2b' },
  closeText: { color: '#fff', fontSize: 25 },
  candidateList: { gap: 5, paddingBottom: 20 },
  candidate: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#3d5253', borderRadius: 10, padding: 6, backgroundColor: '#172223' },
  candidateImage: { width: 45, height: 45 },
  candidateName: { color: '#fff', fontSize: 10.5, fontWeight: '900' },
  score: { color: '#54ddd4', fontSize: 11, fontWeight: '900' },
  disabled: { opacity: .38 },
  controlLight: { borderColor: '#bfd0d0', backgroundColor: '#fff' },
  textLight: { color: '#142629' },
  mutedLight: { color: '#657879' },
});
