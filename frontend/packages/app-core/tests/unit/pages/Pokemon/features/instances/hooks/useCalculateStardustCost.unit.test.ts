import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useCalculateStardustCost } from '@/pages/Pokemon/features/instances/hooks/useCalculateStardustCost';

describe('useCalculateStardustCost', () => {
  it('returns regular registered cost for non-special trades', async () => {
    const passedInPokemon = {
      variant_id: '0001-default',
      rarity: 'Common',
      instanceData: {
        instance_id: '0001-default_11111111-1111-4111-8111-111111111111',
        shiny: false,
      },
    } as any;

    const selectedMatchedInstance = {
      instance_id: '0002-default_22222222-2222-4222-8222-222222222222',
      shiny: false,
      rarity: 'Common',
    } as any;

    const myInstances = {
      '0001-default_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': { registered: true },
    } as any;
    const instances = {
      '0002-default_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb': { registered: true },
    } as any;

    const { result } = renderHook(() =>
      useCalculateStardustCost(
        2,
        passedInPokemon,
        selectedMatchedInstance,
        myInstances,
        instances,
      ),
    );

    await waitFor(() => {
      expect(result.current.stardustCost).toBe(100);
    });
    expect(result.current.isSpecialTrade).toBe(false);
    expect(result.current.isRegisteredTrade).toBe(true);
  });

  it('returns special unregistered cost and uses variant_id fallback', async () => {
    const passedInPokemon = {
      variant_id: '0003-default',
      rarity: 'Legendary',
      instanceData: undefined,
    } as any;

    const selectedMatchedInstance = {
      instance_id: '0004-default_44444444-4444-4444-8444-444444444444',
      shiny: false,
      rarity: 'Common',
    } as any;

    const myInstances = {} as any;
    const instances = {
      '0004-default_cccccccc-cccc-4ccc-8ccc-cccccccccccc': { registered: true },
    } as any;

    const { result } = renderHook(() =>
      useCalculateStardustCost(
        1,
        passedInPokemon,
        selectedMatchedInstance,
        myInstances,
        instances,
      ),
    );

    await waitFor(() => {
      expect(result.current.stardustCost).toBe(1_000_000);
    });
    expect(result.current.isSpecialTrade).toBe(true);
    expect(result.current.isRegisteredTrade).toBe(false);
  });

  it('uses Best Friends stardust pricing for Forever Friends', async () => {
    const passedInPokemon = {
      variant_id: '0150-default',
      rarity: 'Legendary',
    } as any;
    const selectedMatchedInstance = {
      instance_id: '0006-default_55555555-5555-4555-8555-555555555555',
      shiny: false,
      rarity: 'Common',
    } as any;

    const { result } = renderHook(() =>
      useCalculateStardustCost(
        5,
        passedInPokemon,
        selectedMatchedInstance,
        {} as any,
        {} as any,
      ),
    );

    await waitFor(() => {
      expect(result.current.stardustCost).toBe(40_000);
    });
  });
});
