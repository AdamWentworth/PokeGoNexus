import { describe, expect, it } from 'vitest';

import {
  buildTradeProposalPreflight,
  buildTradeProposalRequest,
  findMatchedInstanceById,
  hasInstanceData,
  parseUsernameFromStoredUser,
  sanitizeInstanceData,
  tradeProposalErrorMessage,
} from '@/features/trades/proposal/tradeProposalHelpers';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { PokemonInstance } from '@/types/pokemonInstance';

const makeVariant = (
  overrides: Partial<PokemonVariant> = {},
): PokemonVariant =>
  ({
    variant_id: '0001-default',
    pokemon_id: 1,
    name: 'Bulbasaur',
    species_name: 'Bulbasaur',
    variantType: 'default',
    currentImage: '/images/bulbasaur.png',
    ...overrides,
  } as PokemonVariant);

describe('shared tradeProposalHelpers', () => {
  it('parses username safely from stored user JSON', () => {
    expect(parseUsernameFromStoredUser('{"username":"Ash"}')).toBe('Ash');
    expect(parseUsernameFromStoredUser('{"username":123}')).toBeNull();
    expect(parseUsernameFromStoredUser('bad-json')).toBeNull();
    expect(parseUsernameFromStoredUser(null)).toBeNull();
  });

  it('sanitizes instance data to primitive values only', () => {
    const sanitized = sanitizeInstanceData({
      cp: 1500,
      nickname: 'Sparky',
      favorite: true,
      fusion: { a: 1 },
      trade_tags: ['x'],
      extra: null,
    } as unknown as Partial<PokemonInstance>);

    expect(sanitized).toEqual({
      cp: 1500,
      nickname: 'Sparky',
      favorite: true,
      extra: null,
    });
  });

  it('builds a normalized trade proposal request payload', () => {
    const payload = buildTradeProposalRequest({
      usernameProposed: 'Ash',
      usernameAccepting: 'Misty',
      proposedInstanceId: 'inst-proposed',
      acceptingInstanceId: 'inst-accepting',
      isSpecialTrade: true,
      isRegisteredTrade: false,
      isLuckyTrade: true,
      stardustCost: 40000,
      friendshipLevel: 3,
      variantId: '0001-default',
      passedInInstanceId: 'inst-accepting',
      sanitizedInstanceData: { cp: 1500, favorite: true },
      nowIso: '2026-02-17T00:00:00.000Z',
      nowMs: 1234567890,
    });

    expect(payload).toMatchObject({
      username_proposed: 'Ash',
      username_accepting: 'Misty',
      pokemon_instance_id_user_proposed: 'inst-proposed',
      pokemon_instance_id_user_accepting: 'inst-accepting',
      is_special_trade: true,
      is_registered_trade: false,
      is_lucky_trade: true,
      trade_dust_cost: 40000,
      trade_friendship_level: 3,
      trade_proposal_date: '2026-02-17T00:00:00.000Z',
      last_update: 1234567890,
      pokemon: {
        variant_id: '0001-default',
        instance_id: 'inst-accepting',
        instanceData: { cp: 1500, favorite: true },
      },
    });
  });

  it('finds matched instance by id and narrows instance data presence', () => {
    const variantA = makeVariant({
      instanceData: { instance_id: 'a' } as unknown as PokemonInstance,
    });
    const variantB = makeVariant({
      variant_id: '0002-default',
      instanceData: { instance_id: 'b' } as unknown as PokemonInstance,
    });

    const found = findMatchedInstanceById([variantA, variantB], 'b');
    expect(found?.variant_id).toBe('0002-default');
    expect(hasInstanceData(found)).toBe(true);
    expect(hasInstanceData(makeVariant())).toBe(false);
  });

  it('returns preflight errors for invalid proposal inputs', () => {
    expect(
      buildTradeProposalPreflight({
        selectedMatchedInstance: null,
        friendshipLevel: 3,
        usernameProposed: 'Ash',
      }),
    ).toEqual({
      ok: false,
      error: 'Please select which instance to trade.',
    });

    expect(
      buildTradeProposalPreflight({
        selectedMatchedInstance: makeVariant({
          instanceData: {
            instance_id: 'inst-1',
          } as unknown as PokemonInstance,
        }),
        friendshipLevel: 0,
        usernameProposed: 'Ash',
      }),
    ).toEqual({
      ok: false,
      error: 'Please select a valid friendship level (1-5).',
    });

    expect(
      buildTradeProposalPreflight({
        selectedMatchedInstance: makeVariant({
          instanceData: {
            instance_id: 'inst-1',
          } as unknown as PokemonInstance,
        }),
        friendshipLevel: Number.NaN,
        usernameProposed: 'Ash',
      }),
    ).toEqual({
      ok: false,
      error: 'Please select a valid friendship level (1-5).',
    });

    expect(
      buildTradeProposalPreflight({
        selectedMatchedInstance: makeVariant({
          instanceData: {
            instance_id: 'inst-1',
          } as unknown as PokemonInstance,
        }),
        friendshipLevel: 3,
        usernameProposed: null,
      }),
    ).toEqual({
      ok: false,
      error: 'Could not determine your username. Please sign in again.',
    });

    expect(
      buildTradeProposalPreflight({
        selectedMatchedInstance: makeVariant({
          instanceData: {
            instance_id: '',
          } as unknown as PokemonInstance,
        }),
        friendshipLevel: 3,
        usernameProposed: 'Ash',
      }),
    ).toEqual({
      ok: false,
      error: 'Selected trade instance is missing an instance id.',
    });
  });

  it('returns proposed instance id on successful preflight', () => {
    expect(
      buildTradeProposalPreflight({
        selectedMatchedInstance: makeVariant({
          instanceData: {
            instance_id: 'inst-1',
          } as unknown as PokemonInstance,
        }),
        friendshipLevel: 4,
        usernameProposed: 'Ash',
      }),
    ).toEqual({
      ok: true,
      proposedInstanceId: 'inst-1',
      usernameProposed: 'Ash',
    });
  });

  it('accepts Forever Friends as a valid remote-trade friendship level', () => {
    expect(
      buildTradeProposalPreflight({
        selectedMatchedInstance: makeVariant({
          instanceData: {
            instance_id: 'remote-inst',
          } as unknown as PokemonInstance,
        }),
        friendshipLevel: 5,
        usernameProposed: 'Ash',
      }),
    ).toEqual({
      ok: true,
      proposedInstanceId: 'remote-inst',
      usernameProposed: 'Ash',
    });
  });

  it('turns authoritative trade failures into actionable messages', () => {
    expect(tradeProposalErrorMessage('trade state has changed')).toContain(
      'already involved in an active trade',
    );
    expect(tradeProposalErrorMessage('Invalid trade proposal')).toContain(
      'invalid Pokémon or friendship details',
    );
    expect(tradeProposalErrorMessage('Custom server explanation')).toBe(
      'Custom server explanation',
    );
  });
});
