import type { PokemonVariant } from '../../../types/pokemonVariants';
import type {
  Move,
  PokemonPvPRankingEntry,
  PokemonPvPRankingMove,
} from '@pokemongonexus/shared-contracts/pokemon';

import { toPvPRankingMove } from './pvpRoster';

export type PvPMoveMechanicsLookup = ReadonlyMap<
  string,
  PokemonPvPRankingMove
>;

const normalizeMoveName = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const addMovesToLookup = (
  lookup: Map<string, PokemonPvPRankingMove>,
  moves: readonly Move[],
): void => {
  for (const move of moves) {
    lookup.set(
      normalizeMoveName(move.name),
      toPvPRankingMove(
        move,
        Number(move.is_fast) === 1 ? 'fast' : 'charged',
      ),
    );
  }
};

export const buildPvPMoveMechanicsLookupFromVariants = (
  variants: readonly PokemonVariant[],
): PvPMoveMechanicsLookup => {
  const lookup = new Map<string, PokemonPvPRankingMove>();
  for (const variant of variants) {
    addMovesToLookup(lookup, variant.moves ?? []);
  }
  return lookup;
};

export const buildPvPMoveMechanicsLookupFromChunk = (
  chunk: ReadonlyArray<{
    moves?: readonly Move[];
    fusion?: ReadonlyArray<{ moves?: readonly Move[] }>;
    crownForms?: ReadonlyArray<{ moves?: readonly Move[] }>;
  }>,
): PvPMoveMechanicsLookup => {
  const lookup = new Map<string, PokemonPvPRankingMove>();
  for (const entry of chunk) {
    addMovesToLookup(lookup, entry.moves ?? []);
    for (const fusion of entry.fusion ?? []) {
      addMovesToLookup(lookup, fusion.moves ?? []);
    }
    for (const crownForm of entry.crownForms ?? []) {
      addMovesToLookup(lookup, crownForm.moves ?? []);
    }
  }
  return lookup;
};

export const hydratePvPRankingEntry = (
  entry: PokemonPvPRankingEntry,
  moveLookup: PvPMoveMechanicsLookup,
): PokemonPvPRankingEntry => ({
  ...entry,
  moveset: entry.moveset.map((move) => {
    const mechanics = moveLookup.get(normalizeMoveName(move.name));
    return mechanics
      ? {
        ...move,
        power: mechanics.power,
        energyGain: mechanics.energyGain,
        energyCost: mechanics.energyCost,
        turns: mechanics.turns,
        buff: mechanics.buff,
      }
      : move;
  }),
});
