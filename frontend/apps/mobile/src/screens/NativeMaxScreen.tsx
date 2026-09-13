import { NativeRosterScopeControl } from '../components/tools/NativeRosterScopeControl';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Image as ExpoImage } from 'expo-image';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import {
  getDefaultMaxBattleTier,
  type MaxBattleTier,
} from '@pokemongonexus/app-core/max-battle-simulation';
import { NativeCombatRankingCard } from '../components/NativeCombatRankingCard';
import { NativeSlidingSegmentedControl } from '../components/NativeSlidingSegmentedControl';
import { useNativeSegmentedWorkspaceMotion } from '../components/useNativeSegmentedWorkspaceMotion';
import { NativeMaxBattleSimulator } from '../components/tools/NativeMaxBattleSimulator';
import {
  buildNativeMaxRankings,
  buildNativeMaxRosterSummary,
  buildNativeMaxRoleCandidates,
  buildNativeMaxVariants,
  NATIVE_BATTLE_TYPES,
  type NativeMaxRole,
  type NativeCombatEntry,
  type NativeRosterScope,
} from '../features/tools/nativeBattleModels';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { NativeUiIcon } from '../components/NativeUiIcon';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

export type NativeMaxRoutePatch = Partial<{
  bossId: string;
  difficulty: MaxBattleTier | null;
  role: NativeMaxRole;
  scope: NativeRosterScope;
  selectedType: string;
  trainerCount: number | null;
  view: MaxView;
}>;

type Props = {
  assetBaseUrl: string;
  catalog: BasePokemon[];
  error?: string | null;
  instances?: Record<string, PokemonInstance>;
  initialBossId?: string;
  initialDifficulty?: MaxBattleTier | null;
  initialRole?: NativeMaxRole;
  initialScope?: NativeRosterScope;
  initialSelectedType?: string;
  initialTrainerCount?: number | null;
  initialView?: MaxView;
  isLoading?: boolean;
  onBack: () => void;
  onOpenPokemon: (entry: NativeCombatEntry) => void;
  onRetry: () => void;
  onRouteStateChange?: (patch: NativeMaxRoutePatch) => void;
  signedIn: boolean;
};
type MaxView = 'rankings' | 'bosses';

const EMPTY_MAX_ROLE_CANDIDATES = { damage: [], healing: [], tank: [] };
const MAX_RESULTS_PAGE_SIZE = 18;
const MAX_BOSS_RESULTS_INITIAL_SIZE = 3;
const MAX_BOSS_RESULTS_PAGE_SIZE = 9;
const MAX_VIEW_ITEMS = [
  { label: 'Max rankings', value: 'rankings' },
  { label: 'Boss teams', value: 'bosses' },
] as const;

const absoluteUri = (base: string, value?: string | null) => {
  if (!value) return undefined;
  try { return new URL(value, base).toString(); } catch { return undefined; }
};

const roleHeading = (role: NativeMaxRole, selectedType: string): string => {
  const type = selectedType
    ? `${selectedType.charAt(0).toUpperCase()}${selectedType.slice(1)}`
    : '';
  if (type && role === 'tank') return `Top tanks vs ${type}`;
  if (type && role === 'healing') return `Top healers vs ${type}`;
  if (role === 'damage') return `Top ${type ? `${type} ` : ''}damage dealers`;
  if (role === 'tank') return 'Top tanks';
  return 'Top healers';
};

const roleMetric = (role: NativeMaxRole): string => {
  if (role === 'damage') return 'Max output';
  if (role === 'tank') return 'Bulk';
  return 'Team sustain';
};

const NativeMaxTypeGrid = memo(function NativeMaxTypeGrid({
  assetBaseUrl,
  light,
  onSelect,
  selectedType,
}: {
  assetBaseUrl: string;
  light: boolean;
  onSelect: (type: string) => void;
  selectedType: string;
}) {
  return (
    <View style={styles.typeGrid}>
      {NATIVE_BATTLE_TYPES.map((type) => {
        const selected = selectedType === type;
        return (
          <Pressable
            accessibilityLabel={type}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={type}
            onPress={() => onSelect(type)}
            style={[styles.typeButton, light && styles.typeButtonLight, selected && styles.typeActive]}
          >
            <ExpoImage cachePolicy="memory-disk" contentFit="contain" source={{ uri: absoluteUri(assetBaseUrl, `/images/types/${type}.png`) }} style={styles.typeIcon} transition={0} />
          </Pressable>
        );
      })}
    </View>
  );
});

export const NativeMaxScreen = ({
  assetBaseUrl,
  catalog,
  error = null,
  instances = {},
  initialBossId = '',
  initialDifficulty = null,
  initialRole = 'damage',
  initialScope,
  initialSelectedType = '',
  initialTrainerCount = null,
  initialView = 'rankings',
  isLoading = false,
  onBack: _onBack,
  onOpenPokemon,
  onRetry,
  onRouteStateChange,
  signedIn,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<MaxView>(initialView);
  const [scopeOverride, setScope] = useState<NativeRosterScope | null>(null);
  const [role, setRole] = useState<NativeMaxRole>(initialRole);
  const [selectedType, setSelectedType] = useState(initialSelectedType);
  const [query, setQuery] = useState('');
  const [bossId, setBossId] = useState(initialBossId);
  const [bossQuery, setBossQuery] = useState('');
  const [methodOpen, setMethodOpen] = useState(false);
  const workspaceMotion = useNativeSegmentedWorkspaceMotion(view === 'rankings' ? 0 : 1);
  const [pagination, setPagination] = useState({ key: '', limit: MAX_RESULTS_PAGE_SIZE });
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

  // Canonical Max eligibility also includes special attackers such as crowned
  // Zacian/Zamazenta and Eternatus; they are not guaranteed to carry max[].
  const bossVariants = useMemo(() => buildNativeMaxVariants(catalog), [catalog]);
  const selectedBoss = bossVariants.find((boss) => boss.variant_id === bossId)
    ?? bossVariants[0]
    ?? null;
  // Session restoration is asynchronous on a cold app start. Derive the
  // route default until the user explicitly overrides it, so restoration does
  // not require a second cascading state commit.
  const effectiveScope = signedIn
    ? scopeOverride ?? initialScope ?? 'owned'
    : 'catalog';
  const deferredBossQuery = useDeferredValue(bossQuery);
  const deferredQuery = useDeferredValue(query);
  const rosterSummary = useMemo(
    () => buildNativeMaxRosterSummary(catalog, instances),
    [catalog, instances],
  );
  const candidates = useMemo(
    () => view === 'bosses' && selectedBoss
      ? buildNativeMaxRoleCandidates({
          bossVariant: selectedBoss,
          catalog,
          instances,
          scope: effectiveScope,
        })
      : EMPTY_MAX_ROLE_CANDIDATES,
    [catalog, effectiveScope, instances, selectedBoss, view],
  );
  const rankings = useMemo(() => {
    const normalized = deferredQuery.trim().toLocaleLowerCase();
    const entries = buildNativeMaxRankings({
      bossVariant: view === 'bosses' ? selectedBoss : null,
      catalog,
      instances,
      role,
      scope: effectiveScope,
      selectedType: view === 'rankings' ? selectedType : '',
    });
    return entries.filter((entry) => !normalized || [
      entry.name,
      entry.fastMove?.name,
      entry.chargedMove?.name,
      entry.maxRanking?.maxMoveName,
      entry.maxRanking?.maxMoveType,
      ...entry.types,
    ].some((value) => value?.toLocaleLowerCase().includes(normalized)));
  }, [catalog, deferredQuery, effectiveScope, instances, role, selectedBoss, selectedType, view]);
  const paginationKey = [bossId, query, role, effectiveScope, selectedType, view].join('\u0000');
  const initialVisibleLimit = view === 'bosses'
    ? MAX_BOSS_RESULTS_INITIAL_SIZE
    : MAX_RESULTS_PAGE_SIZE;
  const resultsPageSize = view === 'bosses'
    ? MAX_BOSS_RESULTS_PAGE_SIZE
    : MAX_RESULTS_PAGE_SIZE;
  const visibleLimit = pagination.key === paginationKey
    ? pagination.limit
    : initialVisibleLimit;
  const visibleRankings = useMemo(
    () => rankings.slice(0, visibleLimit),
    [rankings, visibleLimit],
  );
  const bossSuggestions = useMemo(() => {
    const normalized = deferredBossQuery.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return bossVariants.filter((boss) => (
      `${boss.name} ${boss.pokedex_number}`.toLocaleLowerCase().includes(normalized)
    )).slice(0, 8);
  }, [bossVariants, deferredBossQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const scopes: NativeRosterScope[] = signedIn ? ['owned', 'catalog'] : ['catalog'];
      scopes.forEach((scope) => {
        (['damage', 'tank', 'healing'] as NativeMaxRole[]).forEach((nextRole) => {
          buildNativeMaxRankings({
            catalog,
            instances,
            role: nextRole,
            scope,
          });
        });
        if (selectedBoss) {
          buildNativeMaxRoleCandidates({
            bossVariant: selectedBoss,
            catalog,
            instances,
            scope,
          });
        }
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [catalog, instances, selectedBoss, signedIn]);

  useEffect(() => {
    if (bossSuggestions.length === 0) return undefined;
    const timer = setTimeout(() => {
      bossSuggestions.forEach((boss) => {
        buildNativeMaxRoleCandidates({
          bossVariant: boss,
          catalog,
          instances,
          scope: effectiveScope,
        });
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [bossSuggestions, catalog, effectiveScope, instances]);

  useEffect(() => finishPerformance('max_view_result_painted'), [candidates, finishPerformance, rankings.length, view]);
  useEffect(() => finishPerformance('max_scope_result_painted'), [effectiveScope, finishPerformance, rankings.length]);
  useEffect(() => finishPerformance('max_role_result_painted'), [finishPerformance, rankings.length, role]);
  useEffect(() => finishPerformance('max_type_result_painted'), [finishPerformance, rankings.length, selectedType]);
  useEffect(() => {
    if (query === deferredQuery) finishPerformance('max_query_result_painted');
  }, [deferredQuery, finishPerformance, query, rankings.length]);
  useEffect(() => {
    if (bossQuery === deferredBossQuery) finishPerformance('max_boss_query_result_painted');
  }, [bossQuery, bossSuggestions.length, deferredBossQuery, finishPerformance]);
  useEffect(() => finishPerformance('max_boss_result_painted'), [candidates, finishPerformance, selectedBoss?.variant_id]);
  useEffect(() => finishPerformance('max_more_result_painted'), [finishPerformance, visibleLimit]);
  useEffect(() => finishPerformance('max_method_result_painted'), [finishPerformance, methodOpen]);

  const switchView = useCallback((next: MaxView) => {
    if (next === view) return;
    beginPerformance('max_view_result_painted');
    setView(next);
    setQuery('');
    onRouteStateChange?.({ view: next });
  }, [beginPerformance, onRouteStateChange, view]);
  const changeScope = useCallback((next: NativeRosterScope) => {
    if (next === effectiveScope) return;
    beginPerformance('max_scope_result_painted');
    setScope(next);
    onRouteStateChange?.({ scope: next });
  }, [beginPerformance, effectiveScope, onRouteStateChange]);
  const changeRole = (next: NativeMaxRole) => {
    if (next === role) return;
    beginPerformance('max_role_result_painted');
    setRole(next);
    onRouteStateChange?.({ role: next });
  };
  const changeType = useCallback((next: string) => {
    if (next === selectedType) return;
    beginPerformance('max_type_result_painted');
    setSelectedType(next);
    onRouteStateChange?.({ selectedType: next });
  }, [beginPerformance, onRouteStateChange, selectedType]);
  const changeQuery = (next: string) => {
    beginPerformance('max_query_result_painted');
    setQuery(next);
  };
  const changeBossQuery = (next: string) => {
    beginPerformance('max_boss_query_result_painted');
    setBossQuery(next);
  };
  const selectBoss = (nextBossId: string) => {
    if (nextBossId === selectedBoss?.variant_id) {
      setBossQuery('');
      return;
    }
    beginPerformance('max_boss_result_painted');
    setBossId(nextBossId);
    setBossQuery('');
    onRouteStateChange?.({ bossId: nextBossId, difficulty: null, trainerCount: null });
  };

  const productHeader = useMemo(() => (
    <View style={styles.productHeader}>
      <ExpoImage
        accessibilityElementsHidden
        cachePolicy="memory-disk"
        contentFit="contain"
        source={{ uri: absoluteUri(assetBaseUrl, '/images/dynamax.png') }}
        style={styles.productIcon}
        transition={0}
      />
      <View style={styles.headerCopy}>
        <Text style={[styles.eyebrow, light && styles.accentLight]}>POWER SPOT STRATEGY</Text>
        <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>Max Battles</Text>
      </View>
      <Text style={[styles.countPill, light && styles.countPillLight]}>{bossVariants.length} Max-ready Pokémon</Text>
    </View>
  ), [assetBaseUrl, bossVariants.length, light]);

  const viewTabs = useMemo(() => (
    <NativeSlidingSegmentedControl
      accessibilityLabel="Max Battle tools"
      buttonStyle={styles.viewButton}
      indicatorStyle={styles.viewIndicator}
      indicatorTestID="native-max-view-indicator"
      items={MAX_VIEW_ITEMS}
      onChange={switchView}
      renderItem={(item, selected) => <>
        <NativeUiIcon color={selected ? '#06120f' : light ? '#172124' : '#ecf5f4'} name={item.value === 'rankings' ? 'chart' : 'target'} size={14} />
        <Text style={[styles.viewText, light && styles.textLight, selected && styles.activeText]}>{item.label}</Text>
      </>}
      style={[styles.viewTabs, light && styles.panelLight]}
      testID="native-max-view-switcher"
      value={view}
    />
  ), [light, switchView, view]);

  const roster = (
    <NativeRosterScopeControl summary={rosterSummary} scope={effectiveScope} signedIn={signedIn} loading={isLoading} onChange={changeScope} />
  );

  const roleTabs = (
    <View accessibilityLabel="Max Battle role" style={styles.roleTabs}>
      {([['damage', 'bolt', 'Damage'], ['tank', 'diamond', 'Tank'], ['healing', 'heart', 'Healing']] as const).map(([value, icon, label]) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: role === value }}
          key={value}
          onPress={() => changeRole(value)}
          style={[styles.roleButton, light && styles.controlLight, role === value && styles[`${value}Active`]]}
        >
          <NativeUiIcon
            color={light ? '#102829' : '#edf5f4'}
            name={icon}
            size={13}
          />
          <Text style={[styles.roleText, light && styles.textLight]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );

  const typeFilterLabel = role === 'damage' ? 'Max Move type' : 'Incoming attack type';
  const typeFilter = view === 'rankings' ? (
    <View accessibilityLabel={typeFilterLabel} style={[styles.typeDeck, light && styles.panelLight]}>
      <Text style={[styles.fieldLabel, light && styles.mutedLight]}>
        {role === 'damage' ? 'MAX MOVE TYPE' : 'INCOMING ATTACK TYPE'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: selectedType === '' }}
        onPress={() => changeType('')}
        style={[styles.allTypes, selectedType === '' && styles.allTypesActive]}
      >
        <Text style={styles.allTypesText}>All types</Text>
      </Pressable>
      <NativeMaxTypeGrid
        assetBaseUrl={assetBaseUrl}
        light={light}
        onSelect={changeType}
        selectedType={selectedType}
      />
    </View>
  ) : null;

  const bossPicker = view === 'bosses' && selectedBoss ? (
    <View accessibilityLabel="Max Battle boss" style={[styles.bossPicker, light && styles.panelLight]}>
      <View style={styles.selectedBoss}>
        <View style={[styles.selectedBossStage, light && styles.cardLight]}>
          <ExpoImage
            cachePolicy="memory-disk"
            contentFit="contain"
            source={{ uri: absoluteUri(assetBaseUrl, selectedBoss.currentImage || selectedBoss.image_url) }}
            style={styles.selectedBossImage}
            transition={0}
          />
        </View>
        <View style={styles.selectedBossCopy}>
          <Text style={[styles.fieldLabel, light && styles.accentLight]}>MAX BATTLE BOSS</Text>
          <Text style={[styles.selectedBossName, light && styles.textLight]}>{selectedBoss.name}</Text>
          <Text style={[styles.selectedBossTypes, light && styles.mutedLight]}>
            {[selectedBoss.type1_name, selectedBoss.type2_name].filter(Boolean).join(' / ')}
          </Text>
        </View>
      </View>
      <TextInput
        accessibilityLabel="Search Max Battle bosses"
        onChangeText={changeBossQuery}
        onSubmitEditing={() => { if (bossSuggestions[0]) selectBoss(bossSuggestions[0].variant_id); }}
        placeholder="Search Max Battle bosses"
        placeholderTextColor={light ? '#718283' : '#829394'}
        returnKeyType="search"
        style={[styles.search, styles.bossSearch, light && styles.inputLight]}
        value={bossQuery}
      />
      {deferredBossQuery.trim() ? (
        <View accessibilityLabel="Boss results" style={styles.bossResults}>
          {bossSuggestions.length ? bossSuggestions.map((boss) => {
            const maxKind = boss.variantType.includes('gigantamax') ? 'gigantamax' : 'dynamax';
            return (
              <Pressable
                accessibilityLabel={`Select ${boss.name} Max boss`}
                accessibilityRole="button"
                key={boss.variant_id}
                onPress={() => selectBoss(boss.variant_id)}
                style={[styles.bossResult, light && styles.cardLight]}
              >
                <View style={styles.bossResultStage}>
                  <ExpoImage cachePolicy="memory-disk" contentFit="contain" source={{ uri: absoluteUri(assetBaseUrl, boss.currentImage || boss.image_url) }} style={styles.bossResultImage} transition={0} />
                  <ExpoImage cachePolicy="memory-disk" contentFit="contain" source={{ uri: absoluteUri(assetBaseUrl, `/images/${maxKind}.png`) }} style={styles.bossResultMaxIcon} transition={0} />
                </View>
                <Text numberOfLines={2} style={[styles.bossResultName, light && styles.textLight]}>{boss.name}</Text>
                <Text style={[styles.bossResultNumber, light && styles.mutedLight]}>#{String(boss.pokedex_number).padStart(4, '0')}</Text>
              </Pressable>
            );
          }) : (
            <Text style={[styles.stateCopy, light && styles.mutedLight]}>No matching Max boss found.</Text>
          )}
        </View>
      ) : null}
    </View>
  ) : null;

  const heading = view === 'bosses' && selectedBoss
    ? `Top ${role === 'healing' ? 'healers' : role === 'tank' ? 'tanks' : 'damage picks'} vs ${selectedBoss.name}`
    : roleHeading(role, selectedType);
  const assumptions = effectiveScope === 'owned'
    ? 'Recorded level · recorded IVs · recorded Fast Move · unlocked Max Move levels'
    : 'Level 50 · 15/15/15 IVs · Max Moves Level 3';

  const resultsHeader = (
    <View style={[styles.resultsPanel, light && styles.panelLight]}>
      <View style={styles.resultsContext}>
        <Text style={[styles.fieldLabel, light && styles.accentLight]}>{view === 'bosses' ? 'ROLE ALTERNATIVES' : selectedType.toUpperCase() || 'ALL MAX POKÉMON'}</Text>
        <Text style={[styles.rankedPill, light && styles.rankedPillLight]}>{rankings.length} RANKED</Text>
      </View>
      <Text style={[styles.resultsTitle, light && styles.textLight]}>{heading}</Text>
      <Text style={[styles.assumptions, light && styles.mutedLight]}>
        {view === 'bosses'
          ? 'Compare replacements for the selected role in your three-Pokémon party.'
          : assumptions}
      </Text>
      {view === 'rankings' ? (
        <TextInput
          accessibilityLabel="Search Max rankings"
          onChangeText={changeQuery}
          placeholder="Pokémon or move"
          placeholderTextColor={light ? '#718283' : '#829394'}
          style={[styles.search, light && styles.inputLight]}
          value={query}
        />
      ) : null}
      {isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color="#42d6c8" />
          <Text style={[styles.stateCopy, light && styles.mutedLight]}>Preparing Max rankings…</Text>
        </View>
      ) : null}
      {error ? (
        <View accessibilityRole="alert" style={styles.error}>
          <Text style={styles.errorTitle}>Max Battles unavailable</Text>
          <Text style={styles.errorCopy}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      ) : null}
      {!isLoading && !error && rankings.length === 0 ? (
        <View style={styles.resultsEmpty}>
          <Text style={[styles.emptyTitle, light && styles.textLight]}>No eligible Max Pokémon</Text>
          <Text style={[styles.stateCopy, light && styles.mutedLight]}>Try another role, type, boss, or roster.</Text>
        </View>
      ) : null}
    </View>
  );

  const bossBenchmarkNote = view === 'bosses' && selectedBoss ? (
    <View accessibilityLabel="Boss ranking method" style={[styles.benchmark, light && styles.panelLight]}>
      <Text style={[styles.benchmarkTitle, light && styles.textLight]}>Standardized matchup</Text>
      <Text style={[styles.benchmarkCopy, light && styles.mutedLight]}>
        {effectiveScope === 'owned'
          ? 'Recorded level, IVs, Fast Move, and unlocked Max Move levels'
          : 'Level 50 · 15/15/15 IVs · level-3 Max moves'}
        {' · '}
        {rankings[0]?.maxRanking?.bossBenchmark?.pressureSource === 'legal-movesets'
          ? 'expected pressure across legal boss movesets'
          : 'typed benchmark pressure when boss moves are unavailable'}
      </Text>
    </View>
  ) : null;

  const header = (
    <View style={styles.headerStack}>
      <Animated.View style={[styles.stationaryHeader, workspaceMotion.stationaryStyle]}>
        {productHeader}
        {viewTabs}
      </Animated.View>
      {roster}
      {view === 'rankings'
        ? <View style={[styles.filterDeck, light && styles.panelLight]}>{roleTabs}{typeFilter}</View>
        : <>{bossPicker}{selectedBoss ? <NativeMaxBattleSimulator assetBaseUrl={assetBaseUrl} boss={selectedBoss} candidates={candidates} initialDifficulty={initialDifficulty} initialTrainerCount={initialTrainerCount} key={`${selectedBoss.variant_id}-${effectiveScope}`} onDifficultyChange={(difficulty) => onRouteStateChange?.({ difficulty: difficulty === getDefaultMaxBattleTier(selectedBoss) ? null : difficulty })} onTrainerCountChange={(trainerCount) => onRouteStateChange?.({ trainerCount })} rosterScope={effectiveScope} /> : null}{roleTabs}{bossBenchmarkNote}</>}
      {resultsHeader}
    </View>
  );

  const remainingRankings = rankings.length - visibleRankings.length;
  const footer = (
    <View style={styles.footer}>
      {remainingRankings > 0 ? (
        <Pressable
          accessibilityLabel={`Show ${Math.min(resultsPageSize, remainingRankings)} more Max rankings`}
          accessibilityRole="button"
          onPress={() => {
            beginPerformance('max_more_result_painted');
            setPagination({
              key: paginationKey,
              limit: Math.min(rankings.length, visibleLimit + resultsPageSize),
            });
          }}
          style={[styles.showMore, light && styles.controlLight]}
        >
          <Text style={[styles.showMoreText, light && styles.textLight]}>
            Show {Math.min(resultsPageSize, remainingRankings)} more
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: methodOpen }}
        onPress={() => {
          beginPerformance('max_method_result_painted');
          setMethodOpen((current) => !current);
        }}
        style={styles.method}
      >
        <Text style={[styles.methodTitle, light && styles.textLight]}>▸  How Max roles are ranked</Text>
        {methodOpen ? (
          <Text style={[styles.methodCopy, light && styles.mutedLight]}>
            Damage uses Attack, active Max or G-Max power, STAB, and effectiveness. Tank uses effective bulk and boss pressure. Healing uses the active Max Spirit level and team recovery.
          </Text>
        ) : null}
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.root, light && styles.rootLight]} testID="native-max-screen">
      <Animated.View style={[styles.workspaceViewport, workspaceMotion.contentStyle]} testID="native-max-workspace-motion">
        <FlatList
          contentContainerStyle={{ paddingHorizontal: 7, paddingTop: 3 + insets.top, paddingBottom: 96 + insets.bottom }}
          data={visibleRankings}
          initialNumToRender={2}
          keyExtractor={(_entry, index) => String(index)}
          keyboardShouldPersistTaps="always"
          maxToRenderPerBatch={2}
          nestedScrollEnabled
          removeClippedSubviews
          updateCellsBatchingPeriod={100}
          ListFooterComponent={footer}
          ListHeaderComponent={header}
          ListEmptyComponent={null}
          renderItem={({ item, index }) => (
            <NativeCombatRankingCard
              assetBaseUrl={assetBaseUrl}
              entry={item}
              metricLabel={roleMetric(role)}
              onPress={() => onOpenPokemon(item)}
              rank={index + 1}
            />
          )}
          windowSize={1}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#090d0d' },
  workspaceViewport: { flex: 1, minHeight: 0 },
  stationaryHeader: { gap: 9 },
  rootLight: { backgroundColor: '#f8fff9' },
  footer: { gap: 9 },
  benchmark: { gap: 3, borderWidth: 1, borderColor: '#365052', borderRadius: 10, padding: 10, backgroundColor: '#10191a' },
  benchmarkTitle: { color: '#eef7f6', fontSize: 10, fontWeight: '900' },
  benchmarkCopy: { color: '#9aacaa', fontSize: 8.5, lineHeight: 12 },
  showMore: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#405354', borderRadius: 12, backgroundColor: '#11191a' },
  showMoreText: { color: '#edf6f5', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  textLight: { color: '#102829' },
  mutedLight: { color: '#617576' },
  accentLight: { color: '#08766b' },
  panelLight: { borderColor: '#9fb8b8', backgroundColor: '#f8fcfb' },
  controlLight: { borderColor: '#9fb2b2', backgroundColor: '#fff' },
  cardLight: { borderColor: '#a8bcbc', backgroundColor: '#fff' },
  inputLight: { borderColor: '#8ba2a3', color: '#102829', backgroundColor: '#fff' },
  activeText: { color: '#071110' },
  headerStack: { gap: 9 },
  productHeader: { minHeight: 106, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#2b4c4d', paddingHorizontal: 7, paddingBottom: 8 },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#405354', borderRadius: 17, backgroundColor: '#11191a' },
  backText: { marginTop: -4, color: '#fff', fontSize: 31, lineHeight: 34 },
  productIcon: { width: 42, height: 42, transform: [{ translateY: -8 }] },
  headerCopy: { minWidth: 0, flex: 1, transform: [{ translateY: -8 }] },
  eyebrow: { color: '#65ddd2', fontSize: 8.5, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 2, color: '#fff', fontSize: 25, lineHeight: 28, fontWeight: '900' },
  countPill: { alignSelf: 'flex-end', marginBottom: 2, borderWidth: 1, borderColor: '#d45b89', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, color: '#ffd9e7', fontSize: 7, fontWeight: '900' },
  countPillLight: { color: '#a9235b' },
  viewTabs: { borderColor: '#315253', borderRadius: 13, backgroundColor: '#0d1516' },
  viewButton: { gap: 6, borderRadius: 10 },
  viewIndicator: { borderRadius: 10, backgroundColor: '#44d7ca' },
  viewText: { color: '#aebdbc', fontSize: 11, fontWeight: '900' },
  viewIcon: { marginRight: 5, color: '#aebdbc', fontSize: 11, fontWeight: '900' },
  iconLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  disabled: { opacity: .42 },
  filterDeck: { overflow: 'hidden', borderWidth: 1, borderColor: '#315253', borderRadius: 8, backgroundColor: '#0f1819' },
  roleTabs: { flexDirection: 'row', gap: 6, padding: 6 },
  roleButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334849', borderRadius: 6, backgroundColor: '#101819' },
  damageActive: { borderColor: '#f06aa4', backgroundColor: 'rgba(240,106,164,0.16)' },
  tankActive: { borderColor: '#61a8ed', backgroundColor: 'rgba(97,168,237,0.16)' },
  healingActive: { borderColor: '#53d9a8', backgroundColor: 'rgba(83,217,168,0.16)' },
  roleText: { color: '#edf5f4', fontSize: 10, fontWeight: '900' },
  typeDeck: { gap: 8, borderTopWidth: 1, borderColor: '#315253', padding: 11, backgroundColor: '#0f1819' },
  fieldLabel: { color: '#69d9cf', fontSize: 8, fontWeight: '900', letterSpacing: .5 },
  allTypes: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#ddc064' },
  allTypesActive: { backgroundColor: '#f0d370' },
  allTypesText: { color: '#111817', fontSize: 10, fontWeight: '900' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  typeButton: { width: '9.72%', minWidth: 31, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2f4546', borderRadius: 4, backgroundColor: '#131d1e' },
  typeButtonLight: { borderColor: '#aabcbc', backgroundColor: '#fff' },
  typeActive: { borderColor: '#f1d46f', backgroundColor: '#4a4224' },
  typeIcon: { width: '72%', height: '72%', resizeMode: 'contain' },
  bossPicker: { gap: 8, borderWidth: 1, borderColor: '#315253', borderRadius: 9, padding: 9, backgroundColor: '#0f1819' },
  selectedBoss: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedBossStage: { width: 82, height: 82, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#344a4b', borderRadius: 8, backgroundColor: '#111b1c' },
  selectedBossImage: { width: 76, height: 76 },
  selectedBossCopy: { minWidth: 0, flex: 1 },
  selectedBossName: { marginTop: 3, color: '#eef6f5', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  selectedBossTypes: { marginTop: 3, color: '#9bb0af', fontSize: 10, textTransform: 'capitalize' },
  bossSearch: { marginTop: 0 },
  bossResults: { gap: 5, borderTopWidth: 1, borderTopColor: '#315253', paddingTop: 8 },
  bossResult: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#344a4b', borderRadius: 8, paddingHorizontal: 8, backgroundColor: '#111b1c' },
  bossResultStage: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bossResultImage: { width: 42, height: 42 },
  bossResultMaxIcon: { position: 'absolute', right: 0, top: 0, width: 15, height: 15 },
  bossResultName: { minWidth: 0, flex: 1, color: '#eef6f5', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  bossResultNumber: { color: '#9bb0af', fontSize: 9, fontWeight: '800' },
  resultsPanel: { gap: 4, marginTop: 2, borderWidth: 1, borderColor: '#315253', borderRadius: 8, padding: 12, backgroundColor: '#0e1718' },
  resultsContext: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankedPill: { borderWidth: 1, borderColor: '#3b5c5d', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, color: '#a9c2c1', fontSize: 6.5, fontWeight: '900' },
  rankedPillLight: { color: '#526568' },
  resultsTitle: { color: '#fff', fontSize: 18, lineHeight: 21, fontWeight: '900' },
  assumptions: { color: '#9bb0af', fontSize: 8, lineHeight: 11 },
  search: { minHeight: 45, marginTop: 6, borderWidth: 1, borderColor: '#3b5152', borderRadius: 999, paddingHorizontal: 15, color: '#fff', backgroundColor: '#091112', fontSize: 13, fontWeight: '700' },
  state: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 15 },
  stateCopy: { color: '#9eb0af', fontSize: 10, lineHeight: 15, textAlign: 'center' },
  error: { gap: 6, marginTop: 5, borderWidth: 1, borderColor: '#e45d77', borderRadius: 8, padding: 10, backgroundColor: '#39151e' },
  errorTitle: { color: '#ffd8df', fontSize: 13, fontWeight: '900' },
  errorCopy: { color: '#ffb8c4', fontSize: 10 },
  retry: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', borderRadius: 7, paddingHorizontal: 12, backgroundColor: '#df5770' },
  retryText: { color: '#fff', fontWeight: '900' },
  resultsEmpty: { minHeight: 176, alignItems: 'center', justifyContent: 'center', gap: 4 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  method: { gap: 6, minHeight: 43, justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#315253', paddingHorizontal: 8, paddingVertical: 10 },
  methodTitle: { color: '#c8dcda', fontSize: 10, fontWeight: '900' },
  methodCopy: { color: '#96aaa8', fontSize: 9, lineHeight: 14 },
});
