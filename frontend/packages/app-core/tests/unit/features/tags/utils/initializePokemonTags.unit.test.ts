import { beforeEach, describe, expect, it, vi } from 'vitest';

const determineImageUrlMock = vi.hoisted(() => vi.fn(() => '/images/override.png'));

vi.mock('@/utils/imageHelpers', () => ({
  determineImageUrl: determineImageUrlMock,
}));

import { initializePokemonTags } from '@/features/tags/utils/initializePokemonTags';
import { getFilteredPokemonsByOwnership } from '@/hooks/filtering/usePokemonOwnershipFilter';
import { summarizeHomeCollection } from '@/pages/Home/homeDashboardModel';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { PokemonInstance } from '@/types/pokemonInstance';

function makeVariant(overrides: Partial<PokemonVariant> = {}): PokemonVariant {
  return {
    variant_id: '0001-default',
    pokemon_id: 1,
    name: 'Bulbasaur',
    form: null,
    variantType: 'default',
    currentImage: '/images/default/pokemon_1.png',
    stamina: 111,
    shiny_rarity: 'common',
    rarity: 'common',
    pokedex_number: 1,
    moves: [],
    type1_name: 'Grass',
    type2_name: 'Poison',
    type_1_icon: '/images/types/grass.png',
    type_2_icon: '/images/types/poison.png',
    ...overrides,
  } as PokemonVariant;
}

function makeInstance(overrides: Partial<PokemonInstance> = {}): PokemonInstance {
  return {
    instance_id: 'inst-1',
    variant_id: '0001-default',
    pokemon_id: 1,
    nickname: null,
    cp: 500,
    level: 25,
    attack_iv: 10,
    defense_iv: 10,
    stamina_iv: 10,
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
    gender: 'Male',
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
    is_caught: false,
    is_for_trade: false,
    is_wanted: false,
    most_wanted: false,
    caught_tags: [],
    trade_tags: [],
    wanted_tags: [],
    not_trade_list: {},
    not_wanted_list: {},
    trade_filters: {},
    wanted_filters: {},
    mirror: false,
    pref_lucky: false,
    registered: false,
    favorite: false,
    disabled: false,
    pokeball: null,
    location_card: null,
    location_caught: null,
    date_caught: null,
    date_added: '2026-01-01T00:00:00.000Z',
    last_update: 12345,
    ...overrides,
  } as PokemonInstance;
}

describe('initializePokemonTags', () => {
  it('keeps active totals, tag buckets, and visible rows aligned for legacy identities', () => {
    const variants = [makeVariant(), makeVariant({ variant_id: '0104-Cempasúchil_default', pokemon_id: 104, variantType: 'costume_9', currentImage: '/costume.png' })];
    const instances = {
      missing: makeInstance({ instance_id: 'missing', variant_id: null as unknown as string, is_caught: true }),
      costume: makeInstance({ instance_id: 'costume', pokemon_id: 104, variant_id: '0104-Cempas├║chil_default', costume_id: 9, is_caught: true }),
      partner: makeInstance({ instance_id: 'partner', is_caught: true, disabled: true, favorite: true }),
    };
    const before = JSON.stringify(instances);
    const tags = initializePokemonTags(instances, variants);
    expect(summarizeHomeCollection(instances)).toMatchObject({ caught: 2, favorites: 0 });
    expect(Object.keys(tags.caught)).toEqual(['missing', 'costume']);
    const rows = getFilteredPokemonsByOwnership(variants, instances, 'caught', tags);
    expect(rows.map((row) => row.variant_id)).toEqual(['0001-default', '0104-Cempasúchil_default']);
    expect(rows[1].currentImage).toBe('/costume.png');
    expect(rows[1].instanceData.instance_id).toBe('costume');
    expect(JSON.stringify(instances)).toBe(before);
    const staleTags = { ...tags, caught: { ...tags.caught, partner: tags.caught.missing } };
    expect(getFilteredPokemonsByOwnership(variants, instances, 'caught', staleTags)).toHaveLength(2);
  });

  it('does not substitute another costume or invent an unknown variant', () => {
    const instances = {
      costume: makeInstance({ instance_id: 'costume', variant_id: 'damaged-costume', costume_id: 99, is_caught: true }),
      unknown: makeInstance({ instance_id: 'unknown', variant_id: 'unrecognized-form', is_caught: true }),
    };
    expect(initializePokemonTags(instances, [makeVariant()]).caught).toEqual({});
  });

  beforeEach(() => {
    determineImageUrlMock.mockClear();
  });

  it('returns canonical empty buckets', () => {
    const out = initializePokemonTags({}, []);
    expect(out).toEqual({ caught: {}, wanted: {} });
  });

  it('maps instances into caught and wanted buckets', () => {
    const variants = [
      makeVariant({ variant_id: '0001-default', pokemon_id: 1 }),
      makeVariant({ variant_id: '0004-default', pokemon_id: 4, name: 'Charmander', pokedex_number: 4 }),
    ];

    const instances = {
      'caught-1': makeInstance({
        instance_id: 'caught-1',
        variant_id: '0001-default',
        pokemon_id: 1,
        is_caught: true,
      }),
      'wanted-1': makeInstance({
        instance_id: 'wanted-1',
        variant_id: '0004-default',
        pokemon_id: 4,
        is_wanted: true,
      }),
    };

    const out = initializePokemonTags(instances, variants);
    expect(out.caught).toHaveProperty('caught-1');
    expect(out.wanted).toHaveProperty('wanted-1');
  });

  it('allows a single instance to exist in both caught and wanted', () => {
    const instanceId = 'dual-1';
    const out = initializePokemonTags(
      {
        [instanceId]: makeInstance({
          instance_id: instanceId,
          is_caught: true,
          is_wanted: true,
        }),
      },
      [makeVariant()]
    );

    expect(out.caught).toHaveProperty(instanceId);
    expect(out.wanted).toHaveProperty(instanceId);
  });

  it('falls back to pokemon_id+shiny lookup when variant_id is missing', () => {
    const variant = makeVariant({
      variant_id: '0001-shiny',
      variantType: 'shiny',
      pokemon_id: 1,
      currentImage: '/images/shiny/shiny_pokemon_1.png',
    });
    const instanceId = 'fallback-1';

    const out = initializePokemonTags(
      {
        [instanceId]: makeInstance({
          instance_id: instanceId,
          variant_id: '' as unknown as string,
          pokemon_id: 1,
          shiny: true,
          is_caught: true,
        }),
      },
      [variant]
    );

    expect(out.caught).toHaveProperty(instanceId);
    expect(out.caught[instanceId].currentImage).toBe('/images/shiny/shiny_pokemon_1.png');
  });

  it('ignores instances when no matching variant can be resolved', () => {
    const out = initializePokemonTags(
      {
        ghost: makeInstance({
          instance_id: 'ghost',
          variant_id: '9999-default',
          pokemon_id: 9999,
          is_caught: true,
          is_wanted: true,
        }),
      },
      [makeVariant()]
    );

    expect(out.caught.ghost).toBeUndefined();
    expect(out.wanted.ghost).toBeUndefined();
  });

  it('uses image override helper for female/mega/fusion/purified cases', () => {
    const variant = makeVariant({
      female_data: { pokemon_id: 1, image_url: '/female.png', shadow_image_url: '/female-shadow.png', shiny_image_url: '/female-shiny.png', shiny_shadow_image_url: '/female-shiny-shadow.png' },
      megaEvolutions: [{ key: 'mega' }] as unknown as PokemonVariant['megaEvolutions'],
      fusion: [{ key: 'fusion' }] as unknown as PokemonVariant['fusion'],
      currentImage: '/images/default/pokemon_1.png',
    });

    const out = initializePokemonTags(
      {
        special: makeInstance({
          instance_id: 'special',
          is_caught: true,
          gender: 'Female',
          is_mega: true,
          is_fused: true,
          purified: true,
        }),
      },
      [variant]
    );

    expect(determineImageUrlMock).toHaveBeenCalledTimes(1);
    expect(out.caught.special.currentImage).toBe('/images/override.png');
  });

  it('falls back to default image when variant image is missing', () => {
    const out = initializePokemonTags(
      {
        fallbackImage: makeInstance({
          instance_id: 'fallbackImage',
          is_caught: true,
        }),
      },
      [makeVariant({ currentImage: undefined as unknown as string })]
    );

    expect(out.caught.fallbackImage.currentImage).toBe('/images/default_pokemon.png');
  });
});
