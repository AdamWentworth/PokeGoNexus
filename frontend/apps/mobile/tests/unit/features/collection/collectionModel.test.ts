import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon, PokemonMovesChunk } from '@pokemongonexus/shared-contracts/pokemon';
import type { CustomTagsEnvelope } from '@pokemongonexus/shared-contracts/users';
import {
  buildCanonicalCollectionInstancePath,
  buildNativeCatalogRows,
  buildNativeCollectionRows,
  buildNativeInstanceDetail,
  buildNativeTagSummaries,
  filterNativeCollectionRows,
  prepareNativeCollectionSearchRows,
  resolveNativeInstanceImage,
  sortNativeCollectionRows,
} from '../../../../src/features/collection/collectionModel';
import type { NativeCollectionRow } from '../../../../src/features/collection/collectionModel';

const instance = (patch: Partial<PokemonInstance>): PokemonInstance => ({
  pokemon_id: 6,
  instance_id: 'instance-1',
  variant_id: '6',
  nickname: null,
  cp: null,
  level: null,
  attack_iv: null,
  defense_iv: null,
  stamina_iv: null,
  shiny: false,
  costume_id: null,
  lucky: false,
  shadow: false,
  purified: false,
  fast_move_id: null,
  charged_move1_id: null,
  charged_move2_id: null,
  weight: null,
  height: null,
  gender: null,
  mega: false,
  mega_form: null,
  is_mega: false,
  dynamax: false,
  gigantamax: false,
  crown: false,
  max_attack: null,
  max_guard: null,
  max_spirit: null,
  is_fused: false,
  fusion: null,
  fusion_form: null,
  fused_with: null,
  is_traded: false,
  traded_date: null,
  original_trainer_id: null,
  original_trainer_name: null,
  is_caught: true,
  is_for_trade: false,
  is_wanted: false,
  most_wanted: false,
  caught_tags: null,
  trade_tags: null,
  wanted_tags: null,
  not_trade_list: null,
  not_wanted_list: null,
  trade_filters: null,
  wanted_filters: null,
  mirror: false,
  pref_lucky: false,
  friendship_level: null,
  registered: true,
  favorite: false,
  disabled: false,
  pokeball: null,
  location_card: null,
  location_caught: null,
  date_caught: null,
  date_added: '2026-08-23T00:00:00Z',
  last_update: 1,
  ...patch,
});

const pokemon = {
  pokemon_id: 6,
  name: 'Charizard',
  attack: 223,
  defense: 173,
  stamina: 186,
  pokedex_number: 6,
  image_url: '/images/charizard.png',
  image_url_shiny: '/images/charizard-shiny.png',
  image_url_shadow: '/images/charizard-shadow.png',
  image_url_shiny_shadow: '/images/charizard-shiny-shadow.png',
  costumes: [],
  megaEvolutions: [],
  fusion: [],
  max: [{
    pokemon_id: 6,
    dynamax: true,
    gigantamax: true,
    dynamax_release_date: null,
    gigantamax_release_date: null,
    gigantamax_image_url: '/images/gmax-charizard.png',
    shiny_gigantamax_image_url: '/images/gmax-charizard-shiny.png',
  }],
} as unknown as BasePokemon;

describe('native collection model', () => {
  it('builds an exact canonical instance handoff with its status filter', () => {
    expect(buildCanonicalCollectionInstancePath('instance 1', 'trade')).toBe(
      '/pokemon?filter=trade&instanceId=instance+1',
    );
  });

  it('builds the complete catalog separately from collection instances', () => {
    const catalog = [
      {
        ...pokemon,
        shiny_available: 1,
        date_shadow_available: '2020-01-01',
        date_shiny_shadow_available: '2020-01-01',
      } as BasePokemon,
    ];
    const rows = buildNativeCatalogRows(catalog, 'https://pokegonexus.com');

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '0006-default', name: 'Charizard', source: 'catalog' }),
      expect.objectContaining({ id: '0006-shiny', name: 'Shiny Charizard' }),
      expect.objectContaining({ id: '0006-shadow', name: 'Shadow Charizard' }),
      expect.objectContaining({ id: '0006-shiny_shadow', name: 'Shiny Shadow Charizard' }),
      expect.objectContaining({ id: '0006-gigantamax', maxKind: 'gigantamax' }),
    ]));
    expect(sortNativeCollectionRows(rows, 'number', 'ascending').slice(0, 6).map((row) => row.id)).toEqual([
      '0006-default',
      '0006-shiny',
      '0006-shadow',
      '0006-shiny_shadow',
      '0006-dynamax',
      '0006-shiny_dynamax',
    ]);
    expect(sortNativeCollectionRows(rows, 'number', 'descending').slice(0, 6).map((row) => row.id)).toEqual([
      '0006-default',
      '0006-shiny',
      '0006-shadow',
      '0006-shiny_shadow',
      '0006-dynamax',
      '0006-shiny_dynamax',
    ]);
    expect(buildNativeCatalogRows(catalog, 'https://pokegonexus.com')).toBe(rows);
  });

  it('reuses prepared instance details while the query snapshots are unchanged', () => {
    const instances = { caught: instance({ instance_id: 'caught' }) };
    const catalog = [pokemon];
    const moves: PokemonMovesChunk = [];
    const first = buildNativeInstanceDetail(
      instances,
      catalog,
      moves,
      'caught',
      'https://pokegonexus.com',
    );

    expect(buildNativeInstanceDetail(
      instances,
      catalog,
      moves,
      'caught',
      'https://pokegonexus.com',
    )).toBe(first);
    expect(buildNativeInstanceDetail(
      { ...instances },
      catalog,
      moves,
      'caught',
      'https://pokegonexus.com',
    )).not.toBe(first);
  });

  it('uses the exact shiny Gigantamax artwork when that form is selected', () => {
    expect(resolveNativeInstanceImage(
      instance({ shiny: true, gigantamax: true }),
      pokemon,
    )).toBe('/images/gmax-charizard-shiny.png');
  });

  it('uses canonical type assets for transformed collection rows', () => {
    const transformedPokemon = {
      ...pokemon,
      megaEvolutions: [{
        id: 61,
        form: 'x',
        primal: false,
        type1_name: 'Fire',
        type2_name: 'Dragon',
      }],
    } as unknown as BasePokemon;

    const [megaRow] = buildNativeCollectionRows({
      mega: instance({
        instance_id: 'mega',
        mega: true,
        is_mega: true,
        mega_form: 'x',
      }),
    }, [transformedPokemon], 'https://pokegonexus.com');

    expect(megaRow.typeIconUris).toEqual([
      'https://pokegonexus.com/images/types/fire.png',
      'https://pokegonexus.com/images/types/dragon.png',
    ]);
  });

  it('renders a registered inactive Mega as its ordinary current form', () => {
    const transformedPokemon = {
      ...pokemon,
      type_1_icon: '/images/types/fire.png',
      type_2_icon: '/images/types/flying.png',
      megaEvolutions: [{
        id: 61,
        form: 'x',
        primal: false,
        image_url: '/images/mega-charizard-x.png',
        type1_name: 'Fire',
        type2_name: 'Dragon',
      }],
    } as unknown as BasePokemon;

    const [row] = buildNativeCollectionRows({
      registered: instance({
        instance_id: 'registered',
        mega: true,
        is_mega: false,
        mega_form: null,
      }),
    }, [transformedPokemon], 'https://pokegonexus.com');

    expect(row).toEqual(expect.objectContaining({
      name: 'Charizard',
      imageUri: 'https://pokegonexus.com/images/charizard.png',
      typeIconUris: [
        'https://pokegonexus.com/images/types/fire.png',
        'https://pokegonexus.com/images/types/flying.png',
      ],
    }));
    const detail = buildNativeInstanceDetail(
      { registered: instance({ instance_id: 'registered', mega: true, is_mega: false }) },
      [transformedPokemon],
      [],
      'registered',
      'https://pokegonexus.com',
    );
    expect(detail?.traits).not.toContain('Mega Evolved');
  });

  it('builds stable rows, excludes disabled data, and resolves relative artwork', () => {
    const instances = {
      caught: instance({ instance_id: 'caught', favorite: true }),
      wanted: instance({ instance_id: 'wanted', is_caught: false, is_wanted: true, most_wanted: true }),
      disabled: instance({ instance_id: 'disabled', disabled: true }),
    };
    const catalog = [pokemon];
    const rows = buildNativeCollectionRows(instances, catalog, 'https://pokegonexus.com');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(expect.objectContaining({
      name: 'Charizard',
      imageUri: 'https://pokegonexus.com/images/charizard.png',
      favorite: true,
    }));
    expect(filterNativeCollectionRows(rows, 'wanted', '')).toEqual([
      expect.objectContaining({ id: 'wanted', mostWanted: true }),
    ]);
    expect(filterNativeCollectionRows(rows, 'favorites', '')).toEqual([
      expect.objectContaining({ id: 'caught', favorite: true }),
    ]);
    expect(filterNativeCollectionRows(rows, 'most-wanted', '')).toEqual([
      expect.objectContaining({ id: 'wanted', mostWanted: true }),
    ]);
    expect(filterNativeCollectionRows(rows, 'all', '')).toBe(rows);
    expect(filterNativeCollectionRows(rows, 'all', '0006')).toHaveLength(0);
    expect(filterNativeCollectionRows(rows, 'all', '6')).toHaveLength(2);
    const sortedByName = sortNativeCollectionRows(rows, 'name', 'ascending');
    expect(sortNativeCollectionRows(rows, 'name', 'ascending')).toBe(sortedByName);
    expect(buildNativeCollectionRows(instances, catalog, 'https://pokegonexus.com')).toBe(rows);
  });

  it('preserves costume names, type icons, and the costume-specific location background', () => {
    const presentationPokemon = {
      ...pokemon,
      type_1_icon: '/images/types/fire.png',
      type_2_icon: '/images/types/flying.png',
      costumes: [{
        costume_id: 22,
        name: 'detective_hat',
        image_url: '/images/detective-charizard.png',
        image_url_shiny: '/images/shiny-detective-charizard.png',
      }],
      backgrounds: [
        { background_id: 9, costume_id: null, image_url: '/images/generic-location.png' },
        { background_id: 9, costume_id: 22, image_url: '/images/detective-location.png' },
      ],
    } as unknown as BasePokemon;

    const rows = buildNativeCollectionRows({
      detective: instance({
        instance_id: 'detective',
        shiny: true,
        costume_id: 22,
        location_card: '9',
      }),
    }, [presentationPokemon], 'https://pokegonexus.com');

    expect(rows[0]).toEqual(expect.objectContaining({
      name: 'Shiny Detective Hat Charizard',
      imageUri: 'https://pokegonexus.com/images/shiny-detective-charizard.png',
      locationBackgroundUri: 'https://pokegonexus.com/images/detective-location.png',
      typeIconUris: [
        'https://pokegonexus.com/images/types/fire.png',
        'https://pokegonexus.com/images/types/flying.png',
      ],
    }));
  });

  it('hides a stored location card when its background belongs to another costume', () => {
    const presentationPokemon = {
      ...pokemon,
      backgrounds: [{
        background_id: 9,
        costume_id: 22,
        image_url: '/images/detective-location.png',
      }],
    } as unknown as BasePokemon;

    const rows = buildNativeCollectionRows({
      ordinary: instance({
        instance_id: 'ordinary',
        costume_id: null,
        location_card: '9',
      }),
    }, [presentationPokemon], 'https://pokegonexus.com');

    expect(rows[0].locationBackgroundUri).toBeNull();
  });

  it('sorts a copy of real collection rows without mutating query data', () => {
    const rows = buildNativeCollectionRows({
      charizard: instance({ instance_id: 'charizard', cp: 2500, favorite: false }),
      favorite: instance({ instance_id: 'favorite', nickname: 'Ace', cp: 1500, favorite: true }),
    }, [pokemon], 'https://pokegonexus.com');
    const originalOrder = rows.map((row) => row.id);

    expect(sortNativeCollectionRows(rows, 'name', 'ascending').map((row) => row.id)).toEqual([
      'favorite',
      'charizard',
    ]);
    expect(sortNativeCollectionRows(rows, 'combatPower', 'descending').map((row) => row.id)).toEqual([
      'charizard',
      'favorite',
    ]);
    expect(sortNativeCollectionRows(rows, 'favorite', 'descending')[0].id).toBe('favorite');
    expect(rows.map((row) => row.id)).toEqual(originalOrder);
  });

  it('uses the same CP, Recent, Favorite, Name, and form-HP keys as Vite', () => {
    const bulbasaur = {
      ...pokemon,
      pokemon_id: 1,
      pokedex_number: 1,
      name: 'Bulbasaur',
      stamina: 128,
      cp50: 1260,
      date_available: '2016-07-06',
      image_url: '/images/bulbasaur.png',
      max: [],
    } as unknown as BasePokemon;
    const sortableCharizard = {
      ...pokemon,
      cp50: 3266,
      date_available: '2016-07-06',
      megaEvolutions: [{
        id: 61,
        form: 'x',
        date_available: '2020-08-27',
        image_url: '/images/mega-charizard-x.png',
        attack: 273,
        defense: 213,
        stamina: 186,
        cp50: 4353,
        type1_name: 'Fire',
        type2_name: 'Dragon',
      }],
    } as unknown as BasePokemon;
    const catalogRows = buildNativeCatalogRows(
      [sortableCharizard, bulbasaur],
      'https://pokegonexus.com',
    );
    const defaultCharizard = catalogRows.find((row) => row.id === '0006-default');
    const megaCharizard = catalogRows.find((row) => row.id === '0006-mega_x');
    const baseBulbasaur = catalogRows.find((row) => row.id === '0001-default');
    expect(defaultCharizard?.cp).toBeNull();
    expect(defaultCharizard?.sortProjection?.cp).toBe(3266);
    expect(megaCharizard).toEqual(expect.objectContaining({ cp: null, hp: 186 }));
    expect(megaCharizard?.sortProjection?.cp).toBe(4353);
    expect(sortNativeCollectionRows(
      [defaultCharizard, megaCharizard, baseBulbasaur].filter(Boolean) as NativeCollectionRow[],
      'combatPower',
      'descending',
    ).map((row) => row.id)).toEqual([
      '0006-mega_x', '0006-default', '0001-default',
    ]);

    const instanceRows = buildNativeCollectionRows({
      favoriteLow: instance({
        instance_id: 'favoriteLow', pokemon_id: 1, variant_id: '0001-default', cp: 100,
        favorite: true, date_added: '2099-01-01',
      }),
      favoriteHigh: instance({
        instance_id: 'favoriteHigh', cp: 200, favorite: true, date_added: '2000-01-01',
      }),
      ordinary: instance({ instance_id: 'ordinary', cp: 500, favorite: false }),
    }, [sortableCharizard, bulbasaur], 'https://pokegonexus.com');
    expect(sortNativeCollectionRows(instanceRows, 'favorite', 'descending').map((row) => row.id))
      .toEqual(['favoriteHigh', 'favoriteLow', 'ordinary']);
    expect(sortNativeCollectionRows(instanceRows, 'releaseDate', 'ascending').map((row) => row.id))
      .toEqual(['favoriteLow', 'favoriteHigh', 'ordinary']);
  });

  it('matches the canonical union, intersection, exclusion, and family search syntax', () => {
    const searchableRows: NativeCollectionRow[] = [
      {
        id: 'bulbasaur', pokemonId: 1, pokedexNumber: 1, name: 'Bulbasaur', imageUri: null,
        locationBackgroundUri: null, maxKind: null, purified: false, lucky: false,
        typeIconUris: [], status: 'caught', cp: null, favorite: false, mostWanted: false,
        evolutionFamilyIds: [1, 2, 3], searchTerms: ['Grass', 'Poison'],
      },
      {
        id: 'ivysaur', pokemonId: 2, pokedexNumber: 2, name: 'Ivysaur', imageUri: null,
        locationBackgroundUri: null, maxKind: null, purified: false, lucky: false,
        typeIconUris: [], status: 'caught', cp: null, favorite: false, mostWanted: false,
        evolutionFamilyIds: [1, 2, 3], searchTerms: ['Grass', 'Poison'],
      },
      {
        id: 'venusaur', pokemonId: 3, pokedexNumber: 3, name: 'Shiny Venusaur', imageUri: null,
        locationBackgroundUri: null, maxKind: null, purified: false, lucky: false,
        typeIconUris: [], status: 'caught', cp: null, favorite: false, mostWanted: false,
        evolutionFamilyIds: [1, 2, 3], searchTerms: ['Grass', 'Poison', 'Shiny'],
      },
      {
        id: 'charizard', pokemonId: 6, pokedexNumber: 6, name: 'Charizard', imageUri: null,
        locationBackgroundUri: null, maxKind: null, purified: false, lucky: false,
        typeIconUris: [], status: 'caught', cp: null, favorite: false, mostWanted: false,
        evolutionFamilyIds: [4, 5, 6], searchTerms: ['Fire', 'Flying'],
      },
    ];

    expect(prepareNativeCollectionSearchRows(searchableRows, 0, 2)).toBe(2);
    expect(prepareNativeCollectionSearchRows(searchableRows, 2, 128)).toBe(4);
    expect(filterNativeCollectionRows(searchableRows, 'all', 'bulb,char')).toEqual([
      searchableRows[0], searchableRows[3],
    ]);
    const grassAndShiny = filterNativeCollectionRows(searchableRows, 'all', 'grass&shiny');
    expect(grassAndShiny).toEqual([
      searchableRows[2],
    ]);
    expect(filterNativeCollectionRows(searchableRows, 'all', 'grass&shiny')).toBe(
      grassAndShiny,
    );
    expect(filterNativeCollectionRows(searchableRows, 'all', 'grass&!shiny')).toEqual([
      searchableRows[0], searchableRows[1],
    ]);
    expect(filterNativeCollectionRows(searchableRows, 'all', '+bulbasaur')).toEqual(
      searchableRows.slice(0, 3),
    );
    expect(filterNativeCollectionRows(searchableRows, 'all', 'bulbasaur', {
      showEvolutionaryLine: true,
      universeRows: searchableRows,
    })).toEqual(searchableRows.slice(0, 3));
  });

  it('derives ordered system and custom tag membership from canonical instances', () => {
    const instances = {
      favorite: instance({
        instance_id: 'favorite',
        favorite: true,
        caught_tags: ['purple-tag'],
      }),
      trade: instance({
        instance_id: 'trade',
        is_for_trade: true,
        caught_tags: ['purple-tag'],
      }),
      wanted: instance({
        instance_id: 'wanted',
        is_caught: false,
        is_wanted: true,
        most_wanted: true,
        wanted_tags: ['dream-tag'],
      }),
    };
    const rows = buildNativeCollectionRows(instances, [pokemon], 'https://pokegonexus.com');
    const envelope: CustomTagsEnvelope = {
      tags: [
        { tag_id: 'purple-tag', parent: 'caught' as const, name: 'Shadow Shinies', color: '#7c3aed', sort: 0, created_at: 'now' },
        { tag_id: 'dream-tag', parent: 'wanted' as const, name: 'Dream Trades', color: '#f43f5e', sort: 0, created_at: 'now' },
      ],
      orders: {
        caught: ['system:favorites', 'custom:purple-tag', 'system:caught', 'system:trade'],
        wanted: ['custom:dream-tag', 'system:most-wanted', 'system:wanted'],
      },
    };

    const caught = buildNativeTagSummaries(rows, instances, envelope, 'caught');
    const wanted = buildNativeTagSummaries(rows, instances, envelope, 'wanted');

    expect(buildNativeTagSummaries(rows, instances, envelope, 'caught')).toBe(caught);
    expect(buildNativeTagSummaries(rows, instances, envelope, 'wanted')).toBe(wanted);

    expect(caught.map((tag) => tag.name)).toEqual([
      'Favorites', 'Shadow Shinies', 'All Caught', 'For Trade',
    ]);
    expect(caught.map((tag) => tag.filterName)).toEqual([
      'Favorites', 'Shadow Shinies', 'Caught', 'Trade',
    ]);
    expect(caught.find((tag) => tag.name === 'Shadow Shinies')?.rows).toHaveLength(2);
    expect(wanted.map((tag) => tag.name)).toEqual([
      'Dream Trades', 'Most Wanted', 'All Wanted',
    ]);
    expect(wanted.map((tag) => tag.filterName)).toEqual([
      'Dream Trades', 'Most Wanted', 'Wanted',
    ]);
    expect(wanted[0].rows[0]).toEqual(expect.objectContaining({ id: 'wanted' }));
  });

  it('matches web tag previews: instance order for buckets and descending CP for Favorites', () => {
    const instances = {
      high: instance({ instance_id: 'high', pokemon_id: 383, cp: 4000, favorite: true }),
      missing: instance({ instance_id: 'missing', cp: null, favorite: true }),
      low: instance({ instance_id: 'low', cp: 1200, favorite: true }),
      zero: instance({ instance_id: 'zero', cp: 0, favorite: true }),
    };
    const rows = buildNativeCollectionRows(instances, [
      pokemon,
      { ...pokemon, pokemon_id: 383, pokedex_number: 383, name: 'Groudon' },
    ], 'https://pokegonexus.com');
    const tags = buildNativeTagSummaries(rows, instances, undefined, 'caught');

    expect(tags.find((tag) => tag.key === 'system:caught')?.rows.map((row) => row.id))
      .toEqual(['high', 'missing', 'low', 'zero']);
    expect(tags.find((tag) => tag.key === 'system:favorites')?.rows.map((row) => row.id))
      .toEqual(['high', 'missing', 'low', 'zero']);
    expect(tags.find((tag) => tag.key === 'system:favorites')?.previewRows?.map((row) => row.id))
      .toEqual(['high', 'low', 'zero', 'missing']);
  });

  it('keeps stale memberships in the correct parent and uses saved custom-tag sort order', () => {
    const instances = {
      caught: instance({ instance_id: 'caught', caught_tags: ['alpha'], wanted_tags: ['dream'] }),
      wanted: instance({
        instance_id: 'wanted', is_caught: false, is_wanted: true,
        favorite: true, caught_tags: ['alpha'], wanted_tags: ['dream'],
      }),
    };
    const rows = buildNativeCollectionRows(instances, [pokemon], 'https://pokegonexus.com');
    const envelope: CustomTagsEnvelope = {
      tags: [
        { tag_id: 'zeta', parent: 'caught', name: 'Zeta', color: '#111111', sort: 2, created_at: '' },
        { tag_id: 'alpha', parent: 'caught', name: 'Alpha', color: '#111111', sort: 1, created_at: '' },
        { tag_id: 'beta', parent: 'caught', name: 'Beta', color: '#111111', sort: 1, created_at: '' },
        { tag_id: 'dream', parent: 'wanted', name: 'Dream', color: '#111111', sort: 0, created_at: '' },
      ],
      orders: { caught: [], wanted: [] },
    };
    const caught = buildNativeTagSummaries(rows, instances, envelope, 'caught');
    const wanted = buildNativeTagSummaries(rows, instances, envelope, 'wanted');

    expect(caught.filter((tag) => tag.tone === 'custom').map((tag) => tag.name))
      .toEqual(['Alpha', 'Beta', 'Zeta']);
    expect(caught.find((tag) => tag.key === 'system:favorites')?.rows).toEqual([]);
    expect(caught.find((tag) => tag.key === 'custom:alpha')?.rows.map((row) => row.id))
      .toEqual(['caught']);
    expect(wanted.find((tag) => tag.key === 'custom:dream')?.rows.map((row) => row.id))
      .toEqual(['wanted']);
  });

  it('keeps system tags available for malformed optional tag metadata', () => {
    const rows = buildNativeCollectionRows({}, [pokemon], 'https://pokegonexus.com');

    expect(buildNativeTagSummaries(rows, {}, undefined, 'caught').map((tag) => tag.key))
      .toEqual(['system:caught', 'system:favorites', 'system:trade']);
    expect(buildNativeTagSummaries(rows, {}, null, 'wanted').map((tag) => tag.key))
      .toEqual(['system:wanted', 'system:most-wanted']);
  });

  it('does not crash when a legacy instance stores tag membership as an object', () => {
    const instances = {
      legacy: instance({
        instance_id: 'legacy',
        caught_tags: {} as never,
      }),
    };
    const rows = buildNativeCollectionRows(instances, [pokemon], 'https://pokegonexus.com');
    const envelope: CustomTagsEnvelope = {
      tags: [{
        tag_id: 'purple-tag',
        parent: 'caught',
        name: 'Shadow Shinies',
        color: '#7c3aed',
        sort: 0,
        created_at: 'now',
      }],
      orders: {
        caught: ['custom:purple-tag'],
        wanted: [],
      },
    };

    expect(() => buildNativeTagSummaries(rows, instances, envelope, 'caught')).not.toThrow();
    expect(buildNativeTagSummaries(rows, instances, envelope, 'caught')[0].rows).toEqual([]);
  });

  it('builds a native detail model from shared instance identity and move metadata', () => {
    const detailPokemon = {
      ...pokemon,
      megaEvolutions: [{
        id: 61,
        form: 'x',
        primal: false,
        image_url: '/images/mega-charizard-x.png',
        image_url_shiny: '/images/shiny-mega-charizard-x.png',
        attack: 273,
        defense: 213,
        stamina: 186,
        type1_name: 'Fire',
        type2_name: 'Dragon',
      }],
      fusion: [{
        fusion_id: 2,
        base_pokemon_id1: 6,
        base_pokemon_id2: 150,
        name: 'Armored Charizard',
        image_url: '/images/fused-charizard.png',
        image_url_shiny: '/images/shiny-fused-charizard.png',
        attack: 277,
        defense: 220,
        stamina: 200,
        type1_name: 'Fire',
        type2_name: 'Steel',
        backgrounds: [{
          background_id: 12,
          costume_id: 0,
          name: 'Fusion sky',
          location: 'Fusion sky',
          image_url: '/images/fusion-location.png',
        }],
        background_combo_rules: [{
          member1_background_id: 12,
          member2_background_id: 21,
          combo_background_id: 99,
          combo_background_name: 'Combined sky',
          combo_background_location: 'Combined sky',
          combo_background_image_url: '/images/fusion-combo.png',
        }],
      }],
      crownForms: [{
        id: 1,
        name: 'Crowned Test',
        display_form: 'Crowned Sword',
        image_url: '/images/crowned-charizard.png',
        image_url_shiny: '/images/shiny-crowned-charizard.png',
        attack: 332,
        defense: 240,
        stamina: 192,
        type1_name: 'Fairy',
        type2_name: 'Steel',
      }],
      backgrounds: [
        {
          background_id: 9,
          costume_id: null,
          name: 'City Safari',
          location: 'Vancouver',
          image_url: '/images/vancouver-location.png',
        },
        {
          background_id: 10,
          costume_id: 22,
          name: 'Costume only',
          location: 'Costume only',
          image_url: '/images/costume-location.png',
        },
      ],
      sizes: {
        height_xxs_threshold: 1,
        height_xs_threshold: 2,
        height_xl_threshold: 3,
        height_xxl_threshold: 4,
        weight_xxs_threshold: 10,
        weight_xs_threshold: 20,
        weight_xl_threshold: 30,
        weight_xxl_threshold: 40,
      },
    } as unknown as BasePokemon;
    const detail = buildNativeInstanceDetail(
      {
        legacy_key: instance({
          instance_id: 'instance-1',
          shiny: true,
          cp: 2499,
          attack_iv: 15,
          friendship_level: 5,
          pref_lucky: true,
          fast_move_id: 101,
        }),
        partner_key: instance({
          instance_id: 'partner-1',
          pokemon_id: 150,
          variant_id: '0150-default',
        }),
      },
      [detailPokemon, {
        ...pokemon,
        pokemon_id: 150,
        pokedex_number: 150,
        name: 'Mewtwo',
        image_url: '/images/mewtwo.png',
        image_url_shiny: '/images/shiny-mewtwo.png',
        fusion: [],
      } as unknown as BasePokemon],
      [{
        pokemon_id: 6,
        moves: [{
          move_id: 101,
          name: 'Fire Spin',
          is_fast: 1,
          legacy: false,
          type_name: 'Fire',
          type: 'Fire',
          raid_power: 14,
          pvp_power: 9,
        }],
        fusion: [{
          fusion_id: 2,
          moves: [{
            move_id: 202,
            name: 'Fusion Flare',
            is_fast: 0,
            legacy: false,
            type_name: 'Fire',
          }],
        }],
        crownForms: [],
      }] as never,
      'instance-1',
      'https://pokegonexus.com',
    );

    expect(detail).toEqual(expect.objectContaining({
      row: expect.objectContaining({ name: 'Shiny Charizard' }),
      baseStats: {
        attack: Number(detailPokemon.attack),
        defense: Number(detailPokemon.defense),
        stamina: Number(detailPokemon.stamina),
      },
      traits: expect.arrayContaining(['Shiny']),
      stats: expect.arrayContaining([{ label: 'CP', value: '2,499' }]),
      ivs: [{ label: 'Attack', value: 15 }],
      moves: [{
        label: 'Fast move',
        value: 'Fire Spin',
        legacy: false,
        typeName: 'Fire',
        typeIconUri: 'https://pokegonexus.com/images/types/fire.png',
        raidPower: 14,
        pvpPower: 9,
      }],
      preferences: expect.arrayContaining([
        { label: 'Friendship', value: '5/5 hearts' },
        { label: 'Lucky trade', value: 'Requested' },
      ]),
      moveOptions: [{
        id: 101,
        name: 'Fire Spin',
        kind: 'fast',
        legacy: false,
        typeName: 'Fire',
        typeIconUri: 'https://pokegonexus.com/images/types/fire.png',
        raidPower: 14,
        pvpPower: 9,
      }],
      backgroundOptions: [{
        id: 9,
        name: 'Vancouver',
        imageUri: 'https://pokegonexus.com/images/vancouver-location.png',
      }],
      appearanceImageUris: {
        base: 'https://pokegonexus.com/images/charizard-shiny.png',
        shadow: 'https://pokegonexus.com/images/charizard-shiny-shadow.png',
        purified: 'https://pokegonexus.com/images/charizard-shiny.png',
      },
      megaOptions: [{
        form: 'x',
        imageUri: 'https://pokegonexus.com/images/shiny-mega-charizard-x.png',
        label: 'Mega X',
        primal: false,
        stats: { attack: 273, defense: 213, stamina: 186 },
        typeIconUris: [
          'https://pokegonexus.com/images/types/fire.png',
          'https://pokegonexus.com/images/types/dragon.png',
        ],
      }],
      crownOptions: [{
        form: 'Crowned Sword',
        imageUri: 'https://pokegonexus.com/images/shiny-crowned-charizard.png',
        label: 'Crowned Sword',
        moveOptions: [],
        stats: { attack: 332, defense: 240, stamina: 192 },
        typeIconUris: [
          'https://pokegonexus.com/images/types/fairy.png',
          'https://pokegonexus.com/images/types/steel.png',
        ],
      }],
      fusionOptions: [{
        id: 2,
        imageUri: 'https://pokegonexus.com/images/shiny-fused-charizard.png',
        moveOptions: [{
          id: 202,
          name: 'Fusion Flare',
          kind: 'charged',
          legacy: false,
          typeName: 'Fire',
          typeIconUri: 'https://pokegonexus.com/images/types/fire.png',
          raidPower: null,
          pvpPower: null,
        }],
        name: 'Armored Charizard',
        stats: { attack: 277, defense: 220, stamina: 200 },
        typeIconUris: [
          'https://pokegonexus.com/images/types/fire.png',
          'https://pokegonexus.com/images/types/steel.png',
        ],
        partnerPokemonId: 150,
        partnerRows: [expect.objectContaining({ id: 'partner-1', name: 'Mewtwo' })],
        backgroundOptions: [{
          id: 12,
          name: 'Fusion sky',
          imageUri: 'https://pokegonexus.com/images/fusion-location.png',
        }],
        partnerBackgroundIds: { 'partner-1': null },
        comboBackgrounds: [],
      }],
      fusionPartnerRow: null,
      specialMaxBaseEligible: false,
      sizeThresholds: detailPokemon.sizes,
    }));

    const fusedDetail = buildNativeInstanceDetail(
      {
        legacy_key: instance({
          instance_id: 'instance-1',
          shiny: true,
          location_card: '12',
          is_fused: true,
          fusion: { 2: true },
          fusion_form: 'Armored Charizard',
          fused_with: 'partner-1',
        }),
        partner_key: instance({
          instance_id: 'partner-1',
          pokemon_id: 150,
          variant_id: '0150-default',
          location_card: '21',
          disabled: true,
          is_fused: true,
          fusion_form: 'Armored Charizard',
          fused_with: 'instance-1',
        }),
      },
      [detailPokemon, {
        ...pokemon,
        pokemon_id: 150,
        pokedex_number: 150,
        name: 'Mewtwo',
        image_url: '/images/mewtwo.png',
        image_url_shiny: '/images/shiny-mewtwo.png',
        fusion: [],
      } as unknown as BasePokemon],
      [],
      'instance-1',
      'https://pokegonexus.com',
    );
    if (!fusedDetail) throw new Error('Expected the fused detail fixture to resolve.');
    expect(fusedDetail.row.locationBackgroundUri).toBe(
      'https://pokegonexus.com/images/fusion-combo.png',
    );
    expect(fusedDetail.backgroundOptions).toEqual([{
      id: 12,
      name: 'Fusion sky',
      imageUri: 'https://pokegonexus.com/images/fusion-location.png',
    }]);
    expect(fusedDetail.fusionPartnerRow).toEqual(expect.objectContaining({ id: 'partner-1' }));
  });
});
