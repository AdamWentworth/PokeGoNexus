import { useState } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTrainerLookupField } from '@/pages/Pokemon/features/instances/hooks/useTrainerLookupField';

const fetchPublicUserByUsernameMock = vi.hoisted(() => vi.fn());
const fetchTrainerAutocompleteMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/userSearchService', () => ({
  fetchPublicUserByUsername: fetchPublicUserByUsernameMock,
  fetchTrainerAutocomplete: fetchTrainerAutocompleteMock,
}));

type HookArgs = Parameters<typeof useTrainerLookupField>[0];

const makeArgs = (overrides: Partial<HookArgs> = {}): HookArgs => ({
  editMode: true,
  obtainedInTrade: true,
  originalTrainerName: null,
  rawOriginalTrainerName: '',
  onOriginalTrainerNameChange: vi.fn(),
  onOriginalTrainerIdChange: vi.fn(),
  ...overrides,
});

const useTrainerLookupFieldHarness = (overrides: Partial<HookArgs> = {}) => {
  const [originalTrainerName, setOriginalTrainerName] = useState<string | null>(
    overrides.originalTrainerName ?? null,
  );

  return useTrainerLookupField(
    makeArgs({
      ...overrides,
      originalTrainerName,
      onOriginalTrainerNameChange: (value) => {
        overrides.onOriginalTrainerNameChange?.(value);
        setOriginalTrainerName(value);
      },
    }),
  );
};

describe('useTrainerLookupField', () => {
  beforeEach(() => {
    fetchPublicUserByUsernameMock.mockReset();
    fetchTrainerAutocompleteMock.mockReset();
    fetchPublicUserByUsernameMock.mockResolvedValue({
      type: 'success',
      username: 'MatchedTrainer',
      userId: 'user-1',
    });
    fetchTrainerAutocompleteMock.mockResolvedValue({ type: 'success', results: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('syncs the query from props until the trainer field has focus', () => {
    const args = makeArgs({ originalTrainerName: 'Misty' });
    const { result, rerender } = renderHook((hookArgs: HookArgs) => useTrainerLookupField(hookArgs), {
      initialProps: args,
    });

    expect(result.current.trainerQuery).toBe('Misty');

    rerender({ ...args, originalTrainerName: 'Brock' });

    expect(result.current.trainerQuery).toBe('Brock');

    act(() => {
      result.current.handleTrainerNameFocus();
      result.current.handleTrainerNameChange('Ash');
    });
    rerender({ ...args, originalTrainerName: 'Gary' });

    expect(result.current.trainerQuery).toBe('Ash');
  });

  it('debounces autocomplete suggestions and only exposes them while focused', async () => {
    vi.useFakeTimers();
    fetchTrainerAutocompleteMock.mockResolvedValue({
      type: 'success',
      results: [{ username: 'Ash' }],
    });
    const { result } = renderHook(() =>
      useTrainerLookupField(makeArgs({ autocompleteDelayMs: 250 })),
    );

    act(() => {
      result.current.handleTrainerNameChange('As');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(fetchTrainerAutocompleteMock).toHaveBeenCalledWith('As');
    expect(result.current.trainerSuggestions).toEqual([{ username: 'Ash' }]);
    expect(result.current.showTrainerSuggestions).toBe(false);

    act(() => {
      result.current.handleTrainerNameFocus();
    });

    expect(result.current.showTrainerSuggestions).toBe(true);
  });

  it('commits the trimmed blur value and links a successful trainer lookup', async () => {
    fetchPublicUserByUsernameMock.mockResolvedValue({
      type: 'success',
      username: 'CanonicalTrainer',
      userId: 'user-1',
    });
    const onOriginalTrainerNameChange = vi.fn();
    const onOriginalTrainerIdChange = vi.fn();
    const { result } = renderHook(() =>
      useTrainerLookupFieldHarness({
        onOriginalTrainerNameChange,
        onOriginalTrainerIdChange,
      }),
    );

    act(() => {
      result.current.handleTrainerNameFocus();
      result.current.handleTrainerNameChange(' PokePete35 ');
    });
    act(() => {
      result.current.handleTrainerNameBlur();
    });

    await waitFor(() => {
      expect(fetchPublicUserByUsernameMock).toHaveBeenCalledWith('PokePete35');
    });

    expect(result.current.trainerQuery).toBe('PokePete35');
    expect(onOriginalTrainerNameChange).toHaveBeenCalledWith('PokePete35');
    expect(onOriginalTrainerNameChange).not.toHaveBeenCalledWith('CanonicalTrainer');
    expect(onOriginalTrainerIdChange).toHaveBeenCalledWith('user-1');
  });

  it('preserves the typed name and reports an error when trainer lookup fails', async () => {
    fetchPublicUserByUsernameMock.mockRejectedValue(new Error('network down'));
    const onOriginalTrainerNameChange = vi.fn();
    const onOriginalTrainerIdChange = vi.fn();
    const { result } = renderHook(() =>
      useTrainerLookupFieldHarness({
        onOriginalTrainerNameChange,
        onOriginalTrainerIdChange,
      }),
    );

    act(() => {
      result.current.handleTrainerNameFocus();
      result.current.handleTrainerNameChange('Ash');
    });
    act(() => {
      result.current.handleTrainerNameBlur();
    });

    await waitFor(() => {
      expect(result.current.trainerLookupError).toBe('Unable to verify trainer right now.');
    });

    expect(result.current.trainerQuery).toBe('Ash');
    expect(onOriginalTrainerNameChange).toHaveBeenCalledWith('Ash');
    expect(onOriginalTrainerIdChange).toHaveBeenCalledWith(null);
  });

  it('cancels delayed suggestion cleanup and ignores an in-flight lookup after unmount', async () => {
    vi.useFakeTimers();
    let resolveLookup: ((value: { type: 'success'; username: string; userId: string }) => void) | null =
      null;
    fetchPublicUserByUsernameMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        }),
    );
    const onOriginalTrainerIdChange = vi.fn();
    const { result, unmount } = renderHook(() =>
      useTrainerLookupFieldHarness({
        onOriginalTrainerIdChange,
        suggestionClearDelayMs: 120,
      }),
    );

    act(() => {
      result.current.handleTrainerNameFocus();
      result.current.handleTrainerNameChange('Ash');
    });
    act(() => {
      result.current.handleTrainerNameBlur();
    });

    expect(fetchPublicUserByUsernameMock).toHaveBeenCalledWith('Ash');
    unmount();

    await act(async () => {
      resolveLookup?.({ type: 'success', username: 'Ash', userId: 'user-1' });
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(120);
    });

    expect(onOriginalTrainerIdChange).not.toHaveBeenCalledWith('user-1');
  });
});
