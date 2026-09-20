import { describe, expect, it } from 'vitest';

import createPokemonVariants from '@/features/variants/utils/createPokemonVariants';
import type { BasePokemon } from '@/types/pokemonBase';
import { buildPokemonCatalogEntries } from '@pokemongonexus/shared-domain/catalog';
import { projectPokemonCollectionSortSource } from '@pokemongonexus/shared-domain/collection-sort';
import pokemonFixture from '@/../tests/__helpers__/fixtures/pokemons.json';

describe('complete catalog sort projection parity', () => {
  it('projects every native catalog entry with the same sort fields as its Vite variant', () => {
    const catalog = pokemonFixture as BasePokemon[];
    const webVariants = createPokemonVariants(catalog);
    const nativeEntries = buildPokemonCatalogEntries(catalog);
    const entryById = new Map(nativeEntries.map((entry) => [entry.id, entry]));
    const pokemonById = new Map(catalog.map((pokemon) => [pokemon.pokemon_id, pokemon]));

    expect(nativeEntries.map((entry) => entry.id)).toEqual(
      webVariants.map((variant) => variant.variant_id),
    );

    for (const webVariant of webVariants) {
      const entry = entryById.get(webVariant.variant_id);
      const pokemon = pokemonById.get(webVariant.pokemon_id);
      expect(entry, webVariant.variant_id).toBeDefined();
      expect(pokemon, String(webVariant.pokemon_id)).toBeDefined();
      if (!entry || !pokemon) continue;

      const nativeProjection = projectPokemonCollectionSortSource({
        ...pokemon,
        name: entry.name,
        species_name: entry.speciesName,
        variantType: entry.variantType ?? 'default',
        form: entry.form,
        stamina: entry.stamina,
        cp50: entry.cp50,
      });
      expect(nativeProjection, webVariant.variant_id).toEqual(
        projectPokemonCollectionSortSource(webVariant),
      );
    }
  });
});
