import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useHandleChangeTags from '@/pages/Pokemon/services/changeInstanceTag/hooks/useHandleChangeTags';

const modal = vi.hoisted(() => ({
  confirm: vi.fn(),
  alert: vi.fn(),
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => modal,
}));

describe('useHandleChangeTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modal.alert.mockResolvedValue(undefined);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('confirms before opening special Pokémon selectors and leaves selection intact on cancel', async () => {
    modal.confirm.mockResolvedValue(false);
    const promptMegaPokemonSelection = vi.fn();
    const updateInstanceStatus = vi.fn();
    const setHighlightedCards = vi.fn();
    const setIsFastSelectEnabled = vi.fn();

    const { result } = renderHook(() => useHandleChangeTags({
      setTagFilter: vi.fn(),
      setHighlightedCards,
      highlightedCards: new Set(['0003-mega']),
      updateInstanceStatus,
      variants: [{
        variant_id: '0003-mega',
        pokemon_id: 3,
        species_name: 'Mega Venusaur',
      } as any],
      instances: {},
      updateInstanceDetails: vi.fn(),
      setIsUpdating: vi.fn(),
      promptMegaPokemonSelection,
      promptFusionPokemonSelection: vi.fn(),
      setIsFastSelectEnabled,
    }));

    let outcomes: Awaited<ReturnType<typeof result.current.handleConfirmChangeTags>> = [];
    await act(async () => {
      outcomes = await result.current.handleConfirmChangeTags('Caught');
    });

    expect(modal.confirm).toHaveBeenCalledTimes(1);
    expect(promptMegaPokemonSelection).not.toHaveBeenCalled();
    expect(updateInstanceStatus).not.toHaveBeenCalled();
    expect(setHighlightedCards).not.toHaveBeenCalled();
    expect(setIsFastSelectEnabled).not.toHaveBeenCalled();
    expect(outcomes).toEqual([]);
  });

  it('describes custom-tag creation and opens the completed destination tag', async () => {
    modal.confirm.mockResolvedValue(true);
    const setTagFilter = vi.fn();
    const setHighlightedCards = vi.fn();
    const setIsFastSelectEnabled = vi.fn();
    const updateInstanceStatus = vi.fn(async () => [{
      sourceKey: '0003-shadow&shiny',
      sourceInstanceId: null,
      resultingInstanceId: 'venusaur-new',
      targetStatus: 'Caught' as const,
      operation: 'created' as const,
      changed: true,
    }]);

    const { result } = renderHook(() => useHandleChangeTags({
      setTagFilter,
      setHighlightedCards,
      highlightedCards: new Set(['0003-shadow&shiny']),
      updateInstanceStatus,
      variants: [{
        variant_id: '0003-shadow&shiny',
        pokemon_id: 3,
        name: 'Shiny Shadow Venusaur',
      } as any],
      instances: {},
      updateInstanceDetails: vi.fn(),
      setIsUpdating: vi.fn(),
      promptMegaPokemonSelection: vi.fn(),
      promptFusionPokemonSelection: vi.fn(),
      setIsFastSelectEnabled,
    }));

    await act(async () => {
      await result.current.handleConfirmChangeTags('Caught', {
        additionalConfirmationDetails: ['Add to tag: Shadow Shinies'],
        destinationFilter: 'custom:shadow-shinies',
      });
    });

    expect(modal.confirm).toHaveBeenCalledWith(
      'Review these changes:\n• Create Shiny Shadow Venusaur as Caught\n• Add to tag: Shadow Shinies',
    );
    expect(setTagFilter).toHaveBeenCalledWith('custom:shadow-shinies');
    expect(setHighlightedCards).toHaveBeenCalledWith(new Set());
    expect(setIsFastSelectEnabled).toHaveBeenCalledWith(false);
  });
});
