import type { Move, CrownForm } from '../../types/pokemonSubTypes';
import { resolveActiveCrownForm } from '../../utils/crownHelpers';

type CrownMoveState = {
  is_crown: boolean;
  crown_form: string | null;
};

type CrownMovesPokemon = {
  crownForms?: CrownForm[];
};

type ResolveCrownMovePoolArgs = {
  pokemon: CrownMovesPokemon;
  baseMoves: Move[];
  crown: CrownMoveState;
};

export type CrownMoveSource = 'base' | 'crown' | 'crown_missing';

export type ResolveCrownMovePoolResult = {
  moves: Move[];
  source: CrownMoveSource;
  crownPokemonId: number | null;
};

const dedupeMoves = (moves: Move[]): Move[] => {
  const out: Move[] = [];
  const seen = new Set<number>();
  for (const move of moves) {
    if (!move || typeof move.move_id !== 'number') continue;
    if (seen.has(move.move_id)) continue;
    seen.add(move.move_id);
    out.push(move);
  }
  return out;
};

export const resolveCrownMovePool = ({
  pokemon,
  baseMoves,
  crown,
}: ResolveCrownMovePoolArgs): ResolveCrownMovePoolResult => {
  const dedupedBaseMoves = dedupeMoves(baseMoves);
  if (!crown.is_crown) {
    return {
      moves: dedupedBaseMoves,
      source: 'base',
      crownPokemonId: null,
    };
  }

  const selectedCrown = resolveActiveCrownForm(
    pokemon.crownForms,
    crown.crown_form,
  );
  const crownMoves = Array.isArray(selectedCrown?.moves)
    ? dedupeMoves(selectedCrown.moves)
    : [];

  if (crownMoves.length > 0) {
    return {
      moves: crownMoves,
      source: 'crown',
      crownPokemonId:
        typeof selectedCrown?.crown_pokemon_id === 'number'
          ? selectedCrown.crown_pokemon_id
          : null,
    };
  }

  return {
    moves: dedupedBaseMoves,
    source: 'crown_missing',
    crownPokemonId:
      typeof selectedCrown?.crown_pokemon_id === 'number'
        ? selectedCrown.crown_pokemon_id
        : null,
  };
};
