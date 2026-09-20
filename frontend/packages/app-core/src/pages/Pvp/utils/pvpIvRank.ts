import type { PokemonPvPLeagueKey } from '@pokemongonexus/shared-contracts/pokemon';

import { calculateCP } from '../../../utils/calculateCP';
import { cpMultipliers } from '../../../utils/constants';

export type PvPIvBaseStats = {
  attack: number;
  defense: number;
  stamina: number;
};

export type PvPIvValues = {
  attack: number;
  defense: number;
  stamina: number;
};

export type PvPIvRankedSpread = PvPIvValues & {
  rank: number;
  level: number;
  cp: number;
  battleAttack: number;
  battleDefense: number;
  battleHp: number;
  statProduct: number;
  statProductPercent: number;
};

export type PvPIvRankResult = {
  selected: PvPIvRankedSpread;
  best: PvPIvRankedSpread;
  nearby: PvPIvRankedSpread[];
  total: number;
};

export type PvPIvRankSummary = {
  rank: number;
  total: number;
  statProductPercent: number;
};

const LEAGUE_CP_CAPS: Record<PokemonPvPLeagueKey, number | null> = {
  great: 1_500,
  ultra: 2_500,
  master: null,
};

const IV_VALUES = Array.from({ length: 16 }, (_, value) => value);

type PvPLevel = {
  level: number;
  multiplier: number;
};

const buildLevelsThrough = (maxLevel: 50 | 51): PvPLevel[] =>
  Object.entries(cpMultipliers)
    .map(([level, multiplier]) => ({
      level: Number(level),
      multiplier: Number(multiplier),
    }))
    .filter(({ level, multiplier }) => (
      level <= maxLevel &&
      Number.isFinite(level) &&
      Number.isFinite(multiplier)
    ))
    .sort((left, right) => right.level - left.level);

const LEVELS_BY_MAX: Record<50 | 51, PvPLevel[]> = {
  50: buildLevelsThrough(50),
  51: buildLevelsThrough(51),
};

const levelsThrough = (maxLevel: 50 | 51): PvPLevel[] =>
  LEVELS_BY_MAX[maxLevel];

const clampIv = (value: number): number =>
  Math.max(0, Math.min(15, Math.round(Number(value) || 0)));

const spreadKey = ({ attack, defense, stamina }: PvPIvValues): string =>
  `${clampIv(attack)}/${clampIv(defense)}/${clampIv(stamina)}`;

const legalBuild = (
  baseStats: PvPIvBaseStats,
  ivs: PvPIvValues,
  league: PokemonPvPLeagueKey,
  maxLevel: 50 | 51,
): Omit<PvPIvRankedSpread, 'rank' | 'statProductPercent'> => {
  const cpCap = LEAGUE_CP_CAPS[league];
  const levels = levelsThrough(maxLevel);
  let selectedLevel = levels[0];
  if (cpCap !== null) {
    let low = 0;
    let high = levels.length - 1;
    let legalIndex = high;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const cp = Math.max(
        10,
        calculateCP(
          baseStats.attack,
          baseStats.defense,
          baseStats.stamina,
          ivs.attack,
          ivs.defense,
          ivs.stamina,
          levels[middle].multiplier,
        ),
      );
      if (cp <= cpCap) {
        legalIndex = middle;
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }
    selectedLevel = levels[legalIndex] ?? levels[levels.length - 1];
  }

  const battleAttack =
    (baseStats.attack + ivs.attack) * selectedLevel.multiplier;
  const battleDefense =
    (baseStats.defense + ivs.defense) * selectedLevel.multiplier;
  const battleHp = Math.max(
    10,
    Math.floor((baseStats.stamina + ivs.stamina) * selectedLevel.multiplier),
  );
  const cp = Math.max(
    10,
    calculateCP(
      baseStats.attack,
      baseStats.defense,
      baseStats.stamina,
      ivs.attack,
      ivs.defense,
      ivs.stamina,
      selectedLevel.multiplier,
    ),
  );

  return {
    ...ivs,
    level: selectedLevel.level,
    cp,
    battleAttack,
    battleDefense,
    battleHp,
    statProduct: battleAttack * battleDefense * battleHp,
  };
};

const compareBuilds = (
  left: Omit<PvPIvRankedSpread, 'rank' | 'statProductPercent'>,
  right: Omit<PvPIvRankedSpread, 'rank' | 'statProductPercent'>,
): number => (
  right.statProduct - left.statProduct ||
  (right.attack + right.defense + right.stamina) -
    (left.attack + left.defense + left.stamina) ||
  right.attack - left.attack ||
  right.defense - left.defense ||
  right.stamina - left.stamina
);

export const buildPvPIvRankings = (
  baseStats: PvPIvBaseStats,
  league: PokemonPvPLeagueKey,
  maxLevel: 50 | 51 = 50,
): PvPIvRankedSpread[] => {
  const spreads: Array<Omit<PvPIvRankedSpread, 'rank' | 'statProductPercent'>> = [];

  for (const attack of IV_VALUES) {
    for (const defense of IV_VALUES) {
      for (const stamina of IV_VALUES) {
        spreads.push(legalBuild(
          baseStats,
          { attack, defense, stamina },
          league,
          maxLevel,
        ));
      }
    }
  }

  spreads.sort(compareBuilds);

  const bestStatProduct = spreads[0]?.statProduct ?? 1;
  return spreads.map((spread, index) => ({
    ...spread,
    rank: index + 1,
    statProductPercent: (spread.statProduct / bestStatProduct) * 100,
  }));
};

export const summarizePvPIvSpread = (
  baseStats: PvPIvBaseStats,
  ivs: PvPIvValues,
  league: PokemonPvPLeagueKey,
  maxLevel: 50 | 51 = 50,
): PvPIvRankSummary => {
  const selected = legalBuild(baseStats, ivs, league, maxLevel);
  let rank = 1;
  let bestStatProduct = selected.statProduct;

  for (const attack of IV_VALUES) {
    for (const defense of IV_VALUES) {
      for (const stamina of IV_VALUES) {
        const candidate = legalBuild(
          baseStats,
          { attack, defense, stamina },
          league,
          maxLevel,
        );
        if (compareBuilds(candidate, selected) < 0) rank += 1;
        bestStatProduct = Math.max(bestStatProduct, candidate.statProduct);
      }
    }
  }

  return {
    rank,
    total: IV_VALUES.length ** 3,
    statProductPercent: (selected.statProduct / bestStatProduct) * 100,
  };
};

export const rankPvPIvSpread = (
  rankings: PvPIvRankedSpread[],
  ivs: PvPIvValues,
  nearbyRadius = 2,
): PvPIvRankResult | null => {
  if (rankings.length === 0) return null;

  const selectedIndex = rankings.findIndex(
    (spread) => spreadKey(spread) === spreadKey(ivs),
  );
  if (selectedIndex < 0) return null;

  return {
    selected: rankings[selectedIndex],
    best: rankings[0],
    nearby: rankings.slice(
      Math.max(0, selectedIndex - nearbyRadius),
      Math.min(rankings.length, selectedIndex + nearbyRadius + 1),
    ),
    total: rankings.length,
  };
};
