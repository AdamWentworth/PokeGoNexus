import { describe, expect, it } from 'vitest';

import createPokemonVariants from '@/features/variants/utils/createPokemonVariants';
import { initializePokemonTags } from '@/features/tags/utils/initializePokemonTags';
import { getFilteredPokemonsByOwnership } from '@/hooks/filtering/usePokemonOwnershipFilter';
import type { BasePokemon } from '@/types/pokemonBase';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import {
  projectPokemonCollectionSortSource,
  sortPokemonCollectionItems,
  sortPokemonFavoriteTagItems,
} from '@pokemongonexus/shared-domain/collection-sort';
import {
  buildNativeCollectionRows,
  buildNativeTagSummaries,
  sortNativeCollectionRows,
} from '../../../../../../apps/mobile/src/features/collection/collectionModel';
import pokemonFixture from '@/../tests/__helpers__/fixtures/pokemons.json';
import instanceFixture from '@/../tests/__helpers__/fixtures/instances.json';

const catalog = (pokemonFixture as BasePokemon[]).filter(({ pokemon_id }) =>
  [3, 6, 9].includes(pokemon_id));
const variants = createPokemonVariants(catalog);

const makeInstance = (id: string, variantId: string, cp: number): PokemonInstance => ({
  ...Object.values(instanceFixture)[0],
  instance_id: id,
  pokemon_id: Number(variantId.split('-')[0]),
  variant_id: variantId,
  cp,
  favorite: true,
  is_caught: true,
  is_wanted: false,
  is_for_trade: false,
  most_wanted: false,
  disabled: false,
  shiny: variantId.includes('shiny'),
  shadow: variantId.includes('shadow'),
  gigantamax: variantId.includes('gigantamax'),
  caught_tags: [],
  wanted_tags: [],
} as unknown as PokemonInstance);

// Same form/CP sequence as the account capture, with synthetic instance IDs.
const instances = Object.fromEntries([
  makeInstance('blastoise-gmax', '0009-shiny_gigantamax', 2420),
  makeInstance('charizard-first', '0006-default', 3266),
  makeInstance('venusaur-gmax', '0003-shiny_gigantamax', 2681),
  makeInstance('venusaur', '0003-default', 3075),
  makeInstance('blastoise-costume', '0009-sunglasses_default', 2788),
  makeInstance('charizard-shiny-shadow', '0006-shiny_shadow', 2626),
  makeInstance('charizard-shadow', '0006-shadow', 2845),
  makeInstance('charizard-second', '0006-default', 2889),
  makeInstance('charizard-gmax', '0006-shiny_gigantamax', 2850),
  makeInstance('venusaur-shiny', '0003-shiny', 2700),
  makeInstance('venusaur-shadow', '0003-shadow', 2499),
].map((instance) => [instance.instance_id!, instance]));

const webBuckets = initializePokemonTags(instances, variants);
const nativeRows = buildNativeCollectionRows(instances, catalog, 'https://pokegonexus.com');
const nativeTags = buildNativeTagSummaries(nativeRows, instances, undefined, 'caught');
const favorites = nativeTags.find(({ key }) => key === 'system:favorites')!;

describe('collection tag ordering across Vite and native', () => {
  it('keeps the captured Pokédex form order when opening Favorites', () => {
    expect(sortNativeCollectionRows(favorites.rows, 'number', 'ascending').map(({ id }) => id))
      .toEqual([
        'venusaur', 'venusaur-shiny', 'venusaur-gmax', 'venusaur-shadow',
        'charizard-first', 'charizard-second', 'charizard-shadow',
        'charizard-shiny-shadow', 'charizard-gmax',
        'blastoise-gmax', 'blastoise-costume',
      ]);
  });

  for (const sort of ['number', 'name', 'hp', 'combatPower', 'favorite', 'releaseDate'] as const) {
    for (const direction of ['ascending', 'descending'] as const) {
      it(`matches web ${sort} ${direction} for Favorites and All Caught`, () => {
        for (const filter of ['favorites', 'caught']) {
          const webRows = getFilteredPokemonsByOwnership(variants, instances, filter, webBuckets);
          const nativeTag = nativeTags.find(({ key }) => key === `system:${filter}`)!;
          const expected = sortPokemonCollectionItems(
            webRows, sort, direction, projectPokemonCollectionSortSource,
          ).map(({ instanceData }) => instanceData?.instance_id);

          expect(sortNativeCollectionRows(nativeTag.rows, sort, direction).map(({ id }) => id))
            .toEqual(expected);
        }
      });
    }
  }

  it('keeps CP-sorted preview artwork independent of all grid sorts', () => {
    const expectedPreview = sortPokemonFavoriteTagItems(
      Object.values(webBuckets.caught), (item) => item,
    ).map(({ instance_id }) => instance_id);
    expect((favorites.previewRows ?? favorites.rows).map(({ id }) => id)).toEqual(expectedPreview);
    sortNativeCollectionRows(favorites.rows, 'number', 'descending');
    sortNativeCollectionRows(favorites.rows, 'favorite', 'ascending');
    expect(favorites.rows.map(({ id }) => id)).toEqual(Object.keys(instances));
    expect((favorites.previewRows ?? favorites.rows).map(({ id }) => id)).toEqual(expectedPreview);
  });
});
