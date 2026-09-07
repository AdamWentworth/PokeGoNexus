import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import { calculateRaidBossStats } from '@pokemongonexus/app-core/raid-combat';
import { getRaidVariantBadge } from '@pokemongonexus/app-core/raid-presentation-model';
import { NativeRaidBossSetupPanel } from '../components/tools/NativeRaidBossSetupPanel';
import { NativeRaidRankingCard } from '../components/tools/NativeRaidRankingCard';
import { NativeRaidSettingsPanel } from '../components/tools/NativeRaidSettingsPanel';
import { NativeRaidTypeFilter } from '../components/tools/NativeRaidTypeFilter';
import { NativeSlidingSegmentedControl } from '../components/NativeSlidingSegmentedControl';
import { useNativeSegmentedWorkspaceMotion } from '../components/useNativeSegmentedWorkspaceMotion';
import {
  buildNativeRaidAttackers,
  buildNativeRaidCounterAttackersAsync,
  buildNativeRaidBosses,
  buildNativeRaidRosterSummary,
  DEFAULT_NATIVE_RAID_SETTINGS,
  type NativeCombatEntry,
  type NativeRaidSettings,
  type NativeRosterScope,
} from '../features/tools/nativeBattleModels';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { NativeUiIcon } from '../components/NativeUiIcon';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type Props = {
  assetBaseUrl: string;
  catalog: BasePokemon[];
  error?: string | null;
  instances?: Record<string, PokemonInstance>;
  isLoading?: boolean;
  onBack: () => void;
  onMethodology: () => void;
  onOpenPokemon: (entry: NativeCombatEntry) => void;
  onRetry: () => void;
  ownerKey?: string;
  signedIn: boolean;
};
type ViewMode = 'rankings' | 'boss';
type RankingMetric = 'cp' | 'dps' | 'edps' | 'er' | 'tdo';
type SortDirection = 'ascending' | 'descending';
const EMPTY_INSTANCES: Record<string, PokemonInstance> = {};
const RAID_VIEW_ITEMS = [
  { label: 'Attacker rankings', value: 'rankings' },
  { label: 'Boss counters', value: 'boss' },
] as const;

const absoluteUri = (base: string, value: string | null) => {
  if (!value) return undefined;
  try { return new URL(value, base).toString(); } catch { return undefined; }
};

export const NativeRaidScreen = ({
  assetBaseUrl,
  catalog,
  error = null,
  instances = EMPTY_INSTANCES,
  isLoading = false,
  onBack: _onBack,
  onMethodology,
  onOpenPokemon: _onOpenPokemon,
  onRetry,
  ownerKey = 'signed-out-device',
  signedIn,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ViewMode>('rankings');
  const [scopeOverride, setScope] = useState<NativeRosterScope | null>(null);
  const [selectedType, setSelectedType] = useState('');
  const [query, setQuery] = useState('');
  const [bossId, setBossId] = useState('');
  const [bossQuery, setBossQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>('edps');
  const [sortDirection, setSortDirection] = useState<SortDirection>('descending');
  const [settings, setSettings] = useState<NativeRaidSettings>(DEFAULT_NATIVE_RAID_SETTINGS);
  const [shadowRaid, setShadowRaid] = useState(false);
  const [shadowBossMode, setShadowBossMode] = useState<NativeRaidSettings['shadowBossMode']>('subdued');
  const [observedDodgeSuccessRate, setObservedDodgeSuccessRate] = useState<number | null>(null);
  const [bossCounterEntries, setBossCounterEntries] = useState<NativeCombatEntry[]>([]);
  const [bossCountersLoading, setBossCountersLoading] = useState(false);
  const workspaceMotion = useNativeSegmentedWorkspaceMotion(view === 'rankings' ? 0 : 1);
  const bossCounterCacheRef = useRef(new Map<string, {
    catalog: BasePokemon[];
    entries: NativeCombatEntry[];
    instances: Record<string, PokemonInstance>;
  }>());
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
  const deferredQuery = useDeferredValue(query);
  const deferredRankingMetric = useDeferredValue(rankingMetric);
  // Cold starts render once while the persisted session is restoring. Derive
  // the correct signed-in default until the user explicitly changes it.
  const effectiveScope = signedIn ? scopeOverride ?? 'owned' : 'catalog';
  const deferredScope = useDeferredValue(effectiveScope);
  const deferredSelectedType = useDeferredValue(selectedType);
  const deferredSortDirection = useDeferredValue(sortDirection);
  const bosses = useMemo(() => buildNativeRaidBosses(catalog), [catalog]);
  const selectedBoss = bosses.find((boss) => boss.id === bossId) ?? bosses[0] ?? null;
  const selectedBossIsShadowRaid = Boolean(selectedBoss?.tier.key.startsWith('shadow'));
  const shadowMechanicsEnabled = selectedBossIsShadowRaid || shadowRaid;
  const effectiveSettings = useMemo<NativeRaidSettings>(() => ({
    ...settings,
    dodgeSuccessRate: observedDodgeSuccessRate ?? settings.dodgeSuccessRate,
    shadowBossMode: shadowMechanicsEnabled ? shadowBossMode : 'normal',
  }), [observedDodgeSuccessRate, settings, shadowBossMode, shadowMechanicsEnabled]);
  const deferredEffectiveSettings = useDeferredValue(effectiveSettings);
  const selectedBossStats = useMemo(() => selectedBoss
    ? calculateRaidBossStats(selectedBoss.variant, selectedBoss.tier, effectiveSettings.shadowBossMode)
    : null, [effectiveSettings.shadowBossMode, selectedBoss]);
  const selectedBossBadge = selectedBoss ? getRaidVariantBadge(selectedBoss.variant) : 'Pokemon';
  const bossSuggestions = useMemo(() => {
    const normalized = bossQuery.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return bosses.filter((boss) => `${boss.name} ${boss.pokemon.pokedex_number}`.toLocaleLowerCase().includes(normalized)).slice(0, 6);
  }, [bossQuery, bosses]);
  const rosterSummary = useMemo(
    () => buildNativeRaidRosterSummary(catalog, instances),
    [catalog, instances],
  );
  const bossCounterKey = `${selectedBoss?.id ?? ''}:${effectiveScope}:${JSON.stringify(effectiveSettings)}`;

  useEffect(() => {
    if (view !== 'boss' || !selectedBoss) return undefined;
    const cached = bossCounterCacheRef.current.get(bossCounterKey);
    if (
      cached?.catalog === catalog
      && cached.instances === instances
    ) return undefined;
    let cancelled = false;
    setBossCounterEntries([]);
    setBossCountersLoading(true);
    const timer = setTimeout(() => {
      if (cancelled) return;
      void buildNativeRaidCounterAttackersAsync({
        boss: selectedBoss,
        catalog,
        instances,
        scope: effectiveScope,
        settings: effectiveSettings,
        shouldCancel: () => cancelled,
      }).then((entries) => {
        if (!cancelled) {
          bossCounterCacheRef.current.delete(bossCounterKey);
          bossCounterCacheRef.current.set(bossCounterKey, {
            catalog,
            entries,
            instances,
          });
          while (bossCounterCacheRef.current.size > 8) {
            const oldestKey = bossCounterCacheRef.current.keys().next().value;
            if (oldestKey == null) break;
            bossCounterCacheRef.current.delete(oldestKey);
          }
          setBossCounterEntries(entries);
          setBossCountersLoading(false);
        }
      }).catch(() => {
        if (!cancelled) {
          setBossCounterEntries([]);
          setBossCountersLoading(false);
        }
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bossCounterKey, catalog, effectiveScope, effectiveSettings, instances, selectedBoss, view]);

  const rankings = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
    const rows = (view === 'boss'
      ? [...bossCounterEntries]
      : buildNativeRaidAttackers({
          catalog,
          instances,
          requiredType: deferredSelectedType,
          scope: signedIn ? deferredScope : 'catalog',
          settings: deferredEffectiveSettings,
        })).filter((entry) => !normalizedQuery || [
      entry.name,
      entry.fastMove?.name,
      entry.chargedMove?.name,
      ...entry.types,
    ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)));
    if (view === 'rankings') {
      const metricValue = (entry: typeof rows[number]) => {
        if (deferredRankingMetric === 'cp') return entry.cp;
        if (deferredRankingMetric === 'dps') return entry.dps;
        if (deferredRankingMetric === 'tdo') return entry.tdo;
        if (deferredRankingMetric === 'er') return entry.er;
        return entry.score;
      };
      rows.sort((left, right) => (
        (metricValue(right) - metricValue(left)) * (deferredSortDirection === 'descending' ? 1 : -1)
        || left.name.localeCompare(right.name)
      ));
    }
    return rows.slice(0, 30);
  }, [
    bossCounterEntries,
    catalog,
    deferredEffectiveSettings,
    deferredQuery,
    deferredRankingMetric,
    deferredScope,
    deferredSelectedType,
    deferredSortDirection,
    instances,
    signedIn,
    view,
  ]);
  const customPartyScores = useMemo(() => {
    const seen = new Set<string>();
    return bossCounterEntries.filter((entry) => {
      const key = entry.variantId ?? entry.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [bossCounterEntries]);

  useEffect(() => {
    if (view === 'boss') finishPerformance('raid_boss_mode_painted');
  }, [finishPerformance, view]);
  useEffect(() => {
    if (selectedType === deferredSelectedType) finishPerformance('raid_type_result_painted');
  }, [deferredSelectedType, finishPerformance, rankings.length, selectedType]);
  useEffect(() => {
    if (effectiveScope === deferredScope) finishPerformance('raid_roster_result_painted');
  }, [deferredScope, effectiveScope, finishPerformance, rankings.length]);
  useEffect(() => {
    if (query === deferredQuery) finishPerformance('raid_search_result_painted');
  }, [deferredQuery, finishPerformance, query, rankings.length]);
  useEffect(() => {
    if (rankingMetric === deferredRankingMetric && sortDirection === deferredSortDirection) {
      finishPerformance('raid_sort_result_painted');
    }
  }, [deferredRankingMetric, deferredSortDirection, finishPerformance, rankingMetric, rankings.length, sortDirection]);
  useEffect(() => {
    if (!bossCountersLoading && deferredEffectiveSettings === effectiveSettings) {
      finishPerformance('raid_moveset_result_painted');
      finishPerformance('raid_modifier_result_painted');
      finishPerformance('raid_boss_selected_result_painted');
    }
  }, [bossCounterEntries.length, bossCountersLoading, deferredEffectiveSettings, effectiveSettings, finishPerformance, rankings.length]);
  useEffect(() => {
    if (bossQuery.trim() && bossSuggestions.length >= 0) finishPerformance('raid_boss_search_result_painted');
  }, [bossQuery, bossSuggestions.length, finishPerformance]);
  useEffect(() => {
    if (settingsOpen) finishPerformance('raid_settings_painted');
  }, [finishPerformance, settingsOpen]);
  useEffect(() => {
    if (expandedIds.size > 0) finishPerformance('raid_row_detail_painted');
  }, [expandedIds, finishPerformance]);

  const switchView = (next: ViewMode) => {
    if (next === 'boss') beginPerformance('raid_boss_mode_painted');
    if (next === 'boss') {
      const cached = bossCounterCacheRef.current.get(bossCounterKey);
      if (
        cached?.catalog === catalog
        && cached.instances === instances
      ) {
        setBossCounterEntries(cached.entries);
        setBossCountersLoading(false);
      } else {
        setBossCounterEntries([]);
        setBossCountersLoading(true);
      }
    } else {
      setBossCountersLoading(false);
    }
    setView(next);
    setExpandedIds(new Set());
  };
  const selectBoss = (id: string) => {
    beginPerformance('raid_boss_selected_result_painted');
    setBossId(id);
    setBossQuery('');
    setExpandedIds(new Set());
  };
  const selectRankingMetric = (metric: RankingMetric) => {
    beginPerformance('raid_sort_result_painted');
    if (rankingMetric === metric) {
      setSortDirection((current) => current === 'descending' ? 'ascending' : 'descending');
      return;
    }
    setRankingMetric(metric);
    setSortDirection('descending');
  };
  const changeSettings = (next: NativeRaidSettings) => {
    beginPerformance('raid_modifier_result_painted');
    setSettings(next);
  };
  const changeMovesetDetail = (bestOnly: boolean) => {
    if (settings.bestOnly === bestOnly) return;
    beginPerformance('raid_moveset_result_painted');
    setSettings((current) => ({ ...current, bestOnly }));
  };

  const productHeader = (
    <View style={styles.productHeader}>
      <Image fadeDuration={0}
        accessibilityElementsHidden
        resizeMode="contain"
        source={{ uri: absoluteUri(assetBaseUrl, '/images/btn_raid.png') }}
        style={styles.productIcon}
      />
      <View style={styles.headerCopy}>
        <Text style={[styles.eyebrow, light && styles.accentLight]}>BATTLE PLANNING</Text>
        <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>Raid Planner</Text>
        <Text style={[styles.lead, light && styles.mutedLight]}>Rank attackers, prepare counters, and build teams for current raid bosses.</Text>
      </View>
    </View>
  );

  const modeTabs = (
    <NativeSlidingSegmentedControl
      accessibilityLabel="Raid planner mode"
      buttonStyle={styles.modeButton}
      indicatorStyle={styles.modeIndicator}
      indicatorTestID="native-raid-view-indicator"
      items={RAID_VIEW_ITEMS}
      onChange={switchView}
      renderItem={(item, selected) => <>
        <NativeUiIcon color={selected ? '#06120f' : light ? '#172124' : '#ecf5f4'} name={item.value === 'rankings' ? 'chart' : 'target'} size={14} />
        <Text style={[styles.modeText, light && styles.textLight, selected && styles.modeTextActive]}>{item.label}</Text>
      </>}
      style={[styles.modeTabs, light && styles.panelLight]}
      testID="native-raid-view-switcher"
      value={view}
    />
  );

  const roster = (
    <View accessibilityLabel="Raid attacker roster" style={[styles.roster, light && styles.panelLight]}>
      {([['catalog', 'ALL POKÉMON'], ['owned', `MY POKÉMON${effectiveScope === 'owned' ? `   ${isLoading ? '…' : rosterSummary.eligibleCount}` : ''}`]] as const).map(([value, label]) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: value === 'owned' && !signedIn, selected: effectiveScope === value }}
          disabled={value === 'owned' && !signedIn}
          key={value}
          onPress={() => { if (value === 'catalog') beginPerformance('raid_roster_result_painted'); setScope(value); }}
          style={[
            styles.rosterButton,
            light && styles.controlLight,
            effectiveScope === value && styles.rosterActive,
            value === 'owned' && !signedIn && styles.disabled,
          ]}
        >
          <View style={styles.iconLabelRow}>
            <NativeUiIcon color={effectiveScope === value ? '#071410' : light ? '#172124' : '#edf6f5'} name={value === 'catalog' ? 'catalog' : 'trainers'} size={14} />
            <Text style={[styles.rosterText, light && styles.textLight, effectiveScope === value && styles.rosterTextActive]}>{label}</Text>
          </View>
        </Pressable>
      ))}
      {effectiveScope === 'owned' ? (
        <Text accessibilityLiveRegion="polite" style={[styles.rosterDescription, light && styles.mutedLight]}>
          {isLoading
            ? 'Loading your raid roster'
            : [
              `${rosterSummary.eligibleCount} raid-ready entries from ${rosterSummary.caughtCount} caught.`,
              "Uses each copy's current level, IVs, CP, and recorded moves.",
              rosterSummary.projectedFormCount > 0 ? `${rosterSummary.projectedFormCount} available fusion, crowned, or Mega form entries included.` : '',
              rosterSummary.incompleteEntryCount > 0 ? `${rosterSummary.incompleteEntryCount} caught entries need complete battle details before ranking.` : '',
              rosterSummary.hiddenPowerEstimatedCount > 0 ? `${rosterSummary.hiddenPowerEstimatedCount} Hidden Power rolls use a marked type estimate.` : '',
              rosterSummary.unmappedCount > 0 ? `${rosterSummary.unmappedCount} could not be matched to the current catalog.` : '',
            ].filter(Boolean).join(' ')}
        </Text>
      ) : null}
    </View>
  );

  const toolbar = (
    <View style={styles.toolbar}>
      <Text style={[styles.fieldLabel, light && styles.mutedLight]}>{view === 'boss' ? 'COUNTER SEARCH' : 'ATTACKER SEARCH'}</Text>
      <TextInput
        accessibilityLabel={view === 'boss' ? 'Search raid counters' : 'Search raid rankings'}
        onChangeText={(value) => { beginPerformance('raid_search_result_painted'); setQuery(value); }}
        placeholder="Pokémon, type, or move"
        placeholderTextColor={light ? '#708183' : '#809294'}
        style={[styles.search, light && styles.inputLight]}
        value={query}
      />
      <View style={styles.toolbarActions}>
        <View accessibilityLabel="Result detail" style={[styles.movesetTabs, light && styles.controlLight]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: settings.bestOnly }}
            onPress={() => changeMovesetDetail(true)}
            style={[styles.movesetButton, settings.bestOnly && styles.movesetActive]}
          >
            <Text style={[styles.movesetText, light && styles.textLight, settings.bestOnly && styles.movesetTextActive]}>BEST MOVESET</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !settings.bestOnly }}
            onPress={() => changeMovesetDetail(false)}
            style={[styles.movesetButton, !settings.bestOnly && styles.movesetActive]}
          >
            <Text style={[styles.movesetText, light && styles.textLight, !settings.bestOnly && styles.movesetTextActive]}>ALL MOVESETS</Text>
          </Pressable>
        </View>
        {view === 'rankings' ? <Pressable
          accessibilityLabel="Ranking settings"
          accessibilityRole="button"
          accessibilityState={{ expanded: settingsOpen }}
          onPress={() => { beginPerformance('raid_settings_painted'); setSettingsOpen((current) => !current); }}
          style={[styles.settingsButton, light && styles.controlLight, settingsOpen && styles.settingsActive]}
          testID="raid-ranking-settings"
        >
          <View style={styles.iconLabelRow}>
            <NativeUiIcon color={light ? '#172124' : '#edf6f5'} name="filters" size={14} />
            <Text style={[styles.settingsText, light && styles.textLight]}>SETTINGS {settingsOpen ? '⌃' : '⌄'}</Text>
          </View>
        </Pressable> : null}
      </View>
      {view === 'rankings' && settingsOpen ? (
        <NativeRaidSettingsPanel
          includeAttackerLevel={effectiveScope !== 'owned'}
          includeBossControls={Boolean(selectedType)}
          includeRelobbyControls
          onChange={changeSettings}
          settings={settings}
        />
      ) : null}
      {view === 'rankings' ? (
        <View accessibilityLabel="Ranking metric" style={[styles.metricSort, light && styles.controlLight]}>
          {([['edps', 'eDPS'], ['dps', 'DPS'], ['tdo', 'TDO'], ['er', 'ER'], ['cp', 'CP']] as const).map(([metric, label]) => {
            const selected = rankingMetric === metric;
            return (
              <Pressable
                accessibilityLabel={`Sort by ${label}${selected ? `, currently ${sortDirection}` : ''}`}
                accessibilityRole="button"
                key={metric}
                onPress={() => selectRankingMetric(metric)}
                style={[styles.metricSortButton, selected && styles.metricSortActive]}
              >
                <Text style={[styles.metricSortText, light && styles.textLight, selected && styles.metricSortTextActive]}>{label}</Text>
                <Text style={[styles.metricSortIcon, selected && styles.metricSortTextActive]}>{selected ? sortDirection === 'descending' ? '⌄' : '⌃' : '↕'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  const bossPicker = view === 'boss' ? (
    <View style={styles.bossSection}>
      {selectedBoss ? (
        <View style={[styles.selectedBoss, light && styles.panelLight]}>
          <Image fadeDuration={0} resizeMode="contain" source={{ uri: absoluteUri(assetBaseUrl, selectedBoss.imageUri) }} style={styles.selectedBossImage} />
          <View style={styles.bossSummaryCopy}>
            <Text style={[styles.eyebrow, light && styles.accentLight]}>RAID BOSS</Text>
            <Text style={[styles.bossTitle, light && styles.textLight]}>{selectedBoss.name}</Text>
            <View style={styles.bossMetaRow}>{selectedBossBadge !== 'Pokemon' ? <Text style={styles.bossBadge}>{selectedBossBadge}</Text> : null}<Text style={[styles.bossMeta, light && styles.mutedLight]}>{selectedBossStats ? `CP ${selectedBossStats.bossCp.toLocaleString()} · ` : ''}{selectedBoss.variant.type1_name}{selectedBoss.variant.type2_name ? ` / ${selectedBoss.variant.type2_name}` : ''}</Text></View>
          </View>
        </View>
      ) : null}
      <TextInput
        accessibilityLabel="Find boss"
        onChangeText={(value) => { beginPerformance('raid_boss_search_result_painted'); setBossQuery(value); }}
        onSubmitEditing={() => { if (bossSuggestions[0]) selectBoss(bossSuggestions[0].id); }}
        placeholder="Search raid bosses"
        placeholderTextColor={light ? '#708183' : '#809294'}
        returnKeyType="search"
        style={[styles.search, styles.bossSearch, light && styles.inputLight]}
        value={bossQuery}
      />
      {bossQuery.trim() ? (
        <View accessibilityLabel="Raid boss suggestions" style={[styles.bossSuggestions, light && styles.panelLight]}>
          {bossSuggestions.length > 0 ? bossSuggestions.map((boss) => (
            <Pressable
              accessibilityLabel={`Select ${boss.name} raid boss`}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedBoss?.id === boss.id }}
              key={boss.id}
              onPress={() => selectBoss(boss.id)}
              style={[styles.bossSuggestion, selectedBoss?.id === boss.id && styles.bossSuggestionActive]}
            >
              <Image fadeDuration={0} resizeMode="contain" source={{ uri: absoluteUri(assetBaseUrl, boss.imageUri) }} style={styles.bossSuggestionImage} />
              <Text numberOfLines={1} style={[styles.bossSuggestionName, light && styles.textLight]}>{boss.name}</Text>
              <Text style={[styles.bossSuggestionNumber, light && styles.mutedLight]}>#{String(boss.pokemon.pokedex_number).padStart(4, '0')}</Text>
            </Pressable>
          )) : <Text style={[styles.noBosses, light && styles.mutedLight]}>No matching raid boss found.</Text>}
        </View>
      ) : null}
    </View>
  ) : null;

  const heading = view === 'boss'
    ? `Best counters${selectedBoss ? ` vs ${selectedBoss.name}` : ''}`
    : selectedType
      ? `${effectiveScope === 'owned' ? 'Your top' : 'Top'} ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} raid attackers`
      : effectiveScope === 'owned'
        ? 'Your top raid attackers'
        : 'Top raid attackers';

  const header = (
    <View style={styles.headerStack}>
      <Animated.View style={[styles.stationaryHeader, workspaceMotion.stationaryStyle]}>
        {productHeader}
        {modeTabs}
      </Animated.View>
      {roster}
      {view === 'rankings' ? <NativeRaidTypeFilter assetBaseUrl={assetBaseUrl} onChange={(type) => { beginPerformance('raid_type_result_painted'); setSelectedType(type); }} selectedType={selectedType} /> : bossPicker}
      <View style={styles.leaderboardHeading}>
        <Text style={[styles.resultsTitle, light && styles.textLight]}>{heading}</Text>
        <Pressable accessibilityLabel="How raid rankings work" accessibilityRole="button" onPress={onMethodology} style={[styles.info, light && styles.controlLight]}>
          <Text style={[styles.infoText, light && styles.accentLight]}>ⓘ</Text>
        </Pressable>
      </View>
      {toolbar}
      {view === 'boss' && selectedBoss ? <NativeRaidBossSetupPanel assetBaseUrl={assetBaseUrl} boss={selectedBoss} dodgeCalibrationApplied={observedDodgeSuccessRate != null} includeAttackerLevel={effectiveScope !== 'owned'} key={selectedBoss.id} onMethodology={onMethodology} onObservedDodgeRateChange={setObservedDodgeSuccessRate} onSettingsChange={changeSettings} onShadowBossModeChange={(mode) => { beginPerformance('raid_modifier_result_painted'); setShadowBossMode(mode); }} onShadowRaidChange={(enabled) => { beginPerformance('raid_modifier_result_painted'); setShadowRaid(enabled); }} ownerKey={ownerKey} scores={customPartyScores} selectedBossIsShadowRaid={selectedBossIsShadowRaid} settings={effectiveSettings} shadowBossMode={shadowBossMode} shadowMechanicsEnabled={shadowMechanicsEnabled} shadowRaid={shadowRaid} /> : null}
      {isLoading || bossCountersLoading ? <View accessibilityRole="progressbar" style={styles.state}><ActivityIndicator color="#2fd6d0" /><Text style={[styles.stateCopy, light && styles.mutedLight]}>{bossCountersLoading ? 'Modeling raid timelines…' : 'Loading battle data…'}</Text></View> : null}
      {error ? (
        <View accessibilityRole="alert" style={styles.error}>
          <Text style={styles.errorTitle}>Raid Planner unavailable</Text>
          <Text style={styles.errorCopy}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      ) : null}
    </View>
  );

  const emptyPresentation = view === 'boss'
    ? !selectedBoss
      ? {
          title: 'No raid boss data yet.',
          copy: 'Overall and type leaderboards can still rank attackers while boss data loads.',
        }
      : bossCounterEntries.length > 0
        ? { title: 'No counters match the current filters.', copy: '' }
        : effectiveScope === 'owned' && rosterSummary.eligibleCount === 0
          ? {
              title: 'No caught raid-ready Pokémon',
              copy: `Mark Pokémon as caught to build a personalized counter team for ${selectedBoss.name}.`,
            }
          : {
              title: 'No compatible raid counters',
              copy: 'The selected roster has no legal movesets for this battle.',
            }
    : effectiveScope === 'owned'
      ? selectedType
        ? {
            title: 'No compatible attackers',
            copy: `None of your caught Pokémon have a usable ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} moveset for this ranking.`,
          }
        : {
            title: 'No compatible attackers',
            copy: 'No caught attackers match the current filters. Add level, IV, and move details to improve personalized rankings.',
          }
      : selectedType
        ? {
            title: 'No compatible attackers',
            copy: `No eligible attackers have a ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} fast or charged move.`,
          }
        : { title: 'No compatible attackers', copy: 'No attackers match the current filters.' };

  return (
    <View style={[styles.root, light && styles.rootLight]} testID="native-raid-screen">
      <Animated.View style={[styles.workspaceViewport, workspaceMotion.contentStyle]} testID="native-raid-workspace-motion">
        <FlatList
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 4 + insets.top, paddingBottom: 96 + insets.bottom }}
          data={rankings}
          keyExtractor={(entry) => entry.id}
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled
          ListHeaderComponent={header}
          ListEmptyComponent={!isLoading && !bossCountersLoading && !error ? (
            <View style={[styles.empty, light && styles.emptyLight]}>
              <Text style={[styles.emptyTitle, light && styles.textLight]}>{emptyPresentation.title}</Text>
              {emptyPresentation.copy ? <Text style={[styles.stateCopy, light && styles.mutedLight]}>{emptyPresentation.copy}</Text> : null}
            </View>
          ) : null}
          renderItem={({ item, index }) => (
            <NativeRaidRankingCard
              assetBaseUrl={assetBaseUrl}
              entry={item}
              attackerLevel={settings.attackerLevel}
              expanded={expandedIds.has(item.id)}
              onToggle={() => {
                beginPerformance('raid_row_detail_painted');
                setExpandedIds((current) => {
                  const next = new Set(current);
                  if (next.has(item.id)) next.delete(item.id);
                  else next.add(item.id);
                  return next;
                });
              }}
              primaryMetric={view === 'rankings' ? rankingMetric : 'dps'}
              rank={index + 1}
            />
          )}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#071011' },
  workspaceViewport: { flex: 1, minHeight: 0 },
  stationaryHeader: { gap: 8 },
  rootLight: { backgroundColor: '#f8fff9' },
  textLight: { color: '#142629' },
  mutedLight: { color: '#617476' },
  accentLight: { color: '#08766b' },
  panelLight: { borderColor: '#b8cccc', backgroundColor: '#fff' },
  controlLight: { borderColor: '#b8c8c8', backgroundColor: '#fff' },
  inputLight: { borderColor: '#b8c8c8', color: '#142629', backgroundColor: '#fff' },
  headerStack: { gap: 8, marginBottom: 8 },
  productHeader: { minHeight: 114, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#294749', paddingHorizontal: 3, paddingBottom: 9 },
  back: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#435758', borderRadius: 18, backgroundColor: '#172122' },
  backText: { marginTop: -4, color: '#fff', fontSize: 34 },
  productIcon: { width: 48, height: 48, transform: [{ translateY: -7 }] },
  headerCopy: { minWidth: 0, flex: 1, transform: [{ translateY: -7 }] },
  eyebrow: { color: '#69ded7', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#fff', fontSize: 27, fontWeight: '900', letterSpacing: -.6 },
  lead: { marginTop: 2, color: '#a9bbbb', fontSize: 11.5, lineHeight: 16 },
  modeTabs: { borderColor: '#355153', borderRadius: 14, backgroundColor: '#101819' },
  modeButton: { minHeight: 34, gap: 5, borderRadius: 10 },
  modeIndicator: { borderRadius: 10, backgroundColor: '#2fd6d0' },
  modeIcon: { color: '#d5e5e5', fontSize: 11, fontWeight: '900' },
  modeText: { color: '#d5e5e5', fontSize: 10.5, fontWeight: '900' },
  modeTextActive: { color: '#071214' },
  roster: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, borderWidth: 1, borderColor: '#355153', borderRadius: 13, padding: 5, backgroundColor: '#101819' },
  rosterButton: { flex: 1, minHeight: 37, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#435758', borderRadius: 999, backgroundColor: '#1b2526' },
  rosterActive: { borderColor: '#2fd6d0', backgroundColor: '#45dbc4' },
  rosterText: { color: '#e6f1f1', fontSize: 9.5, fontWeight: '900' },
  iconLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  rosterTextActive: { color: '#071214' },
  rosterDescription: { width: '100%', paddingHorizontal: 7, paddingVertical: 4, color: '#a3b5b6', fontSize: 9.5, lineHeight: 14, textAlign: 'center' },
  disabled: { opacity: .45 },
  toolbar: { gap: 7 },
  fieldLabel: { color: '#a3b5b6', fontSize: 9, fontWeight: '900', letterSpacing: .8 },
  search: { minHeight: 39, borderWidth: 1, borderColor: '#455a5c', borderRadius: 999, paddingHorizontal: 14, color: '#fff', backgroundColor: '#101819', fontSize: 13, fontWeight: '700' },
  toolbarActions: { flexDirection: 'row', gap: 6 },
  metricSort: { minHeight: 43, flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: '#355052', borderRadius: 11, padding: 4, backgroundColor: '#101819' },
  metricSortButton: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 8 },
  metricSortActive: { backgroundColor: '#42d5c6' },
  metricSortText: { color: '#b9c9ca', fontSize: 8, fontWeight: '900' },
  metricSortIcon: { color: '#809294', fontSize: 8, fontWeight: '900' },
  metricSortTextActive: { color: '#06191a' },
  movesetTabs: { minWidth: 0, flex: 1, flexDirection: 'row', borderWidth: 1, borderColor: '#3b5052', borderRadius: 999, padding: 3, backgroundColor: '#101819' },
  movesetButton: { minWidth: 0, flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingHorizontal: 4 },
  movesetActive: { backgroundColor: '#45dbc4' },
  movesetText: { color: '#d5e5e5', fontSize: 8.5, fontWeight: '900' },
  movesetTextActive: { color: '#071214' },
  settingsButton: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: '#455a5c', borderRadius: 999, paddingHorizontal: 10, backgroundColor: '#1a2324' },
  settingsActive: { borderColor: '#2fd6d0' },
  settingsText: { color: '#e2eeee', fontSize: 8.5, fontWeight: '900' },
  leaderboardHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 3 },
  resultsTitle: { minWidth: 0, flex: 1, color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '900', textAlign: 'center' },
  info: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3e5557', borderRadius: 22, backgroundColor: '#162122' },
  infoText: { color: '#52ded5', fontSize: 16, fontWeight: '900' },
  bossSection: { gap: 7 },
  selectedBoss: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#355153', borderRadius: 13, padding: 9, backgroundColor: '#101819' },
  selectedBossImage: { width: 72, height: 72 },
  bossSummaryCopy: { minWidth: 0, flex: 1 },
  bossTitle: { color: '#fff', fontSize: 19, fontWeight: '900' },
  bossMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 3 },
  bossBadge: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden', color: '#f0dcff', backgroundColor: '#69409b', fontSize: 7.5, fontWeight: '900' },
  bossMeta: { color: '#9badae', fontSize: 9.5, fontWeight: '800' },
  bossSearch: { marginTop: 0 },
  bossSuggestions: { gap: 3, borderWidth: 1, borderColor: '#355153', borderRadius: 12, padding: 5, backgroundColor: '#101819' },
  bossSuggestion: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 9, paddingHorizontal: 7 },
  bossSuggestionActive: { backgroundColor: '#174d47' },
  bossSuggestionImage: { width: 40, height: 40 },
  bossSuggestionName: { minWidth: 0, flex: 1, color: '#fff', fontSize: 11, fontWeight: '900' },
  bossSuggestionNumber: { color: '#95a8a9', fontSize: 8.5, fontWeight: '800' },
  noBosses: { padding: 10, color: '#9badae', fontSize: 10, textAlign: 'center' },
  state: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  stateCopy: { color: '#a3b5b6', fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  error: { gap: 7, borderWidth: 1, borderColor: '#df5770', borderRadius: 12, padding: 13, backgroundColor: '#39151e' },
  errorTitle: { color: '#ffd8df', fontSize: 15, fontWeight: '900' },
  errorCopy: { color: '#ffb8c4', fontSize: 12 },
  retry: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', borderRadius: 999, paddingHorizontal: 14, backgroundColor: '#df5770' },
  retryText: { color: '#fff', fontWeight: '900' },
  empty: { alignItems: 'center', gap: 5, marginTop: 3, borderWidth: 1, borderStyle: 'dashed', borderColor: '#3d5556', borderRadius: 12, padding: 25, backgroundColor: '#101819' },
  emptyLight: { borderColor: '#a9c2c2', backgroundColor: '#fff' },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
