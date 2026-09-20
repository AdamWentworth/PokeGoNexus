import { useEffect, useMemo, useState } from 'react';
import { FaChartBar, FaChevronDown, FaCrosshairs, FaSearch } from 'react-icons/fa';
import { useSearchParams } from 'react-router';

import ProductPageHeader from '@/components/layout/ProductPageHeader';
import SegmentedControl from '@/components/layout/SegmentedControl';
import { AppLoadingFallback } from '@/contexts/AppLoadingContext';
import { useAuthStore } from '@/stores/useAuthStore';

import MaxBossPicker from './components/MaxBossPicker';
import MaxBattleSimulator from './components/MaxBattleSimulator';
import MaxRankingList from './components/MaxRankingList';
import MaxRoleTabs from './components/MaxRoleTabs';
import MaxRosterScope from './components/MaxRosterScope';
import MaxTypeFilter from './components/MaxTypeFilter';
import { useMaxBattleData } from './hooks/useMaxBattleData';
import {
  getMaxBattleCatalog,
  MAX_BATTLE_TYPES,
  rankMaxBattlePokemon,
  type MaxRole,
  type MaxRoleCandidates,
} from './utils/maxBattleModel';
import {
  getDefaultMaxBattleTier,
  getMaxBattleBossPreset,
  getMaxBattleTierOptions,
  type MaxBattleTier,
} from './utils/maxBattleSimulation';
import {
  buildMaxRoster,
  type MaxRosterScope as MaxRosterScopeValue,
} from './utils/maxRoster';

import './Max.css';

type MaxView = 'rankings' | 'bosses';

const MAX_VIEW_ITEMS = [
  {
    icon: <FaChartBar />,
    label: 'Max rankings',
    value: 'rankings',
  },
  {
    icon: <FaCrosshairs />,
    label: 'Boss teams',
    value: 'bosses',
  },
] as const;

const MAX_RESULTS_PAGE_SIZE = 18;
const MAX_BOSS_RESULTS_INITIAL_SIZE = 3;
const MAX_BOSS_RESULTS_PAGE_SIZE = 9;
const MAX_ROLES: MaxRole[] = ['damage', 'tank', 'healing'];

const isMaxRole = (value: string | null): value is MaxRole =>
  MAX_ROLES.includes(value as MaxRole);

const isMaxType = (value: string | null): value is string =>
  value != null && (MAX_BATTLE_TYPES as readonly string[]).includes(value);

const isMaxBattleTier = (value: string | null): value is MaxBattleTier =>
  value != null &&
  (['one-star', 'two-star', 'three-star', 'legendary', 'gigantamax'] as const)
    .includes(value as MaxBattleTier);

const roleHeading = (role: MaxRole, selectedType: string): string => {
  const type = selectedType
    ? `${selectedType.charAt(0).toUpperCase()}${selectedType.slice(1)}`
    : '';
  if (type && role === 'tank') return `Top tanks vs ${type}`;
  if (type && role === 'healing') return `Top healers vs ${type}`;
  if (role === 'damage') return `Top ${type ? `${type} ` : ''}damage dealers`;
  if (role === 'tank') return 'Top tanks';
  return 'Top healers';
};

const bossRoleHeading = (role: MaxRole, bossName: string): string => {
  if (role === 'damage') return `Top damage picks vs ${bossName}`;
  if (role === 'tank') return `Top tanks vs ${bossName}`;
  return `Top healers vs ${bossName}`;
};

const Max = () => {
  const {
    variants,
    variantsLoading: loading,
    movesLoading,
    instances,
    instancesLoading,
  } = useMaxBattleData();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [searchParams, setSearchParams] = useSearchParams();
  const [scopeDirection, setScopeDirection] = useState<'forward' | 'backward'>(
    'forward',
  );
  const [search, setSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(MAX_RESULTS_PAGE_SIZE);
  const [bossVisibleLimit, setBossVisibleLimit] = useState(
    MAX_BOSS_RESULTS_INITIAL_SIZE,
  );

  const view: MaxView = searchParams.get('view') === 'bosses' ? 'bosses' : 'rankings';
  const requestedScope = searchParams.get('scope');
  const rosterScope: MaxRosterScopeValue =
    requestedScope === 'catalog' || !isLoggedIn ? 'catalog' : 'owned';
  const requestedRole = searchParams.get('role');
  const role: MaxRole = isMaxRole(requestedRole) ? requestedRole : 'damage';
  const requestedType = searchParams.get('type')?.toLowerCase() ?? null;
  const selectedType = isMaxType(requestedType) ? requestedType : '';
  const selectedBossId = searchParams.get('boss') ?? '';

  const updateSearchParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next, { replace: true });
  };

  const changeView = (nextView: MaxView) =>
    updateSearchParams({ view: nextView === 'rankings' ? null : nextView });

  const changeRole = (nextRole: MaxRole) =>
    updateSearchParams({ role: nextRole === 'damage' ? null : nextRole });

  const changeType = (nextType: string) =>
    updateSearchParams({ type: nextType || null });

  const maxCatalog = useMemo(() => getMaxBattleCatalog(variants), [variants]);
  const maxRoster = useMemo(
    () => buildMaxRoster(variants, instances),
    [instances, variants],
  );
  const rankingCatalog =
    rosterScope === 'owned' ? maxRoster.pokemon : maxCatalog;
  const selectedBoss =
    maxCatalog.find((boss) => boss.variant_id === selectedBossId) ?? maxCatalog[0];

  const requestedDifficulty = searchParams.get('difficulty');
  const availableDifficulties = selectedBoss
    ? getMaxBattleTierOptions(selectedBoss)
    : [];
  const difficulty =
    selectedBoss &&
    isMaxBattleTier(requestedDifficulty) &&
    availableDifficulties.includes(requestedDifficulty)
      ? requestedDifficulty
      : selectedBoss
        ? getDefaultMaxBattleTier(selectedBoss)
        : null;
  const bossPreset =
    selectedBoss && difficulty
      ? getMaxBattleBossPreset(selectedBoss, difficulty)
      : null;
  const requestedTrainerCount = Number(searchParams.get('trainers'));
  const trainerCount = bossPreset
    ? Math.min(
        bossPreset.maxTrainers,
        Math.max(
          1,
          Number.isFinite(requestedTrainerCount) && requestedTrainerCount > 0
            ? Math.round(requestedTrainerCount)
            : bossPreset.defaultTrainers,
        ),
      )
    : 1;

  const rankingEntries = useMemo(
    () =>
      rankMaxBattlePokemon(rankingCatalog, {
        role,
        selectedType: selectedType || undefined,
      }),
    [rankingCatalog, role, selectedType],
  );

  const filteredRankings = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rankingEntries;
    return rankingEntries
      .filter((entry) =>
        `${entry.variant.name} ${entry.fastMove.name} ${entry.maxMoveName} ${entry.maxMoveType}`
          .toLowerCase()
          .includes(query),
      );
  }, [rankingEntries, search]);

  const visibleRankings = useMemo(
    () => filteredRankings.slice(0, visibleLimit),
    [filteredRankings, visibleLimit],
  );

  useEffect(() => {
    setVisibleLimit(MAX_RESULTS_PAGE_SIZE);
  }, [role, rosterScope, search, selectedType, view]);

  const bossRoleCandidates = useMemo<MaxRoleCandidates>(() => {
    const empty: MaxRoleCandidates = { damage: [], tank: [], healing: [] };
    if (!selectedBoss) return empty;

    return {
      damage: rankMaxBattlePokemon(rankingCatalog, {
        role: 'damage',
        boss: selectedBoss,
      }),
      tank: rankMaxBattlePokemon(rankingCatalog, {
        role: 'tank',
        boss: selectedBoss,
      }),
      healing: rankMaxBattlePokemon(rankingCatalog, {
        role: 'healing',
        boss: selectedBoss,
      }),
    };
  }, [rankingCatalog, selectedBoss]);

  const bossRankingEntries = bossRoleCandidates[role];
  const visibleBossRankings = useMemo(
    () => bossRankingEntries.slice(0, bossVisibleLimit),
    [bossRankingEntries, bossVisibleLimit],
  );

  useEffect(() => {
    setBossVisibleLimit(MAX_BOSS_RESULTS_INITIAL_SIZE);
  }, [role, rosterScope, selectedBossId, view]);

  const changeRosterScope = (nextScope: MaxRosterScopeValue) => {
    if (nextScope === rosterScope) return;
    setScopeDirection(nextScope === 'owned' ? 'forward' : 'backward');
    const defaultScope = isLoggedIn ? 'owned' : 'catalog';
    updateSearchParams({ scope: nextScope === defaultScope ? null : nextScope });
  };

  const rankingAssumptions =
    rosterScope === 'owned'
      ? 'Recorded level · recorded IVs · recorded Fast Move · unlocked Max Move levels'
      : 'Level 50 · 15/15/15 IVs · Max Moves Level 3';

  if (loading && variants.length === 0) {
    return <AppLoadingFallback source="max-battles" />;
  }

  return (
    <main className="max-page">
      <div className="max-page-inner">
        <ProductPageHeader
          className="max-product-header"
          eyebrow="Power Spot strategy"
          icon={<img src="/images/dynamax.png" alt="" />}
          meta={
            <strong className="max-page-count">
              {maxCatalog.length} Max-ready Pokémon
            </strong>
          }
          title="Max Battles"
        />

        <SegmentedControl
          ariaLabel="Max Battle tools"
          className="max-view-switcher"
          items={MAX_VIEW_ITEMS}
          onChange={changeView}
          value={view}
        />

        <MaxRosterScope
          scope={rosterScope}
          onChange={changeRosterScope}
          isLoggedIn={isLoggedIn}
          loading={instancesLoading}
          summary={maxRoster}
        />

        <div
          className={`max-scope-stage max-scope-stage--${scopeDirection}`}
          data-roster-scope={rosterScope}
          key={rosterScope}
        >
          {view === 'rankings' ? (
          <>
            <section className="max-ranking-filter-deck" aria-label="Ranking filters">
              <MaxRoleTabs label="Ranking role" role={role} onChange={changeRole} />
              <MaxTypeFilter
                role={role}
                selectedType={selectedType}
                onChange={changeType}
              />
            </section>

            <section className="max-results-panel" aria-labelledby="max-rankings-title">
              <div className="max-results-toolbar">
                <div>
                  <span className="max-results-context">
                    <span>{selectedType || 'All Max Pokémon'}</span>
                    <strong>{filteredRankings.length} ranked</strong>
                  </span>
                  <h2 id="max-rankings-title">{roleHeading(role, selectedType)}</h2>
                  <p
                    aria-label="Ranking assumptions"
                    className="max-ranking-assumptions"
                  >
                    {rankingAssumptions}
                  </p>
                </div>
                <label className="max-ranking-search">
                  <FaSearch aria-hidden="true" />
                  <input
                    aria-label="Search Max rankings"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Pokémon or move"
                    type="search"
                    value={search}
                  />
                </label>
              </div>
              {(movesLoading ||
                (rosterScope === 'owned' && instancesLoading)) &&
              rankingEntries.length === 0 ? (
                <div className="max-ranking-empty" role="status">
                  <strong>Preparing Max rankings</strong>
                  <span>
                    {rosterScope === 'owned'
                      ? 'Loading your caught Max Pokémon.'
                      : 'Loading current move pools.'}
                  </span>
                </div>
              ) : (
                <>
                  <MaxRankingList entries={visibleRankings} role={role} />
                  {visibleRankings.length < filteredRankings.length && (
                    <footer className="max-results-more">
                      <span>
                        Showing {visibleRankings.length} of {filteredRankings.length}
                      </span>
                      <button
                        onClick={() =>
                          setVisibleLimit((current) =>
                            Math.min(
                              filteredRankings.length,
                              current + MAX_RESULTS_PAGE_SIZE,
                            ),
                          )
                        }
                        type="button"
                      >
                        <FaChevronDown aria-hidden="true" />
                        Show{' '}
                        {Math.min(
                          MAX_RESULTS_PAGE_SIZE,
                          filteredRankings.length - visibleRankings.length,
                        )}{' '}
                        more
                      </button>
                    </footer>
                  )}
                </>
              )}
            </section>
          </>
        ) : selectedBoss ? (
          <>
            <MaxBossPicker
              bosses={maxCatalog}
              selectedBoss={selectedBoss}
              onSelect={(boss) =>
                updateSearchParams({
                  boss: boss.variant_id,
                  difficulty: null,
                  trainers: null,
                })
              }
            />
            <MaxBattleSimulator
              boss={selectedBoss}
              candidates={bossRoleCandidates}
              difficulty={difficulty ?? getDefaultMaxBattleTier(selectedBoss)}
              onDifficultyChange={(nextDifficulty) =>
                updateSearchParams({
                  difficulty:
                    nextDifficulty === getDefaultMaxBattleTier(selectedBoss)
                      ? null
                      : nextDifficulty,
                  trainers: null,
                })
              }
              onTrainerCountChange={(count) =>
                updateSearchParams({
                  trainers:
                    bossPreset && count === bossPreset.defaultTrainers
                      ? null
                      : String(count),
                })
              }
              rosterScope={rosterScope}
              trainerCount={trainerCount}
            />
            <MaxRoleTabs label="Boss team role" role={role} onChange={changeRole} />
            <aside className="max-boss-benchmark-note" aria-label="Boss ranking method">
              <strong>Standardized matchup</strong>
              <span>
                {rosterScope === 'owned'
                  ? 'Recorded level, IVs, Fast Move, and unlocked Max Move levels'
                  : 'Level 50 · 15/15/15 IVs · level-3 Max moves'}{' '}
                ·{' '}
                {bossRankingEntries[0]?.bossBenchmark?.pressureSource ===
                'legal-movesets'
                  ? 'expected pressure across legal boss movesets'
                  : 'typed benchmark pressure when boss moves are unavailable'}
              </span>
            </aside>
            <section
              className="max-results-panel max-boss-role-results"
              aria-labelledby="max-boss-role-title"
            >
              <div className="max-results-toolbar max-boss-role-toolbar">
                <div>
                  <span className="max-results-context">
                    <span>Role alternatives</span>
                    <strong>{bossRankingEntries.length} ranked</strong>
                  </span>
                  <h2 id="max-boss-role-title">{bossRoleHeading(role, selectedBoss.name)}</h2>
                  <p className="max-ranking-assumptions">
                    Compare replacements for the selected role in your three-Pokémon
                    party.
                  </p>
                </div>
              </div>
              <MaxRankingList entries={visibleBossRankings} role={role} />
              {visibleBossRankings.length < bossRankingEntries.length && (
                <footer className="max-results-more">
                  <span>
                    Showing {visibleBossRankings.length} of {bossRankingEntries.length}
                  </span>
                  <button
                    onClick={() =>
                      setBossVisibleLimit((current) =>
                        Math.min(
                          bossRankingEntries.length,
                          current + MAX_BOSS_RESULTS_PAGE_SIZE,
                        ),
                      )
                    }
                    type="button"
                  >
                    <FaChevronDown aria-hidden="true" />
                    Show{' '}
                    {Math.min(
                      MAX_BOSS_RESULTS_PAGE_SIZE,
                      bossRankingEntries.length - visibleBossRankings.length,
                    )}{' '}
                    more
                  </button>
                </footer>
              )}
            </section>
          </>
        ) : (
          <div className="max-results-panel max-ranking-empty">
            <strong>No Max Battle bosses available</strong>
            <span>The current catalog does not contain released Max-ready Pokémon.</span>
          </div>
          )}
        </div>

        <details className="max-method-note">
          <summary>How Max roles are ranked</summary>
          <div>
            <p>
              <strong>Damage:</strong> Attack × active Max or G-Max power × STAB ×
              effectiveness. <strong>Tank:</strong> effective bulk ÷ Fast Move time,
              with the active Max Guard level shown separately.
            </p>
            <p>
              <strong>Healing:</strong> the active Max Spirit level restores a share of
              the user&apos;s HP to each active Pokémon; the group figure uses four active
              Pokémon. All Pokémon use level 50, perfect IVs, and level-3 Max Moves;
              My Pokémon use each caught copy&apos;s recorded battle details.
            </p>
          </div>
        </details>
      </div>
    </main>
  );
};

export default Max;
