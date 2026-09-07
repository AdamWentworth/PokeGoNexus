import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PokemonInstance } from "@pokemongonexus/shared-contracts/instances";
import type {
  BasePokemon,
  PokemonPvPLeagueKey,
  PokemonPvPRankingEntry,
  PokemonPvPRankingsPayload,
  PokemonPvPRosterEvaluationResponse,
} from "@pokemongonexus/shared-contracts/pokemon";
import { evaluatePvPRosterLocally } from "@pokemongonexus/shared-domain/pvp-battle";
import {
  formatPvPSpeciesName,
  type PvPTeamCandidate,
} from "@pokemongonexus/app-core/pvp-team-builder";
import {
  buildPvPMoveMechanicsLookupFromChunk,
  hydratePvPRankingEntry,
} from "@pokemongonexus/app-core/pvp-move-hydration";
import { NativePvpBattleLab } from "../components/tools/NativePvpBattleLab";
import { NativePvpIvRank } from "../components/tools/NativePvpIvRank";
import { NativePvpTeamBuilder } from "../components/tools/NativePvpTeamBuilder";
import { NativeSlidingSegmentedControl } from '../components/NativeSlidingSegmentedControl';
import { useNativeSegmentedWorkspaceMotion } from '../components/useNativeSegmentedWorkspaceMotion';
import {
  buildNativePvpFormats,
  buildNativePvpRankingRows,
  buildNativePvpRosterEvaluationPlan,
  pvpRoleScore,
  type NativePvpRole,
  type NativePvpWorkspace,
} from "../features/tools/nativePvpModel";
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { NativeUiIcon, type NativeUiIconName } from '../components/NativeUiIcon';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type Props = {
  assetBaseUrl: string;
  catalog: BasePokemon[];
  error?: string | null;
  instances?: Record<string, PokemonInstance>;
  isLoading?: boolean;
  onBack: () => void;
  onCatalogNeeded?: () => void;
  onMethodology: () => void;
  onOwnedDataNeeded?: () => void;
  onRetry: () => void;
  payload: PokemonPvPRankingsPayload | null;
  persistTeamBuilder?: boolean;
  signedIn: boolean;
};
type PvpBattleSeed = {
  mode?: "single" | "team";
  leftKey: string;
  rightKey: string;
  leftTeamKeys?: string[];
  rightTeamKeys?: string[];
};
const WORKSPACES: [NativePvpWorkspace, string, NativeUiIconName][] = [
  ["rankings", "Rankings", "list"],
  ["team", "Team Builder", "trainers"],
  ["battle", "Battle Lab", "flask"],
  ["iv-rank", "IV Rank", "calculator"],
];
const PVP_WORKSPACE_ITEMS = WORKSPACES.map(([value, label]) => ({ label, value }));
const ROLES: [NativePvpRole, string, NativeUiIconName][] = [
  ["overall", "Overall", "chart"],
  ["lead", "Lead", "flag"],
  ["closer", "Closer", "fist"],
  ["switch", "Switch", "trade"],
  ["charger", "Charger", "bolt"],
  ["attacker", "Attacker", "fist"],
  ["consistency", "Consistency", "scale"],
];
const LEAGUES: [PokemonPvPLeagueKey, string, string][] = [
  ["great", "Great", "1,500 CP"],
  ["ultra", "Ultra", "2,500 CP"],
  ["master", "Master", "No CP limit"],
];
const uri = (base: string, value: string) => {
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
};
const PvpEntryCard = ({
  assetBaseUrl,
  entry,
  entriesBySpeciesId,
  cp,
  expanded,
  nickname,
  onPress,
  personalBuild,
  rank,
  role,
}: {
  assetBaseUrl: string;
  entry: PokemonPvPRankingEntry;
  entriesBySpeciesId: Map<string, PokemonPvPRankingEntry>;
  cp?: number;
  expanded: boolean;
  nickname?: string | null;
  onPress: () => void;
  personalBuild: boolean;
  rank: number;
  role: NativePvpRole;
}) => {
  const light = useNativeColorScheme() === "light";
  const typeIcon = (type: string) =>
    uri(assetBaseUrl, `/images/types/${type.toLocaleLowerCase()}.png`);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${expanded ? "Hide" : "Show"} details for ${entry.name}`}
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={[
        styles.rankingCard,
        light && styles.cardLight,
        expanded && styles.rankingExpanded,
      ]}
    >
      <View style={styles.rankingHeader}>
        <View
          style={[
            styles.rank,
            rank === 1 && styles.rankGold,
            rank === 2 && styles.rankSilver,
            rank === 3 && styles.rankBronze,
          ]}
        >
          <Text style={[styles.rankText, rank <= 3 && styles.rankTextTop]}>
            {rank}
          </Text>
        </View>
        <View style={styles.rankingCopy}>
        <View style={styles.buildRow}>
          <Image fadeDuration={0}
            resizeMode="contain"
            source={{ uri: uri(assetBaseUrl, entry.imageUrl) }}
            style={styles.pokemonImage}
          />
          <View style={styles.identity}>
            <Text style={[styles.pokemonName, light && styles.textLight]}>
              {entry.name}
            </Text>
            {nickname ? <Text numberOfLines={1} style={[styles.nickname, light && styles.mutedLight]}>{nickname}</Text> : null}
            <View style={styles.typeRow}>
              {entry.types.map((type) => (
                <Image fadeDuration={0}
                  accessibilityIgnoresInvertColors
                  key={type}
                  resizeMode="contain"
                  source={{ uri: typeIcon(type) }}
                  style={styles.typeIcon}
                />
              ))}
            </View>
            <View style={styles.moves}>
              {entry.moveset.map((move) => (
                <View key={`${move.kind}-${move.id}`} style={styles.moveRow}>
                  <Image fadeDuration={0}
                    accessibilityIgnoresInvertColors
                    resizeMode="contain"
                    source={{ uri: typeIcon(move.type) }}
                    style={styles.moveIcon}
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.moveLine, light && styles.textLight]}
                  >
                    {move.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.buildMeta}>
            <Text style={[styles.score, light && styles.accentLight]}>
              {pvpRoleScore(entry, role).toFixed(1)}
            </Text>
            <Text style={[styles.scoreLabel, light && styles.mutedLight]}>
              {role === "overall" ? "Overall" : role}
            </Text>
            <Text style={[styles.level, light && styles.textLight]}>
              Level {entry.recommendedLevel}
            </Text>
            {cp != null ? <Text style={[styles.ivs, light && styles.mutedLight]}>CP {cp.toLocaleString()}</Text> : null}
            <Text style={[styles.ivs, light && styles.mutedLight]}>
              {entry.attackIv}/{entry.defenseIv}/{entry.staminaIv} IV
            </Text>
            <View style={[styles.detailPill, light && styles.detailPillLight]}>
              <Text style={[styles.detailPillText, light && styles.textLight]}>
                Details {expanded ? "⌃" : "⌄"}
              </Text>
            </View>
          </View>
        </View>
        </View>
      </View>
      {expanded ? (
        <View style={styles.expanded}>
          <View style={styles.detailSummary}>
            <View style={styles.detailPanel}>
              <Text style={[styles.detailTitle, light && styles.accentLight]}>Role profile</Text>
              <View style={styles.roleProfileGrid}>
              {ROLES.slice(1).map(([roleKey, label]) => {
                const score = pvpRoleScore(entry, roleKey);
                return <View key={roleKey} style={styles.roleProfileRow}>
                  <Text style={[styles.roleProfileLabel, light && styles.mutedLight]}>{label}</Text>
                  <View style={[styles.roleProfileTrack, light && styles.roleProfileTrackLight]}><View style={[styles.roleProfileFill, { width: `${Math.max(0, Math.min(100, score))}%` }]} /></View>
                  <Text style={[styles.roleProfileScore, light && styles.textLight]}>{score.toFixed(1)}</Text>
                </View>;
              })}
              </View>
            </View>
            <View style={styles.detailPanel}>
              <Text style={[styles.detailTitle, light && styles.accentLight]}>Battle build</Text>
              <View style={styles.battleStatGrid}>
                {[
                  ['Attack', entry.battleAttack?.toFixed(1) ?? '---'],
                  ['Defense', entry.battleDefense?.toFixed(1) ?? '---'],
                  ['HP', entry.battleHp == null ? '---' : String(entry.battleHp)],
                  ['Stat product', entry.statProduct?.toLocaleString() ?? '---'],
                ].map(([label, value]) => <View key={label} style={styles.battleStat}><Text style={[styles.battleStatLabel, light && styles.mutedLight]}>{label}</Text><Text style={[styles.battleStatValue, light && styles.textLight]}>{value}</Text></View>)}
              </View>
            </View>
          </View>
          <View style={styles.matchupGrid}>
            {([
              [personalBuild ? 'Strong species matchups' : 'Strong matchups', entry.matchups ?? [], 'strong'],
              [personalBuild ? 'Species threats' : 'Key threats', entry.counters ?? [], 'threat'],
            ] as const).map(([title, matchups, kind]) => <View accessibilityLabel={title} key={kind} style={[styles.matchupPanel, kind === 'strong' ? styles.matchupStrong : styles.matchupThreat]}>
              <Text style={[styles.detailTitle, light && styles.accentLight]}>{title}</Text>
              {matchups.length ? matchups.map((matchup) => {
                const opponent = entriesBySpeciesId.get(matchup.speciesId);
                return <View key={matchup.speciesId} style={styles.matchupRow}>
                  {opponent?.imageUrl ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: uri(assetBaseUrl, opponent.imageUrl) }} style={styles.matchupImage} /> : null}
                  <View style={styles.matchupCopy}><Text style={[styles.matchupName, light && styles.textLight]}>{opponent?.name ?? formatPvPSpeciesName(matchup.speciesId)}</Text><Text style={[styles.matchupRating, light && styles.mutedLight]}>{matchup.rating.toFixed(0)} battle rating</Text></View>
                </View>;
              }) : <Text style={[styles.detailBody, light && styles.mutedLight]}>Matchup details are not available in this snapshot.</Text>}
            </View>)}
          </View>
          {(entry.moveUsage?.length ?? 0) > 0 ? <View style={styles.moveOptions}>
            <Text style={[styles.detailTitle, light && styles.accentLight]}>Simulated move options</Text>
            {entry.moveUsage!.map((move) => {
              const selected = entry.moveset.some((selectedMove) => selectedMove.id === move.id);
              const maxUses = Math.max(1, ...entry.moveUsage!.map((option) => option.uses));
              return <View key={`${move.kind}-${move.id}`} style={[styles.moveOption, selected && styles.moveOptionSelected]}>
                <Image fadeDuration={0} source={{ uri: typeIcon(move.type) }} style={styles.moveIcon} />
                <View style={styles.moveOptionCopy}><Text style={[styles.matchupName, light && styles.textLight]}>{move.name}</Text><Text style={[styles.matchupRating, light && styles.mutedLight]}>{move.kind === 'fast' ? 'Fast' : 'Charged'}</Text><View style={[styles.moveUseTrack, light && styles.roleProfileTrackLight]}><View style={[styles.moveUseFill, { width: `${(move.uses / maxUses) * 100}%` }]} /></View></View>
              </View>;
            })}
          </View> : null}
        </View>
      ) : null}
    </Pressable>
  );
};

export const NativePvpScreen = ({
  assetBaseUrl,
  catalog,
  error = null,
  instances = {},
  isLoading = false,
  onBack: _onBack,
  onCatalogNeeded,
  onMethodology,
  onOwnedDataNeeded,
  onRetry,
  payload,
  persistTeamBuilder = true,
  signedIn,
}: Props) => {
  const light = useNativeColorScheme() === "light";
  const insets = useSafeAreaInsets();
  const workspaceScrollRef = useRef<ScrollView>(null);
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
  const formats = useMemo(() => buildNativePvpFormats(payload), [payload]);
  const [workspace, setWorkspace] = useState<NativePvpWorkspace>("rankings");
  const [formatKey, setFormatKey] = useState("great");
  const format =
    formats.find((item) => item.key === formatKey) ?? formats[0] ?? null;
  const mechanics =
    format?.mechanics ??
    (/\bcompetitors?\b/i.test(
      `${format?.key ?? ""} ${format?.label ?? ""} ${format?.cup ?? ""}`,
    )
      ? "pvpoke-legacy"
      : "current-2026");
  const league = (format?.league ?? "great") as PokemonPvPLeagueKey;
  const [scope, setScope] = useState<"catalog" | "owned">("catalog");
  const [cupOpen, setCupOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [role, setRole] = useState<NativePvpRole>("overall");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(50);
  const [battleSeed, setBattleSeed] = useState<PvpBattleSeed | null>(null);
  useEffect(() => {
    if (workspace === "iv-rank" || scope === "owned") onCatalogNeeded?.();
    if (scope === "owned") onOwnedDataNeeded?.();
  }, [onCatalogNeeded, onOwnedDataNeeded, scope, workspace]);
  const deferredFormat = useDeferredValue(format);
  const deferredMechanics = useDeferredValue(mechanics);
  const deferredQuery = useDeferredValue(query);
  const deferredScope = useDeferredValue(scope);
  const deferredWorkspace = useDeferredValue(workspace);
  const workspaceMotion = useNativeSegmentedWorkspaceMotion(Math.max(
    0,
    WORKSPACES.findIndex(([value]) => value === deferredWorkspace),
  ));
  const evaluationPlan = useMemo(() => (
    deferredScope === 'owned' && deferredWorkspace !== 'iv-rank'
      ? buildNativePvpRosterEvaluationPlan({
        catalog,
        cpLimit: deferredFormat?.cpLimit ?? null,
        entries: deferredFormat?.entries ?? [],
        formatKey: deferredFormat?.key ?? 'great',
        instances,
        mechanics: deferredMechanics,
      })
      : null
  ), [catalog, deferredFormat, deferredMechanics, deferredScope, deferredWorkspace, instances]);
  const [ownedEvaluation, setOwnedEvaluation] = useState<{
    error: string | null;
    key: string | null;
    loading: boolean;
    response: PokemonPvPRosterEvaluationResponse | null;
  }>({ error: null, key: null, loading: false, response: null });
  const activeOwnedEvaluation = evaluationPlan && ownedEvaluation.key === evaluationPlan.cacheKey
    ? ownedEvaluation
    : {
      error: null,
      key: evaluationPlan?.cacheKey ?? null,
      loading: Boolean(evaluationPlan),
      response: null,
    };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (!evaluationPlan) return undefined;

    timer = setTimeout(() => {
      void (async () => {
        try {
          setOwnedEvaluation({
            error: null,
            key: evaluationPlan.cacheKey,
            loading: true,
            response: null,
          });
          const results: PokemonPvPRosterEvaluationResponse['results'] = [];
          for (const candidate of evaluationPlan.request.candidates) {
            if (cancelled) return;
            // Yield between recorded copies so large collections do not freeze
            // the native UI while using the same local battle model as Vite.
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
            const response = evaluatePvPRosterLocally({
              ...evaluationPlan.request,
              candidates: [candidate],
            });
            results.push(...response.results);
          }
          if (cancelled) return;
          setOwnedEvaluation({
            error: null,
            key: evaluationPlan.cacheKey,
            loading: false,
            response: {
              mechanics: evaluationPlan.request.mechanics,
              fieldSize: evaluationPlan.request.opponents.length,
              results,
            },
          });
        } catch (error: unknown) {
          if (cancelled) return;
          setOwnedEvaluation({
            error: error instanceof Error ? error.message : 'Exact build evaluation is unavailable.',
            key: evaluationPlan.cacheKey,
            loading: false,
            response: null,
          });
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [evaluationPlan]);

  const roster = useMemo(() => buildNativePvpRankingRows({
    catalog,
    cpLimit: deferredFormat?.cpLimit ?? null,
    entries: deferredFormat?.entries ?? [],
    evaluation: activeOwnedEvaluation.response,
    instances,
    query: deferredQuery,
    role,
    scope: deferredScope,
  }), [activeOwnedEvaluation.response, catalog, deferredFormat, deferredQuery, deferredScope, instances, role]);
  const rankingRows = roster.rows;
  const pvpMoveLookup = useMemo(
    () => buildPvPMoveMechanicsLookupFromChunk(catalog),
    [catalog],
  );
  const hydratedToolEntries = useMemo(
    () => (deferredFormat?.entries ?? []).map((entry) => (
      hydratePvPRankingEntry(entry, pvpMoveLookup)
    )),
    [deferredFormat, pvpMoveLookup],
  );
  const toolRoster = useMemo(() => buildNativePvpRankingRows({
    catalog,
    cpLimit: deferredFormat?.cpLimit ?? null,
    entries: hydratedToolEntries,
    evaluation: activeOwnedEvaluation.response,
    instances,
    role: "overall",
    scope: deferredScope,
  }), [activeOwnedEvaluation.response, catalog, deferredFormat, deferredScope, hydratedToolEntries, instances]);
  const fieldRoster = useMemo(() => buildNativePvpRankingRows({
    catalog: [],
    cpLimit: deferredFormat?.cpLimit ?? null,
    entries: hydratedToolEntries,
    role: "overall",
    scope: "catalog",
  }), [deferredFormat, hydratedToolEntries]);
  const toolCandidates = useMemo<PvPTeamCandidate[]>(() => toolRoster.rows.map(({ cp, entry, key, nickname }) => ({ cp, entry, key, nickname })), [toolRoster.rows]);
  const fieldCandidates = useMemo<PvPTeamCandidate[]>(() => fieldRoster.rows.map(({ entry, key }) => ({ entry, key, nickname: null })), [fieldRoster.rows]);
  const entriesBySpeciesId = useMemo(() => new Map((deferredFormat?.entries ?? []).map((entry) => [entry.speciesId, entry])), [deferredFormat]);
  const rosterDetails = [
    `${roster.summary.eligibleCount} fully detailed from ${roster.summary.caughtCount} caught`,
    activeOwnedEvaluation.loading
      ? 'evaluating levels, IVs, and moves on this device'
      : activeOwnedEvaluation.response
        ? `evaluated locally against ${activeOwnedEvaluation.response.fieldSize} meta opponents`
        : activeOwnedEvaluation.error
          ? 'species baseline shown; local build evaluation unavailable'
          : '',
    roster.summary.overCapCount > 0 ? `${roster.summary.overCapCount} over the format cap` : '',
    roster.summary.missingCpCount > 0 ? `${roster.summary.missingCpCount} need CP` : '',
    roster.summary.missingLevelOrIvCount > 0 ? `${roster.summary.missingLevelOrIvCount} need level or IVs` : '',
    roster.summary.missingMoveCount > 0 ? `${roster.summary.missingMoveCount} need a Fast and Charged Move` : '',
    roster.summary.unmatchedCount > 0 ? `${roster.summary.unmatchedCount} unavailable in this format ranking` : '',
  ].filter(Boolean).join(' · ');
  useEffect(() => finishPerformance("pvp_workspace_result_painted"), [deferredWorkspace, finishPerformance]);
  useEffect(() => {
    finishPerformance("pvp_league_result_painted");
    finishPerformance("pvp_cup_result_painted");
  }, [deferredFormat, finishPerformance]);
  useEffect(() => finishPerformance("pvp_scope_result_painted"), [deferredScope, finishPerformance, toolRoster.rows]);
  useEffect(() => finishPerformance("pvp_role_result_painted"), [finishPerformance, rankingRows, role]);
  useEffect(() => {
    if (query === deferredQuery) finishPerformance("pvp_search_result_painted");
  }, [deferredQuery, finishPerformance, query, rankingRows]);
  useEffect(() => finishPerformance("pvp_ranking_detail_painted"), [expanded, finishPerformance]);
  useEffect(() => finishPerformance("pvp_rules_result_painted"), [finishPerformance, rulesOpen]);
  useEffect(() => finishPerformance("pvp_more_result_painted"), [finishPerformance, visibleLimit]);
  const updateWorkspace = (next: NativePvpWorkspace) => {
    beginPerformance("pvp_workspace_result_painted");
    if (next === "battle") setBattleSeed(null);
    if (next === "iv-rank") setFormatKey(league);
    setWorkspace(next);
    setExpanded(null);
    setVisibleLimit(50);
    setCupOpen(false);
    setRulesOpen(false);
  };
  const openSeededBattle = (memberKeys: string[], opponentKey: string) => {
    beginPerformance("pvp_workspace_result_painted");
    setBattleSeed({
      mode: "team",
      leftKey: memberKeys[0] ?? "",
      rightKey: opponentKey,
      leftTeamKeys: memberKeys,
      rightTeamKeys: [opponentKey],
    });
    setWorkspace("battle");
    setExpanded(null);
    setVisibleLimit(50);
    setCupOpen(false);
    setRulesOpen(false);
  };
  const selectFormat = (key: string) => {
    beginPerformance(["great", "ultra", "master"].includes(key)
      ? "pvp_league_result_painted"
      : "pvp_cup_result_painted");
    setFormatKey(key);
    setExpanded(null);
    setVisibleLimit(50);
    setCupOpen(false);
    setRulesOpen(false);
  };
  const selectScope = (value: "catalog" | "owned") => {
    beginPerformance("pvp_scope_result_painted");
    setScope(value);
    setExpanded(null);
    setVisibleLimit(50);
  };
  const cupFormats = formats.filter(
    (item) => !["great", "ultra", "master"].includes(item.key),
  );
  const activeCup = cupFormats.find((item) => item.key === format?.key) ?? null;
  const rankedCount = workspace === "iv-rank"
    ? 4096
    : scope === "owned"
      ? toolRoster.summary.eligibleCount
      : (format?.entries.length ?? 0);
  const header = (
    <View>
      <Animated.View style={workspaceMotion.stationaryStyle}>
        <View style={styles.topbar}>
          <Image fadeDuration={0}
            resizeMode="contain"
            source={{ uri: uri(assetBaseUrl, "/images/btn_pvp.png") }}
            style={styles.productIcon}
          />
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, light && styles.accentLight]}>TRAINER BATTLES</Text>
            <Text
              accessibilityRole="header"
              style={[styles.title, light && styles.textLight]}
            >
              {workspace === "rankings"
                ? "PvP Rankings"
                : workspace === "team"
                  ? "PvP Team Builder"
                  : workspace === "battle"
                    ? "PvP Battle Lab"
                    : "PvP IV Rank"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="How PvP rankings work"
              onPress={onMethodology}
              style={[styles.method, light && styles.methodLight]}
            >
              <Text style={[styles.methodText, light && styles.accentLight]}>ⓘ METHOD</Text>
            </Pressable>
            <View style={[styles.countPill, light && styles.countPillLight]}>
              <Text style={[styles.countText, light && styles.countTextLight]}>
                {rankedCount.toLocaleString()} {workspace === "iv-rank" ? "spreads" : scope === "owned" ? "ready" : "ranked"}
              </Text>
            </View>
          </View>
        </View>
        <NativeSlidingSegmentedControl
          accessibilityLabel="PvP workspace"
          buttonStyle={styles.workspace}
          indicatorStyle={styles.workspaceIndicator}
          indicatorTestID="native-pvp-workspace-indicator"
          items={PVP_WORKSPACE_ITEMS}
          onChange={updateWorkspace}
          renderItem={(item, selected) => {
            const icon = WORKSPACES.find(([value]) => value === item.value)?.[2] ?? 'list';
            return <View style={styles.workspaceLabel}>
              <NativeUiIcon color={selected ? '#071313' : light ? '#172124' : '#e5f0ef'} name={icon} size={12} />
              <Text style={[styles.workspaceText, light && styles.textLight, selected && styles.workspaceTextActive]}>{item.label}</Text>
            </View>;
          }}
          style={[styles.workspaceRail, light && styles.sectionLight]}
          testID="native-pvp-workspace-switcher"
          value={workspace}
        />
      </Animated.View>
      <View style={[styles.leagueTabs, light && styles.sectionLight]}>
        {LEAGUES.map(([key, label, detail]) => (
          <Pressable
            accessibilityLabel={`${label}, ${detail}`}
            accessibilityRole="button"
            accessibilityState={{ selected: format?.league === key && !activeCup }}
            key={key}
            onPress={() => selectFormat(key)}
            style={[
              styles.league,
              format?.league === key && !activeCup && styles.leagueActive,
            ]}
          >
            <Text
              style={[
                styles.leagueTitle,
                light && styles.textLight,
                format?.league === key && !activeCup && styles.leagueTextActive,
              ]}
            >
              {label}
            </Text>
            <Text
              style={[
                styles.leagueDetail,
                light && styles.mutedLight,
                format?.league === key && !activeCup && styles.leagueDetailActive,
              ]}
            >
              {detail}
            </Text>
          </Pressable>
        ))}
      </View>
      {workspace !== "iv-rank" ? (
        <View>
          <Pressable
            accessibilityLabel="Current PvP cup"
            accessibilityRole="button"
            accessibilityState={{ expanded: cupOpen }}
            onPress={() => setCupOpen((open) => !open)}
            style={[styles.cupPicker, light && styles.sectionLight]}
          >
            <NativeUiIcon color={light ? '#08766b' : '#42d5c2'} name="trophy" size={18} />
            <View style={styles.cupCopy}>
              <Text style={[styles.cupLabel, light && styles.accentLight]}>CURRENT CUPS</Text>
              <Text style={[styles.cupValue, light && styles.textLight]}>{activeCup?.label ?? (cupFormats.length ? "Choose a cup" : "No cups available")}</Text>
            </View>
            <Text style={[styles.cupChevron, light && styles.mutedLight]}>{cupOpen ? "⌃" : "⌄"}</Text>
          </Pressable>
          {cupOpen && cupFormats.length ? (
            <View style={[styles.cupOptions, light && styles.panelLight]}>
              {cupFormats.map((item) => (
                <Pressable accessibilityRole="button" key={item.key} onPress={() => selectFormat(item.key)} style={styles.cupOption}>
                  <Text style={[styles.cupOptionText, light && styles.textLight]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {workspace !== "iv-rank" && activeCup && format?.rules.length ? (
        <View style={[styles.rules, light && styles.panelLight]}>
          <Pressable
            accessibilityLabel="Format rules"
            accessibilityRole="button"
            accessibilityState={{ expanded: rulesOpen }}
            onPress={() => {
              beginPerformance("pvp_rules_result_painted");
              setRulesOpen((open) => !open);
            }}
            style={styles.rulesSummary}
          >
            <Text style={[styles.eyebrow, light && styles.accentLight]}>FORMAT RULES</Text>
            <Text style={[styles.cupChevron, light && styles.mutedLight]}>{rulesOpen ? "⌃" : "⌄"}</Text>
          </Pressable>
          {rulesOpen ? <Text style={[styles.ruleText, light && styles.mutedLight]}>
            {format.rules.join(" · ")}
          </Text> : null}
        </View>
      ) : null}
      {workspace !== "iv-rank" ? (
        <View style={[styles.scopeRow, light && styles.sectionLight]}>
          {(
            [
              ["catalog", "All Pokémon"],
              ["owned", "My Pokémon"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: value === "owned" && !signedIn, selected: scope === value }}
              disabled={value === "owned" && !signedIn}
              key={value}
              onPress={() => selectScope(value)}
              style={[
                styles.scopeButton,
                scope === value && styles.scopeActive,
                value === "owned" && !signedIn && styles.disabled,
              ]}
            >
              <View style={styles.iconLabelRow}>
                <NativeUiIcon color={scope === value ? '#071313' : light ? '#172124' : '#e5f0ef'} name={value === 'catalog' ? 'catalog' : 'trainers'} size={14} />
                <Text
                  style={[
                    styles.scopeText,
                    light && styles.textLight,
                    scope === value && styles.scopeTextActive,
                  ]}
                >
                  {label}{value === 'owned' && scope === 'owned' ? `   ${isLoading ? '…' : roster.summary.eligibleCount}` : ''}
                </Text>
              </View>
            </Pressable>
          ))}
          {scope === 'owned' ? (
            <Text accessibilityLiveRegion="polite" style={[styles.scopeDescription, light && styles.mutedLight]}>
              {isLoading ? 'Loading your caught Pokémon…' : rosterDetails}
            </Text>
          ) : null}
        </View>
      ) : null}
      {isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color="#299cf5" />
          <Text style={[styles.stateCopy, light && styles.mutedLight]}>
            Loading PvP snapshot…
          </Text>
        </View>
      ) : null}
      {error ? (
        <View accessibilityRole="alert" style={styles.error}>
          <Text style={styles.errorTitle}>PvP tools unavailable</Text>
          <Text style={styles.errorCopy}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={styles.retry}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
  const sourceFooter = payload?.source ? (
    <View style={[styles.sourceFooter, light && styles.panelLight]}>
      <Text style={[styles.sourceCopy, light && styles.mutedLight]}>
        Battle-simulation rankings from{" "}
        <Text
          accessibilityRole="link"
          onPress={() => void Linking.openURL(payload.source!.url).catch(() => undefined)}
          style={[styles.sourceLink, light && styles.accentLight]}
        >
          {payload.source.name}
        </Text>
        ; filtered to the current Pokémon Go Nexus catalog.
      </Text>
      <Text style={[styles.sourceDetail, light && styles.mutedLight]}>
        {scope === "owned"
          ? activeOwnedEvaluation.response
            ? `My Pokémon evaluates every recorded build locally against ${activeOwnedEvaluation.response.fieldSize} current meta opponents.`
            : "My Pokémon shows every recorded build; species scores remain visible until its local evaluation is available."
          : "Recommended IVs maximize performance for the selected format, not rarity."}
      </Text>
    </View>
  ) : null;
  if (deferredWorkspace === "rankings")
    return (
      <View
        style={[styles.root, light && styles.rootLight]}
        testID="native-pvp-screen"
      >
        <Animated.View style={[styles.workspaceViewport, workspaceMotion.contentStyle]} testID="native-pvp-workspace-motion">
          <FlatList
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingTop: 8 + insets.top,
            paddingBottom: 96 + insets.bottom,
          }}
          data={rankingRows.slice(0, visibleLimit)}
          keyExtractor={(row) => row.key}
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled
          ListHeaderComponent={
            <>
              {header}
              <View style={styles.roleRail}>
                {ROLES.map(([value, label, icon]) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: role === value }}
                    key={value}
                    onPress={() => {
                      beginPerformance("pvp_role_result_painted");
                      setRole(value);
                      setExpanded(null);
                      setVisibleLimit(50);
                    }}
                    style={[
                      styles.role,
                      light && styles.controlLight,
                      role === value && styles.roleActive,
                    ]}
                  >
                    <View style={styles.roleLabel}>
                      <NativeUiIcon color={role === value ? light ? '#174e78' : '#f5ffff' : light ? '#172124' : '#e5f0ef'} name={icon} size={12} />
                      <Text
                      style={[
                        styles.roleText,
                        light && styles.textLight,
                        role === value && styles.roleTextActive,
                        role === value && light && styles.roleTextActiveLight,
                      ]}
                    >
                      {label}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              <View style={[styles.toolbar, light && styles.panelLight]}>
                <View style={styles.resultsHeading}>
                  <Text style={[styles.toolbarLabel, light && styles.accentLight]}>{ROLES.find(([value]) => value === role)?.[1]?.toLocaleUpperCase()} RANKINGS</Text>
                  <Text style={[styles.resultsTitle, light && styles.textLight]}>{format?.label ?? "Great League"}</Text>
                </View>
                <View style={[styles.searchWrap, light && styles.inputLight]}>
                  <NativeUiIcon color={light ? '#4c7073' : '#9db6b8'} name="search" size={18} />
                  <TextInput
                    accessibilityLabel="Search PvP rankings"
                    onChangeText={(value) => {
                      beginPerformance("pvp_search_result_painted");
                      setQuery(value);
                      setExpanded(null);
                      setVisibleLimit(50);
                    }}
                    placeholder="Pokémon, type, or move"
                    placeholderTextColor="#78868e"
                    style={[styles.search, light && styles.textLight]}
                    value={query}
                  />
                </View>
              </View>
            </>
          }
          ListEmptyComponent={
            !isLoading && !error ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, light && styles.textLight]}>
                  No battle-ready Pokémon
                </Text>
                <Text style={[styles.stateCopy, light && styles.mutedLight]}>
                  Try another format, roster, role, or search.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <PvpEntryCard
              assetBaseUrl={assetBaseUrl}
              cp={item.cp}
              entry={item.entry}
              entriesBySpeciesId={entriesBySpeciesId}
              expanded={expanded === item.key}
              nickname={item.nickname}
              onPress={() => {
                beginPerformance("pvp_ranking_detail_painted");
                setExpanded((current) =>
                  current === item.key ? null : item.key,
                )
              }}
              personalBuild={item.personalBuild}
              rank={index + 1}
              role={role}
            />
          )}
          ListFooterComponent={<>
            {visibleLimit < rankingRows.length ? (
              <Pressable accessibilityLabel={`Show next ${Math.min(50, rankingRows.length - visibleLimit)} PvP rankings`} accessibilityRole="button" onPress={() => { beginPerformance("pvp_more_result_painted"); setVisibleLimit((current) => current + 50); }} style={styles.showMore}>
                <Text style={styles.showMoreText}>Show next {Math.min(50, rankingRows.length - visibleLimit)}</Text>
              </Pressable>
            ) : null}
            {sourceFooter}
          </>}
          />
        </Animated.View>
      </View>
    );
  return (
    <View style={[styles.root, light && styles.rootLight]} testID="native-pvp-screen">
      <Animated.View style={[styles.workspaceViewport, workspaceMotion.contentStyle]} testID="native-pvp-workspace-motion">
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: 8 + insets.top, paddingBottom: 96 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="always"
          ref={workspaceScrollRef}
          nestedScrollEnabled
        >
          {header}
          {deferredWorkspace === "team" ? (
            <NativePvpTeamBuilder
          assetBaseUrl={assetBaseUrl}
          candidates={toolCandidates}
          entriesBySpeciesId={entriesBySpeciesId}
          fieldCandidates={fieldCandidates}
          key={`${format?.key ?? "great"}:${scope}`}
          light={light}
          mechanics={mechanics}
          onTestMatchup={openSeededBattle}
          persistSelection={persistTeamBuilder}
          storageKey={`${format?.key ?? "great"}:${scope}`}
        />
          ) : deferredWorkspace === "battle" ? (
            <NativePvpBattleLab
          assetBaseUrl={assetBaseUrl}
          candidates={toolCandidates}
          formatLabel={format?.label ?? "Great League"}
          initialSelection={battleSeed}
          key={[
            format?.key ?? "great",
            scope,
            battleSeed?.mode ?? "single",
            battleSeed?.leftTeamKeys?.join(",") ?? battleSeed?.leftKey ?? "",
            battleSeed?.rightTeamKeys?.join(",") ?? battleSeed?.rightKey ?? "",
          ].join(":")}
          light={light}
          mechanics={mechanics}
          opponentCandidates={scope === "owned" ? fieldCandidates : toolCandidates}
          onResultLayout={(offsetY) =>
            workspaceScrollRef.current?.scrollTo({
              animated: true,
              y: Math.max(0, offsetY - 16),
            })
          }
          playerSideLabel={scope === "owned" ? "Your team" : "Side A"}
        />
          ) : (
            <NativePvpIvRank
          assetBaseUrl={assetBaseUrl}
          catalog={catalog}
          cpLimit={format?.cpLimit ?? null}
          instances={instances}
          isLoading={Boolean(isLoading)}
          league={league}
          light={light}
          rankings={format?.entries ?? []}
          scope={scope}
          setScope={selectScope}
          signedIn={signedIn}
        />
          )}
          {deferredWorkspace !== "iv-rank" ? sourceFooter : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden", backgroundColor: "#0d1112" },
  workspaceViewport: { flex: 1, minHeight: 0 },
  rootLight: { backgroundColor: "#f8fff9" },
  scrollContent: { gap: 8, paddingHorizontal: 7 },
  textLight: { color: "#071d20" },
  mutedLight: { color: "#4c7073" },
  accentLight: { color: "#08766b" },
  panelLight: { borderColor: "#b2d2d2", backgroundColor: "#fff" },
  controlLight: { borderColor: "#bdc9cf", backgroundColor: "#fff" },
  cardLight: { borderColor: "#d5e7e7", backgroundColor: "#fff" },
  sectionLight: { borderColor: "#b2d2d2", backgroundColor: "#f8ffff" },
  methodLight: { borderColor: "#7dbdb9", backgroundColor: "#f8ffff" },
  countPillLight: { borderColor: "#e6a9c3", backgroundColor: "#fff3f8" },
  countTextLight: { color: "#a83567" },
  detailPillLight: { borderColor: "#7dbdb9", backgroundColor: "#fff" },
  inputLight: {
    borderColor: "#8dc3c3",
    color: "#071d20",
    backgroundColor: "#fbffff",
  },
  sourceFooter: { gap: 4, marginTop: 9, borderTopWidth: 1, borderColor: "rgba(115,204,204,0.28)", paddingHorizontal: 5, paddingTop: 11 },
  sourceCopy: { color: "#9db6b8", fontSize: 10, lineHeight: 15 },
  sourceLink: { color: "#42d5c2", fontWeight: "900", textDecorationLine: "underline" },
  sourceDetail: { color: "#9db6b8", fontSize: 9, lineHeight: 14 },
  topbar: {
    minHeight: 116,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    borderBottomWidth: 1,
    borderColor: "rgba(115,204,204,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  productIcon: { width: 48, height: 48 },
  headerCopy: { minWidth: 0, flex: 1, justifyContent: "center" },
  eyebrow: {
    color: "#8fc6cb",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: { color: "#f5ffff", fontSize: 27, fontWeight: "900" },
  headerActions: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  method: {
    minHeight: 39,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(115,204,204,0.5)",
    borderRadius: 999,
    paddingHorizontal: 13,
    backgroundColor: "rgba(66,213,194,0.06)",
  },
  methodText: { color: "#42d5c2", fontSize: 10, fontWeight: "900" },
  countPill: {
    minHeight: 39,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(237,111,165,0.42)",
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: "rgba(237,111,165,0.09)",
  },
  countText: { color: "#ffd7e8", fontSize: 11, fontWeight: "900" },
  workspaceRail: {
    marginTop: 8,
    borderColor: "rgba(115,204,204,0.28)",
    borderRadius: 9,
    backgroundColor: "#101516",
  },
  workspace: {
    minWidth: 0,
    minHeight: 43,
    borderRadius: 7,
    paddingHorizontal: 2,
  },
  workspaceIndicator: { borderRadius: 7, backgroundColor: "#42d5c2" },
  workspaceText: { color: "#9db6b8", fontSize: 9, fontWeight: "900", textAlign: "center" },
  workspaceLabel: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  workspaceIcon: { color: "#9db6b8", fontSize: 10 },
  workspaceTextActive: { color: "#071313" },
  leagueTabs: {
    flexDirection: "row",
    gap: 4,
    marginTop: 7,
    borderWidth: 1,
    borderColor: "rgba(115,204,204,0.28)",
    borderRadius: 8,
    padding: 4,
    backgroundColor: "#101516",
  },
  league: {
    minWidth: 0,
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  leagueActive: { backgroundColor: "#42d5c2" },
  leagueTitle: { color: "#f5ffff", fontSize: 12, fontWeight: "900" },
  leagueDetail: { marginTop: 2, color: "#9db6b8", fontSize: 9, fontWeight: "700" },
  leagueTextActive: { color: "#071313" },
  leagueDetailActive: { color: "#123c39" },
  cupPicker: {
    minHeight: 53,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 5,
    borderWidth: 1,
    borderColor: "rgba(115,204,204,0.28)",
    borderRadius: 8,
    paddingHorizontal: 11,
    backgroundColor: "#101516",
  },
  cupIcon: { color: "#42d5c2", fontSize: 19 },
  cupCopy: { minWidth: 0, flex: 1 },
  cupLabel: { color: "#8fc6cb", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  cupValue: { marginTop: 2, color: "#f5ffff", fontSize: 11, fontWeight: "900" },
  cupChevron: { color: "#9db6b8", fontSize: 17 },
  cupOptions: { gap: 2, marginTop: 3, borderWidth: 1, borderColor: "rgba(115,204,204,0.28)", borderRadius: 8, padding: 5, backgroundColor: "#151a1b" },
  cupOption: { minHeight: 42, justifyContent: "center", borderBottomWidth: 1, borderColor: "rgba(115,204,204,0.15)", paddingHorizontal: 10 },
  cupOptionText: { color: "#f5ffff", fontSize: 11, fontWeight: "800" },
  rules: {
    gap: 4,
    marginTop: 5,
    borderWidth: 1,
    borderColor: "#34424a",
    borderRadius: 11,
    padding: 10,
    backgroundColor: "#151b20",
  },
  rulesSummary: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ruleText: { color: "#9eabb2", fontSize: 10, lineHeight: 15 },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 7,
    borderWidth: 1,
    borderColor: "rgba(115,204,204,0.28)",
    borderRadius: 8,
    padding: 5,
    backgroundColor: "#101516",
  },
  scopeButton: {
    minWidth: 0,
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(115,204,204,0.5)",
    borderRadius: 999,
    backgroundColor: "#151a1b",
  },
  scopeActive: { borderColor: "#42d5c2", backgroundColor: "#42d5c2" },
  scopeText: { color: "#f5ffff", fontSize: 11, fontWeight: "900" },
  scopeTextActive: { color: "#071313" },
  scopeDescription: { width: '100%', paddingHorizontal: 7, paddingVertical: 4, color: '#9db6b8', fontSize: 9.5, lineHeight: 14, textAlign: 'center' },
  roleRail: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingTop: 7 },
  role: {
    width: "24%",
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(115,204,204,0.5)",
    borderRadius: 5,
    paddingHorizontal: 2,
    backgroundColor: "#151a1b",
  },
  roleActive: { borderColor: "#54a9ef", backgroundColor: "rgba(84,169,239,0.18)", borderBottomWidth: 3 },
  roleText: { color: "#9db6b8", fontSize: 9, fontWeight: "900", textAlign: "center" },
  roleLabel: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
  roleIcon: { color: "#9db6b8", fontSize: 10 },
  roleTextActive: { color: "#f5ffff" },
  roleTextActiveLight: { color: "#174e78" },
  iconLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  toolbar: { gap: 8, marginTop: 7, marginBottom: 8, borderWidth: 1, borderColor: "rgba(115,204,204,0.28)", borderRadius: 8, padding: 8, backgroundColor: "#151a1b" },
  toolbarLabel: { color: "#8fc6cb", fontSize: 9, fontWeight: "900" },
  searchWrap: { minHeight: 45, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "rgba(115,204,204,0.5)", borderRadius: 999, paddingHorizontal: 12, backgroundColor: "#101516" },
  searchIcon: { color: "#9db6b8", fontSize: 22 },
  search: {
    minWidth: 0,
    flex: 1,
    minHeight: 43,
    color: "#f5ffff",
    fontSize: 14,
  },
  resultsHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  resultsTitle: { color: "#f5ffff", fontSize: 14, fontWeight: "900" },
  resultsMeta: { color: "#8d9ba2", fontSize: 10 },
  rankingCard: {
    minHeight: 104,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(141,192,194,0.17)",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#151a1b",
  },
  rankingExpanded: { borderColor: "rgba(115,204,204,0.5)" },
  rankingHeader: { minWidth: 0, minHeight: 86, flexDirection: "row", alignItems: "center", gap: 8 },
  rank: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(66,213,194,0.55)",
    borderRadius: 20,
  },
  rankGold: { borderColor: "#f4cf54", backgroundColor: "#f4cf54" },
  rankSilver: { borderColor: "#d6e6eb", backgroundColor: "#d6e6eb" },
  rankBronze: { borderColor: "#d88b51", backgroundColor: "#d88b51" },
  rankText: { color: "#f5ffff", fontSize: 13, fontWeight: "900" },
  rankTextTop: { color: "#142025" },
  pokemonImage: { width: 50, height: 50 },
  rankingCopy: { minWidth: 0, flex: 1 },
  buildRow: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 },
  identity: { minWidth: 0, flex: 1 },
  pokemonName: { color: "#f5ffff", fontSize: 13, fontWeight: "900" },
  nickname: { marginTop: 1, color: '#99a7ae', fontSize: 9, fontWeight: '700' },
  pokemonMeta: { marginTop: 2, color: "#99a7ae", fontSize: 9 },
  typeRow: { flexDirection: "row", gap: 3, marginTop: 2 },
  typeIcon: { width: 14, height: 14 },
  moves: { gap: 2, marginTop: 6 },
  moveRow: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 4 },
  moveIcon: { width: 13, height: 13 },
  moveLine: { minWidth: 0, flex: 1, color: "#d8e6e7", fontSize: 9, fontWeight: "700" },
  buildMeta: { minWidth: 72, alignItems: "flex-end" },
  score: {
    color: "#42d5c2",
    fontSize: 16,
    fontWeight: "900",
  },
  scoreLabel: { color: "#9db6b8", fontSize: 8, fontWeight: "800", textTransform: "capitalize" },
  level: { marginTop: 8, color: "#f5ffff", fontSize: 9, fontWeight: "900" },
  ivs: { color: "#9db6b8", fontSize: 8, fontWeight: "700" },
  detailPill: { marginTop: 5, borderWidth: 1, borderColor: "rgba(115,204,204,0.5)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  detailPillText: { color: "#f5ffff", fontSize: 8, fontWeight: "900" },
  expanded: {
    gap: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: "rgba(115,204,204,0.28)",
    paddingHorizontal: 2,
    paddingTop: 11,
  },
  detailSummary: { gap: 13 },
  detailPanel: { gap: 7 },
  detailPanelLight: { borderColor: "#d5e7e7", backgroundColor: "#fbffff" },
  detailTitle: { color: "#8fc6cb", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  detailBody: { color: "#9db6b8", fontSize: 9.5, lineHeight: 14 },
  roleProfileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  roleProfileRow: { width: "49%", alignItems: "stretch", gap: 3 },
  roleProfileLabel: { color: "#9db6b8", fontSize: 8, fontWeight: "800", textAlign: "center" },
  roleProfileTrack: { width: "100%", height: 4, overflow: "hidden", borderRadius: 999, backgroundColor: "#344149" },
  roleProfileTrackLight: { backgroundColor: "#d5dee2" },
  roleProfileFill: { height: "100%", borderRadius: 999, backgroundColor: "#42d5c2" },
  roleProfileScore: { color: "#f5ffff", fontSize: 8, fontWeight: "900", textAlign: "center" },
  battleStatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  battleStat: { width: "24%", gap: 2, borderLeftWidth: 2, borderColor: "#54a9ef", paddingLeft: 6, paddingVertical: 3 },
  battleStatLight: { backgroundColor: "#f5fbff" },
  battleStatLabel: { color: "#9db6b8", fontSize: 7.5, fontWeight: "800" },
  battleStatValue: { color: "#f5ffff", fontSize: 11, fontWeight: "900" },
  matchupGrid: { gap: 7, marginTop: 4 },
  matchupPanel: { gap: 6, borderLeftWidth: 3, paddingLeft: 9 },
  matchupStrong: { borderColor: "#42d5c2" },
  matchupThreat: { borderColor: "#ed6fa5" },
  matchupRow: { minHeight: 37, flexDirection: "row", alignItems: "center", gap: 7 },
  matchupImage: { width: 34, height: 34 },
  matchupCopy: { minWidth: 0, flex: 1 },
  matchupName: { color: "#f5ffff", fontSize: 9, fontWeight: "900" },
  matchupRating: { color: "#9db6b8", fontSize: 8 },
  moveOptions: { gap: 6, marginTop: 4 },
  moveOption: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "transparent", borderRadius: 6, padding: 5 },
  moveOptionSelected: { borderColor: "rgba(66,213,194,0.42)", backgroundColor: "rgba(66,213,194,0.08)" },
  moveOptionCopy: { minWidth: 0, flex: 1, gap: 2 },
  moveUseTrack: { height: 4, overflow: "hidden", borderRadius: 999, backgroundColor: "#344149" },
  moveUseFill: { height: "100%", borderRadius: 999, backgroundColor: "#ed6fa5" },
  showMore: { minHeight: 46, alignItems: "center", justifyContent: "center", marginVertical: 6, borderWidth: 1, borderColor: "rgba(115,204,204,0.5)", borderRadius: 7, backgroundColor: "rgba(66,213,194,0.06)" },
  showMoreText: { color: "#42d5c2", fontSize: 11, fontWeight: "900" },
  workspacePanel: {
    gap: 10,
    borderWidth: 1,
    borderColor: "#34434b",
    borderRadius: 15,
    padding: 13,
    backgroundColor: "#151b20",
  },
  teamSlots: { flexDirection: "row", gap: 7 },
  teamSlot: {
    minWidth: 0,
    flex: 1,
    minHeight: 116,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#414e56",
    borderRadius: 11,
    padding: 7,
    backgroundColor: "#11171b",
  },
  teamSlotFilled: { borderColor: "#42cc9f" },
  teamImage: { width: 58, height: 58, resizeMode: "contain" },
  plus: { color: "#299cf5", fontSize: 30 },
  teamRole: { color: "#fff", fontSize: 9, fontWeight: "900" },
  teamName: {
    minHeight: 26,
    color: "#9daab1",
    fontSize: 9,
    lineHeight: 12,
    textAlign: "center",
  },
  analysis: {
    gap: 4,
    borderTopWidth: 1,
    borderColor: "#34434b",
    paddingTop: 9,
  },
  analysisTitle: { color: "#fff", fontSize: 13, fontWeight: "900" },
  warning: { color: "#d5b46b", fontSize: 10, lineHeight: 15 },
  candidateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  candidate: {
    width: "31.7%",
    minHeight: 126,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#414e56",
    borderRadius: 11,
    padding: 7,
    backgroundColor: "#151b20",
  },
  candidateActive: { borderColor: "#42cc9f", backgroundColor: "#123c31" },
  candidateImage: { width: 70, height: 70, resizeMode: "contain" },
  candidateName: {
    minHeight: 28,
    color: "#fff",
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  candidateScore: { color: "#42cc9f", fontSize: 9, fontWeight: "900" },
  battlePair: { flexDirection: "row", gap: 8 },
  battleSide: {
    minWidth: 0,
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#414e56",
    borderRadius: 12,
    padding: 9,
    backgroundColor: "#11171b",
  },
  battleImage: { width: 105, height: 105, resizeMode: "contain" },
  verdict: {
    alignItems: "center",
    gap: 3,
    borderTopWidth: 1,
    borderColor: "#34434b",
    paddingTop: 10,
  },
  verdictLabel: {
    color: "#8f9da4",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
  verdictName: { color: "#42cc9f", fontSize: 18, fontWeight: "900" },
  pickerRail: { gap: 7, paddingVertical: 7 },
  picker: {
    width: 94,
    minHeight: 108,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#414e56",
    borderRadius: 10,
    padding: 7,
    backgroundColor: "#151b20",
  },
  pickerImage: { width: 66, height: 66, resizeMode: "contain" },
  ivPokemon: { flexDirection: "row", alignItems: "center", gap: 9 },
  ivImage: { width: 90, height: 90, resizeMode: "contain" },
  ivInputs: { flexDirection: "row", gap: 8 },
  ivField: { flex: 1 },
  ivLabel: {
    marginBottom: 4,
    color: "#9ba8af",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  ivInput: {
    minHeight: 47,
    borderWidth: 1,
    borderColor: "#46545d",
    borderRadius: 10,
    color: "#fff",
    backgroundColor: "#11171b",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  primary: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "#168ced",
  },
  primaryText: { color: "#fff", fontWeight: "900" },
  disabled: { opacity: 0.45 },
  ivResult: {
    alignItems: "center",
    gap: 4,
    borderTopWidth: 1,
    borderColor: "#34434b",
    paddingTop: 11,
  },
  ivRank: { color: "#42cc9f", fontSize: 25, fontWeight: "900" },
  ivTotal: { color: "#9ba8af", fontSize: 10 },
  ivStats: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
  },
  ivStatsText: { textAlign: "center" },
  ivStatValue: {
    color: "#299cf5",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  ivStatLabel: { color: "#8f9da4", fontSize: 8, textAlign: "center" },
  state: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 22,
  },
  stateCopy: {
    color: "#a8b5bc",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  error: {
    gap: 7,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#df5770",
    borderRadius: 12,
    padding: 13,
    backgroundColor: "#39151e",
  },
  errorTitle: { color: "#ffd8df", fontSize: 15, fontWeight: "900" },
  errorCopy: { color: "#ffb8c4", fontSize: 12 },
  retry: {
    alignSelf: "flex-start",
    minHeight: 40,
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: "#df5770",
  },
  retryText: { color: "#fff", fontWeight: "900" },
  empty: { alignItems: "center", gap: 5, padding: 40 },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
});
