import { useState } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NavigateFunction } from 'react-router';

import useInstanceIdProcessor, {
  type PokemonOverlaySelection,
} from '@/pages/Pokemon/hooks/useInstanceIdProcessor';
import type { Instances } from '@/types/instances';
import type { PokemonVariant } from '@/types/pokemonVariants';

const userSearchState = {
  foreignInstancesLoading: false,
  viewedInstances: null,
};

vi.mock('@/stores/useUserSearchStore', () => ({
  useUserSearchStore: {
    getState: () => userSearchState,
  },
}));

const variant = {
  pokemon_id: 25,
  variant_id: '25-default',
  name: 'Pikachu',
} as PokemonVariant;

const instances = {
  'instance-1': {
    instance_id: 'instance-1',
    pokemon_id: 25,
    variant_id: '25-default',
    is_caught: true,
    is_for_trade: true,
  },
} as unknown as Instances;

describe('useInstanceIdProcessor', () => {
  it('opens an owner instance supplied by URL and removes only the one-shot id', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    let location = {
      pathname: '/pokemon',
      search: '?filter=trade&instanceId=instance-1',
      state: undefined,
    };

    const { result, rerender } = renderHook(() => {
      const [selectedPokemon, setSelectedPokemon] = useState<PokemonOverlaySelection>(null);
      const [hasProcessedInstanceId, setHasProcessedInstanceId] = useState(false);
      useInstanceIdProcessor({
        variantsLoading: false,
        filteredVariants: [variant],
        instances,
        location,
        navigate,
        selectedPokemon,
        setSelectedPokemon,
        hasProcessedInstanceId,
        setHasProcessedInstanceId,
        isOwnCollection: true,
      });
      return selectedPokemon;
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/pokemon?filter=trade', {
        replace: true,
        state: { instanceId: null },
      });
    });

    location = {
      pathname: '/pokemon',
      search: '?filter=trade',
      state: undefined,
    };
    rerender();

    await waitFor(() => {
      expect(result.current).toEqual(expect.objectContaining({
        overlayType: 'instance',
        pokemon: expect.objectContaining({
          instanceData: expect.objectContaining({ instance_id: 'instance-1' }),
        }),
      }));
    });
  });
});
