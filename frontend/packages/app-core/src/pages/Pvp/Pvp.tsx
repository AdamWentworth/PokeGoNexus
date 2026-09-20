import { useEffect, useMemo, useState } from 'react';
import {
  FaBalanceScale,
  FaBookOpen,
  FaBolt,
  FaCalculator,
  FaChartLine,
  FaChevronDown,
  FaExchangeAlt,
  FaFistRaised,
  FaFlag,
  FaFlask,
  FaInfoCircle,
  FaListOl,
  FaSearch,
  FaTrophy,
  FaUser,
  FaUsers,
} from 'react-icons/fa';
import type { IconType } from 'react-icons';
import { Link } from 'react-router';

import ProductPageHeader from '@/components/layout/ProductPageHeader';
import SegmentedControl from '@/components/layout/SegmentedControl';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useBootstrapInstances } from '@/features/instances/hooks/useBootstrapInstances';
import { useBootstrapVariants } from '@/features/variants/hooks/useBootstrapVariants';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { hasHydratedMoves } from '@/features/variants/utils/prepareVariantChunkHydration';
import { useAuthStore } from '@/stores/useAuthStore';
import { getTypeIconPath } from '@/utils/imageHelpers';
import { resolveAssetUrl } from '@/utils/assetUrl';
import type {
  PokemonPvPFormat,
  PokemonPvPLeagueKey,
  PokemonPvPRankingEntry,
} from '@shared-contracts/pokemon';

import { usePvPRankings } from './hooks/usePvPRankings';
import { usePvPMoveMechanics } from './hooks/usePvPMoveMechanics';
import PvpBattleLab from './components/PvpBattleLab';
import PvpIvRank from './components/PvpIvRank';
import PvpTeamBuilder from './components/PvpTeamBuilder';
import {
  buildOwnedPvPRoster,
  type PvPRosterScope,
} from './utils/pvpRoster';
import {
  applyPvPRosterEvaluation,
} from './utils/pvpRosterEvaluation';
import { useOwnedPvPRosterEvaluation } from './hooks/useOwnedPvPRosterEvaluation';
import { formatPvPSpeciesName } from './utils/pvpTeamBuilder';
import { hydratePvPRankingEntry } from './utils/pvpMoveHydration';
import { resolvePvPBattleMechanics } from './utils/pvpBattleMechanics';
import './Pvp.css';


const LEAGUES: Array<{
  key: PokemonPvPLeagueKey;
  label: string;
  detail: string;
}> = [
  { key: 'great', label: 'Great', detail: '1,500 CP' },
  { key: 'ultra', label: 'Ultra', detail: '2,500 CP' },
  { key: 'master', label: 'Master', detail: 'No CP limit' },
];

const INITIAL_LIMIT = 50;
const EMPTY_OWNED_ROSTER = {
  entries: [],
  caughtCount: 0,
  eligibleCount: 0,
  incompleteCount: 0,
  missingCpCount: 0,
  missingLevelOrIvCount: 0,
  missingMoveCount: 0,
  overCapCount: 0,
  unmatchedCount: 0,
} as const;

const isLeagueKey = (value: string): value is PokemonPvPLeagueKey =>
  value === 'great' || value === 'ultra' || value === 'master';

type PvPRoleKey =
  | 'overall'
  | 'lead'
  | 'closer'
  | 'switch'
  | 'charger'
  | 'attacker'
  | 'consistency';

type PvPWorkspace = 'rankings' | 'team' | 'battle' | 'iv-rank';
const PVP_WORKSPACE_ITEMS = [
  { icon: <FaListOl />, label: 'Rankings', value: 'rankings' },
  { icon: <FaUsers />, label: 'Team Builder', value: 'team' },
  { icon: <FaFlask />, label: 'Battle Lab', value: 'battle' },
  { icon: <FaCalculator />, label: 'IV Rank', value: 'iv-rank' },
] as const;

type PvPBattleSeed = {
  mode?: 'single' | 'team';
  leftKey: string;
  rightKey: string;
  leftTeamKeys?: string[];
  rightTeamKeys?: string[];
};

const ROLES: Array<{
  key: PvPRoleKey;
  label: string;
  icon: IconType;
  scoreIndex: number | null;
}> = [
  { key: 'overall', label: 'Overall', icon: FaChartLine, scoreIndex: null },
  { key: 'lead', label: 'Lead', icon: FaFlag, scoreIndex: 0 },
  { key: 'closer', label: 'Closer', icon: FaFistRaised, scoreIndex: 1 },
  { key: 'switch', label: 'Switch', icon: FaExchangeAlt, scoreIndex: 2 },
  { key: 'charger', label: 'Charger', icon: FaBolt, scoreIndex: 3 },
  { key: 'attacker', label: 'Attacker', icon: FaFistRaised, scoreIndex: 4 },
  { key: 'consistency', label: 'Consistency', icon: FaBalanceScale, scoreIndex: 5 },
];

const rankTier = (rank: number): string => {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return 'standard';
};

const formatLevel = (level: number): string =>
  Number.isInteger(level) ? String(level) : level.toFixed(1);

function TypeIcons({ types }: { types: string[] }) {
  return (
    <span className="pvp-types" role="img" aria-label={types.join(' and ')}>
      {types.map((type) => (
        <img
          key={type}
          src={getTypeIconPath(type)}
          alt=""
          title={type}
          draggable={false}
        />
      ))}
    </span>
  );
}

function Moveset({ entry }: { entry: PokemonPvPRankingEntry }) {
  return (
    <div className="pvp-moveset">
      {entry.moveset.map((move) => (
        <span
          className={`pvp-move pvp-move--${move.kind}`}
          key={`${entry.speciesId}-${move.kind}-${move.id}`}
        >
          <img src={getTypeIconPath(move.type)} alt="" draggable={false} />
          <span>{move.name}</span>
        </span>
      ))}
    </div>
  );
}

function scoreForRole(
  entry: PokemonPvPRankingEntry,
  role: (typeof ROLES)[number],
): number {
  if (role.scoreIndex === null) return entry.score;
  return entry.categoryScores[role.scoreIndex] ?? entry.score;
}

function MatchupList({
  title,
  items,
  entriesBySpeciesId,
  kind,
}: {
  title: string;
  items: PokemonPvPRankingEntry['matchups'];
  entriesBySpeciesId: Map<string, PokemonPvPRankingEntry>;
  kind: 'strong' | 'threat';
}) {
  return (
    <section className={`pvp-matchups pvp-matchups--${kind}`}>
      <h3>{title}</h3>
      {items.length > 0 ? (
        <div>
          {items.map((matchup) => {
            const opponent = entriesBySpeciesId.get(matchup.speciesId);
            return (
              <div key={`${kind}-${matchup.speciesId}`}>
                {opponent?.imageUrl && (
                  <img
                    src={resolveAssetUrl(opponent.imageUrl)}
                    alt=""
                    loading="lazy"
                    draggable={false}
                  />
                )}
                <span>
                  <strong>
                    {opponent?.name ?? formatPvPSpeciesName(matchup.speciesId)}
                  </strong>
                  <small>{matchup.rating.toFixed(0)} battle rating</small>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p>Matchup details are not available in this snapshot.</p>
      )}
    </section>
  );
}

function RankingDetails({
  entry,
  entriesBySpeciesId,
  personalBuild,
}: {
  entry: PokemonPvPRankingEntry;
  entriesBySpeciesId: Map<string, PokemonPvPRankingEntry>;
  personalBuild: boolean;
}) {
  const selectedMoves = new Set(entry.moveset.map((move) => move.id));
  const moveUsage = entry.moveUsage ?? [];
  const maxMoveUses = Math.max(1, ...moveUsage.map((move) => move.uses));

  return (
    <div className="pvp-ranking-details-inner">
      <div className="pvp-detail-summary">
        <section className="pvp-role-profile">
          <h3>Role profile</h3>
          <div>
            {ROLES.slice(1).map((role) => {
              const score = scoreForRole(entry, role);
              return (
                <span key={role.key}>
                  <small>{role.label}</small>
                  <i>
                    <b style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
                  </i>
                  <strong>{score.toFixed(1)}</strong>
                </span>
              );
            })}
          </div>
        </section>

        <section className="pvp-battle-stats">
          <h3>Battle build</h3>
          <div>
            <span>
              <small>Attack</small>
              <strong>{entry.battleAttack?.toFixed(1) ?? '---'}</strong>
            </span>
            <span>
              <small>Defense</small>
              <strong>{entry.battleDefense?.toFixed(1) ?? '---'}</strong>
            </span>
            <span>
              <small>HP</small>
              <strong>{entry.battleHp ?? '---'}</strong>
            </span>
            <span>
              <small>Stat product</small>
              <strong>{entry.statProduct?.toLocaleString() ?? '---'}</strong>
            </span>
          </div>
        </section>
      </div>

      <div className="pvp-matchup-grid">
        <MatchupList
          title={personalBuild ? 'Strong species matchups' : 'Strong matchups'}
          items={entry.matchups ?? []}
          entriesBySpeciesId={entriesBySpeciesId}
          kind="strong"
        />
        <MatchupList
          title={personalBuild ? 'Species threats' : 'Key threats'}
          items={entry.counters ?? []}
          entriesBySpeciesId={entriesBySpeciesId}
          kind="threat"
        />
      </div>

      {moveUsage.length > 0 && (
        <section className="pvp-move-options">
          <h3>Simulated move options</h3>
          <div>
            {moveUsage.map((move) => (
              <span
                key={`${move.kind}-${move.id}`}
                className={selectedMoves.has(move.id) ? 'selected' : ''}
              >
                <img src={getTypeIconPath(move.type)} alt="" draggable={false} />
                <strong>{move.name}</strong>
                <small>{move.kind === 'fast' ? 'Fast' : 'Charged'}</small>
                <i>
                  <b style={{ width: `${(move.uses / maxMoveUses) * 100}%` }} />
                </i>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RankingRow({
  entry,
  rank,
  score,
  scoreLabel,
  cp,
  nickname,
  expanded,
  onToggle,
  entriesBySpeciesId,
  personalBuild,
}: {
  entry: PokemonPvPRankingEntry;
  rank: number;
  score: number;
  scoreLabel: string;
  cp?: number;
  nickname?: string | null;
  expanded: boolean;
  onToggle: () => void;
  entriesBySpeciesId: Map<string, PokemonPvPRankingEntry>;
  personalBuild: boolean;
}) {
  const ivSpread = `${entry.attackIv}/${entry.defenseIv}/${entry.staminaIv}`;
  return (
    <section className={`pvp-ranking-item${expanded ? ' expanded' : ''}`}>
      <article className="pvp-ranking-row">
        <span className={`pvp-rank pvp-rank--${rankTier(rank)}`}>
          {rank}
        </span>

        <div className="pvp-pokemon">
          <img
            className="pvp-pokemon-image"
            src={resolveAssetUrl(entry.imageUrl)}
            alt=""
            loading="lazy"
            draggable={false}
          />
          <div>
            <strong>{entry.name}</strong>
            {nickname && <span className="pvp-nickname">{nickname}</span>}
            <TypeIcons types={entry.types} />
          </div>
        </div>

        <Moveset entry={entry} />

        <div className="pvp-score">
          <strong>{score.toFixed(1)}</strong>
          <span>{scoreLabel}</span>
        </div>

        <div className="pvp-build">
          <strong>Level {formatLevel(entry.recommendedLevel)}</strong>
          {cp != null && <span>CP {cp.toLocaleString()}</span>}
          <span>{ivSpread} IV</span>
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Show'} details for ${entry.name}`}
            onClick={onToggle}
          >
            <span>{expanded ? 'Hide' : 'Details'}</span>
            <FaChevronDown aria-hidden="true" />
          </button>
        </div>
      </article>
      <div className="pvp-ranking-details" aria-hidden={!expanded}>
        {expanded && (
          <RankingDetails
            entry={entry}
            entriesBySpeciesId={entriesBySpeciesId}
            personalBuild={personalBuild}
          />
        )}
      </div>
    </section>
  );
}

const Pvp = () => {
  const { data, loading, error } = usePvPRankings();
  const variants = useVariantsStore((state) => state.variants);
  const variantsLoading = useVariantsStore((state) => state.variantsLoading);
  const movesLoading = useVariantsStore((state) => state.isMovesLoading);
  const instances = useInstancesStore((state) => state.instances);
  const instancesLoading = useInstancesStore((state) => state.instancesLoading);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [formatKey, setFormatKey] = useState<string>('great');
  const [workspace, setWorkspace] = useState<PvPWorkspace>('rankings');
  const [roleKey, setRoleKey] = useState<PvPRoleKey>('overall');
  const [rosterScope, setRosterScope] = useState<PvPRosterScope>('catalog');
  const [search, setSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_LIMIT);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [battleSeed, setBattleSeed] = useState<PvPBattleSeed | null>(null);
  const battleToolsRequested = workspace === 'team' || workspace === 'battle';
  const moveMechanics = usePvPMoveMechanics(battleToolsRequested);
  const ownedRosterRequested = rosterScope === 'owned';
  const ivRankRequested = workspace === 'iv-rank';
  const ownedRankingRequested =
    rosterScope === 'owned' && workspace !== 'iv-rank';

  // PvP rankings use their own lightweight payload. Load the much larger
  // catalog only for personal rosters or IV Rank, and load Trainer instances
  // only when the personal roster is opened.
  useBootstrapVariants(ownedRosterRequested || ivRankRequested);
  useBootstrapInstances(ownedRosterRequested);

  useEffect(() => {
    if (!isLoggedIn) setRosterScope('catalog');
  }, [isLoggedIn]);

  const cupFormats = useMemo(() => data?.formats ?? [], [data?.formats]);
  const activeCup = useMemo(
    () => cupFormats.find((format) => format.key === formatKey),
    [cupFormats, formatKey],
  );
  const battleMechanics = useMemo(
    () => resolvePvPBattleMechanics(formatKey, activeCup),
    [activeCup, formatKey],
  );
  const activeLeagueKey: PokemonPvPLeagueKey = activeCup?.league === 'little'
    ? 'great'
    : activeCup?.league ?? (isLeagueKey(formatKey) ? formatKey : 'great');
  const activeLeague = LEAGUES.find((item) => item.key === activeLeagueKey) ?? LEAGUES[0];
  const activeFormatLabel =
    activeCup?.label ??
    data?.leagues[activeLeagueKey]?.label ??
    `${activeLeague.label} League`;
  const entries = useMemo(
    () => activeCup?.entries ?? data?.leagues[activeLeagueKey]?.entries ?? [],
    [activeCup, activeLeagueKey, data],
  );
  const cpLimit = activeCup?.cpLimit ?? data?.leagues[activeLeagueKey]?.cpLimit ?? null;
  const entriesBySpeciesId = useMemo(
    () => new Map(entries.map((entry) => [entry.speciesId, entry])),
    [entries],
  );
  const ownedRoster = useMemo(
    () => ownedRankingRequested
      ? buildOwnedPvPRoster(entries, variants, instances, cpLimit)
      : EMPTY_OWNED_ROSTER,
    [cpLimit, entries, instances, ownedRankingRequested, variants],
  );
  const ownedEvaluation = useOwnedPvPRosterEvaluation(
    ownedRankingRequested,
    ownedRoster.entries,
    entries,
    variants,
    formatKey,
    battleMechanics,
  );
  const evaluatedOwnedEntries = useMemo(
    () => applyPvPRosterEvaluation(
      ownedRoster.entries,
      ownedEvaluation.response,
    ),
    [ownedEvaluation.response, ownedRoster.entries],
  );
  const scopedEntries = useMemo(
    () => rosterScope === 'owned'
      ? evaluatedOwnedEntries.map((owned) => ({
        entry: owned.entry,
        key: owned.instanceId,
        cp: owned.cp,
        nickname: owned.nickname,
      }))
      : entries.map((entry) => ({
        entry,
        key: entry.speciesId,
        cp: undefined,
        nickname: null,
      })),
    [entries, evaluatedOwnedEntries, rosterScope],
  );
  const fieldCandidates = useMemo(
    () => entries.map((entry) => ({
      entry,
      key: entry.speciesId,
      cp: undefined,
      nickname: null,
    })),
    [entries],
  );
  const battleToolEntries = useMemo(
    () => {
      const moveLookup = moveMechanics.data;
      return moveLookup
        ? scopedEntries.map((candidate) => ({
          ...candidate,
          entry: hydratePvPRankingEntry(candidate.entry, moveLookup),
        }))
        : scopedEntries;
    },
    [moveMechanics.data, scopedEntries],
  );
  const battleToolFieldCandidates = useMemo(
    () => {
      const moveLookup = moveMechanics.data;
      return moveLookup
        ? fieldCandidates.map((candidate) => ({
          ...candidate,
          entry: hydratePvPRankingEntry(candidate.entry, moveLookup),
        }))
        : fieldCandidates;
    },
    [fieldCandidates, moveMechanics.data],
  );
  const activeRole = ROLES.find((item) => item.key === roleKey) ?? ROLES[0];
  const rankedEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scopedEntries
      .filter(({ entry, nickname }) => {
        if (!query) return true;
        return [
          entry.name,
          entry.speciesId,
          nickname ?? '',
          ...entry.types,
          ...entry.moveset.flatMap((move) => [move.name, move.type]),
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .map((item) => ({
        ...item,
        score: scoreForRole(item.entry, activeRole),
      }))
      .sort((left, right) => (
        right.score - left.score ||
        left.entry.rank - right.entry.rank ||
        left.entry.name.localeCompare(right.entry.name)
      ))
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));
  }, [activeRole, scopedEntries, search]);

  useEffect(() => {
    setVisibleLimit(INITIAL_LIMIT);
    setExpandedKey(null);
  }, [formatKey, roleKey, rosterScope, search, workspace]);

  useEffect(() => {
    if (data && !isLeagueKey(formatKey) && !activeCup) {
      setFormatKey('great');
    }
  }, [activeCup, data, formatKey]);

  const visibleEntries = rankedEntries.slice(0, visibleLimit);
  const cachedMovesAvailable = useMemo(
    () => hasHydratedMoves(variants),
    [variants],
  );
  const ownedLoading =
    ownedRankingRequested &&
    (
      (variantsLoading && variants.length === 0) ||
      (movesLoading && !cachedMovesAvailable) ||
      (instancesLoading && Object.keys(instances).length === 0)
    );
  const pageLoading = loading || ownedLoading;
  const battleToolsLoading =
    pageLoading || (battleToolsRequested && moveMechanics.loading);
  const battleToolsError =
    error || (battleToolsRequested ? moveMechanics.error : null);
  const ownedLoadingMessage =
    variantsLoading && variants.length === 0
      ? 'Loading the Pokémon catalog...'
      : instancesLoading && Object.keys(instances).length === 0
        ? 'Loading your caught Pokémon...'
        : 'Loading move data for your caught Pokémon...';
  const rosterDetails = [
    `${ownedRoster.eligibleCount} fully detailed from ${ownedRoster.caughtCount} caught`,
    ownedEvaluation.loading
      ? 'evaluating levels, IVs, and moves on this device'
      : ownedEvaluation.response
        ? `evaluated locally against ${ownedEvaluation.response.fieldSize} meta opponents`
        : ownedEvaluation.error
          ? 'species baseline shown; local build evaluation unavailable'
          : '',
    ownedRoster.overCapCount > 0
      ? `${ownedRoster.overCapCount} over the format cap`
      : '',
    ownedRoster.missingCpCount > 0
      ? `${ownedRoster.missingCpCount} need CP`
      : '',
    ownedRoster.missingLevelOrIvCount > 0
      ? `${ownedRoster.missingLevelOrIvCount} need level or IVs`
      : '',
    ownedRoster.missingMoveCount > 0
      ? `${ownedRoster.missingMoveCount} need a Fast and Charged Move`
      : '',
    ownedRoster.unmatchedCount > 0
      ? `${ownedRoster.unmatchedCount} unavailable in this format ranking`
      : '',
  ].filter(Boolean).join(' · ');

  const changeWorkspace = (nextWorkspace: PvPWorkspace) => {
    if (nextWorkspace === 'battle') setBattleSeed(null);
    if (nextWorkspace === 'iv-rank') setFormatKey(activeLeagueKey);
    setWorkspace(nextWorkspace);
  };

  return (
    <div className="pvp-page">
      <div className="pvp-page-inner">
        <ProductPageHeader
          actions={
            <div className="pvp-header-actions">
              <Link to="/pvp/methodology">
                <FaInfoCircle aria-hidden="true" />
                <span>Method</span>
              </Link>
              <strong>
                {workspace === 'iv-rank'
                  ? '4,096 spreads'
                  : rosterScope === 'owned'
                    ? `${ownedRoster.eligibleCount} ready`
                    : `${entries.length || '---'} ranked`}
              </strong>
            </div>
          }
          className="pvp-product-header"
          eyebrow="Trainer Battles"
          icon={<img src="/images/btn_pvp.png" alt="" draggable={false} />}
          title={
            workspace === 'rankings'
              ? 'PvP Rankings'
              : workspace === 'team'
                ? 'PvP Team Builder'
                : workspace === 'battle'
                  ? 'PvP Battle Lab'
                  : 'PvP IV Rank'
          }
        />

        <SegmentedControl
          ariaLabel="PvP workspace"
          className="pvp-workspace-switcher"
          items={PVP_WORKSPACE_ITEMS}
          onChange={changeWorkspace}
          value={workspace}
        />

        <section
          className={`pvp-format-controls${
            workspace === 'iv-rank' ? ' pvp-format-controls--league-only' : ''
          }`}
        >
          <nav className="pvp-league-tabs" aria-label="PvP league">
            {LEAGUES.map((item) => (
              <button
                type="button"
                key={item.key}
                className={formatKey === item.key ? 'active' : ''}
                aria-pressed={formatKey === item.key}
                onClick={() => setFormatKey(item.key)}
              >
                <span>{item.label}</span>
                <small>{item.detail}</small>
              </button>
            ))}
          </nav>
          {workspace !== 'iv-rank' && (
            <label className="pvp-cup-picker">
              <FaTrophy aria-hidden="true" />
              <span>
                <small>Current cups</small>
                <select
                  value={activeCup?.key ?? ''}
                  onChange={(event) => {
                    if (event.target.value) setFormatKey(event.target.value);
                  }}
                  disabled={cupFormats.length === 0}
                  aria-label="Current PvP cup"
                >
                  <option value="">
                    {cupFormats.length > 0 ? 'Choose a cup' : 'No cups available'}
                  </option>
                  {cupFormats.map((format: PokemonPvPFormat) => (
                    <option value={format.key} key={format.key}>
                      {format.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          )}
        </section>

        {workspace !== 'iv-rank' && activeCup && activeCup.rules.length > 0 && (
          <details className="pvp-format-rules">
            <summary>Format rules</summary>
            <ul>
              {activeCup.rules.map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
          </details>
        )}

        {workspace !== 'iv-rank' && (
          <section className="pvp-roster-scope" aria-label="PvP roster">
            <div role="group" aria-label="Pokemon source">
              <button
                type="button"
                className={rosterScope === 'catalog' ? 'active' : ''}
                aria-pressed={rosterScope === 'catalog'}
                onClick={() => setRosterScope('catalog')}
              >
                <FaBookOpen aria-hidden="true" />
                <span>All Pokémon</span>
              </button>
              <button
                type="button"
                className={rosterScope === 'owned' ? 'active' : ''}
                aria-pressed={rosterScope === 'owned'}
                disabled={!isLoggedIn}
                title={!isLoggedIn ? 'Log in to rank your caught Pokémon' : undefined}
                onClick={() => setRosterScope('owned')}
              >
                <FaUser aria-hidden="true" />
                <span>My Pokémon</span>
                {rosterScope === 'owned' && (
                  <strong>{ownedLoading ? '…' : ownedRoster.eligibleCount}</strong>
                )}
              </button>
            </div>
            {rosterScope === 'owned' && (
              <span role="status">
                {ownedLoading ? ownedLoadingMessage : rosterDetails}
              </span>
            )}
          </section>
        )}

        {workspace === 'rankings' ? (
          <>
            <nav className="pvp-role-tabs" aria-label="Ranking role">
              {ROLES.map((role) => {
                const Icon = role.icon;
                return (
                  <button
                    type="button"
                    key={role.key}
                    className={roleKey === role.key ? 'active' : ''}
                    aria-pressed={roleKey === role.key}
                    onClick={() => setRoleKey(role.key)}
                  >
                    <Icon aria-hidden="true" />
                    <span>{role.label}</span>
                  </button>
                );
              })}
            </nav>

            <section className="pvp-toolbar" aria-label={`${activeFormatLabel} rankings`}>
              <div>
                <span>{activeRole.label} rankings</span>
                <strong>{activeFormatLabel}</strong>
              </div>
              <label className="pvp-search">
                <FaSearch aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Pokemon, type, or move"
                  aria-label="Search PvP rankings"
                />
              </label>
            </section>

            {pageLoading && (
              <div className="pvp-status" role="status">
                {rosterScope === 'owned'
                  ? ownedLoadingMessage
                  : 'Loading current rankings...'}
              </div>
            )}
            {error && (
              <div className="pvp-status pvp-status--error" role="alert">
                {error}
              </div>
            )}
            {!pageLoading && !error && visibleEntries.length === 0 && (
              <div className="pvp-status">
                {rosterScope === 'owned' && !search
                  ? 'No caught Pokémon are ready for this format. Add CP, level, IVs, one Fast Move, and two Charged Moves to a legal build.'
                  : 'No rankings match that search.'}
              </div>
            )}

            {!pageLoading && !error && visibleEntries.length > 0 && (
              <>
                <div className="pvp-ranking-head" aria-hidden="true">
                  <span>Rank</span>
                  <span>Pokemon</span>
                  <span>Recommended team</span>
                  <span>{activeRole.label}</span>
                  <span>Build</span>
                </div>
                <section className="pvp-rankings" aria-live="polite">
                  {visibleEntries.map(({ entry, rank, score, key, cp, nickname }) => (
                    <RankingRow
                      key={key}
                      entry={entry}
                      rank={rank}
                      score={score}
                      scoreLabel={
                        rosterScope === 'owned' && ownedEvaluation.response
                          ? `Build ${activeRole.label}`
                          : activeRole.label
                      }
                      cp={cp}
                      nickname={nickname}
                      personalBuild={
                        rosterScope === 'owned' && ownedEvaluation.response != null
                      }
                      expanded={expandedKey === key}
                      onToggle={() => setExpandedKey((current) => current === key ? null : key)}
                      entriesBySpeciesId={entriesBySpeciesId}
                    />
                  ))}
                </section>
              </>
            )}

            {visibleLimit < rankedEntries.length && (
              <button
                type="button"
                className="pvp-show-more"
                onClick={() => setVisibleLimit((current) => current + INITIAL_LIMIT)}
              >
                Show next {Math.min(INITIAL_LIMIT, rankedEntries.length - visibleLimit)}
              </button>
            )}
          </>
        ) : workspace === 'iv-rank' ? (
          <PvpIvRank
            variants={variants}
            variantsLoading={variantsLoading}
            instances={instances}
            instancesLoading={instancesLoading}
            isLoggedIn={isLoggedIn}
            scope={rosterScope}
            onScopeChange={setRosterScope}
            league={activeLeagueKey}
            cpLimit={cpLimit}
            metaRankings={entries}
          />
        ) : workspace === 'team' ? (
          <>
            {battleToolsLoading && (
              <div className="pvp-status" role="status">
                {moveMechanics.loading
                  ? 'Loading local battle mechanics...'
                  : 'Loading Team Builder...'}
              </div>
            )}
            {battleToolsError && (
              <div className="pvp-status pvp-status--error" role="alert">
                {battleToolsError}
              </div>
            )}
            {!battleToolsLoading &&
              !battleToolsError &&
              battleToolEntries.length === 0 && (
              <div className="pvp-status">
                No Pokémon are available for this team.
              </div>
            )}
            {!battleToolsLoading &&
              !battleToolsError &&
              battleToolEntries.length > 0 && (
              <PvpTeamBuilder
                key={`${formatKey}-${rosterScope}`}
                candidates={battleToolEntries}
                fieldCandidates={battleToolFieldCandidates}
                entriesBySpeciesId={entriesBySpeciesId}
                storageKey={`${formatKey}:${rosterScope}`}
                mechanics={battleMechanics}
                onTestMatchup={(memberKeys, opponentKey) => {
                  setBattleSeed({
                    mode: 'team',
                    leftKey: memberKeys[0],
                    rightKey: opponentKey,
                    leftTeamKeys: memberKeys,
                    rightTeamKeys: [opponentKey],
                  });
                  setWorkspace('battle');
                }}
              />
            )}
          </>
        ) : (
          <>
            {battleToolsLoading && (
              <div className="pvp-status" role="status">
                {moveMechanics.loading
                  ? 'Loading local battle mechanics...'
                  : 'Loading Battle Lab...'}
              </div>
            )}
            {battleToolsError && (
              <div className="pvp-status pvp-status--error" role="alert">
                {battleToolsError}
              </div>
            )}
            {!battleToolsLoading &&
              !battleToolsError &&
              battleToolEntries.length === 0 && (
              <div className="pvp-status">
                No Pokémon are available for this battle.
              </div>
            )}
            {!battleToolsLoading &&
              !battleToolsError &&
              battleToolEntries.length > 0 && (
              <PvpBattleLab
                key={[
                  formatKey,
                  rosterScope,
                  battleSeed?.mode ?? 'single',
                  battleSeed?.leftTeamKeys?.join(',') ?? battleSeed?.leftKey ?? '',
                  battleSeed?.rightTeamKeys?.join(',') ?? battleSeed?.rightKey ?? '',
                ].join('-')}
                candidates={battleToolEntries}
                opponentCandidates={
                  rosterScope === 'owned'
                    ? battleToolFieldCandidates
                    : battleToolEntries
                }
                formatLabel={activeFormatLabel}
                mechanics={battleMechanics}
                initialSelection={battleSeed}
                playerSideLabel={
                  rosterScope === 'owned' ? 'Your team' : 'Side A'
                }
              />
            )}
          </>
        )}

        {workspace !== 'iv-rank' && data?.source && (
          <footer className="pvp-source">
            <span>
              Battle-simulation rankings from{' '}
              <a href={data.source.url} target="_blank" rel="noreferrer">
                {data.source.name}
              </a>
              ; filtered to the current Pokémon Go Nexus catalog.
            </span>
            <small>
              {rosterScope === 'owned'
                ? ownedEvaluation.response
                  ? `My Pokémon evaluates every recorded build locally against ${ownedEvaluation.response.fieldSize} current meta opponents.`
                  : 'My Pokémon shows every recorded build; species scores remain visible until its local evaluation is available.'
                : 'Recommended IVs maximize performance for the selected format, not rarity.'}
            </small>
          </footer>
        )}
      </div>
    </div>
  );
};

export default Pvp;
