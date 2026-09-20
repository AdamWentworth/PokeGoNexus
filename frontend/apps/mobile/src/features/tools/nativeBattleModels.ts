import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type {
  BasePokemon,
  Move,
  PokemonMovesChunk,
  PokemonRaidDataChunk,
  RaidBoss,
} from '@pokemongonexus/shared-contracts/pokemon';
import type { PokemonVariant } from '@pokemongonexus/shared-contracts/variants';
import createPokemonVariants from '@pokemongonexus/app-core/pokemon-variants';
import {
  dedupeBestCounterPerVariant,
  dedupeBestTypeDpsPerVariant,
  getPrimaryRaidMetadataForVariant,
  getRaidTierKeyForVariant,
  isEligibleRaidAttacker,
  isEligibleRaidBoss,
  RAID_TIER_PRESETS,
  scoreRaidCounters,
  scoreRaidCounterFinalists,
  scoreBestRaidOverallAttackers,
  scoreRaidOverallAttackers,
  scoreRaidTypeDps,
  selectRaidCounterFinalists,
  type RaidCounterScore,
  type RaidCounterSettings,
  type RaidOverallScore,
  type RaidTierKey,
  type RaidTierPreset,
  type RaidTypeDpsScore,
} from '@pokemongonexus/app-core/raid-model';
import {
  getRaidRosterDetail,
  getRaidVariantDisplayName,
} from '@pokemongonexus/app-core/raid-presentation-model';
import {
  getMaxBattleCatalog,
  rankMaxBattlePokemon,
  type MaxRankingEntry,
  type MaxRole,
  type MaxRoleCandidates,
} from '@pokemongonexus/app-core/max-battle-model';
import {
  buildRaidRoster,
  type RaidRosterSummary,
} from '@pokemongonexus/app-core/raid-roster';
import {
  buildMaxRoster,
  type MaxRosterSummary,
} from '@pokemongonexus/app-core/max-roster';
import { getTypeEffectivenessMultiplier } from '@pokemongonexus/shared-domain/type-effectiveness';
import { mergePokemonMaxData, mergePokemonMoveData } from '@pokemongonexus/shared-domain/pokemon-data';

export const NATIVE_BATTLE_TYPES = ['bug', 'dark', 'dragon', 'electric', 'fairy', 'fighting', 'fire', 'flying', 'ghost', 'grass', 'ground', 'ice', 'normal', 'poison', 'psychic', 'rock', 'steel', 'water'] as const;
export type NativeBattleType = typeof NATIVE_BATTLE_TYPES[number];
export type NativeRosterScope = 'catalog' | 'owned';
export type NativeRaidAttackerLevel = '40.0' | '50.0' | '51.0';
export type NativeRaidFriendship = 'none' | 'good' | 'great' | 'ultra' | 'best';
export type NativeRaidMegaAlly = 'none' | 'general' | 'matching';
export type NativeRaidPartyPower = 'none' | 'party2' | 'party3' | 'party4';
export type NativeRaidPartyPowerStrategy = 'immediate' | 'next-charged' | 'strongest-charged' | 'manual';
export type NativeRaidDodgeStrategy = 'none' | 'charged';
export type NativeRaidBossMovesetMode = 'expected' | 'monte-carlo' | 'favorable' | 'hostile';
export type NativeRaidShadowBossMode = 'normal' | 'enraged' | 'subdued';

const nativeCatalogVariantCache = new WeakMap<BasePokemon[], PokemonVariant[]>();
const nativeCatalogVariants = (catalog: BasePokemon[]): PokemonVariant[] => {
  const cached = nativeCatalogVariantCache.get(catalog);
  if (cached) return cached;
  const variants = createPokemonVariants(catalog);
  nativeCatalogVariantCache.set(catalog, variants);
  return variants;
};

const nativeRaidRosterCache = new WeakMap<
  PokemonVariant[],
  WeakMap<Record<string, PokemonInstance>, RaidRosterSummary>
>();
const nativeRaidRoster = (
  variants: PokemonVariant[],
  instances: Record<string, PokemonInstance>,
): RaidRosterSummary => {
  const byInstances = nativeRaidRosterCache.get(variants) ?? new WeakMap();
  const cached = byInstances.get(instances);
  if (cached) return cached;
  const roster = buildRaidRoster(variants, instances);
  byInstances.set(instances, roster);
  nativeRaidRosterCache.set(variants, byInstances);
  return roster;
};

const nativeMaxRosterCache = new WeakMap<
  PokemonVariant[],
  WeakMap<Record<string, PokemonInstance>, MaxRosterSummary>
>();

const nativeMaxCatalogCache = new WeakMap<PokemonVariant[], PokemonVariant[]>();
const nativeMaxRankingCache = new WeakMap<
  PokemonVariant[],
  Map<string, MaxRankingEntry[]>
>();
const nativeMaxCombatEntryCache = new WeakMap<MaxRankingEntry[], NativeCombatEntry[]>();
const nativeMaxRoster = (
  variants: PokemonVariant[],
  instances: Record<string, PokemonInstance>,
): MaxRosterSummary => {
  const byInstances = nativeMaxRosterCache.get(variants) ?? new WeakMap();
  const cached = byInstances.get(instances);
  if (cached) return cached;
  const roster = buildMaxRoster(variants, instances);
  byInstances.set(instances, roster);
  nativeMaxRosterCache.set(variants, byInstances);
  return roster;
};

const nativeRaidCatalogProjectionCache = new WeakMap<
  PokemonVariant[],
  { attackers: PokemonVariant[]; bossTargets: PokemonVariant[] }
>();
const nativeRaidCatalogProjection = (variants: PokemonVariant[]) => {
  const cached = nativeRaidCatalogProjectionCache.get(variants);
  if (cached) return cached;
  const projection = {
    attackers: variants.filter(isEligibleRaidAttacker),
    bossTargets: variants.filter(isEligibleRaidBoss),
  };
  nativeRaidCatalogProjectionCache.set(variants, projection);
  return projection;
};

export type NativeRaidSettings = {
  attackerLevel: NativeRaidAttackerLevel;
  bestOnly: boolean;
  friendship: NativeRaidFriendship;
  megaAllyBonus: NativeRaidMegaAlly;
  partyPower: NativeRaidPartyPower;
  partyPowerStrategy: NativeRaidPartyPowerStrategy;
  dodgeStrategy: NativeRaidDodgeStrategy;
  dodgeSuccessRate: number;
  bossMovesetMode: NativeRaidBossMovesetMode;
  shadowBossMode: NativeRaidShadowBossMode;
  relobbySeconds: number;
  weatherBoostedType: string;
};

export const DEFAULT_NATIVE_RAID_SETTINGS: NativeRaidSettings = {
  attackerLevel: '50.0',
  bestOnly: true,
  friendship: 'none',
  megaAllyBonus: 'none',
  partyPower: 'none',
  partyPowerStrategy: 'immediate',
  dodgeStrategy: 'none',
  dodgeSuccessRate: 1,
  bossMovesetMode: 'expected',
  shadowBossMode: 'normal',
  relobbySeconds: 10,
  weatherBoostedType: '',
};

export type NativeCombatEntry = {
  chargedMove: Move | null;
  chargedMatchesType?: boolean;
  counter?: {
    dodges: number;
    faints: number;
    relobbies: number;
    simulationWon: boolean;
    soloTimeSeconds: number;
    trainersNeeded: number;
  } | null;
  cp: number;
  dps: number;
  er: number;
  fastMove: Move | null;
  fastMatchesType?: boolean;
  id: string;
  imageUri: string | null;
  maxKind: 'dynamax' | 'gigantamax' | null;
  maxRanking?: MaxRankingEntry;
  name: string;
  pokemonId: number;
  rosterDetail: string | null;
  score: number;
  sourceInstanceId: string | null;
  tdo: number;
  types: string[];
  variantId?: string;
  /** Canonical Raid score retained for the shared group and party simulators. */
  raidCounterScore?: RaidCounterScore;
};

export type NativeRaidBossEntry = {
  boss: RaidBoss;
  id: string;
  imageUri: string | null;
  name: string;
  pokemon: BasePokemon;
  tier: RaidTierPreset;
  tierKey: RaidTierKey;
  types: string[];
  variant: PokemonVariant;
};

export const nativeTypeEffectiveness = getTypeEffectivenessMultiplier;

export const hydrateNativeToolCatalog = (
  catalog: BasePokemon[],
  moves: PokemonMovesChunk = [],
  raidData: PokemonRaidDataChunk = [],
): BasePokemon[] => {
  const raidsById = new Map(raidData.map((entry) => [entry.pokemon_id, entry.raid_boss]));
  return mergePokemonMoveData(catalog, moves).map((pokemon) => ({ ...pokemon, moves: pokemon.moves ?? [], raid_boss: raidsById.get(pokemon.pokemon_id) ?? pokemon.raid_boss ?? [] }));
};

export const hydrateNativeMaxCatalog = (
  catalog: BasePokemon[],
  maxData: BasePokemon[] = [],
  moves: PokemonMovesChunk = [],
): BasePokemon[] => mergePokemonMaxData(hydrateNativeToolCatalog(catalog, moves), maxData);

export const canonicalNativeRaidSettings = (settings: NativeRaidSettings): RaidCounterSettings => ({
  attackerLevel: settings.attackerLevel,
  bossMovesetMode: settings.bossMovesetMode,
  dodgeStrategy: settings.dodgeStrategy,
  dodgeSuccessRate: settings.dodgeSuccessRate,
  friendship: settings.friendship,
  megaAllyBonus: settings.megaAllyBonus,
  partyPower: settings.partyPower,
  partyPowerStrategy: settings.partyPowerStrategy,
  relobbySeconds: settings.relobbySeconds,
  shadowBossMode: settings.shadowBossMode,
  weatherBoostedType: settings.weatherBoostedType,
});

const buildCanonicalRaidAttackers = (
  catalog: BasePokemon[],
  instances: Record<string, PokemonInstance>,
  scope: NativeRosterScope,
): { attackers: PokemonVariant[]; bossTargets: PokemonVariant[] } => {
  const variants = nativeCatalogVariants(catalog);
  const { attackers: catalogAttackers, bossTargets } = nativeRaidCatalogProjection(variants);
  if (scope === 'catalog') {
    return { attackers: catalogAttackers, bossTargets };
  }

  return { attackers: nativeRaidRoster(variants, instances).attackers, bossTargets };
};

export const buildNativeRaidRosterSummary = (
  catalog: BasePokemon[],
  instances: Record<string, PokemonInstance>,
): RaidRosterSummary => nativeRaidRoster(nativeCatalogVariants(catalog), instances);

const canonicalCombatEntry = (
  score: RaidOverallScore | RaidTypeDpsScore,
  settings: NativeRaidSettings,
): NativeCombatEntry => {
  const variant = score.variant;
  const instance = variant.instanceData ?? null;
  return {
    chargedMove: score.chargedMove,
    chargedMatchesType: 'chargedMatchesType' in score ? score.chargedMatchesType : undefined,
    counter: null,
    cp: score.cp,
    dps: score.dps,
    er: score.er,
    fastMove: score.fastMove,
    fastMatchesType: 'fastMatchesType' in score ? score.fastMatchesType : undefined,
    id: `${variant.variant_id}-${score.fastMove.move_id}-${score.chargedMove.move_id}`,
    imageUri: variant.currentImage || variant.image_url || null,
    maxKind: null,
    name: getRaidVariantDisplayName(variant),
    pokemonId: variant.pokemon_id,
    rosterDetail: instance ? getRaidRosterDetail(variant, settings.attackerLevel) : null,
    score: score.eDps,
    sourceInstanceId: instance?.instance_id ?? null,
    tdo: score.tdo,
    types: [variant.type1_name, variant.type2_name]
      .filter(Boolean)
      .map((value) => value.toLocaleLowerCase()),
    variantId: variant.variant_id,
  };
};

const canonicalCounterEntry = (
  score: RaidCounterScore,
  tier: RaidTierPreset,
  settings: NativeRaidSettings,
): NativeCombatEntry => {
  const variant = score.variant;
  const instance = variant.instanceData ?? null;
  const estimatedShare = tier.bossHp / Math.max(1, score.trainersNeeded);
  return {
    chargedMove: score.chargedMove,
    counter: {
      dodges: score.dodges,
      faints: score.faints,
      relobbies: score.relobbies,
      simulationWon: score.simulationWon,
      soloTimeSeconds: score.soloTimeSeconds,
      trainersNeeded: score.trainersNeeded,
    },
    cp: score.cp,
    dps: score.dps,
    er: score.dps,
    fastMove: score.fastMove,
    id: `${variant.variant_id}-${score.fastMove.move_id}-${score.chargedMove.move_id}`,
    imageUri: variant.currentImage || variant.image_url || null,
    maxKind: null,
    name: getRaidVariantDisplayName(variant),
    pokemonId: variant.pokemon_id,
    rosterDetail: instance ? getRaidRosterDetail(variant, settings.attackerLevel) : null,
    score: score.sustainedDps ?? score.dps,
    sourceInstanceId: instance?.instance_id ?? null,
    tdo: Math.max(0, estimatedShare),
    types: [variant.type1_name, variant.type2_name]
      .filter(Boolean)
      .map((value) => value.toLocaleLowerCase()),
    variantId: variant.variant_id,
    raidCounterScore: score,
  };
};

const buildCanonicalRaidRankings = ({
  catalog,
  instances,
  requiredType,
  scope,
  settings,
}: {
  catalog: BasePokemon[];
  instances: Record<string, PokemonInstance>;
  requiredType: string;
  scope: NativeRosterScope;
  settings: NativeRaidSettings;
}): NativeCombatEntry[] => {
  const { attackers, bossTargets } = buildCanonicalRaidAttackers(catalog, instances, scope);
  const canonicalSettings = canonicalNativeRaidSettings(settings);
  const scores = requiredType
    ? scoreRaidTypeDps(attackers, requiredType, canonicalSettings, bossTargets)
    : settings.bestOnly
      ? scoreBestRaidOverallAttackers(attackers, canonicalSettings, bossTargets)
      : scoreRaidOverallAttackers(attackers, canonicalSettings);
  const selectedScores = requiredType && settings.bestOnly
    ? dedupeBestTypeDpsPerVariant(scores as RaidTypeDpsScore[])
    : scores;
  return selectedScores.map((score) => canonicalCombatEntry(score, settings));
};

export const buildNativeRaidAttackers = ({ boss, catalog, instances = {}, requiredType = '', scope = 'catalog', settings }: {
  boss?: NativeRaidBossEntry | null;
  catalog: BasePokemon[];
  instances?: Record<string, PokemonInstance>;
  requiredType?: string;
  scope?: NativeRosterScope;
  settings?: Partial<NativeRaidSettings>;
}): NativeCombatEntry[] => {
  const resolvedSettings = { ...DEFAULT_NATIVE_RAID_SETTINGS, ...settings };
  if (!boss) {
    return buildCanonicalRaidRankings({
      catalog,
      instances,
      requiredType,
      scope,
      settings: resolvedSettings,
    });
  }
  const { attackers } = buildCanonicalRaidAttackers(catalog, instances, scope);
  const scores = scoreRaidCounters(
    attackers,
    boss.variant,
    boss.tier,
    canonicalNativeRaidSettings(resolvedSettings),
  );
  const selectedScores = resolvedSettings.bestOnly
    ? dedupeBestCounterPerVariant(scores)
    : scores;
  return selectedScores.map((score) => canonicalCounterEntry(score, boss.tier, resolvedSettings));
};

const compareNativeRaidCounterScores = (
  left: RaidCounterScore,
  right: RaidCounterScore,
): number => (
  (right.sustainedDps ?? right.dps) - (left.sustainedDps ?? left.dps)
  || right.dps - left.dps
  || left.soloTimeSeconds - right.soloTimeSeconds
  || left.faints - right.faints
);

const yieldNativeRaidCalculation = (): Promise<void> => new Promise(
  (resolve) => setTimeout(resolve, 0),
);

/**
 * React Native does not expose the browser Worker used by the canonical Vite
 * Raid page. Score the exact same finalist set in cooperative chunks so a tab
 * change can paint its boss controls and progress state instead of freezing
 * the Android UI until every timeline simulation has completed.
 */
export const buildNativeRaidCounterAttackersAsync = async ({
  boss,
  catalog,
  instances = {},
  scope = 'catalog',
  settings,
  shouldCancel = () => false,
}: {
  boss: NativeRaidBossEntry;
  catalog: BasePokemon[];
  instances?: Record<string, PokemonInstance>;
  scope?: NativeRosterScope;
  settings?: Partial<NativeRaidSettings>;
  shouldCancel?: () => boolean;
}): Promise<NativeCombatEntry[]> => {
  const resolvedSettings = { ...DEFAULT_NATIVE_RAID_SETTINGS, ...settings };
  await yieldNativeRaidCalculation();
  if (shouldCancel()) return [];

  const { attackers } = buildCanonicalRaidAttackers(catalog, instances, scope);
  const canonicalSettings = canonicalNativeRaidSettings(resolvedSettings);
  await yieldNativeRaidCalculation();
  if (shouldCancel()) return [];

  const finalists = selectRaidCounterFinalists(
    attackers,
    boss.variant,
    boss.tier,
    canonicalSettings,
  );
  const scores: RaidCounterScore[] = [];
  const chunkSize = 12;
  for (let start = 0; start < finalists.length; start += chunkSize) {
    if (shouldCancel()) return [];
    scores.push(...scoreRaidCounterFinalists(
      finalists.slice(start, start + chunkSize),
      boss.variant,
      boss.tier,
      canonicalSettings,
    ));
    await yieldNativeRaidCalculation();
  }

  if (shouldCancel()) return [];
  scores.sort(compareNativeRaidCounterScores);
  const selectedScores = resolvedSettings.bestOnly
    ? dedupeBestCounterPerVariant(scores)
    : scores;
  return selectedScores.map((score) => canonicalCounterEntry(
    score,
    boss.tier,
    resolvedSettings,
  ));
};

export const buildNativeRaidBosses = (catalog: BasePokemon[]): NativeRaidBossEntry[] => {
  const pokemonById = new Map(catalog.map((pokemon) => [Number(pokemon.pokemon_id), pokemon]));
  return nativeCatalogVariants(catalog)
    .filter(isEligibleRaidBoss)
    .flatMap((variant) => {
      const boss = getPrimaryRaidMetadataForVariant(variant);
      const tierKey = getRaidTierKeyForVariant(variant);
      const pokemon = pokemonById.get(Number(variant.pokemon_id));
      if (!boss || !tierKey || !pokemon) return [];
      return [{
        boss,
        id: variant.variant_id,
        imageUri: variant.currentImage || variant.image_url || null,
        name: variant.name,
        pokemon,
        tier: RAID_TIER_PRESETS[tierKey],
        tierKey,
        types: [variant.type1_name, variant.type2_name]
          .filter(Boolean)
          .map((type) => type.toLocaleLowerCase()),
        variant,
      } satisfies NativeRaidBossEntry];
    })
    .sort((a, b) => a.pokemon.pokedex_number - b.pokemon.pokedex_number || a.name.localeCompare(b.name));
};

export type NativeMaxRole = 'damage' | 'tank' | 'healing';

const nativeMaxCatalog = (variants: PokemonVariant[]): PokemonVariant[] => {
  const cached = nativeMaxCatalogCache.get(variants);
  if (cached) return cached;
  const maxCatalog = getMaxBattleCatalog(variants);
  nativeMaxCatalogCache.set(variants, maxCatalog);
  return maxCatalog;
};

export const buildNativeMaxVariants = (catalog: BasePokemon[]): PokemonVariant[] =>
  nativeMaxCatalog(nativeCatalogVariants(catalog));

export const buildNativeMaxRosterSummary = (
  catalog: BasePokemon[],
  instances: Record<string, PokemonInstance>,
): MaxRosterSummary => nativeMaxRoster(nativeCatalogVariants(catalog), instances);

type NativeMaxRankingOptions = {
  boss?: BasePokemon | null;
  bossVariant?: PokemonVariant | null;
  catalog: BasePokemon[];
  instances?: Record<string, PokemonInstance>;
  role: NativeMaxRole;
  scope?: NativeRosterScope;
  selectedType?: string;
};

export const buildNativeMaxBossVariant = (
  boss?: BasePokemon | null,
): PokemonVariant | null => {
  if (!boss) return null;
  const variants = buildNativeMaxVariants([boss]);
  return variants.find((variant) => variant.variantType.includes('gigantamax'))
    ?? variants[0]
    ?? null;
};

export const buildNativeMaxCanonicalRankings = ({
  boss,
  bossVariant,
  catalog,
  instances = {},
  role,
  scope = 'catalog',
  selectedType = '',
}: NativeMaxRankingOptions): MaxRankingEntry[] => {
  const variants = nativeCatalogVariants(catalog);
  const rankingVariants = scope === 'owned'
    ? nativeMaxRoster(variants, instances).pokemon
    : nativeMaxCatalog(variants);
  const resolvedBoss = bossVariant ?? buildNativeMaxBossVariant(boss);
  const cacheKey = [resolvedBoss?.variant_id ?? '', role, selectedType].join('\u0000');
  const bySettings = nativeMaxRankingCache.get(rankingVariants) ?? new Map<string, MaxRankingEntry[]>();
  const cached = bySettings.get(cacheKey);
  if (cached) return cached;
  const rankings = rankMaxBattlePokemon(rankingVariants, {
    boss: resolvedBoss,
    role: role as MaxRole,
    selectedType,
  });
  bySettings.set(cacheKey, rankings);
  nativeMaxRankingCache.set(rankingVariants, bySettings);
  return rankings;
};

export const buildNativeMaxRoleCandidates = (
  options: Omit<NativeMaxRankingOptions, 'role' | 'selectedType'>,
): MaxRoleCandidates => ({
  damage: buildNativeMaxCanonicalRankings({ ...options, role: 'damage' }),
  tank: buildNativeMaxCanonicalRankings({ ...options, role: 'tank' }),
  healing: buildNativeMaxCanonicalRankings({ ...options, role: 'healing' }),
});

export const buildNativeMaxRankings = (
  options: NativeMaxRankingOptions,
): NativeCombatEntry[] => {
  const rankings = buildNativeMaxCanonicalRankings(options);
  const cached = nativeMaxCombatEntryCache.get(rankings);
  if (cached) return cached;
  const entries = rankings.map((entry) => ({
    chargedMove: entry.chargedMove,
    cp: entry.cp,
    dps: entry.bossBenchmark?.maxHitDamage ?? entry.attackIndex,
    er: entry.score,
    fastMove: entry.fastMove,
    id: entry.variant.variant_id,
  imageUri: entry.variant.currentImage || entry.variant.image_url || null,
  maxKind: entry.maxForm === 'special' ? null : entry.maxForm,
  maxRanking: entry,
    name: entry.displayName,
    pokemonId: entry.variant.pokemon_id,
    rosterDetail: entry.personalized
      ? `Level ${entry.levelLabel}${entry.ivPercent == null ? '' : ` · ${entry.ivPercent}% IV`}`
      : null,
    score: entry.score,
    sourceInstanceId: entry.variant.instanceData?.instance_id ?? null,
    tdo: entry.effectiveBulk,
    types: [entry.variant.type1_name, entry.variant.type2_name]
      .filter(Boolean)
      .map((type) => type.toLocaleLowerCase()),
    variantId: entry.variant.variant_id,
  }));
  nativeMaxCombatEntryCache.set(rankings, entries);
  return entries;
};
