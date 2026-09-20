import type { BasePokemon, PokemonMovesChunk } from '@pokemongonexus/shared-contracts/pokemon';

type MoveCatalogRow = Pick<BasePokemon, 'pokemon_id' | 'moves' | 'fusion' | 'crownForms'>;

/** Hydrate the same base and form-specific move pools in every host. */
export const mergePokemonMoveData = <T extends MoveCatalogRow>(
  catalog: T[],
  chunk: PokemonMovesChunk,
): T[] => {
  const byId = new Map(chunk.map((entry) => [Number(entry.pokemon_id), entry]));
  return catalog.map((pokemon) => {
    const entry = byId.get(Number(pokemon.pokemon_id));
    if (!entry) return pokemon;
    const fusionMoves = new Map((entry.fusion ?? []).map((form) => [Number(form.fusion_id), form.moves]));
    const crownMoves = new Map((entry.crownForms ?? []).map((form) => [Number(form.id), form.moves]));
    return {
      ...pokemon,
      moves: entry.moves ?? [],
      fusion: (pokemon.fusion ?? []).map((form) => ({
        ...form,
        moves: fusionMoves.get(Number(form.fusion_id)) ?? form.moves ?? [],
      })),
      crownForms: (pokemon.crownForms ?? []).map((form) => ({
        ...form,
        moves: crownMoves.get(Number(form.id)) ?? form.moves ?? [],
      })),
    };
  });
};

export const mergePokemonMaxData = (catalog: BasePokemon[], maxData: BasePokemon[]): BasePokemon[] => {
  const byId = new Map(maxData.map((pokemon) => [Number(pokemon.pokemon_id), pokemon]));
  return catalog.map((pokemon) => {
    const supplement = byId.get(Number(pokemon.pokemon_id));
    if (!supplement) return pokemon;
    return {
      ...pokemon,
      max: supplement.max?.length ? supplement.max : pokemon.max,
      max_battle_profiles: supplement.max_battle_profiles?.length
        ? supplement.max_battle_profiles
        : pokemon.max_battle_profiles,
    };
  });
};
