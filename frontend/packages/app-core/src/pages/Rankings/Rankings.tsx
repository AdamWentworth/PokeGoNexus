import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router';
import {
  FaArrowRight,
  FaBoxOpen,
  FaCheckCircle,
  FaExchangeAlt,
  FaHeart,
  FaInfoCircle,
  FaMedal,
  FaSearch,
  FaSyncAlt,
  FaUsers,
} from 'react-icons/fa';
import type { PokemonCommunityRanking } from '@shared-contracts/search';
import ProductPageHeader from '@/components/layout/ProductPageHeader';
import SegmentedControl from '@/components/layout/SegmentedControl';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useBootstrapVariants } from '@/features/variants/hooks/useBootstrapVariants';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { useAuthStore } from '@/stores/useAuthStore';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { resolveAssetUrl } from '@/utils/assetUrl';
import { buildPokemonCatalogPath } from '@/pages/Pokemon/utils/pokemonCatalogNavigation';
import { AppLoadingFallback } from '@/contexts/AppLoadingContext';
import { useCommunityRankings } from './hooks/useCommunityRankings';
import {
  buildPersonalRankingStatuses,
  isWantedEligibleVariant,
  matchesPersonalRankingFilter,
  type PersonalRankingFilter,
  type PersonalRankingStatus,
} from './utils/personalRankingStatus';
import './Rankings.css';

type RankingMode = 'wanted' | 'rarest';
const RANKING_MODE_ITEMS = [
  {
    ariaControls: 'community-ranking-results',
    icon: <FaHeart />,
    label: 'Most wanted',
    value: 'wanted',
  },
  {
    ariaControls: 'community-ranking-results',
    icon: <FaMedal />,
    label: 'Rarest owned',
    value: 'rarest',
  },
] as const;

type RankingCategory = 'all' | 'shiny' | 'costume' | 'shadow' | 'max';

interface JoinedRanking extends PokemonCommunityRanking {
  variant: PokemonVariant;
}

type RankingWithVariant = PokemonCommunityRanking & {
  variant: PokemonVariant;
};

const CATEGORY_FILTERS: ReadonlyArray<{
  value: RankingCategory;
  label: string;
  mask?: string;
  rarestOnly?: boolean;
}> = [
  { value: 'all', label: 'All' },
  { value: 'shiny', label: 'Shiny', mask: '/images/shiny_search.png' },
  { value: 'costume', label: 'Costume', mask: '/images/costume_search.png' },
  {
    value: 'shadow',
    label: 'Shadow',
    mask: '/images/shadow_search.png',
    rarestOnly: true,
  },
  {
    value: 'max',
    label: 'Max',
    mask: '/images/gigantamax_title_mask.png',
  },
];

const INITIAL_RESULT_COUNT = 30;
const RESULT_INCREMENT = 30;
const FALLBACK_IMAGE = '/images/default_pokemon.png';

const CATEGORY_LABELS: Record<RankingCategory, string> = {
  all: 'All Pokémon',
  shiny: 'Shiny',
  costume: 'Costume',
  shadow: 'Shadow',
  max: 'Max',
};

const PERSONAL_FILTER_LABELS: Record<PersonalRankingFilter, string> = {
  all: 'All',
  owned: 'I have',
  trade: 'For trade',
  wanted: 'I want',
  missing: 'Missing',
};

function formatFormName(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getRankingDisplayName(variant: PokemonVariant): string {
  const name = variant.name || variant.species_name;
  const form = String(variant.form || '').trim();
  if (!form) return name;

  const escapedForm = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const formAlreadyNamed = new RegExp(
    `(?:^|[\\s(_-])${escapedForm}(?:$|[\\s)_-])`,
    'i',
  ).test(name);
  if (formAlreadyNamed) return name;

  return `${name} ${formatFormName(form)}`;
}

export function getRankingCatalogSearch(variant: PokemonVariant): string {
  const terms = [variant.species_name || variant.name];
  const variantType = String(variant.variantType || '').toLowerCase();

  if (variantType.includes('shiny')) terms.push('shiny');
  if (variantType.includes('shadow')) terms.push('shadow');
  if (variantType.includes('costume')) terms.push('costume');
  if (variantType.includes('gigantamax')) terms.push('gigantamax');
  else if (variantType.includes('dynamax')) terms.push('dynamax');

  return terms
    .map((term) => String(term || '').trim().toLowerCase())
    .filter(Boolean)
    .join('&');
}

function getEvolutionIds(
  variant: PokemonVariant,
  key: 'evolves_from' | 'evolves_to',
): number[] {
  const source = variant as PokemonVariant & {
    evolutionData?: { evolves_from?: unknown; evolves_to?: unknown };
  };
  const values = source.evolutionData?.[key];
  if (!Array.isArray(values)) return [];
  return values.map(Number).filter(Number.isFinite);
}

export function collapseEvolutionFamilyRankings<T extends RankingWithVariant>(
  rows: T[],
  variants: PokemonVariant[],
): T[] {
  const speciesByID = new Map<number, PokemonVariant>();
  for (const variant of variants) {
    const pokemonID = Number(variant.pokemon_id);
    if (Number.isFinite(pokemonID) && !speciesByID.has(pokemonID)) {
      speciesByID.set(pokemonID, variant);
    }
  }

  const adjacency = new Map<number, Set<number>>();
  const connect = (left: number, right: number) => {
    if (!speciesByID.has(left) || !speciesByID.has(right)) return;
    if (!adjacency.has(left)) adjacency.set(left, new Set());
    if (!adjacency.has(right)) adjacency.set(right, new Set());
    adjacency.get(left)?.add(right);
    adjacency.get(right)?.add(left);
  };
  for (const [pokemonID, variant] of speciesByID) {
    for (const linkedID of [
      ...getEvolutionIds(variant, 'evolves_from'),
      ...getEvolutionIds(variant, 'evolves_to'),
    ]) {
      connect(pokemonID, linkedID);
    }
  }

  const familyKeyByID = new Map<number, number>();
  for (const pokemonID of speciesByID.keys()) {
    if (familyKeyByID.has(pokemonID)) continue;
    const family = new Set<number>();
    const pending = [pokemonID];
    while (pending.length > 0) {
      const current = pending.pop() as number;
      if (family.has(current)) continue;
      family.add(current);
      adjacency.get(current)?.forEach((linkedID) => pending.push(linkedID));
    }
    const familyKey = Math.min(...family);
    family.forEach((memberID) => familyKeyByID.set(memberID, familyKey));
  }

  const depthByID = new Map<number, number>();
  const getDepth = (pokemonID: number, trail = new Set<number>()): number => {
    const cached = depthByID.get(pokemonID);
    if (cached !== undefined) return cached;
    const variant = speciesByID.get(pokemonID);
    const parents = variant
      ? getEvolutionIds(variant, 'evolves_from').filter(
          (parentID) => speciesByID.has(parentID) && !trail.has(parentID),
        )
      : [];
    if (parents.length === 0) {
      depthByID.set(pokemonID, 0);
      return 0;
    }
    const nextTrail = new Set(trail);
    nextTrail.add(pokemonID);
    const depth =
      1 + Math.min(...parents.map((parentID) => getDepth(parentID, nextTrail)));
    depthByID.set(pokemonID, depth);
    return depth;
  };

  const selectedByGroup = new Map<string, T>();
  for (const row of rows) {
    const variantType = String(row.variant.variantType || 'default');
    if (variantType.includes('costume')) {
      selectedByGroup.set(`variant:${row.variant_id}`, row);
      continue;
    }

    const pokemonID = Number(row.variant.pokemon_id);
    const familyKey = familyKeyByID.get(pokemonID) ?? pokemonID;
    const form = String(row.variant.form || '').trim().toLowerCase();
    const groupKey = `${familyKey}:${variantType}:${form}`;
    const selected = selectedByGroup.get(groupKey);
    if (
      !selected ||
      getDepth(pokemonID) < getDepth(Number(selected.variant.pokemon_id))
    ) {
      selectedByGroup.set(groupKey, row);
    }
  }

  const selectedIDs = new Set(
    [...selectedByGroup.values()].map((row) => row.variant_id),
  );
  return rows.filter((row) => selectedIDs.has(row.variant_id));
}

export function prepareRankingsForMode<T extends RankingWithVariant>(
  mode: RankingMode,
  rows: T[],
  variants: PokemonVariant[],
): T[] {
  return mode === 'rarest'
    ? collapseEvolutionFamilyRankings(rows, variants)
    : rows;
}

function formatSnapshotTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';
  return `Updated ${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)}`;
}

export function getRankingsErrorMessage(
  error: string,
  online = typeof navigator === 'undefined' ? true : navigator.onLine,
): string {
  if (!online) {
    return 'You appear to be offline. Check your connection and try again.';
  }

  const normalized = error.toLowerCase();
  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return 'The rankings service took too long to respond. Try again in a moment.';
  }
  if (
    normalized.includes('503') ||
    normalized.includes('502') ||
    normalized.includes('service unavailable')
  ) {
    return 'The community rankings service is temporarily unavailable.';
  }

  return 'Community rankings could not be refreshed. Try again in a moment.';
}

function RankingRow({
  entry,
  rank,
  mode,
  scaleMaximum,
  privacyThreshold,
  personalStatus,
  showPersonalStatus,
}: {
  entry: JoinedRanking;
  rank: number;
  mode: RankingMode;
  scaleMaximum: number;
  privacyThreshold: number;
  personalStatus?: PersonalRankingStatus;
  showPersonalStatus: boolean;
}) {
  const primaryCount =
    mode === 'wanted' ? entry.wanted_users : entry.caught_users;
  const primaryScaleCount = primaryCount ?? 0;
  const progress = Math.max(
    4,
    Math.round((primaryScaleCount / Math.max(scaleMaximum, 1)) * 100),
  );
  const image =
    entry.variant.currentImage || entry.variant.image_url || FALLBACK_IMAGE;
  const primaryLabel =
    primaryCount == null
      ? `Fewer than ${privacyThreshold} trainers want this`
      : mode === 'wanted'
      ? primaryCount === 0
        ? 'No trainers want this'
        : `${primaryCount.toLocaleString()} ${
            primaryCount === 1 ? 'trainer wants' : 'trainers want'
          } this`
      : `Owned by ${primaryCount.toLocaleString()} ${
          primaryCount === 1 ? 'trainer' : 'trainers'
        }`;
  const collectionAction = !showPersonalStatus
    ? null
    : personalStatus?.tradeCount
      ? {
          label: 'View trade copies',
          path: buildPokemonCatalogPath({
            filter: 'Trade',
            search: getRankingCatalogSearch(entry.variant),
          }),
        }
      : personalStatus?.wanted
        ? {
            label: 'View wishlist',
            path: buildPokemonCatalogPath({
              filter: 'Wanted',
              search: getRankingCatalogSearch(entry.variant),
            }),
          }
        : personalStatus?.registered
          ? {
              label: 'View collection',
              path: buildPokemonCatalogPath({
                filter: 'Caught',
                search: getRankingCatalogSearch(entry.variant),
              }),
            }
          : {
              label: 'Browse Pokémon',
              path: '/pokemon',
            };
  return (
    <article
      className={`community-ranking-row community-ranking-row--rank-${Math.min(
        rank,
        4,
      )}`}
    >
      <div className="community-ranking-position" aria-label={`Rank ${rank}`}>
        {rank <= 3 && <FaMedal aria-hidden="true" />}
        <strong>{rank}</strong>
      </div>
      <div className="community-ranking-pokemon">
        <div className="community-ranking-artwork">
          <img
            className="community-ranking-artwork-pokemon"
            src={resolveAssetUrl(image)}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={(event) => {
              event.currentTarget.src = FALLBACK_IMAGE;
            }}
          />
          {entry.variant.variantType.includes('gigantamax') && (
            <img
              className="community-ranking-form-icon"
              src="/images/gigantamax.png"
              alt="Gigantamax"
            />
          )}
          {!entry.variant.variantType.includes('gigantamax') &&
            entry.variant.variantType.includes('dynamax') && (
              <img
                className="community-ranking-form-icon"
                src="/images/dynamax.png"
                alt="Dynamax"
              />
            )}
        </div>
        <span>
          <strong>{getRankingDisplayName(entry.variant)}</strong>
          {showPersonalStatus && (
            <span className="community-ranking-personal">
              {personalStatus?.caughtCount ? (
                <span title="Caught copies">
                  <FaCheckCircle aria-hidden="true" />
                  {personalStatus.caughtCount} caught
                </span>
              ) : personalStatus?.registered ? (
                <span title="Registered in your Pokédex">
                  <FaCheckCircle aria-hidden="true" />
                  Registered
                </span>
              ) : null}
              {personalStatus?.tradeCount ? (
                <span title="Copies currently listed for trade">
                  <FaExchangeAlt aria-hidden="true" />
                  {personalStatus.tradeCount} for trade
                </span>
              ) : null}
              {personalStatus?.wanted ? (
                <span title="On your wanted list">
                  <FaHeart aria-hidden="true" />
                  Wanted
                </span>
              ) : null}
            </span>
          )}
        </span>
      </div>
      <div className="community-ranking-count">
        <strong>{primaryLabel}</strong>
        <span aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </span>
        {collectionAction && (
          <a
            className="community-ranking-action"
            href={collectionAction.path}
          >
            {collectionAction.label}
            <FaArrowRight aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}

function EmptyRankingState({
  category,
  personalFilter,
  query,
  onClearAll,
  onClearCategory,
  onClearQuery,
}: {
  category: RankingCategory;
  personalFilter: PersonalRankingFilter;
  query: string;
  onClearAll: () => void;
  onClearCategory: () => void;
  onClearQuery: () => void;
}) {
  if (query.trim()) {
    return (
      <div className="community-rankings-empty" role="status">
        <FaSearch aria-hidden="true" />
        <strong>No matching Pokémon</strong>
        <span>Try another name, form, or Pokédex number.</span>
        <button type="button" onClick={onClearQuery}>
          Clear search
        </button>
      </div>
    );
  }

  if (personalFilter === 'owned') {
    return (
      <div className="community-rankings-empty" role="status">
        <FaBoxOpen aria-hidden="true" />
        <strong>None of these are in your collection</strong>
        <span>Caught Pokémon and Pokédex registrations appear here.</span>
        <a href="/pokemon">Browse Pokémon</a>
      </div>
    );
  }

  if (personalFilter === 'trade') {
    return (
      <div className="community-rankings-empty" role="status">
        <FaExchangeAlt aria-hidden="true" />
        <strong>Nothing is listed for trade</strong>
        <span>Mark a caught copy for trade to see it in this ranking.</span>
        <a href={buildPokemonCatalogPath({ filter: 'Caught' })}>
          View my Pokémon
        </a>
      </div>
    );
  }

  if (personalFilter === 'wanted') {
    return (
      <div className="community-rankings-empty" role="status">
        <FaHeart aria-hidden="true" />
        <strong>Nothing here is on your wishlist</strong>
        <span>Add Pokémon to your wishlist to compare them here.</span>
        <a href="/pokemon">Browse Pokémon</a>
      </div>
    );
  }

  if (personalFilter === 'missing') {
    return (
      <div className="community-rankings-empty" role="status">
        <FaCheckCircle aria-hidden="true" />
        <strong>Nothing is missing</strong>
        <span>You have every Pokémon in this view registered or caught.</span>
        <button type="button" onClick={onClearAll}>
          Show all rankings
        </button>
      </div>
    );
  }

  if (category !== 'all') {
    return (
      <div className="community-rankings-empty" role="status">
        <FaSearch aria-hidden="true" />
        <strong>No {CATEGORY_LABELS[category].toLowerCase()} entries</strong>
        <span>This community snapshot has no results in that category.</span>
        <button type="button" onClick={onClearCategory}>
          Show all categories
        </button>
      </div>
    );
  }

  return (
    <div className="community-rankings-empty" role="status">
      <FaSearch aria-hidden="true" />
      <strong>No community entries yet</strong>
      <span>Rankings will appear after the next community snapshot.</span>
    </div>
  );
}

const Rankings: React.FC = () => {
  const variants = useVariantsStore((state) => state.variants);
  const variantsLoading = useVariantsStore((state) => state.variantsLoading);
  const instances = useInstancesStore((state) => state.instances);
  const instancesLoading = useInstancesStore((state) => state.instancesLoading);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [searchParams, setSearchParams] = useSearchParams();
  const [visibleCount, setVisibleCount] = useState(INITIAL_RESULT_COUNT);
  const [showQuickControls, setShowQuickControls] = useState(false);
  const filterSummaryRef = useRef<HTMLDivElement | null>(null);
  const { data, error, loading, refresh } = useCommunityRankings(true);
  const mode: RankingMode =
    searchParams.get('view') === 'rarest' ? 'rarest' : 'wanted';
  const requestedCategory = searchParams.get('category');
  const category: RankingCategory =
    requestedCategory &&
    ['shiny', 'costume', 'shadow', 'max'].includes(requestedCategory)
      ? (requestedCategory as RankingCategory)
      : 'all';
  const requestedPersonalFilter = searchParams.get('collection');
  const personalFilter: PersonalRankingFilter =
    isLoggedIn &&
    requestedPersonalFilter &&
    ['owned', 'trade', 'wanted', 'missing'].includes(requestedPersonalFilter)
      ? (requestedPersonalFilter as PersonalRankingFilter)
      : 'all';
  const query = searchParams.get('search') ?? '';

  useBootstrapVariants();

  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>, replace = false) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (mode === 'wanted' && category === 'shadow') {
      updateSearchParams({ category: null }, true);
    }
  }, [category, mode, updateSearchParams]);

  useEffect(() => {
    const summary = filterSummaryRef.current;
    if (!summary || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      setShowQuickControls(
        !entry.isIntersecting && entry.boundingClientRect.bottom < 0,
      );
    });
    observer.observe(summary);
    return () => observer.disconnect();
  }, [data, instancesLoading, isLoggedIn, loading, variantsLoading]);

  const variantsByID = useMemo(
    () => new Map(variants.map((variant) => [variant.variant_id, variant])),
    [variants],
  );
  const sourceRows = useMemo(
    () => (mode === 'wanted' ? data?.most_wanted ?? [] : data?.rarest ?? []),
    [data, mode],
  );
  const matchedRows = useMemo(
    () =>
      sourceRows.flatMap<JoinedRanking>((entry) => {
        const variant = variantsByID.get(entry.variant_id);
        return variant ? [{ ...entry, variant }] : [];
      }),
    [sourceRows, variantsByID],
  );
  const joinedRows = useMemo(
    () =>
      prepareRankingsForMode(mode, matchedRows, variants).filter(
        (entry) =>
          mode !== 'wanted' || isWantedEligibleVariant(entry.variant_id),
      ),
    [matchedRows, mode, variants],
  );
  const personalStatuses = useMemo(
    () => buildPersonalRankingStatuses(instances),
    [instances],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const categoryAndSearchRows = useMemo(
    () =>
      joinedRows.filter(({ variant }) => {
        const variantType = String(variant.variantType || '').toLowerCase();
        const matchesCategory =
          category === 'all' ||
          (category === 'shiny' && variantType.includes('shiny')) ||
          (category === 'costume' && variantType.includes('costume')) ||
          (category === 'shadow' && variantType.includes('shadow')) ||
          (category === 'max' &&
            (variantType.includes('dynamax') ||
              variantType.includes('gigantamax')));
        if (!matchesCategory) return false;
        if (!normalizedQuery) return true;
        return [
          variant.name,
          variant.species_name,
          variant.variantType,
          String(variant.pokedex_number),
        ].some((value) =>
          String(value || '').toLowerCase().includes(normalizedQuery),
        );
      }),
    [
      category,
      joinedRows,
      normalizedQuery,
    ],
  );
  const personalFilterCounts = useMemo(
    () =>
      new Map<PersonalRankingFilter, number>(
        (['all', 'owned', 'trade', 'wanted', 'missing'] as const).map(
          (filter) => [
            filter,
            filter === 'all'
              ? categoryAndSearchRows.length
              : categoryAndSearchRows.filter(({ variant }) =>
                  matchesPersonalRankingFilter(
                    personalStatuses.get(variant.variant_id),
                    filter,
                  ),
                ).length,
          ],
        ),
      ),
    [categoryAndSearchRows, personalStatuses],
  );
  const filteredRows = useMemo(
    () =>
      !isLoggedIn || personalFilter === 'all'
        ? categoryAndSearchRows
        : categoryAndSearchRows.filter(({ variant }) =>
            matchesPersonalRankingFilter(
              personalStatuses.get(variant.variant_id),
              personalFilter,
            ),
          ),
    [
      categoryAndSearchRows,
      isLoggedIn,
      personalFilter,
      personalStatuses,
    ],
  );
  const rankByVariantID = useMemo(
    () =>
      new Map(
        joinedRows.map((entry, index) => [entry.variant_id, index + 1]),
    ),
    [joinedRows],
  );
  const visibleRows = filteredRows.slice(0, visibleCount);
  const scaleMaximum = filteredRows.reduce(
    (maximum, entry) =>
      Math.max(
        maximum,
        (mode === 'wanted' ? entry.wanted_users : entry.caught_users) ?? 0,
      ),
    0,
  );

  const selectMode = (nextMode: RankingMode) => {
    updateSearchParams({
      view: nextMode === 'wanted' ? null : nextMode,
      category:
        nextMode === 'wanted' && category === 'shadow' ? null : category,
    });
    setVisibleCount(INITIAL_RESULT_COUNT);
  };
  const hasActiveFilters =
    category !== 'all' ||
    personalFilter !== 'all' ||
    normalizedQuery.length > 0;
  const clearFilters = () => {
    updateSearchParams({
      category: null,
      collection: null,
      search: null,
    });
    setVisibleCount(INITIAL_RESULT_COUNT);
  };
  const pageLoading =
    (loading && !data) ||
    variantsLoading ||
    (isLoggedIn && instancesLoading);

  if (pageLoading) {
    return <AppLoadingFallback source="community-rankings" />;
  }

  return (
    <div className="community-rankings-page">
      <div className="community-rankings-inner">
        <ProductPageHeader
          className="rankings-product-header"
          eyebrow="Trainer collections"
          icon={<img src="/images/btn_rankings.png" alt="" />}
          meta={
            data ? (
              <div className="community-rankings-population">
                <FaUsers aria-hidden="true" />
                <strong>
                  {Math.max(
                    data.snapshot.collector_users,
                    data.snapshot.wishlist_users,
                  ).toLocaleString()}
                </strong>
                <small>trainers</small>
              </div>
            ) : null
          }
          title="Community Rankings"
        />

        <>
            <section className="community-ranking-controls">
              <SegmentedControl
                ariaLabel="Community ranking"
                className="community-ranking-switcher"
                items={RANKING_MODE_ITEMS}
                mode="tabs"
                onChange={selectMode}
                value={mode}
              />

              <label className="community-ranking-search">
                <FaSearch aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search rankings"
                  value={query}
                  placeholder="Pokémon, number, or form"
                  onChange={(event) => {
                    updateSearchParams(
                      { search: event.target.value || null },
                      true,
                    );
                    setVisibleCount(INITIAL_RESULT_COUNT);
                  }}
                />
              </label>
            </section>

            <div className="community-rankings-context">
              <span>
                <strong>{mode === 'wanted' ? 'Most wanted' : 'Rarest owned'}</strong>
                {mode === 'wanted'
                  ? 'Ranked by distinct trainer wishlists'
                  : 'Fewest trainers with a caught copy or Pokédex registration'}
              </span>
              <small>One vote per trainer. Duplicate copies count once.</small>
            </div>

            <section
              className="community-ranking-filters"
              aria-label="Ranking filters"
            >
              <div className="community-ranking-filter-group">
                <span>Category</span>
                <div
                  className="community-ranking-filter-row community-ranking-filter-row--category"
                  aria-label="Pokémon category"
                >
                  {CATEGORY_FILTERS
                    .filter(({ rarestOnly }) => !rarestOnly || mode === 'rarest')
                    .map(({ value, label, mask }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={category === value}
                      className={category === value ? 'active' : ''}
                      onClick={() => {
                        updateSearchParams({
                          category: value === 'all' ? null : value,
                        });
                        setVisibleCount(INITIAL_RESULT_COUNT);
                      }}
                    >
                      {mask && (
                        <span
                          className="community-ranking-filter-mask"
                          data-ranking-filter-asset={mask}
                          aria-hidden="true"
                          style={{
                            WebkitMaskImage: `url("${resolveAssetUrl(mask)}")`,
                            maskImage: `url("${resolveAssetUrl(mask)}")`,
                          }}
                        />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {isLoggedIn && (
                <div className="community-ranking-filter-group">
                  <span>Compared with yours</span>
                  <div
                    className="community-ranking-filter-row community-ranking-filter-row--personal"
                    aria-label="Compared with yours"
                  >
                    {(
                      [
                        ['all', 'All'],
                        ['owned', 'I have'],
                        ['trade', 'For trade'],
                        ['wanted', 'I want'],
                        ['missing', 'Missing'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={personalFilter === value}
                        className={personalFilter === value ? 'active personal' : ''}
                        onClick={() => {
                          updateSearchParams({
                            collection: value === 'all' ? null : value,
                          });
                          setVisibleCount(INITIAL_RESULT_COUNT);
                        }}
                      >
                        <span>{label}</span>
                        <small aria-hidden="true">
                          {personalFilterCounts.get(value)?.toLocaleString() ?? 0}
                        </small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
            <div
              className="community-ranking-filter-summary"
              ref={filterSummaryRef}
            >
              <span role="status" aria-live="polite" aria-atomic="true">
                <strong>{filteredRows.length.toLocaleString()}</strong> results
                <i aria-hidden="true">·</i>
                {CATEGORY_LABELS[category]}
                {isLoggedIn && (
                  <>
                    <i aria-hidden="true">·</i>
                    {PERSONAL_FILTER_LABELS[personalFilter]}
                  </>
                )}
              </span>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters}>
                  Clear
                </button>
              )}
            </div>
            {showQuickControls && (
              <nav
                className={`community-ranking-quick-controls${
                  isLoggedIn ? '' : ' community-ranking-quick-controls--public'
                }`}
                aria-label="Quick ranking controls"
              >
                <select
                  aria-label="Ranking view"
                  value={mode}
                  onChange={(event) =>
                    selectMode(event.target.value as RankingMode)
                  }
                >
                  <option value="wanted">Most wanted</option>
                  <option value="rarest">Rarest owned</option>
                </select>
                <select
                  aria-label="Pokémon category"
                  value={category}
                  onChange={(event) => {
                    const value = event.target.value as RankingCategory;
                    updateSearchParams({
                      category: value === 'all' ? null : value,
                    });
                    setVisibleCount(INITIAL_RESULT_COUNT);
                  }}
                >
                  {CATEGORY_FILTERS
                    .filter(({ rarestOnly }) => !rarestOnly || mode === 'rarest')
                    .map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
                {isLoggedIn && (
                  <select
                    aria-label="Compared with yours"
                    value={personalFilter}
                    onChange={(event) => {
                      const value = event.target.value as PersonalRankingFilter;
                      updateSearchParams({
                        collection: value === 'all' ? null : value,
                      });
                      setVisibleCount(INITIAL_RESULT_COUNT);
                    }}
                  >
                    {(
                      ['all', 'owned', 'trade', 'wanted', 'missing'] as const
                    ).map((value) => (
                      <option key={value} value={value}>
                        {PERSONAL_FILTER_LABELS[value]} (
                        {personalFilterCounts.get(value)?.toLocaleString() ?? 0})
                      </option>
                    ))}
                  </select>
                )}
                <label>
                  <FaSearch aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Search rankings"
                    value={query}
                    placeholder="Search"
                    onChange={(event) => {
                      updateSearchParams(
                        { search: event.target.value || null },
                        true,
                      );
                      setVisibleCount(INITIAL_RESULT_COUNT);
                    }}
                  />
                </label>
              </nav>
            )}

            {error && !data && (
              <section className="community-rankings-state" role="alert">
                <h2>Rankings are unavailable</h2>
                <p>{getRankingsErrorMessage(error)}</p>
                <button type="button" onClick={refresh}>
                  Try again
                </button>
              </section>
            )}

            {error && data && (
              <aside className="community-rankings-stale" role="status">
                <span>
                  Showing the last community snapshot. Refresh is temporarily
                  unavailable.
                </span>
                <button type="button" onClick={refresh}>
                  Try again
                </button>
              </aside>
            )}

            {data && (
              <>
                <section
                  id="community-ranking-results"
                  className="community-ranking-results"
                  role="tabpanel"
                  aria-live="polite"
                  aria-busy={loading}
                  aria-label={
                    mode === 'wanted'
                      ? 'Most wanted Pokémon'
                      : 'Rarest owned Pokémon'
                  }
                >
                  {visibleRows.map((entry) => (
                    <RankingRow
                      key={entry.variant_id}
                      entry={entry}
                      rank={rankByVariantID.get(entry.variant_id) ?? 0}
                      mode={mode}
                      scaleMaximum={scaleMaximum}
                      privacyThreshold={data.privacy_threshold}
                      personalStatus={personalStatuses.get(entry.variant_id)}
                      showPersonalStatus={isLoggedIn}
                    />
                  ))}
                  {visibleRows.length === 0 && (
                    <EmptyRankingState
                      category={category}
                      personalFilter={personalFilter}
                      query={query}
                      onClearAll={clearFilters}
                      onClearCategory={() =>
                        updateSearchParams({ category: null })
                      }
                      onClearQuery={() =>
                        updateSearchParams({ search: null }, true)
                      }
                    />
                  )}
                </section>
                {visibleRows.length < filteredRows.length && (
                  <button
                    type="button"
                    className="community-rankings-more"
                    onClick={() =>
                      setVisibleCount((count) => count + RESULT_INCREMENT)
                    }
                  >
                    Show more
                  </button>
                )}
                <footer className="community-rankings-footer">
                  <span className="community-rankings-updated">
                    {formatSnapshotTime(data.snapshot.updated_at)}
                    <button
                      type="button"
                      onClick={refresh}
                      disabled={loading}
                      aria-label="Refresh community rankings"
                      title="Refresh community rankings"
                    >
                      <FaSyncAlt aria-hidden="true" />
                    </button>
                  </span>
                </footer>
                <details className="community-rankings-method">
                  <summary>
                    <FaInfoCircle aria-hidden="true" />
                    How these rankings work
                  </summary>
                  <div>
                    <p>
                      <strong>Most wanted</strong> counts distinct trainer
                      wishlists. Duplicate wanted copies do not add votes.
                    </p>
                    <p>
                      <strong>Rarest owned</strong> counts trainers with a
                      caught copy or Pokédex registration. Duplicate copies
                      count once.
                    </p>
                    <p>
                      Ordinary evolution families are collapsed in rarity
                      results, while collectible costumes remain separate.
                      Small totals may be withheld to protect trainer privacy.
                    </p>
                  </div>
                </details>
              </>
            )}
        </>
      </div>
    </div>
  );
};

export default Rankings;
