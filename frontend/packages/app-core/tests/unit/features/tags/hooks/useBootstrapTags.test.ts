import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBootstrapTags } from '@/features/tags/hooks/useBootstrapTags';
import { useTagsStore } from '@/features/tags/store/useTagsStore';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';

describe('useBootstrapTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useVariantsStore.setState({
      variants: [],
      variantsLoading: false,
      isRefreshing: false,
    });

    useInstancesStore.setState({
      instances: {},
      foreignInstances: null,
      instancesLoading: false,
    });

    useTagsStore.setState({
      tags: { caught: {}, wanted: {}, trade: {} } as any,
      customTags: { caught: {}, wanted: {} },
      systemChildren: {
        caught: { favorite: {}, trade: {} },
        wanted: { mostWanted: {} },
      },
      tagsLoading: true,
      customTagsLoading: true,
      foreignTags: null,
      hydrateFromCache: vi.fn().mockResolvedValue(undefined) as any,
      buildTags: vi.fn().mockResolvedValue(undefined) as any,
      refreshCustomTagDefinitions: vi.fn().mockResolvedValue(undefined) as any,
    });
  });

  it('hydrates tags from cache on mount', async () => {
    const hydrateSpy = vi.spyOn(useTagsStore.getState(), 'hydrateFromCache');

    renderHook(() => useBootstrapTags());

    await waitFor(() => {
      expect(hydrateSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('builds tags once both instances and variants are available', async () => {
    const buildSpy = vi.spyOn(useTagsStore.getState(), 'buildTags');

    renderHook(() => useBootstrapTags());

    await act(async () => {
      useVariantsStore.setState({
        variants: [
          {
            variant_id: '0001-default',
            pokemon_id: 1,
            name: 'Bulbasaur',
            currentImage: '/images/default/pokemon_1.png',
            stamina: 111,
            moves: [],
            pokedex_number: 1,
          } as any,
        ],
      });
      useInstancesStore.setState({
        instances: {
          'caught-1': {
            instance_id: 'caught-1',
            variant_id: '0001-default',
            pokemon_id: 1,
            is_caught: true,
            is_wanted: false,
          } as any,
        },
      });
    });

    await waitFor(() => {
      expect(buildSpy).toHaveBeenCalled();
    });
  });

  it('does not hydrate or build tags when disabled', async () => {
    const hydrateSpy = vi.spyOn(useTagsStore.getState(), 'hydrateFromCache');
    const buildSpy = vi.spyOn(useTagsStore.getState(), 'buildTags');

    renderHook(() => useBootstrapTags(false));
    await Promise.resolve();

    expect(hydrateSpy).not.toHaveBeenCalled();
    expect(buildSpy).not.toHaveBeenCalled();
  });
});
