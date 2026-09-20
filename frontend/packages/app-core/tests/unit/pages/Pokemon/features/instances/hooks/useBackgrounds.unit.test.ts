import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useBackgrounds } from '@/pages/Pokemon/features/instances/hooks/useBackgrounds';
import type { VariantBackground } from '@/types/pokemonSubTypes';

const baseBackground: VariantBackground = {
  background_id: 1,
  costume_id: null,
  image_url: '/images/base-bg.png',
  name: 'Base City',
  location: 'Seattle',
  date: '2025-01-01',
};

const partyBackground: VariantBackground = {
  background_id: 2,
  costume_id: 7,
  image_url: '/images/party-bg.png',
  name: 'Party City',
  location: 'Seattle',
  date: '2025-01-02',
};

describe('useBackgrounds', () => {
  it('keeps no-costume and exact-costume background pools separate', () => {
    const backgrounds = [baseBackground, partyBackground];
    const { result, rerender } = renderHook(
      ({ variantType }) => useBackgrounds(backgrounds, variantType, null),
      { initialProps: { variantType: 'default' } },
    );

    expect(result.current.selectableBackgrounds).toEqual([baseBackground]);

    rerender({ variantType: 'shiny_shadow_costume_7' });
    expect(result.current.selectableBackgrounds).toEqual([partyBackground]);

    rerender({ variantType: 'fusion_dawn_wings' });
    expect(result.current.selectableBackgrounds).toEqual(backgrounds);
  });

  it('does not restore a saved background from an incompatible costume pool', async () => {
    const { result } = renderHook(() =>
      useBackgrounds([baseBackground, partyBackground], 'costume_7', 1),
    );

    await waitFor(() => expect(result.current.selectedBackground).toBeNull());
  });

  it('restores a saved background from the exact costume pool', async () => {
    const { result } = renderHook(() =>
      useBackgrounds([baseBackground, partyBackground], 'costume_7', 2),
    );

    await waitFor(() => expect(result.current.selectedBackground).toEqual(partyBackground));
  });

  it('rejects a selection from a different costume pool', () => {
    const { result } = renderHook(() =>
      useBackgrounds([baseBackground, partyBackground], 'default', null),
    );

    act(() => result.current.handleBackgroundSelect(partyBackground));
    expect(result.current.selectedBackground).toBeNull();
  });
});
