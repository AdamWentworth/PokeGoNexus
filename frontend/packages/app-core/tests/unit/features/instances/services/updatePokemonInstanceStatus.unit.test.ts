import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updatePokemonInstanceStatus } from '@/features/instances/services/updatePokemonInstanceStatus';
import * as pokemonIdUtils from '@/utils/PokemonIDUtils';
import * as instanceUtils from '@/features/instances/utils/createNewInstanceData';
import * as registrationUtils from '@/features/instances/utils/updateRegistrationStatus';

import type { Instances } from '@/types/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';

const FIXED_UUID = '11111111-1111-4111-8111-111111111111';
const EXISTING_UUID = '22222222-2222-4222-8222-222222222222';

function makeVariant(overrides: Partial<PokemonVariant> = {}): PokemonVariant {
  return {
    variant_id: '0001-default',
    pokemon_id: 1,
    species_name: 'Bulbasaur',
    variantType: 'default',
    currentImage: undefined,
    costumes: [],
    ...overrides,
  } as PokemonVariant;
}

function makeInstance(overrides: Partial<PokemonInstance> = {}): PokemonInstance {
  return {
    instance_id: FIXED_UUID,
    variant_id: '0001-default',
    pokemon_id: 1,
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
    last_update: 0,
    ...overrides,
  } as PokemonInstance;
}

describe('updatePokemonInstanceStatus (current model)', () => {
  let instances: Instances;
  let variants: PokemonVariant[];

  beforeEach(() => {
    vi.restoreAllMocks();

    instances = {};
    variants = [makeVariant()];

    vi.spyOn(pokemonIdUtils, 'generateUUID').mockReturnValue(FIXED_UUID);
    vi.spyOn(instanceUtils, 'createNewInstanceData').mockImplementation((variant) =>
      makeInstance({ variant_id: variant.variant_id, pokemon_id: variant.pokemon_id }),
    );
    vi.spyOn(registrationUtils, 'updateRegistrationStatus').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns null when variant_id cannot be resolved', () => {
    const result = updatePokemonInstanceStatus('missing-variant', 'Caught', [], instances);

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      '[updatePokemonInstanceStatus]',
      'No variant for',
      'missing-variant',
    );
  });

  it('updates an existing UUID-targeted instance to Caught', () => {
    instances[EXISTING_UUID] = makeInstance({
      instance_id: EXISTING_UUID,
      variant_id: '0001-default',
      is_caught: false,
      is_for_trade: false,
      is_wanted: false,
      registered: false,
    });

    const result = updatePokemonInstanceStatus(EXISTING_UUID, 'Caught', variants, instances);

    expect(result).toBe(EXISTING_UUID);
    expect(instances[EXISTING_UUID]).toMatchObject({
      is_caught: true,
      is_for_trade: false,
      is_wanted: false,
      registered: true,
    });
    expect(registrationUtils.updateRegistrationStatus).toHaveBeenCalledWith(
      instances[EXISTING_UUID],
      instances,
    );
  });

  it('reuses an existing baseline row when target is variant_id', () => {
    instances[EXISTING_UUID] = makeInstance({
      instance_id: EXISTING_UUID,
      variant_id: '0001-default',
      is_caught: false,
      is_for_trade: false,
      is_wanted: false,
      registered: false,
    });

    const result = updatePokemonInstanceStatus('0001-default', 'Trade', variants, instances);

    expect(result).toBe(EXISTING_UUID);
    expect(instanceUtils.createNewInstanceData).not.toHaveBeenCalled();
    expect(instances[EXISTING_UUID]).toMatchObject({
      is_caught: true,
      is_for_trade: true,
      is_wanted: false,
      registered: true,
    });
  });

  it('creates a new instance when no baseline row exists', () => {
    const result = updatePokemonInstanceStatus('0001-default', 'Wanted', variants, instances);

    expect(result).toBe(FIXED_UUID);
    expect(instanceUtils.createNewInstanceData).toHaveBeenCalledWith(variants[0]);
    expect(instances[FIXED_UUID]).toMatchObject({
      variant_id: '0001-default',
      is_caught: false,
      is_for_trade: false,
      is_wanted: true,
      registered: true,
    });
  });

  it('blocks Trade/Wanted transitions for special states (example: shadow)', () => {
    const alertMock = vi.fn();
    instances[EXISTING_UUID] = makeInstance({
      instance_id: EXISTING_UUID,
      variant_id: '0001-default',
      shadow: true,
    });

    const result = updatePokemonInstanceStatus(
      EXISTING_UUID,
      'Trade',
      variants,
      instances,
      alertMock,
    );

    expect(result).toBe(EXISTING_UUID);
    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Cannot move'));
    expect(instances[EXISTING_UUID]).toMatchObject({
      shadow: true,
      is_for_trade: false,
      is_wanted: false,
    });
  });

  it('blocks a favorite caught Pokémon from being listed For Trade', () => {
    const alertMock = vi.fn();
    instances[EXISTING_UUID] = makeInstance({
      instance_id: EXISTING_UUID,
      is_caught: true,
      favorite: true,
      registered: true,
    });

    const result = updatePokemonInstanceStatus(
      EXISTING_UUID,
      'Trade',
      variants,
      instances,
      alertMock,
    );

    expect(result).toBe(EXISTING_UUID);
    expect(alertMock).toHaveBeenCalledWith(
      'Favorite Pokémon cannot be listed For Trade. Remove Favorite first.',
    );
    expect(instances[EXISTING_UUID]).toMatchObject({
      favorite: true,
      is_caught: true,
      is_for_trade: false,
    });
  });

  it('creates a separate wanted clone when source instance is caught', () => {
    instances[EXISTING_UUID] = makeInstance({
      instance_id: EXISTING_UUID,
      variant_id: '0001-default',
      is_caught: true,
      is_for_trade: false,
      is_wanted: false,
      registered: true,
    });

    const result = updatePokemonInstanceStatus(EXISTING_UUID, 'Wanted', variants, instances);

    expect(result).toBe(FIXED_UUID);
    expect(instances[FIXED_UUID]).toMatchObject({
      instance_id: FIXED_UUID,
      variant_id: '0001-default',
      is_caught: false,
      is_for_trade: false,
      is_wanted: true,
      registered: true,
    });
    expect(instances[EXISTING_UUID]).toMatchObject({
      is_caught: true,
      is_wanted: false,
    });
    expect(registrationUtils.updateRegistrationStatus).toHaveBeenCalledTimes(2);
  });

  it('converts a wanted entry into the same caught instance', () => {
    instances[EXISTING_UUID] = makeInstance({
      instance_id: EXISTING_UUID,
      variant_id: '0001-default',
      is_wanted: true,
      most_wanted: true,
      wanted_tags: ['wishlist'],
      registered: true,
    });

    const result = updatePokemonInstanceStatus(EXISTING_UUID, 'Caught', variants, instances);

    expect(result).toBe(EXISTING_UUID);
    expect(Object.keys(instances)).toEqual([EXISTING_UUID]);
    expect(instances[EXISTING_UUID]).toMatchObject({
      is_caught: true,
      is_for_trade: false,
      is_wanted: false,
      most_wanted: false,
      wanted_tags: [],
      registered: true,
    });
  });

  it('resets flags when setting Missing', () => {
    instances[EXISTING_UUID] = makeInstance({
      instance_id: EXISTING_UUID,
      variant_id: '0001-default',
      is_caught: true,
      is_for_trade: true,
      is_wanted: false,
      registered: true,
    });

    const result = updatePokemonInstanceStatus(EXISTING_UUID, 'Missing', variants, instances);

    expect(result).toBe(EXISTING_UUID);
    expect(instances[EXISTING_UUID]).toMatchObject({
      is_caught: false,
      is_for_trade: false,
      is_wanted: false,
      registered: false,
    });
    expect(registrationUtils.updateRegistrationStatus).toHaveBeenCalledWith(
      instances[EXISTING_UUID],
      instances,
    );
  });

  it('does not carry custom tags across incompatible collection states', () => {
    instances[EXISTING_UUID] = makeInstance({
      instance_id: EXISTING_UUID,
      variant_id: '0001-default',
      is_caught: true,
      registered: true,
      caught_tags: ['inventory-tag'],
      trade_tags: ['legacy-trade-tag'],
      wanted_tags: ['stale-wanted-tag'],
      favorite: true,
      most_wanted: true,
    });

    const result = updatePokemonInstanceStatus(EXISTING_UUID, 'Wanted', variants, instances);

    expect(result).toBe(FIXED_UUID);
    expect(instances[FIXED_UUID]).toMatchObject({
      is_caught: false,
      is_wanted: true,
      caught_tags: [],
      trade_tags: [],
      wanted_tags: [],
      favorite: false,
      most_wanted: false,
    });
    expect(instances[EXISTING_UUID].caught_tags).toEqual(['inventory-tag']);

    updatePokemonInstanceStatus(EXISTING_UUID, 'Missing', variants, instances);
    expect(instances[EXISTING_UUID]).toMatchObject({
      caught_tags: [],
      trade_tags: [],
      wanted_tags: [],
      favorite: false,
      most_wanted: false,
    });
  });

  it('keeps inventory tags when toggling For Trade and clears wanted-only state', () => {
    instances[EXISTING_UUID] = makeInstance({
      instance_id: EXISTING_UUID,
      variant_id: '0001-default',
      is_caught: true,
      is_wanted: true,
      registered: true,
      caught_tags: ['inventory-tag'],
      wanted_tags: ['wanted-tag'],
      favorite: false,
      most_wanted: true,
    });

    updatePokemonInstanceStatus(EXISTING_UUID, 'Trade', variants, instances);

    expect(instances[EXISTING_UUID]).toMatchObject({
      is_caught: true,
      is_for_trade: true,
      is_wanted: false,
      caught_tags: ['inventory-tag'],
      wanted_tags: [],
      favorite: false,
      most_wanted: false,
    });
  });

  it('sets purified for pokemon_id 2301/2302 when variant includes default', () => {
    const purifiedVariant = makeVariant({ variant_id: '2301-default', pokemon_id: 2301 });
    variants = [purifiedVariant];

    instances[EXISTING_UUID] = makeInstance({
      instance_id: EXISTING_UUID,
      variant_id: '2301-default',
      pokemon_id: 2301,
      purified: false,
    });

    updatePokemonInstanceStatus(EXISTING_UUID, 'Caught', variants, instances);

    expect(instances[EXISTING_UUID]).toMatchObject({
      purified: true,
      is_caught: true,
    });
  });

  it('sets dynamax/gigantamax flags from variant_id', () => {
    const dynamaxVariant = makeVariant({ variant_id: '0001-dynamax', pokemon_id: 1 });
    variants = [dynamaxVariant];

    instances[EXISTING_UUID] = makeInstance({
      instance_id: EXISTING_UUID,
      variant_id: '0001-dynamax',
      dynamax: false,
      gigantamax: false,
    });

    updatePokemonInstanceStatus(EXISTING_UUID, 'Caught', variants, instances);

    expect(instances[EXISTING_UUID]).toMatchObject({
      dynamax: true,
      gigantamax: false,
      is_caught: true,
    });
  });
});
