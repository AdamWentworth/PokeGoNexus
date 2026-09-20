import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./Raid.css";
import PageState from '@/components/layout/PageState';
import ProductPageHeader from '@/components/layout/ProductPageHeader';
import { useInstancesStore } from "@/features/instances/store/useInstancesStore";
import { useVariantsStore } from "@/features/variants/store/useVariantsStore";
import { useAuthStore } from "@/stores/useAuthStore";
import type { PokemonVariant } from "@/types/pokemonVariants";
import { getStorageString, STORAGE_KEYS } from "@/utils/storage";
import ConfirmDialog from "../../components/modals/ConfirmDialog";
import LoadingSpinner from "../../components/LoadingSpinner";
import RaidCalibrationPanel from "./components/RaidCalibrationPanel";
import RaidBossCounterList from "./components/RaidBossCounterList";
import RaidBossDetails from "./components/RaidBossDetails";
import RaidBossPicker from "./components/RaidBossPicker";
import RaidCounterToolbar from "./components/RaidCounterToolbar";
import RaidModeTabs from "./components/RaidModeTabs";
import RaidModifiers from "./components/RaidModifiers";
import RaidModelProvenance from "./components/RaidModelProvenance";
import RaidRankingTable from "./components/RaidRankingTable";
import RaidRankingTypeFilter from "./components/RaidRankingTypeFilter";
import RaidRosterScope from "./components/RaidRosterScope";
import RaidObservationDialog from "./components/RaidObservationDialog";
import RaidPartyBuilder from "./components/RaidPartyBuilder";
import RaidSetupPanel from "./components/RaidSetupPanel";
import { TYPE_MAPPING } from "./utils/constants";
import {
  DEFAULT_RAID_RELOBBY_SECONDS,
  RAID_ROUTE_READY_MEASURE,
  RAID_TIER_PRESETS,
  calculateRaidBossStats,
  dedupeBestCounterPerVariant,
  dedupeBestTypeDpsPerVariant,
  estimateRaidGroup,
  getPrimaryRaidMetadataForVariant,
  getRaidTierKeyForVariant,
  isEligibleRaidAttacker,
  isEligibleRaidBoss,
  isShadowRaidTier,
  scoreBestRaidOverallAttackers,
  scoreRaidCounters,
  scoreRaidOverallAttackers,
  scoreRaidTypeDps,
  simulateRaidGroupAtTrainerCount,
  RAID_SIMULATION_MODEL_VERSION,
  type FriendshipKey,
  type MegaAllyBonusKey,
  type PartyPowerKey,
  type PartyPowerStrategy,
  type RaidBossMovesetMode,
  type RaidCounterSettings,
  type RaidDodgeStrategy,
  type RaidPartySimulationResult,
  type RaidTierKey,
  type ShadowBossMode,
} from "./utils/raidCalculations";
import {
  analyzeRaidCalibration,
  appendRaidCalibrationObservation,
  clearRaidCalibrationObservations,
  createRaidCalibrationObservation,
  loadRaidCalibrationObservations,
  type RaidCalibrationPredictionSource,
  type RaidObservationActual,
} from "./utils/raidCalibration";
import { scoreRaidCountersAsync } from "./utils/raidCounterWorkers";
import {
  DEFAULT_METRIC_SORT,
  DEFAULT_RAID_RANKING_TYPE,
  capitalize,
  getRaidVariantDisplayName,
  getUniqueByVariant,
  matchesCounterSearch,
  sortRaidMetricScores,
  type RaidMetricSortDirection,
  type RaidMetricSortKey,
  type RaidViewMode,
} from "./utils/raidViewModel";
import {
  buildRaidRoster,
  type RaidRosterScope as RaidRosterScopeValue,
} from "./utils/raidRoster";

const Raid: React.FC = () => {
  const routeReadyMeasured = useRef(false);
  const variants = useVariantsStore(
    (state) => state.variants,
  ) as PokemonVariant[];
  const loading = useVariantsStore((state) => state.variantsLoading);
  const movesLoading = useVariantsStore((state) => state.isMovesLoading);
  const raidDataLoading = useVariantsStore((state) => state.isRaidDataLoading);
  const ensureMoves = useVariantsStore((state) => state.ensureMoves);
  const ensureRaidData = useVariantsStore((state) => state.ensureRaidData);
  const instances = useInstancesStore((state) => state.instances);
  const instancesLoading = useInstancesStore((state) => state.instancesLoading);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const user = useAuthStore((state) => state.user);
  const calibrationOwnerKey =
    user?.user_id ??
    getStorageString(STORAGE_KEYS.deviceId) ??
    "signed-out-device";

  const [viewMode, setViewMode] = useState<RaidViewMode>("rankings");
  const [rosterScope, setRosterScope] = useState<RaidRosterScopeValue>(
    isLoggedIn ? "owned" : "catalog",
  );
  const [bossSearch, setBossSearch] = useState("");
  const [selectedBossId, setSelectedBossId] = useState<string>("");
  const [selectedType, setSelectedType] = useState(
    DEFAULT_RAID_RANKING_TYPE,
  );
  const [shadowRaid, setShadowRaid] = useState(false);
  const [shadowBossMode, setShadowBossMode] =
    useState<ShadowBossMode>("subdued");
  const [attackerSearch, setAttackerSearch] = useState("");
  const [attackerLevel, setAttackerLevel] =
    useState<RaidCounterSettings["attackerLevel"]>("50.0");
  const [friendship, setFriendship] = useState<FriendshipKey>("none");
  const [megaAllyBonus, setMegaAllyBonus] = useState<MegaAllyBonusKey>("none");
  const [partyPower, setPartyPower] = useState<PartyPowerKey>("none");
  const [partyPowerStrategy, setPartyPowerStrategy] =
    useState<PartyPowerStrategy>("immediate");
  const [dodgeStrategy, setDodgeStrategy] = useState<RaidDodgeStrategy>("none");
  const [weatherBoostedType, setWeatherBoostedType] = useState("none");
  const [relobbySeconds, setRelobbySeconds] = useState(
    DEFAULT_RAID_RELOBBY_SECONDS,
  );
  const [bossMovesetMode, setBossMovesetMode] =
    useState<RaidBossMovesetMode>("expected");
  const [bestOnly, setBestOnly] = useState(true);
  const [rankingSettingsOpen, setRankingSettingsOpen] = useState(false);
  const [sortMetric, setSortMetric] =
    useState<RaidMetricSortKey>(DEFAULT_METRIC_SORT);
  const [sortDirection, setSortDirection] =
    useState<RaidMetricSortDirection>("descending");
  const [bossCounterScores, setBossCounterScores] = useState<
    ReturnType<typeof scoreRaidCounters>
  >([]);
  const [bossCounterScoresLoading, setBossCounterScoresLoading] =
    useState(false);
  const [calibrationObservations, setCalibrationObservations] = useState(
    loadRaidCalibrationObservations,
  );
  const [dodgeCalibrationEnabled, setDodgeCalibrationEnabled] = useState(false);
  const [observationDialogOpen, setObservationDialogOpen] = useState(false);
  const [clearCalibrationConfirmOpen, setClearCalibrationConfirmOpen] =
    useState(false);
  const [customPartyResult, setCustomPartyResult] =
    useState<RaidPartySimulationResult | null>(null);
  const [customPartyPrediction, setCustomPartyPrediction] = useState<{
    source: RaidCalibrationPredictionSource;
    scenarioKey: string;
  } | null>(null);

  const calibrationProfile = useMemo(
    () =>
      analyzeRaidCalibration(
        calibrationObservations.filter(
          (observation) =>
            observation.ownerKey === calibrationOwnerKey &&
            observation.modelVersion === RAID_SIMULATION_MODEL_VERSION,
        ),
      ),
    [calibrationObservations, calibrationOwnerKey],
  );

  useEffect(() => {
    void ensureMoves();
    void ensureRaidData();
  }, [ensureMoves, ensureRaidData]);

  useEffect(() => {
    setRosterScope(isLoggedIn ? "owned" : "catalog");
  }, [isLoggedIn]);

  useEffect(() => {
    setDodgeCalibrationEnabled(false);
  }, [calibrationOwnerKey]);

  const bossOptions = useMemo(
    () =>
      getUniqueByVariant(variants.filter(isEligibleRaidBoss)).sort((a, b) => {
        const aHasRaidData = (a.raid_boss?.length ?? 0) > 0 ? 0 : 1;
        const bHasRaidData = (b.raid_boss?.length ?? 0) > 0 ? 0 : 1;
        return (
          aHasRaidData - bHasRaidData ||
          a.pokedex_number - b.pokedex_number ||
          getRaidVariantDisplayName(a).localeCompare(
            getRaidVariantDisplayName(b),
          )
        );
      }),
    [variants],
  );

  const selectedBoss =
    bossOptions.find((boss) => boss.variant_id === selectedBossId) ??
    bossOptions[0] ??
    null;

  useEffect(() => {
    if (!selectedBossId && bossOptions.length > 0) {
      setSelectedBossId(bossOptions[0].variant_id);
    }
  }, [bossOptions, selectedBossId]);

  const filteredBossOptions = useMemo(() => {
    const query = bossSearch.trim().toLowerCase();
    if (!query) return [];
    return bossOptions
      .filter(
        (boss) =>
          getRaidVariantDisplayName(boss).toLowerCase().includes(query) ||
          String(boss.pokedex_number).padStart(4, "0").includes(query),
      )
      .slice(0, 6);
  }, [bossOptions, bossSearch]);

  const catalogAttackers = useMemo(
    () => getUniqueByVariant(variants.filter(isEligibleRaidAttacker)),
    [variants],
  );
  const raidRoster = useMemo(
    () => buildRaidRoster(variants, instances),
    [instances, variants],
  );
  const attackers =
    rosterScope === "owned" ? raidRoster.attackers : catalogAttackers;
  const personalized = rosterScope === "owned";

  const selectedTierKey: RaidTierKey = selectedBoss
    ? (getRaidTierKeyForVariant(selectedBoss) ?? "legendary")
    : "legendary";
  const selectedTier = RAID_TIER_PRESETS[selectedTierKey];
  const selectedBossIsShadowRaid = isShadowRaidTier(selectedTierKey);
  const shadowMechanicsEnabled = selectedBossIsShadowRaid || shadowRaid;
  const activeShadowBossMode: ShadowBossMode = shadowMechanicsEnabled
    ? shadowBossMode
    : "normal";
  const settings = useMemo<RaidCounterSettings>(
    () => ({
      attackerLevel,
      friendship,
      megaAllyBonus,
      partyPower,
      partyPowerStrategy,
      dodgeStrategy,
      weatherBoostedType:
        weatherBoostedType === "none" ? "" : weatherBoostedType,
      shadowBossMode: activeShadowBossMode,
      bossMovesetMode,
      relobbySeconds,
      dodgeSuccessRate:
        dodgeCalibrationEnabled && calibrationProfile.canApplyDodgeCalibration
          ? calibrationProfile.dodgeSuccessRate
          : 1,
    }),
    [
      activeShadowBossMode,
      attackerLevel,
      bossMovesetMode,
      friendship,
      megaAllyBonus,
      partyPower,
      partyPowerStrategy,
      dodgeStrategy,
      dodgeCalibrationEnabled,
      calibrationProfile.canApplyDodgeCalibration,
      calibrationProfile.dodgeSuccessRate,
      relobbySeconds,
      weatherBoostedType,
    ],
  );

  useEffect(() => {
    if (viewMode !== "boss" || !selectedBoss) {
      setBossCounterScores([]);
      setBossCounterScoresLoading(false);
      return;
    }

    if (attackers.length === 0) {
      setBossCounterScores([]);
      setBossCounterScoresLoading(false);
      return;
    }

    setBossCounterScores([]);
    setBossCounterScoresLoading(true);

    if (typeof Worker !== "function") {
      setBossCounterScores(
        scoreRaidCounters(attackers, selectedBoss, selectedTier, settings),
      );
      setBossCounterScoresLoading(false);
      return;
    }

    const controller = new AbortController();
    void scoreRaidCountersAsync(
      attackers,
      selectedBoss,
      selectedTier,
      settings,
      bestOnly,
      controller.signal,
    )
      .then((scores) => {
        if (!controller.signal.aborted) {
          setBossCounterScores(scores);
          setBossCounterScoresLoading(false);
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setBossCounterScores(
          scoreRaidCounters(attackers, selectedBoss, selectedTier, settings),
        );
        setBossCounterScoresLoading(false);
      });

    return () => controller.abort();
  }, [attackers, bestOnly, selectedBoss, selectedTier, settings, viewMode]);

  const raidScores = useMemo(() => {
    const scored = bestOnly
      ? dedupeBestCounterPerVariant(bossCounterScores)
      : bossCounterScores;
    return scored
      .filter((score) => matchesCounterSearch(score, attackerSearch))
      .slice(0, 30);
  }, [attackerSearch, bestOnly, bossCounterScores]);

  const customPartyScores = useMemo(
    () => dedupeBestCounterPerVariant(bossCounterScores),
    [bossCounterScores],
  );

  const handleCustomPartyResultChange = useCallback(
    (
      result: RaidPartySimulationResult | null,
      source?: RaidCalibrationPredictionSource,
      scenarioKey?: string,
    ) => {
      setCustomPartyResult(result);
      setCustomPartyPrediction(
        result && source && scenarioKey ? { source, scenarioKey } : null,
      );
    },
    [],
  );

  const overallRankingScores = useMemo(() => {
    if (viewMode !== "rankings" || selectedType) return [];
    return bestOnly
      ? scoreBestRaidOverallAttackers(attackers, settings, bossOptions)
      : scoreRaidOverallAttackers(attackers, settings);
  }, [attackers, bestOnly, bossOptions, selectedType, settings, viewMode]);

  const overallScores = useMemo(() => {
    return sortRaidMetricScores(
      overallRankingScores.filter((score) =>
        matchesCounterSearch(score, attackerSearch),
      ),
      sortMetric,
      sortDirection,
    ).slice(0, 30);
  }, [attackerSearch, overallRankingScores, sortDirection, sortMetric]);

  useEffect(() => {
    if (
      routeReadyMeasured.current ||
      viewMode !== "rankings" ||
      loading ||
      movesLoading ||
      overallScores.length === 0 ||
      typeof performance === "undefined"
    ) {
      return;
    }

    routeReadyMeasured.current = true;
    performance.clearMeasures(RAID_ROUTE_READY_MEASURE);
    performance.measure(RAID_ROUTE_READY_MEASURE, {
      start: 0,
      end: performance.now(),
    });
  }, [loading, movesLoading, overallScores.length, viewMode]);

  const typeDpsRankingScores = useMemo(() => {
    if (viewMode !== "rankings" || !selectedType) return [];
    const allScores = scoreRaidTypeDps(
      attackers,
      selectedType,
      settings,
      bossOptions,
    );
    return bestOnly ? dedupeBestTypeDpsPerVariant(allScores) : allScores;
  }, [attackers, bestOnly, bossOptions, selectedType, settings, viewMode]);

  const typeDpsScores = useMemo(() => {
    return sortRaidMetricScores(
      typeDpsRankingScores.filter((score) =>
        matchesCounterSearch(score, attackerSearch),
      ),
      sortMetric,
      sortDirection,
    ).slice(0, 30);
  }, [attackerSearch, typeDpsRankingScores, sortDirection, sortMetric]);

  const typeRankingActive = selectedType.length > 0;
  const rankingScores = typeRankingActive ? typeDpsScores : overallScores;
  const rankingHeading = `${personalized ? "Your top" : "Top"}${
    typeRankingActive ? ` ${capitalize(selectedType)}` : ""
  } raid attackers`;
  const rankingAriaLabel = rankingHeading;

  const groupEstimate = useMemo(() => {
    if (viewMode !== "boss") return null;
    if (!selectedBoss) return null;
    return estimateRaidGroup(
      bossCounterScores,
      selectedBoss,
      selectedTier,
      settings,
    );
  }, [bossCounterScores, selectedBoss, selectedTier, settings, viewMode]);

  const bossStats = selectedBoss
    ? calculateRaidBossStats(selectedBoss, selectedTier, activeShadowBossMode)
    : null;
  const bossMetadata = selectedBoss
    ? getPrimaryRaidMetadataForVariant(selectedBoss)
    : null;
  const typeOptions = Object.values(TYPE_MAPPING).map((type) => type.name);
  const bossSearchActive = bossSearch.trim().length > 0;
  const modifierProps = {
    typeOptions,
    attackerLevel,
    onAttackerLevelChange: setAttackerLevel,
    friendship,
    onFriendshipChange: setFriendship,
    megaAllyBonus,
    onMegaAllyBonusChange: setMegaAllyBonus,
    partyPower,
    onPartyPowerChange: setPartyPower,
    partyPowerStrategy,
    onPartyPowerStrategyChange: setPartyPowerStrategy,
    weatherBoostedType,
    onWeatherBoostedTypeChange: setWeatherBoostedType,
    relobbySeconds,
    onRelobbySecondsChange: setRelobbySeconds,
    dodgeStrategy,
    onDodgeStrategyChange: setDodgeStrategy,
    bossMovesetMode,
    onBossMovesetModeChange: setBossMovesetMode,
    shadowMechanicsEnabled,
    selectedBossIsShadowRaid,
    shadowRaid,
    onShadowRaidChange: setShadowRaid,
    shadowBossMode,
    onShadowBossModeChange: setShadowBossMode,
    includeAttackerLevel: !personalized,
  };

  const handleBossSelect = (boss: PokemonVariant) => {
    setSelectedBossId(boss.variant_id);
    setBossSearch("");
  };

  const handleMetricSort = (metric: RaidMetricSortKey) => {
    if (sortMetric === metric) {
      setSortDirection((previous) =>
        previous === "descending" ? "ascending" : "descending",
      );
      return;
    }

    setSortMetric(metric);
    setSortDirection("descending");
  };

  const handleSaveObservation = (actual: RaidObservationActual) => {
    if (!selectedBoss) return;

    const exactPartyPrediction =
      customPartyResult &&
      customPartyResult.trainers.length === actual.trainerCount;
    const prediction = exactPartyPrediction
      ? customPartyResult
      : simulateRaidGroupAtTrainerCount(
          bossCounterScores,
          selectedBoss,
          selectedTier,
          settings,
          actual.trainerCount,
        );
    if (!prediction) return;

    const observation = createRaidCalibrationObservation({
      ownerKey: calibrationOwnerKey,
      modelVersion: RAID_SIMULATION_MODEL_VERSION,
      catalogVersion:
        getStorageString(STORAGE_KEYS.pokemonCatalogVersion) ?? "unknown",
      bossVariantId: selectedBoss.variant_id,
      bossName: getRaidVariantDisplayName(selectedBoss),
      tierKey: selectedTierKey,
      predictionSource: exactPartyPrediction
        ? (customPartyPrediction?.source ?? "custom-party")
        : "group-estimate",
      scenarioKey: exactPartyPrediction
        ? (customPartyPrediction?.scenarioKey ??
          `custom-party-${actual.trainerCount}`)
        : `group-estimate-${actual.trainerCount}`,
      dodgeCalibrationApplied:
        dodgeCalibrationEnabled && calibrationProfile.canApplyDodgeCalibration,
      predicted: {
        clearTimeSeconds: prediction.projectedTimeToWinSeconds,
        faints: prediction.faints,
        relobbies: prediction.relobbies,
        winRate: prediction.distribution.winRate,
        p10ClearTimeSeconds:
          prediction.distribution.timeToWinSeconds.p10 || null,
        p90ClearTimeSeconds:
          prediction.distribution.timeToWinSeconds.p90 || null,
      },
      actual,
    });

    setCalibrationObservations(appendRaidCalibrationObservation(observation));
    setObservationDialogOpen(false);
  };

  const handleClearCalibration = () => {
    setCalibrationObservations(
      clearRaidCalibrationObservations(calibrationOwnerKey),
    );
    setDodgeCalibrationEnabled(false);
    setClearCalibrationConfirmOpen(false);
  };

  const handleExportCalibration = () => {
    const observations = calibrationObservations.filter(
      (observation) =>
        observation.ownerKey === calibrationOwnerKey &&
        observation.modelVersion === RAID_SIMULATION_MODEL_VERSION,
    );
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            modelVersion: RAID_SIMULATION_MODEL_VERSION,
            observations,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pokegonexus-raid-calibration-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (loading || movesLoading || (viewMode === "boss" && raidDataLoading)) {
    return <LoadingSpinner />;
  }

  if (catalogAttackers.length === 0) {
    return (
      <div className="raid-page">
        <ProductPageHeader
          className="raid-product-header"
          description="Rank attackers, prepare counters, and build teams for current raid bosses."
          eyebrow="Battle planning"
          icon={<img src="/images/btn_raid.png" alt="" />}
          title="Raid Planner"
        />
        <PageState
          className="raid-empty-state"
          description="Once the Pokédex data finishes loading, the planner can rank raid attackers."
          title="No raid-ready attacker data yet."
        />
      </div>
    );
  }

  return (
    <div className="raid-page">
      <ProductPageHeader
        className="raid-product-header"
        description="Rank attackers, prepare counters, and build teams for current raid bosses."
        eyebrow="Battle planning"
        icon={<img src="/images/btn_raid.png" alt="" />}
        title="Raid Planner"
      />
      <RaidModeTabs viewMode={viewMode} onChange={setViewMode} />
      <RaidRosterScope
        scope={rosterScope}
        onChange={setRosterScope}
        isLoggedIn={isLoggedIn}
        loading={instancesLoading}
        summary={raidRoster}
      />

      {viewMode === "rankings" && (
        <section className="raid-layout raid-overall-layout">
          <main className="raid-panel raid-main-panel raid-overall-panel">
            <RaidRankingTypeFilter
              selectedType={selectedType}
              typeOptions={typeOptions}
              onChange={setSelectedType}
            />

            <header className="raid-leaderboard-header">
              <h1>{rankingHeading}</h1>
              <div className="raid-leaderboard-meta">
                <RaidModelProvenance />
              </div>
            </header>

            <RaidCounterToolbar
              label="Attacker search"
              search={attackerSearch}
              onSearchChange={setAttackerSearch}
              bestOnly={bestOnly}
              onBestOnlyChange={setBestOnly}
              includeRankingSettings
              rankingSettingsOpen={rankingSettingsOpen}
              onRankingSettingsOpenChange={setRankingSettingsOpen}
            />

            {rankingSettingsOpen && (
              <section
                className="raid-ranking-settings"
                aria-label="Ranking settings"
              >
                <RaidModifiers
                  {...modifierProps}
                  includeShadowControls={false}
                  includeRelobbyControls
                  includeBossMovesetControls={typeRankingActive}
                />
              </section>
            )}

            <RaidRankingTable
              ariaLabel={rankingAriaLabel}
              scores={rankingScores}
              attackerLevel={attackerLevel}
              sortMetric={sortMetric}
              sortDirection={sortDirection}
              onSort={handleMetricSort}
              emptyMessage={
                personalized ? (
                  typeRankingActive ? (
                    <>
                      None of your caught Pokémon have a usable{" "}
                      {capitalize(selectedType)} moveset for this ranking.
                    </>
                  ) : (
                    "No caught attackers match the current filters. Add level, IV, and move details to improve personalized rankings."
                  )
                ) : typeRankingActive ? (
                  <>
                    No eligible attackers have a {capitalize(selectedType)} fast
                    or charged move.
                  </>
                ) : (
                  "No attackers match the current filters."
                )
              }
            />
          </main>
        </section>
      )}

      {viewMode === "boss" &&
        (selectedBoss && bossStats ? (
          <section className="raid-layout">
            <RaidBossPicker
              selectedBoss={selectedBoss}
              bossCp={bossStats.bossCp}
              search={bossSearch}
              searchActive={bossSearchActive}
              filteredBossOptions={filteredBossOptions}
              onSearchChange={setBossSearch}
              onBossSelect={handleBossSelect}
            />

            <main className="raid-panel raid-main-panel">
              <RaidCounterToolbar
                label="Counter search"
                search={attackerSearch}
                onSearchChange={setAttackerSearch}
                bestOnly={bestOnly}
                onBestOnlyChange={setBestOnly}
              />

              <RaidSetupPanel tierLabel={selectedTier.label}>
                {groupEstimate && (
                  <>
                    <RaidBossDetails
                      tier={selectedTier}
                      bossStats={bossStats}
                      groupEstimate={groupEstimate}
                      metadata={bossMetadata}
                    />
                    <RaidPartyBuilder
                      scores={customPartyScores}
                      boss={selectedBoss}
                      tier={selectedTier}
                      settings={settings}
                      onResultChange={handleCustomPartyResultChange}
                    />
                  </>
                )}

                <RaidCalibrationPanel
                  profile={calibrationProfile}
                  enabled={dodgeCalibrationEnabled}
                  disabled={
                    bossCounterScoresLoading ||
                    bossCounterScores.length === 0 ||
                    !groupEstimate
                  }
                  onEnabledChange={setDodgeCalibrationEnabled}
                  onLogRaid={() => setObservationDialogOpen(true)}
                  onExport={handleExportCalibration}
                  onClear={() => setClearCalibrationConfirmOpen(true)}
                />

                <RaidModifiers
                  {...modifierProps}
                  includeShadowControls
                  includeRelobbyControls
                  includeBossMovesetControls
                  includeMonteCarloOption
                  collapsible
                />

                {shadowMechanicsEnabled && (
                  <section className="raid-shadow-note">
                    <strong>Purified Gem reminder</strong>
                    <span>
                      Each Trainer can use up to 5 Purified Gems. It takes
                      coordinated Gems to subdue an enraged Shadow Raid Boss,
                      so solo attempts should use the enraged estimate.
                    </span>
                  </section>
                )}

                <RaidModelProvenance />
              </RaidSetupPanel>

              {bossCounterScoresLoading ? (
                <div className="raid-list-empty" role="status">
                  Modeling raid timelines…
                </div>
              ) : personalized && attackers.length === 0 ? (
                <section className="raid-calculation-status" role="status">
                  <strong>No caught raid-ready Pokémon</strong>
                  <span>
                    Mark Pokémon as caught to build a personalized counter team
                    for {selectedBoss.name}.
                  </span>
                </section>
              ) : bossCounterScores.length === 0 ? (
                <section className="raid-calculation-status" role="status">
                  <strong>No compatible raid counters</strong>
                  <span>
                    The selected roster has no legal movesets for this battle.
                  </span>
                </section>
              ) : (
                <RaidBossCounterList
                  scores={raidScores}
                  attackerLevel={attackerLevel}
                />
              )}
            </main>
          </section>
        ) : (
          <section className="raid-empty-state">
            <div className="raid-panel-header">
              <p className="raid-eyebrow">Boss counters</p>
              <h2>No raid boss data yet.</h2>
            </div>
            <p>
              Overall and type leaderboards can still rank attackers while boss
              data loads.
            </p>
          </section>
        ))}

      {observationDialogOpen && selectedBoss && groupEstimate && (
        <RaidObservationDialog
          bossName={getRaidVariantDisplayName(selectedBoss)}
          defaultTrainerCount={
            customPartyResult?.trainers.length ??
            Math.max(1, groupEstimate.minTrainers)
          }
          onCancel={() => setObservationDialogOpen(false)}
          onSave={handleSaveObservation}
        />
      )}
      {clearCalibrationConfirmOpen && (
        <ConfirmDialog
          message="Clear your locally stored raid observations? This cannot be undone."
          onCancel={() => setClearCalibrationConfirmOpen(false)}
          onConfirm={handleClearCalibration}
        />
      )}
    </div>
  );
};

export default Raid;
