import { resolveRaidRosterFormProjections } from '../../Raid/utils/raidRosterForms';
import type { InstancesMap, PokemonInstance } from '../../../types/pokemonInstance';
import type { PokemonVariant } from '../../../types/pokemonVariants';
import type {
  PokemonPvPLeagueKey,
  PokemonPvPRankingEntry,
} from '@pokemongonexus/shared-contracts/pokemon';

import {
  summarizePvPIvSpread,
  type PvPIvValues,
} from './pvpIvRank';
import type { PvPIvPokemonOption } from './pvpIvPokemon';
import {
  buildPvPRankingLookup,
  matchPvPRanking,
} from './pvpRoster';

export type OwnedPvPIvEntry = {
  instanceId: string;
  pokemon: PvPIvPokemonOption;
  nickname: string | null;
  imageUrl: string;
  cp: number | null;
  level: number | null;
  ivs: PvPIvValues;
  favorite: boolean;
  metaRank: number | null;
  metaScore: number | null;
};

export type RankedOwnedPvPIvEntry = {
  entry: OwnedPvPIvEntry;
  ivRank: number;
  ivTotal: number;
  ivPercent: number;
  recommendationScore: number;
};

export type OwnedPvPIvRoster = {
  entries: OwnedPvPIvEntry[];
  caughtCount: number;
  completeCount: number;
  incompleteCount: number;
  unmatchedCount: number;
};

const normalize = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const finiteOrNull = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const validIv = (value: unknown): boolean => {
  if (value == null || value === '') return false;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 15;
};

const statsKey = (
  pokemonId: number,
  attack: unknown,
  defense: unknown,
  stamina: unknown,
): string =>
  [pokemonId, Number(attack), Number(defense), Number(stamina)].join(':');

const instanceIdentity = (key: string, instance: PokemonInstance): string =>
  String(instance.instance_id || key);

export const buildOwnedPvPIvRoster = (
  options: PvPIvPokemonOption[],
  variants: PokemonVariant[],
  instances: InstancesMap,
  rankings: PokemonPvPRankingEntry[] = [],
): OwnedPvPIvRoster => {
  const variantsById = new Map(
    variants.map((variant) => [String(variant.variant_id), variant]),
  );
  const optionsByStats = new Map<string, PvPIvPokemonOption[]>();
  const rankingLookup = buildPvPRankingLookup(rankings);
  options.forEach((option) => {
    const key = statsKey(
      option.pokemonId,
      option.attack,
      option.defense,
      option.stamina,
    );
    const matches = optionsByStats.get(key);
    if (matches) matches.push(option);
    else optionsByStats.set(key, [option]);
  });

  const caught = Object.entries(instances).filter(
    ([, instance]) => instance.is_caught && !instance.disabled,
  );
  const roster: OwnedPvPIvRoster = {
    entries: [],
    caughtCount: caught.length,
    completeCount: 0,
    incompleteCount: 0,
    unmatchedCount: 0,
  };

  caught.forEach(([key, instance]) => {
    if (
      !validIv(instance.attack_iv) ||
      !validIv(instance.defense_iv) ||
      !validIv(instance.stamina_iv)
    ) {
      roster.incompleteCount += 1;
      return;
    }

    const base = variantsById.get(String(instance.variant_id));
    if (!base) {
      roster.unmatchedCount += 1;
      return;
    }

    const projection =
      instance.is_fused || instance.crown
        ? resolveRaidRosterFormProjections(variants, base, instance)[0]
        : {
          variant: base,
          formSource: 'base' as const,
          useRecordedCp: true,
        };
    if (!projection || projection.formSource === 'mega') {
      roster.unmatchedCount += 1;
      return;
    }

    const candidates = optionsByStats.get(statsKey(
      projection.variant.pokemon_id,
      projection.variant.attack,
      projection.variant.defense,
      projection.variant.stamina,
    )) ?? [];
    const projectedNames = new Set([
      normalize(projection.variant.name),
      normalize(projection.variant.species_name),
      normalize(base.name),
      normalize(base.species_name),
    ]);
    const pokemon =
      candidates.find((candidate) => projectedNames.has(normalize(candidate.name))) ??
      candidates[0];
    if (!pokemon) {
      roster.unmatchedCount += 1;
      return;
    }
    const meta = matchPvPRanking(
      rankingLookup,
      projection.variant,
      projection.formSource,
      instance,
      projection.formPokemonId,
    );

    roster.entries.push({
      instanceId: instanceIdentity(key, instance),
      pokemon,
      nickname: instance.nickname,
      imageUrl:
        projection.variant.currentImage ||
        base.currentImage ||
        pokemon.imageUrl,
      cp: finiteOrNull(instance.cp),
      level: finiteOrNull(instance.level),
      ivs: {
        attack: Number(instance.attack_iv),
        defense: Number(instance.defense_iv),
        stamina: Number(instance.stamina_iv),
      },
      favorite: Boolean(instance.favorite),
      metaRank: meta?.rank ?? null,
      metaScore: meta?.score ?? null,
    });
  });

  roster.entries.sort((left, right) => (
    left.pokemon.pokedexNumber - right.pokemon.pokedexNumber ||
    left.pokemon.name.localeCompare(right.pokemon.name) ||
    String(left.nickname ?? '').localeCompare(String(right.nickname ?? '')) ||
    left.instanceId.localeCompare(right.instanceId)
  ));
  roster.completeCount = roster.entries.length;
  return roster;
};

export const rankOwnedPvPIvEntries = (
  entries: OwnedPvPIvEntry[],
  league: PokemonPvPLeagueKey,
  maxLevel: 50 | 51,
  cpLimit: number | null,
): RankedOwnedPvPIvEntry[] =>
  entries
    .filter((entry) => (
      cpLimit == null ||
      entry.cp == null ||
      entry.cp <= cpLimit
    ))
    .map((entry) => {
      const summary = summarizePvPIvSpread(
        {
          attack: entry.pokemon.attack,
          defense: entry.pokemon.defense,
          stamina: entry.pokemon.stamina,
        },
        entry.ivs,
        league,
        maxLevel,
      );
      const ivPercentile =
        1 - ((summary.rank - 1) / Math.max(1, summary.total - 1));
      const recommendationScore = entry.metaScore == null
        ? ivPercentile * 20
        : (entry.metaScore * 0.7) + (ivPercentile * 100 * 0.3);
      return {
        entry,
        ivRank: summary.rank,
        ivTotal: summary.total,
        ivPercent: summary.statProductPercent,
        recommendationScore,
      };
    })
    .sort((left, right) => (
      right.recommendationScore - left.recommendationScore ||
      (left.entry.metaRank ?? Number.MAX_SAFE_INTEGER) -
        (right.entry.metaRank ?? Number.MAX_SAFE_INTEGER) ||
      left.ivRank - right.ivRank ||
      left.entry.pokemon.pokedexNumber - right.entry.pokemon.pokedexNumber ||
      left.entry.instanceId.localeCompare(right.entry.instanceId)
    ));
