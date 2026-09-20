import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NavigateFunction } from 'react-router';

import usePokemonPageController from '@/pages/Pokemon/hooks/usePokemonPageController';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { Instances } from '@/types/instances';
import type { TagBuckets } from '@/types/tags';
import type { SortMode, SortType } from '@/types/sort';

type UsePokemonProcessingArgs = [
  PokemonVariant[],
  Instances,
  string,
  TagBuckets,
  string,
  boolean,
  SortType,
  SortMode,
];

const loadForeignProfileMock = vi.fn();
const updateInstanceStatusMock = vi.fn();
const setHighlightedCardsMock = vi.fn();
const setIsFastSelectEnabledMock = vi.fn();
const handleConfirmChangeTagsMock = vi.fn(async () => undefined);
const modalAlertMock = vi.fn().mockResolvedValue(undefined);
const usePokemonProcessingMock = vi.fn((..._args: UsePokemonProcessingArgs) => ({
  filteredVariants: [baseVariant],
  sortedPokemons: [
    {
      ...baseVariant,
      instanceData: { instance_id: 'inst-1' },
    },
    { variant_id: '0002-default', pokemon_id: 2 },
  ] as PokemonVariant[],
}));

const baseVariant = { variant_id: '0001-default', pokemon_id: 1 } as PokemonVariant;
const variantsStoreState = {
  variants: [baseVariant],
  variantsLoading: false,
};
const instancesStoreState = {
  foreignInstances: null,
  updateInstanceStatus: updateInstanceStatusMock,
  instances: {} as Instances,
};
const tagsStoreState = {
  tags: {} as TagBuckets,
  customTags: { caught: {}, wanted: {} },
  foreignTags: null,
};
const userSearchStoreState = {
  userExists: true,
  foreignInstancesLoading: false,
  loadForeignProfile: loadForeignProfileMock,
  canonicalUsername: '',
};

vi.mock('@/features/variants/store/useVariantsStore', () => ({
  useVariantsStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(variantsStoreState),
}));

vi.mock('@/features/instances/store/useInstancesStore', () => ({
  useInstancesStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(instancesStoreState),
}));

vi.mock('@/features/tags/store/useTagsStore', () => ({
  useTagsStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(tagsStoreState),
}));

vi.mock('@/stores/useUserSearchStore', () => ({
  useUserSearchStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(userSearchStoreState),
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({
    alert: modalAlertMock,
    confirm: vi.fn(),
  }),
}));

vi.mock('@/pages/Pokemon/hooks/useUIControls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/Pokemon/hooks/useUIControls')>();
  return {
    default: (settings: Parameters<typeof actual.default>[0]) => ({
      ...actual.default(settings),
      setIsFastSelectEnabled: setIsFastSelectEnabledMock,
      setHighlightedCards: setHighlightedCardsMock,
    }),
  };
});

vi.mock('@/pages/Pokemon/hooks/usePokemonProcessing', () => ({
  default: (...args: UsePokemonProcessingArgs) => usePokemonProcessingMock(...args),
}));

vi.mock('@/pages/Pokemon/hooks/useInstanceIdProcessor', () => ({
  default: vi.fn(),
}));

vi.mock('@/pages/Pokemon/services/changeInstanceTag/hooks/useHandleChangeTags', () => ({
  default: () => ({
    handleConfirmChangeTags: handleConfirmChangeTagsMock,
  }),
}));

vi.mock('@/pages/Pokemon/features/mega/hooks/useMegaPokemonHandler', () => ({
  default: () => ({
    promptMegaPokemonSelection: vi.fn(),
    isMegaSelectionOpen: false,
    megaSelectionData: null,
    handleMegaSelectionResolve: vi.fn(),
    handleMegaSelectionReject: vi.fn(),
  }),
}));

vi.mock('@/pages/Pokemon/features/fusion/hooks/useFusionPokemonHandler', () => ({
  default: () => ({
    promptFusionPokemonSelection: vi.fn(),
    isFusionSelectionOpen: false,
    fusionSelectionData: null,
    handleFusionSelectionResolve: vi.fn(),
    closeFusionSelection: vi.fn(),
    handleCreateNewLeft: vi.fn(),
    handleCreateNewRight: vi.fn(),
  }),
}));

vi.mock('@/pages/Pokemon/hooks/useSwipeHandler', () => ({
  default: () => ({
    onTouchStart: vi.fn(),
    onTouchMove: vi.fn(),
    onTouchEnd: vi.fn(),
  }),
}));

describe('usePokemonPageController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('selects Favorite descending on every Favorites tap and lets other tags keep the chosen sort', () => {
    const { result } = renderHook(() => usePokemonPageController({
      isOwnCollection: true,
      location: { pathname: '/pokemon', state: null } as any,
      navigate: vi.fn() as unknown as NavigateFunction,
    }));
    expect(result.current.sortType).toBe('number');
    act(() => result.current.handleTagSelect('Favorites'));
    expect(result.current.sortType).toBe('favorite');
    expect(result.current.sortMode).toBe('descending');
    expect(usePokemonProcessingMock.mock.calls.at(-1)?.slice(6)).toEqual(['favorite', 'descending']);

    act(() => {
      result.current.setSortType('name');
      result.current.setSortMode('ascending');
    });
    act(() => result.current.handleTagSelect('Trade'));
    expect(result.current.sortType).toBe('name');
    expect(result.current.sortMode).toBe('ascending');
    act(() => result.current.handleTagSelect('Favorites'));
    expect(result.current.sortType).toBe('favorite');
    expect(result.current.sortMode).toBe('descending');

    act(() => result.current.setSortMode('ascending'));
    act(() => result.current.handleTagSelect('Favorites'));
    expect(result.current.sortMode).toBe('descending');
    act(() => result.current.handleTagSelect('Favorites'));
    expect(result.current.sortMode).toBe('descending');
  });

  it('forwards derived tag filters like Favorites into pokemon processing', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    const location = { pathname: '/pokemon', state: null } as any;

    const { result } = renderHook(() =>
      usePokemonPageController({
        isOwnCollection: true,
        location,
        navigate,
      }),
    );

    await waitFor(() => {
      expect(result.current.isPageLoading).toBe(false);
    });

    act(() => {
      result.current.handleTagSelect('Favorites');
    });

    const latestCall = usePokemonProcessingMock.mock.calls.at(-1) as
      | UsePokemonProcessingArgs
      | undefined;
    expect(latestCall?.[2]).toBe('Favorites');
    expect(result.current.activeStatusFilter).toBeNull();
  });

  it('opens directly into a catalog filter supplied by the URL', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    const location = {
      pathname: '/pokemon',
      search: '?filter=favorites&search=rayquaza%26shiny',
      state: null,
    } as any;

    const { result } = renderHook(() =>
      usePokemonPageController({
        isOwnCollection: true,
        location,
        navigate,
      }),
    );

    await waitFor(() => {
      expect(result.current.tagFilter).toBe('Favorites');
    });

    expect(result.current.sidePanelTagFilter).toBe('Favorites');
    expect(result.current.activeView).toBe('pokemon');
    const latestCall = usePokemonProcessingMock.mock.calls.at(-1) as
      | UsePokemonProcessingArgs
      | undefined;
    expect(latestCall?.[2]).toBe('Favorites');
    expect(latestCall?.[4]).toBe('rayquaza&shiny');
    expect(result.current.searchTerm).toBe('rayquaza&shiny');
  });

  it('loads foreign profile for username routes and exits loading state', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    const location = { pathname: '/pokemon/ash', state: null } as any;

    const { result } = renderHook(() =>
      usePokemonPageController({
        isOwnCollection: false,
        urlUsername: 'ash',
        location,
        navigate,
      }),
    );

    await waitFor(() => {
      expect(result.current.isPageLoading).toBe(false);
    });

    expect(result.current.isUsernamePath).toBe(true);
    expect(loadForeignProfileMock).toHaveBeenCalledWith('ash', expect.any(Function));
  });

  it('returns a viewed listing to its originating Search page', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    const location = {
      pathname: '/pokemon/ash',
      search: '',
      state: { contextBackTo: '/search' },
    } as any;

    const { result } = renderHook(() =>
      usePokemonPageController({
        isOwnCollection: false,
        urlUsername: 'ash',
        location,
        navigate,
      }),
    );

    await waitFor(() => {
      expect(result.current.returnToContext).toBeTypeOf('function');
    });

    act(() => {
      result.current.returnToContext?.();
    });
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('preserves a requested filter after loading a foreign collection', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    const location = {
      pathname: '/pokemon/ash',
      search: '?filter=trade',
      state: null,
    } as any;

    const { result } = renderHook(() =>
      usePokemonPageController({
        isOwnCollection: false,
        urlUsername: 'ash',
        location,
        navigate,
      }),
    );

    await waitFor(() => {
      expect(loadForeignProfileMock).toHaveBeenCalledWith('ash', expect.any(Function));
    });

    const callback = loadForeignProfileMock.mock.calls.at(-1)?.[1] as
      | (() => void)
      | undefined;
    act(() => {
      callback?.();
    });

    expect(result.current.tagFilter).toBe('Trade');
    expect(result.current.sidePanelTagFilter).toBe('Trade');
  });

  it('always retains a tag while viewing another trainer catalog', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    const location = {
      pathname: '/pokemon/ash',
      search: '',
      state: null,
    } as any;

    const { result } = renderHook(() =>
      usePokemonPageController({
        isOwnCollection: false,
        urlUsername: 'ash',
        location,
        navigate,
      }),
    );

    expect(result.current.tagFilter).toBe('Caught');
    expect(result.current.sidePanelTagFilter).toBe('Caught');

    act(() => {
      result.current.handleTagSelect('Wanted');
    });
    expect(result.current.tagFilter).toBe('Wanted');

    act(() => {
      result.current.handleClearTagFilter();
    });

    expect(result.current.tagFilter).toBe('Wanted');
    expect(result.current.sidePanelTagFilter).toBe('Wanted');

    act(() => {
      result.current.handleTagSelect('');
    });

    expect(result.current.tagFilter).toBe('Caught');
    expect(result.current.sidePanelTagFilter).toBe('Caught');
  });

  it('opens a foreign trade listing under the Trade tag from router state', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    const location = {
      pathname: '/pokemon/ash',
      search: '',
      state: { instanceId: 'inst-1', instanceData: 'Trade' },
    } as any;

    const { result } = renderHook(() =>
      usePokemonPageController({
        isOwnCollection: false,
        urlUsername: 'ash',
        location,
        navigate,
      }),
    );

    await waitFor(() => {
      expect(loadForeignProfileMock).toHaveBeenCalledWith('ash', expect.any(Function));
    });

    const callback = loadForeignProfileMock.mock.calls.at(-1)?.[1] as
      | (() => void)
      | undefined;
    act(() => {
      callback?.();
    });

    expect(result.current.tagFilter).toBe('Trade');
    expect(result.current.sidePanelTagFilter).toBe('Trade');
  });

  it('select-all action sends computed ids to highlighted state and enables fast-select', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    const location = { pathname: '/pokemon', state: null } as any;

    const { result } = renderHook(() =>
      usePokemonPageController({
        isOwnCollection: true,
        location,
        navigate,
      }),
    );

    await waitFor(() => {
      expect(result.current.isPageLoading).toBe(false);
    });

    act(() => {
      result.current.handleSelectAll();
    });

    const highlightedArg = setHighlightedCardsMock.mock.calls.at(-1)?.[0];
    expect(highlightedArg).toBeInstanceOf(Set);
    expect(Array.from(highlightedArg)).toEqual(['inst-1', '0002-default']);
    expect(setIsFastSelectEnabledMock).toHaveBeenCalledWith(true);
  });

  it('updates local tag and view state when selecting a tag from a tag panel', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    const location = { pathname: '/pokemon', state: null } as any;

    const { result } = renderHook(() =>
      usePokemonPageController({
        isOwnCollection: true,
        location,
        navigate,
      }),
    );

    await waitFor(() => {
      expect(result.current.isPageLoading).toBe(false);
    });

    act(() => {
      result.current.handleTagSelect('Trade');
    });

    expect(result.current.tagFilter).toBe('Trade');
    expect(result.current.sidePanelTagFilter).toBe('Trade');
    expect(result.current.activeView).toBe('pokemon');
  });

  it('waits for the side panel slide to settle before syncing side-panel tag state', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    const location = { pathname: '/pokemon', state: null } as any;

    const { result } = renderHook(() =>
      usePokemonPageController({
        isOwnCollection: true,
        location,
        navigate,
      }),
    );

    await waitFor(() => {
      expect(result.current.isPageLoading).toBe(false);
    });

    act(() => {
      result.current.setActiveView('inventory');
    });

    vi.useFakeTimers();

    act(() => {
      result.current.handleTagSelect('Trade');
    });

    expect(result.current.tagFilter).toBe('Trade');
    expect(result.current.sidePanelTagFilter).toBe('');
    expect(result.current.activeView).toBe('pokemon');

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current.sidePanelTagFilter).toBe('');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.sidePanelTagFilter).toBe('Trade');
  });

  it('clears the active tag filter back to the full catalog', async () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    const location = { pathname: '/pokemon', state: null } as any;

    const { result } = renderHook(() =>
      usePokemonPageController({
        isOwnCollection: true,
        location,
        navigate,
      }),
    );

    await waitFor(() => {
      expect(result.current.isPageLoading).toBe(false);
    });

    act(() => {
      result.current.handleTagSelect('Wanted');
    });
    expect(result.current.tagFilter).toBe('Wanted');

    act(() => {
      result.current.handleClearTagFilter();
    });

    expect(result.current.tagFilter).toBe('');
    expect(result.current.sidePanelTagFilter).toBe('');
    expect(result.current.activeView).toBe('pokemon');

    const latestCall = usePokemonProcessingMock.mock.calls.at(-1) as
      | UsePokemonProcessingArgs
      | undefined;
    expect(latestCall?.[2]).toBe('');
  });
});
