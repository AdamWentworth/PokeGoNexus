import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Animated, Modal, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type {
  NativeCollectionRow,
  NativeTagSummary,
} from '../../../src/features/collection/collectionModel';
import { NativeCollectionHubScreen } from '../../../src/screens/NativeCollectionHubScreen';
import { NATIVE_HORIZONTAL_PAGE_TRANSITION_MS } from '../../../src/components/NativeHorizontalPageSlider';
import {
  actionMenuExperienceParityContract,
  buildClearActiveTagMessage,
} from '@pokemongonexus/shared-ui-tokens';
import { runAfterNativeUiInteractions } from '../../../src/interaction/nativeUiInteractionScheduler';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 412, height: 915, scale: 2.625, fontScale: 1 }),
}));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  cleanup();
  jest.useRealTimers();
});

const caughtRow: NativeCollectionRow = {
  id: 'caught-bulbasaur',
  pokemonId: 1,
  pokedexNumber: 1,
  name: 'Shiny Bulbasaur',
  imageUri: 'https://pokegonexus.com/images/shiny/shiny_pokemon_1.png',
  locationBackgroundUri: null,
  maxKind: null,
  purified: false,
  lucky: false,
  typeIconUris: [],
  status: 'caught',
  source: 'instance',
  cp: 500,
  favorite: true,
  mostWanted: false,
};

const wantedRow: NativeCollectionRow = {
  ...caughtRow,
  id: 'wanted-mewtwo',
  pokemonId: 150,
  pokedexNumber: 150,
  name: 'Shiny Mewtwo',
  status: 'wanted',
  cp: null,
  favorite: false,
  mostWanted: true,
};

const catalogBulbasaur: NativeCollectionRow = {
  ...caughtRow,
  id: '0001-default',
  name: 'Bulbasaur',
  cp: null,
  favorite: false,
  source: 'catalog',
};

const catalogMewtwo: NativeCollectionRow = {
  ...wantedRow,
  id: '0150-default',
  name: 'Mewtwo',
  mostWanted: false,
  source: 'catalog',
};

const inventoryTag: NativeTagSummary = {
  key: 'system:favorites',
  parent: 'caught',
  name: 'Favorites',
  color: '#ffd45a',
  tone: 'favorites',
  rows: [caughtRow],
};

const allCaughtTag: NativeTagSummary = {
  key: 'system:caught',
  parent: 'caught',
  name: 'All Caught',
  filterName: 'Caught',
  color: '#5798ff',
  tone: 'caught',
  rows: [caughtRow],
};

const wishlistTag: NativeTagSummary = {
  key: 'system:most-wanted',
  parent: 'wanted',
  name: 'Most Wanted',
  color: '#ff704d',
  tone: 'most-wanted',
  rows: [wantedRow],
};

const caughtInstance = {
  instance_id: caughtRow.id,
  variant_id: '0001-shiny',
  pokemon_id: 1,
  is_caught: true,
  is_for_trade: false,
  is_wanted: false,
  favorite: true,
  most_wanted: false,
  caught_tags: [],
  wanted_tags: [],
  registered: true,
  disabled: false,
  lucky: false,
  shadow: false,
  mega: false,
  is_mega: false,
  is_fused: false,
} as unknown as PokemonInstance;

describe('NativeCollectionHubScreen', () => {
  it.each(['number', 'name', 'favorite'] as const)(
    'opens Favorites in Favorite descending from %s ascending, including repeated taps',
    (initialSort) => {
      const strong = { ...caughtRow, id: 'strong-mewtwo', pokemonId: 150, pokedexNumber: 150,
        name: 'Mewtwo', cp: 4713 };
      const favorites = { ...inventoryTag, rows: [caughtRow, strong] };
      const onContextChange = jest.fn();
      const onOpenEntry = jest.fn();
      render(
        <SafeAreaProvider initialMetrics={{
          frame: { x: 0, y: 0, width: 412, height: 915 },
          insets: { top: 24, right: 0, bottom: 20, left: 0 },
        }}>
          <NativeCollectionHubScreen
            assetBaseUrl="https://pokegonexus.com"
            catalogRows={[catalogBulbasaur, catalogMewtwo]}
            error={null}
            inventoryTags={[favorites, allCaughtTag]}
            instances={{}}
            initialView="inventory"
            initialSort={initialSort}
            initialSortDirection="ascending"
            isLoading={false}
            onContextChange={onContextChange}
            onOpenEntry={onOpenEntry}
            onRetry={jest.fn()}
            wishlistTags={[wishlistTag]}
          />
        </SafeAreaProvider>,
      );

      const openFavorites = () => {
        const button = screen.getByRole('button', { name: /Open Favorites/i });
        fireEvent(button, 'pressIn');
        fireEvent(button, 'pressOut');
        fireEvent.press(button);
        expect(screen.getByLabelText('Sort by FAVORITE descending')).toBeTruthy();
        fireEvent.press(screen.getByRole('button', { name: 'View Mewtwo' }));
        expect(onOpenEntry).toHaveBeenLastCalledWith(strong, [strong, caughtRow]);
        expect(onContextChange).toHaveBeenCalledWith(expect.objectContaining({
          sort: 'favorite', sortDirection: 'descending',
        }));
        act(() => jest.advanceTimersByTime(500));
      };
      openFavorites();

      // A manual sort is allowed until the user opens Favorites again.
      fireEvent.press(screen.getByLabelText('Sort by FAVORITE descending'));
      fireEvent.press(screen.getByText('NUMBER'));
      act(() => jest.advanceTimersByTime(500));
      expect(screen.getByLabelText('Sort by NUMBER ascending')).toBeTruthy();
      fireEvent.press(screen.getByRole('tab', { name: /tags/i }));
      openFavorites();

      // Selecting an already-active Favorite sort must not toggle it ascending.
      fireEvent.press(screen.getByRole('tab', { name: /tags/i }));
      openFavorites();
    },
  );

  it('hosts the Vite-style sort overlay at the edge-to-edge hub root', () => {
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogRows={[catalogBulbasaur, catalogMewtwo]}
          error={null}
          inventoryTags={[inventoryTag, allCaughtTag]}
          instances={{}}
          isLoading={false}
          onOpenEntry={jest.fn()}
          onRetry={jest.fn()}
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByLabelText('Sort by NUMBER ascending'));

    expect(screen.getByTestId('native-collection-sort-menu')).toBeTruthy();
    expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
    expect(screen.getByTestId('native-collection-hub')).toContainElement(
      screen.getByTestId('native-collection-sort-menu'),
    );
  });

  it('uses one stateful hub for tab changes, tag selection, and opening entries', () => {
    const onOpenEntry = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
        assetBaseUrl="https://pokegonexus.com"
        catalogRows={[catalogBulbasaur, catalogMewtwo]}
        error={null}
        inventoryTags={[inventoryTag, allCaughtTag]}
        instances={{}}
        isLoading={false}
        onActionMenuPress={jest.fn()}
        onOpenEntry={onOpenEntry}
        onRetry={jest.fn()}
        syncStatus={<Text testID="sync-status-slot">Offline changes retained</Text>}
        wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Bulbasaur')).toBeTruthy();
    expect(screen.getByText('Mewtwo')).toBeTruthy();
    expect(screen.getByTestId('sync-status-slot')).toBeTruthy();
    expect(screen.queryByText('Shiny Bulbasaur')).toBeNull();
    expect(screen.queryByText('Shiny Mewtwo')).toBeNull();

    fireEvent.press(screen.getByRole('tab', { name: /tags/i }));
    expect(screen.getByRole('tab', { name: /pokémon/i }).props.accessibilityState).toEqual({
      selected: false,
    });
    expect(screen.getByRole('tab', { name: /tags/i }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByRole('tab', { name: /tags/i }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByText('1 Pokémon')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /Open Favorites/i }));

    expect(screen.getByText('Favorites')).toBeTruthy();
    expect(screen.getByText('Shiny Bulbasaur')).toBeTruthy();
    expect(screen.queryByText('Shiny Mewtwo')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'View Shiny Bulbasaur' }));
    expect(onOpenEntry).toHaveBeenCalledWith(caughtRow, [caughtRow]);

    fireEvent.press(screen.getByRole('button', { name: /Clear Favorites tag filter/i }));
    expect(screen.getByTestId('native-confirmation-dialog')).toBeTruthy();
    expect(screen.getByText(buildClearActiveTagMessage('Favorites'))).toBeTruthy();
    expect(screen.getByText('Shiny Bulbasaur', { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('native-confirmation-dialog')).toBeNull();
    expect(screen.getByText('Shiny Bulbasaur')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: /Clear Favorites tag filter/i }));
    fireEvent.press(screen.getByRole('button', { name: 'OK' }));
    expect(screen.getByText('Bulbasaur')).toBeTruthy();
    expect(screen.getByText('Mewtwo')).toBeTruthy();
    expect(screen.queryByText('Shiny Bulbasaur')).toBeNull();

    fireEvent.press(screen.getByRole('tab', { name: /tags/i }));
    fireEvent.press(screen.getByRole('button', { name: /Open All Caught/i }));
    expect(screen.getByText('Caught')).toBeTruthy();

    fireEvent.press(screen.getByRole('tab', { name: /wishlist/i }));
    expect(screen.getByLabelText('Wanted tags')).toBeTruthy();
    expect(screen.getByText('Most Wanted')).toBeTruthy();
  });

  it('updates one virtualized grid before sliding back to Pokémon from either side', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const timeout = jest.spyOn(global, 'setTimeout');
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogRows={[catalogBulbasaur, catalogMewtwo]}
          error={null}
          inventoryTags={[inventoryTag, allCaughtTag]}
          instances={{}}
          isLoading={false}
          onOpenEntry={jest.fn()}
          onRetry={jest.fn()}
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getAllByText('Favorites', { includeHiddenElements: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Most Wanted', { includeHiddenElements: true }).length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId(
      'native-collection-grid',
      { includeHiddenElements: true },
    )).toHaveLength(1);
    act(() => jest.advanceTimersByTime(360));
    expect(screen.getAllByTestId(
      'parity-card-0001-default',
      { includeHiddenElements: true },
    )).toHaveLength(1);

    fireEvent.press(screen.getByRole('tab', { name: /tags/i }));
    timing.mockClear();
    timeout.mockClear();
    fireEvent.press(screen.getByRole('button', { name: /Open Favorites/i }));

    expect(screen.queryAllByTestId(
      'native-collection-grid',
      { includeHiddenElements: true },
    )).toHaveLength(1);
    expect(screen.getByTestId(
      'parity-card-caught-bulbasaur',
      { includeHiddenElements: true },
    )).toBeTruthy();
    expect(screen.queryByTestId(
      'parity-card-0150-default',
      { includeHiddenElements: true },
    )).toBeNull();
    expect(screen.queryByText('(FAVORITES)')).toBeNull();
    // The new card window has committed before the child layout effect starts
    // motion, so there is no extra blank frame between touch and animation.
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      duration: NATIVE_HORIZONTAL_PAGE_TRANSITION_MS,
      toValue: 412,
      useNativeDriver: true,
    }));
    expect(timeout).toHaveBeenCalledWith(
      expect.any(Function),
      NATIVE_HORIZONTAL_PAGE_TRANSITION_MS,
    );
    act(() => jest.advanceTimersByTime(NATIVE_HORIZONTAL_PAGE_TRANSITION_MS));
    expect(screen.getByText('(FAVORITES)')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /pokémon/i }).props.accessibilityState).toEqual({
      selected: true,
    });

    fireEvent.press(screen.getByRole('tab', { name: /wishlist/i }));
    timing.mockClear();
    fireEvent.press(screen.getByRole('button', { name: /Open Most Wanted/i }));
    expect(screen.getByText('(FAVORITES)')).toBeTruthy();
    expect(screen.queryByText('(MOST WANTED)')).toBeNull();
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      duration: NATIVE_HORIZONTAL_PAGE_TRANSITION_MS,
      toValue: 412,
      useNativeDriver: true,
    }));
    act(() => jest.advanceTimersByTime(NATIVE_HORIZONTAL_PAGE_TRANSITION_MS));
    expect(screen.getByText('(MOST WANTED)')).toBeTruthy();
    timeout.mockRestore();
  });

  it('commits a pressed tag into the hidden grid before release starts the slide', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const onContextChange = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogRows={[catalogBulbasaur, catalogMewtwo]}
          error={null}
          inventoryTags={[inventoryTag, allCaughtTag]}
          instances={{}}
          initialView="inventory"
          isLoading={false}
          onContextChange={onContextChange}
          onOpenEntry={jest.fn()}
          onRetry={jest.fn()}
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );

    timing.mockClear();
    onContextChange.mockClear();

    const favorites = screen.getByRole('button', { name: /Open Favorites/i });
    fireEvent(favorites, 'pressIn');

    expect(screen.getByTestId(
      'parity-card-caught-bulbasaur',
      { includeHiddenElements: true },
    )).toBeTruthy();
    expect(screen.queryByTestId(
      'parity-card-0150-default',
      { includeHiddenElements: true },
    )).toBeNull();
    expect(screen.getByRole('tab', { name: /tags/i }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(timing).not.toHaveBeenCalled();
    expect(onContextChange).not.toHaveBeenCalled();

    // A successful Pressable release emits press-out immediately before press.
    fireEvent(favorites, 'pressOut');
    fireEvent.press(favorites);

    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      duration: NATIVE_HORIZONTAL_PAGE_TRANSITION_MS,
      toValue: 412,
      useNativeDriver: true,
    }));
    // The Favorites preset must commit before motion reveals the destination.
    expect(screen.getByLabelText('Sort by FAVORITE descending')).toBeTruthy();
    expect(onContextChange).toHaveBeenCalledWith(expect.objectContaining({
      activeView: 'pokemon',
      selectedTagKey: 'system:favorites',
    }));
  });

  it('restores the hidden grid without navigation when a tag press is cancelled', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogRows={[catalogBulbasaur, catalogMewtwo]}
          error={null}
          inventoryTags={[inventoryTag, allCaughtTag]}
          instances={{}}
          initialView="inventory"
          isLoading={false}
          onOpenEntry={jest.fn()}
          onRetry={jest.fn()}
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );

    timing.mockClear();
    const favorites = screen.getByRole('button', { name: /Open Favorites/i });
    fireEvent(favorites, 'pressIn');
    const backgroundTask = jest.fn();
    runAfterNativeUiInteractions(backgroundTask);
    act(() => jest.runOnlyPendingTimers());
    expect(backgroundTask).not.toHaveBeenCalled();
    fireEvent(favorites, 'pressOut');
    act(() => {
      jest.advanceTimersByTime(0);
      jest.runOnlyPendingTimers();
    });

    expect(screen.getByLabelText('Sort by NUMBER ascending', {
      includeHiddenElements: true,
    })).toBeTruthy();
    expect(screen.getByTestId(
      'parity-card-0150-default',
      { includeHiddenElements: true },
    )).toBeTruthy();
    expect(screen.getByRole('tab', { name: /tags/i }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(timing).not.toHaveBeenCalled();
    expect(backgroundTask).toHaveBeenCalledTimes(1);
  });

  it('does not animate or persist a tap on the already-selected tab', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const onContextChange = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogRows={[catalogBulbasaur, catalogMewtwo]}
          error={null}
          inventoryTags={[inventoryTag, allCaughtTag]}
          instances={{}}
          isLoading={false}
          onContextChange={onContextChange}
          onOpenEntry={jest.fn()}
          onRetry={jest.fn()}
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );
    act(() => jest.advanceTimersByTime(1));
    timing.mockClear();

    fireEvent.press(screen.getByRole('tab', { name: /pokémon/i }));

    expect(timing).not.toHaveBeenCalled();
    expect(onContextChange).not.toHaveBeenCalled();
  });

  it('starts a header-tab track before persisting its destination', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const onContextChange = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogRows={[catalogBulbasaur, catalogMewtwo]}
          error={null}
          inventoryTags={[inventoryTag, allCaughtTag]}
          instances={{}}
          isLoading={false}
          onContextChange={onContextChange}
          onOpenEntry={jest.fn()}
          onRetry={jest.fn()}
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );
    timing.mockClear();
    onContextChange.mockClear();

    fireEvent.press(screen.getByRole('tab', { name: /tags/i }));

    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      toValue: 0,
      useNativeDriver: true,
    }));
    expect(timing.mock.invocationCallOrder[0]).toBeLessThan(
      onContextChange.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it('preserves the active search when selecting a tag like Vite', () => {
    const onContextChange = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogRows={[catalogBulbasaur, catalogMewtwo]}
          error={null}
          initialQuery="bulba"
          inventoryTags={[inventoryTag, allCaughtTag]}
          instances={{}}
          isLoading={false}
          onContextChange={onContextChange}
          onOpenEntry={jest.fn()}
          onRetry={jest.fn()}
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByLabelText('Search Pokémon').props.value).toBe('bulba');
    expect(screen.getByText('(1)')).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: /wishlist/i }));
    fireEvent.press(screen.getByRole('button', { name: /Open Most Wanted/i }));
    act(() => jest.advanceTimersByTime(17));

    expect(screen.getByLabelText('Search Pokémon').props.value).toBe('bulba');
    expect(screen.queryByText('Shiny Mewtwo')).toBeNull();
    expect(screen.getByText('No Pokémon found')).toBeTruthy();
    expect(screen.getByText('(0)')).toBeTruthy();
    expect(onContextChange).not.toHaveBeenCalledWith(expect.objectContaining({ query: '' }));
  });

  it('opens the canonical quick-navigation menu instead of replacing the collection', () => {
    const onActionMenuNavigate = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogRows={[catalogBulbasaur]}
          error={null}
          inventoryTags={[inventoryTag, allCaughtTag]}
          instances={{}}
          isLoading={false}
          onActionMenuNavigate={onActionMenuNavigate}
          onActionMenuPress={jest.fn()}
          onOpenEntry={jest.fn()}
          onRetry={jest.fn()}
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getAllByRole('button', { name: 'Open action menu' })).toHaveLength(1);
    fireEvent.press(screen.getByRole('button', { name: 'Open action menu' }));

    expect(screen.getByTestId('native-action-menu')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pokémon' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Trades' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Search' }));
    expect(onActionMenuNavigate).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(32));
    expect(onActionMenuNavigate).toHaveBeenCalledWith('/search');
  });

  it('retains a prepared action menu so later opens only toggle visibility', () => {
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogRows={[catalogBulbasaur]}
          error={null}
          inventoryTags={[inventoryTag, allCaughtTag]}
          instances={{}}
          isLoading={false}
          onOpenEntry={jest.fn()}
          onRetry={jest.fn()}
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );

    act(() => {
      jest.advanceTimersByTime(700);
      jest.runOnlyPendingTimers();
    });
    const preparedMenu = screen.getByTestId('native-action-menu', {
      includeHiddenElements: true,
    });
    expect(preparedMenu.props.pointerEvents).toBe('none');

    fireEvent.press(screen.getByRole('button', { name: 'Open action menu' }));
    expect(screen.getByTestId('native-action-menu')).toBe(preparedMenu);
    expect(screen.getByTestId('native-action-menu').props.pointerEvents).toBe('auto');

    fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    act(() => jest.advanceTimersByTime(actionMenuExperienceParityContract.motion.closeMs));
    expect(screen.getByTestId('native-action-menu', {
      includeHiddenElements: true,
    }).props.pointerEvents).toBe('none');
  });

  it('applies a routed system tag before the first Pokémon page paint', () => {
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogRows={[catalogBulbasaur, catalogMewtwo]}
          error={null}
          initialTagKey="system:caught"
          inventoryTags={[inventoryTag, allCaughtTag]}
          instances={{ [caughtRow.id]: caughtInstance }}
          isLoading={false}
          onOpenEntry={jest.fn()}
          onRetry={jest.fn()}
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Caught')).toBeTruthy();
    expect(screen.getByText('Shiny Bulbasaur')).toBeTruthy();
    expect(screen.queryByText('Mewtwo')).toBeNull();
    const grid = screen.getByTestId('native-collection-grid');
    expect(grid.props.removeClippedSubviews).toBe(false);
    expect(grid.props.windowSize).toBe(3);
    expect(grid.props.ListHeaderComponent).toBeUndefined();
  });

  it('selects catalog variants in place and opens the canonical organizer', () => {
    const onOpenEntry = jest.fn();
    const onOrganizePokemon = jest.fn().mockResolvedValue({ message: '1 Pokémon added.' });
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogRows={[catalogBulbasaur, catalogMewtwo]}
          error={null}
          inventoryTags={[inventoryTag, allCaughtTag]}
          instances={{}}
          isLoading={false}
          onActionMenuPress={jest.fn()}
          onOpenEntry={onOpenEntry}
          onOrganizePokemon={onOrganizePokemon}
          onRetry={jest.fn()}
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Select Bulbasaur' }));

    expect(onOpenEntry).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Add \(1\)/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'X' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'SELECT ALL' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: /Add \(1\)/i }));
    expect(screen.getByRole('header', { name: 'Add Pokémon' })).toBeTruthy();
    expect(screen.getByText('1 selected')).toBeTruthy();
  });

  it('long-presses an existing instance into the same organizer workflow', () => {
    const onOpenEntry = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogRows={[catalogBulbasaur]}
          error={null}
          inventoryTags={[inventoryTag, allCaughtTag]}
          instances={{ [caughtRow.id]: caughtInstance }}
          isLoading={false}
          onActionMenuPress={jest.fn()}
          onOpenEntry={onOpenEntry}
          onOrganizePokemon={jest.fn().mockResolvedValue({ message: 'Saved.' })}
          onRetry={jest.fn()}
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByRole('tab', { name: /tags/i }));
    fireEvent.press(screen.getByRole('button', { name: /Open All Caught/i }));
    const caughtCard = screen.getByRole('button', { name: 'View Shiny Bulbasaur' });
    fireEvent(caughtCard, 'longPress');

    expect(onOpenEntry).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Organize \(1\)/i })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /Organize \(1\)/i }));
    expect(screen.getByRole('header', { name: 'Organize Pokémon' })).toBeTruthy();
    expect(screen.getByText('Create Wanted copy')).toBeTruthy();
    expect(screen.getByText('Transfer selected')).toBeTruthy();
  });

  it('requires a stable tag while viewing another trainer catalog', () => {
    const onReturnToContext = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogOwner="OtherTrainer"
          catalogRows={[caughtRow, wantedRow]}
          error={null}
          inventoryTags={[allCaughtTag]}
          instances={{ [caughtRow.id]: caughtInstance }}
          isLoading={false}
          onActionMenuPress={jest.fn()}
          onOpenEntry={jest.fn()}
          onRetry={jest.fn()}
          onReturnToContext={onReturnToContext}
          requireTagSelection
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByLabelText("Viewing OtherTrainer's catalog")).toBeTruthy();
    expect(screen.getByText('Shiny Bulbasaur')).toBeTruthy();
    expect(screen.queryByText('Shiny Mewtwo')).toBeNull();
    expect(screen.queryByRole('button', { name: /Clear Caught tag filter/i })).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Back to results' }));
    expect(onReturnToContext).toHaveBeenCalledTimes(1);
  });

  it('preserves the listing tag used to enter a foreign catalog', () => {
    render(
      <SafeAreaProvider initialMetrics={{
        frame: { x: 0, y: 0, width: 412, height: 915 },
        insets: { top: 24, right: 0, bottom: 20, left: 0 },
      }}>
        <NativeCollectionHubScreen
          assetBaseUrl="https://pokegonexus.com"
          catalogOwner="OtherTrainer"
          catalogRows={[caughtRow, wantedRow]}
          error={null}
          initialTagKey="system:most-wanted"
          inventoryTags={[allCaughtTag]}
          instances={{ [caughtRow.id]: caughtInstance }}
          isLoading={false}
          onActionMenuPress={jest.fn()}
          onOpenEntry={jest.fn()}
          onRetry={jest.fn()}
          requireTagSelection
          wishlistTags={[wishlistTag]}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Shiny Mewtwo')).toBeTruthy();
    expect(screen.queryByText('Shiny Bulbasaur')).toBeNull();
    expect(screen.queryByRole('button', { name: /Clear Most Wanted tag filter/i })).toBeNull();
  });
});
