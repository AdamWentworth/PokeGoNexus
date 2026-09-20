import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RAID_SIMULATION_MODEL_VERSION } from '@pokemongonexus/app-core/raid-rules';
import type {
  NativeCombatEntry,
  NativeRaidBossEntry,
  NativeRaidSettings,
} from '../../features/tools/nativeBattleModels';
import {
  createNativeRaidObservation,
  type NativeRaidCalibrationPredictionSource,
  type NativeRaidObservation,
  type NativeRaidObservationActual,
} from '../../features/tools/nativeRaidCalibration';
import {
  estimateNativeRaidGroup,
  resolveNativeRaidTier,
  simulateNativeRaidLobby,
  type NativeRaidPartyResult,
} from '../../features/tools/nativeRaidPlannerModel';
import { NativeRaidCalibrationPanel } from './NativeRaidCalibrationPanel';
import { NativeRaidPartyBuilder } from './NativeRaidPartyBuilder';
import { NativeRaidSettingsPanel } from './NativeRaidSettingsPanel';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../../observability/nativeUiInteractionTiming';

type Props = {
  assetBaseUrl: string;
  boss: NativeRaidBossEntry;
  dodgeCalibrationApplied?: boolean;
  includeAttackerLevel?: boolean;
  onMethodology: () => void;
  onObservedDodgeRateChange?: (rate: number | null) => void;
  onSettingsChange: (settings: NativeRaidSettings) => void;
  onShadowBossModeChange: (mode: NativeRaidSettings['shadowBossMode']) => void;
  onShadowRaidChange: (enabled: boolean) => void;
  ownerKey: string;
  scores: NativeCombatEntry[];
  selectedBossIsShadowRaid: boolean;
  settings: NativeRaidSettings;
  shadowBossMode: NativeRaidSettings['shadowBossMode'];
  shadowMechanicsEnabled: boolean;
  shadowRaid: boolean;
};

type PartyPrediction = {
  result: NativeRaidPartyResult;
  scenarioKey: string;
  source: Exclude<NativeRaidCalibrationPredictionSource, 'group-estimate'>;
};

const trainerLabel = (count: number) => count > 0 ? `${count} trainer${count === 1 ? '' : 's'}` : '—';

export const NativeRaidBossSetupPanel = ({
  assetBaseUrl,
  boss,
  dodgeCalibrationApplied = false,
  includeAttackerLevel = true,
  onMethodology,
  onObservedDodgeRateChange,
  onSettingsChange,
  onShadowBossModeChange,
  onShadowRaidChange,
  ownerKey,
  scores,
  selectedBossIsShadowRaid,
  settings,
  shadowBossMode,
  shadowMechanicsEnabled,
  shadowRaid,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const [open, setOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const openStartedAtRef = useRef<number | null>(null);
  const [partyPrediction, setPartyPrediction] = useState<PartyPrediction | null>(null);
  const tier = useMemo(() => resolveNativeRaidTier(boss), [boss]);
  const estimate = useMemo(
    () => estimateNativeRaidGroup(scores, boss, settings, tier),
    [boss, scores, settings, tier],
  );
  const shadow = shadowMechanicsEnabled;

  useEffect(() => {
    if (!open || openStartedAtRef.current == null) return;
    markNativeUiPerformanceAfterPaint('raid_setup_painted', openStartedAtRef.current);
    openStartedAtRef.current = null;
  }, [open]);

  const handlePartyResult = (
    result: NativeRaidPartyResult | null,
    source?: PartyPrediction['source'],
    scenarioKey?: string,
  ) => {
    setPartyPrediction(result && source && scenarioKey ? { result, scenarioKey, source } : null);
  };
  const buildObservation = (actual: NativeRaidObservationActual): NativeRaidObservation | null => {
    const exactParty = partyPrediction?.result.trainers.length === actual.trainerCount;
    const prediction = exactParty
      ? partyPrediction.result
      : simulateNativeRaidLobby(scores, boss, settings, actual.trainerCount, tier);
    if (!prediction || !Number.isFinite(prediction.projectedTimeToWinSeconds)) return null;
    return createNativeRaidObservation({
      ownerKey,
      modelVersion: RAID_SIMULATION_MODEL_VERSION,
      catalogVersion: 'unknown',
      bossVariantId: boss.variant.variant_id,
      bossName: boss.name,
      tierKey: tier.key,
      predictionSource: exactParty ? partyPrediction.source : 'group-estimate',
      scenarioKey: exactParty ? partyPrediction.scenarioKey : `group-estimate-${actual.trainerCount}`,
      dodgeCalibrationApplied,
      predicted: {
        clearTimeSeconds: prediction.projectedTimeToWinSeconds,
        faints: prediction.faints,
        relobbies: prediction.relobbies,
        winRate: prediction.distribution.winRate,
        p10ClearTimeSeconds: prediction.distribution.timeToWinSeconds.p10 || null,
        p90ClearTimeSeconds: prediction.distribution.timeToWinSeconds.p90 || null,
      },
      actual,
    });
  };

  return (
    <View style={[styles.panel, light && styles.panelLight]}>
      <Pressable accessibilityLabel="Raid setup" accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => { if (!open) openStartedAtRef.current = Date.now(); setOpen((current) => !current); }} style={styles.toggle}>
        <Text style={styles.toggleIcon}>⚒</Text>
        <View style={styles.toggleCopy}><Text style={[styles.toggleTitle, light && styles.textLight]}>Raid setup</Text><Text numberOfLines={1} style={[styles.toggleMeta, light && styles.mutedLight]}>{tier.label} · team, settings, and raid log</Text></View>
        <Text style={[styles.chevron, light && styles.textLight]}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.content}>
          <View accessibilityLabel="Raid summary" style={[styles.overview, light && styles.subpanelLight]}>
            <View style={styles.overviewHeader}>
              <View style={styles.overviewCopy}><Text style={styles.eyebrow}>{tier.label.toLocaleUpperCase()}</Text><Text style={[styles.note, light && styles.mutedLight]}>{tier.note}</Text></View>
              <View style={styles.hp}><Text style={[styles.hpValue, light && styles.textLight]}>{tier.bossHp.toLocaleString()}</Text><Text style={styles.hpLabel}>BOSS HP</Text></View>
            </View>
            <View style={styles.stats}>
              <View style={[styles.primaryStat, styles.stat]}><Text style={styles.statLabel}>MINIMUM</Text><Text style={styles.statValue}>{trainerLabel(estimate?.minTrainers ?? 0)}</Text></View>
              <View style={styles.stat}><Text style={[styles.statLabel, light && styles.mutedLight]}>COMFORTABLE</Text><Text style={[styles.statValue, light && styles.textLight]}>{trainerLabel(estimate?.comfortableTrainers ?? 0)}</Text></View>
              <View style={styles.stat}><Text style={[styles.statLabel, light && styles.mutedLight]}>TEAM DPS</Text><Text style={[styles.statValue, light && styles.textLight]}>{estimate ? estimate.topTeamDps.toFixed(1) : '—'}</Text></View>
            </View>
            {estimate?.superMega ? <View style={styles.shieldRequirement}><Text style={styles.shieldTitle}>{estimate.superMega.shieldCount} shields</Text><Text style={styles.shieldCopy}>Plan for {estimate.superMega.shieldCount} Trainers with a Mega Pokémon{estimate.superMega.shieldCountSource === 'fallback' ? ' (estimated)' : ''}.</Text></View> : null}
            <View style={[styles.catchRanges, light && styles.catchRangesLight]}>
              <Text style={[styles.catchText, light && styles.mutedLight]}>Catch CP  <Text style={[styles.catchValue, light && styles.textLight]}>{boss.boss.min_unboosted_cp}–{boss.boss.max_unboosted_cp}</Text></Text>
              <Text style={[styles.catchText, light && styles.mutedLight]}>Weather boosted  <Text style={[styles.catchValue, light && styles.textLight]}>{boss.boss.min_boosted_cp}–{boss.boss.max_boosted_cp}</Text></Text>
            </View>
          </View>

          <NativeRaidPartyBuilder assetBaseUrl={assetBaseUrl} boss={boss} onResultChange={handlePartyResult} scores={scores} settings={settings} tier={tier} />

          <NativeRaidCalibrationPanel
            bossName={boss.name}
            buildObservation={buildObservation}
            defaultTrainerCount={partyPrediction?.result.trainers.length ?? Math.max(1, estimate?.minTrainers ?? 1)}
            disabled={scores.length === 0}
            key={ownerKey}
            modelVersion={RAID_SIMULATION_MODEL_VERSION}
            onObservedDodgeRateChange={onObservedDodgeRateChange}
            ownerKey={ownerKey}
          />

          <NativeRaidSettingsPanel
            collapsible
            includeAttackerLevel={includeAttackerLevel}
            includeBossControls
            includeMonteCarloOption
            includeRelobbyControls
            includeShadowControls
            onChange={onSettingsChange}
            onShadowBossModeChange={onShadowBossModeChange}
            onShadowRaidChange={onShadowRaidChange}
            selectedBossIsShadowRaid={selectedBossIsShadowRaid}
            settings={settings}
            shadowBossMode={shadowBossMode}
            shadowMechanicsEnabled={shadowMechanicsEnabled}
            shadowRaid={shadowRaid}
          />

          {shadow ? <View style={styles.shadowNote}><Text style={styles.shadowTitle}>Purified Gem reminder</Text><Text style={styles.shadowCopy}>Each Trainer can use up to 5 Purified Gems. It takes coordinated Gems to subdue an enraged Shadow Raid Boss, so solo attempts should use the enraged estimate.</Text></View> : null}
          <View style={[styles.rulesPanel, light && styles.subpanelLight]}>
            <Pressable accessibilityLabel="Team estimate rules" accessibilityRole="button" accessibilityState={{ expanded: rulesOpen }} onPress={() => setRulesOpen((current) => !current)} style={styles.rulesToggle}>
              <Text style={styles.rulesIcon}>ⓘ</Text><Text style={[styles.rulesTitle, light && styles.textLight]}>Team estimate rules</Text><Text style={[styles.chevron, light && styles.textLight]}>{rulesOpen ? '⌃' : '⌄'}</Text>
            </Pressable>
            {rulesOpen ? <Text style={[styles.rules, light && styles.mutedLight]}>Uses six distinct attackers and at most one Mega or Primal. One caught Pokémon cannot fill two form slots.{estimate?.superMega ? ' Super Mega estimates assume every Trainer brings an actual Mega; Primal Pokémon cannot break shields.' : ''}</Text> : null}
          </View>
          <Pressable accessibilityLabel="Ranking method" accessibilityRole="button" onPress={onMethodology} style={[styles.method, light && styles.subpanelLight]}><Text style={styles.rulesIcon}>ⓘ</Text><Text style={[styles.methodText, light && styles.textLight]}>Method</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: { overflow: 'hidden', borderWidth: 1, borderColor: '#355052', borderRadius: 13, backgroundColor: '#101819' },
  panelLight: { borderColor: '#b9cdcd', backgroundColor: '#fff' },
  toggle: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 },
  toggleIcon: { color: '#55ddd4', fontSize: 21 },
  toggleCopy: { minWidth: 0, flex: 1 },
  toggleTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  toggleMeta: { marginTop: 1, color: '#9db0b1', fontSize: 9.5 },
  chevron: { color: '#eaf5f5', fontSize: 13, fontWeight: '900' },
  content: { gap: 9, borderTopWidth: 1, borderTopColor: '#2b4142', padding: 9 },
  overview: { overflow: 'hidden', borderRadius: 11, backgroundColor: '#172223' },
  subpanelLight: { backgroundColor: '#eef5f4' },
  overviewHeader: { flexDirection: 'row', gap: 8, padding: 10 },
  overviewCopy: { minWidth: 0, flex: 1 },
  eyebrow: { color: '#4ddbd0', fontSize: 8.5, fontWeight: '900', letterSpacing: .8 },
  note: { marginTop: 2, color: '#a1b3b4', fontSize: 9.5, lineHeight: 13 },
  hp: { alignItems: 'flex-end' },
  hpValue: { color: '#fff', fontSize: 16, fontWeight: '900' },
  hpLabel: { color: '#62dcd4', fontSize: 7, fontWeight: '900' },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#2c4243' },
  stat: { flex: 1, gap: 2, padding: 9 },
  primaryStat: { backgroundColor: '#236f68' },
  statLabel: { color: '#a4b5b6', fontSize: 7, fontWeight: '900' },
  statValue: { color: '#fff', fontSize: 12, fontWeight: '900' },
  shieldRequirement: { gap: 2, borderTopWidth: 1, borderTopColor: '#805fb0', padding: 9, backgroundColor: '#2a183a' },
  shieldTitle: { color: '#ead6ff', fontSize: 10, fontWeight: '900' },
  shieldCopy: { color: '#ceb6e7', fontSize: 8.5 },
  catchRanges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, borderTopWidth: 1, borderTopColor: '#2c4243', padding: 9 },
  catchRangesLight: { borderTopColor: '#cedddd' },
  catchText: { color: '#9db0b1', fontSize: 8.5 },
  catchValue: { color: '#fff', fontWeight: '900' },
  shadowNote: { gap: 3, borderWidth: 1, borderColor: '#9569c7', borderRadius: 10, padding: 10, backgroundColor: '#2a183a' },
  shadowTitle: { color: '#ead6ff', fontSize: 11, fontWeight: '900' },
  shadowCopy: { color: '#ceb6e7', fontSize: 9.5, lineHeight: 13 },
  rulesPanel: { overflow: 'hidden', borderRadius: 9, backgroundColor: '#172223' },
  rulesToggle: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 9 },
  rulesIcon: { color: '#50ddd4', fontSize: 14, fontWeight: '900' },
  rulesTitle: { minWidth: 0, flex: 1, color: '#fff', fontSize: 10, fontWeight: '900' },
  rules: { borderTopWidth: 1, borderTopColor: '#2c4243', padding: 9, color: '#8fa2a3', fontSize: 8.5, lineHeight: 12 },
  method: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9, backgroundColor: '#172223' },
  methodText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  textLight: { color: '#142629' },
  mutedLight: { color: '#657879' },
});
