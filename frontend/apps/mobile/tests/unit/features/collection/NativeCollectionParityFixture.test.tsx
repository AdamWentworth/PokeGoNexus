import { createRef } from 'react';
import { FlatList, Keyboard, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import {
  NativeCollectionParityFixture,
  type NativeCollectionParityFixtureHandle,
  resolveNativeCollectionCardHeight,
} from '../../../../src/features/collection/parity/NativeCollectionParityFixture';
import { createNativeCollectionImageRevealController } from '../../../../src/features/collection/parity/nativeCollectionImageRevealController';
import { runAfterNativeUiInteractions } from '../../../../src/interaction/nativeUiInteractionScheduler';
import { COLLECTION_PARITY_FIXTURES } from '../../../../src/features/collection/parity/collectionParityFixtures';

const mockUseWindowDimensions = jest.fn(() => ({
  width: 412,
  height: 915,
  scale: 2.625,
  fontScale: 1,
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe('NativeCollectionParityFixture', () => {
  beforeEach(() => {
    mockUseWindowDimensions.mockReturnValue({
      width: 412,
      height: 915,
      scale: 2.625,
      fontScale: 1,
    });
  });

  it('preserves the canonical mobile collection hierarchy without native redesign copy', () => {
    render(<NativeCollectionParityFixture onActionMenuPress={() => undefined} />);

    expect(screen.getByRole('tab', { name: /tags/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /pokémon/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /wishlist/i })).toBeTruthy();
    expect(screen.getByLabelText('Search Pokémon')).toBeTruthy();
    expect(screen.getByText('Favorites')).toBeTruthy();
    expect(screen.queryByText('NATIVE COLLECTION')).toBeNull();
    expect(screen.queryByText('Your Pokémon')).toBeNull();
    expect(screen.queryByText('Edit in current app')).toBeNull();
  });

  it('renders all canonical card fixtures and their layered state signals', () => {
    render(<NativeCollectionParityFixture onActionMenuPress={() => undefined} />);

    expect(screen.getAllByLabelText('Favorite')).toHaveLength(9);
    expect(screen.getAllByLabelText('Gigantamax')).toHaveLength(2);
    expect(screen.getByTestId('native-location-backdrop', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Sort by Pokédex number ascending')).toBeTruthy();
    expect(screen.getByLabelText('Open action menu')).toBeTruthy();
    for (const card of COLLECTION_PARITY_FIXTURES) {
      expect(screen.getByTestId(`parity-card-${card.id}`)).toBeTruthy();
      expect(screen.getByText(card.name)).toBeTruthy();
    }
    expect(collectionExperienceParityContract.cardLongPressMs).toBe(300);
  });

  it('supports the remaining canonical card layers and non-clearable wanted context', () => {
    render(
      <NativeCollectionParityFixture
        activeTag="Most Wanted"
        cards={[
          {
            id: 'purified-dynamax-wanted',
            cp: null,
            dexNumber: 9,
            name: 'Purified Dynamax Blastoise',
            imagePath: '/images/shiny/shiny_pokemon_9.png',
            typeIconPaths: ['/images/types/water.png'],
            maxKind: 'dynamax',
            mostWanted: true,
            ownership: 'wanted',
            purified: true,
          },
        ]}
        collectionCount={1}
        tagCanClear={false}
        tagTone="most-wanted"
      />,
    );

    expect(screen.getByText('(MOST WANTED)')).toBeTruthy();
    expect(screen.getByLabelText('Most Wanted')).toBeTruthy();
    expect(screen.getByLabelText('Dynamax')).toBeTruthy();
    expect(screen.getByLabelText('Purified')).toBeTruthy();
    expect(screen.getByTestId(
      'native-wanted-status-glow',
      { includeHiddenElements: true },
    )).toBeTruthy();
    expect(screen.queryByLabelText('Clear Most Wanted tag filter')).toBeNull();
  });

  it.each(['caught', 'trade', 'wanted'] as const)(
    'renders the canonical radial %s ownership glow behind tagged Pokémon',
    (ownership) => {
      render(
        <NativeCollectionParityFixture
          cards={[{
            ...COLLECTION_PARITY_FIXTURES[0],
            id: `${ownership}-glow-card`,
            ownership,
          }]}
        />,
      );

      const glow = screen.getByTestId(
        `native-${ownership}-status-glow`,
        { includeHiddenElements: true },
      );
      expect(glow).toHaveStyle({
        top: '10%',
        left: '15%',
        width: '70%',
        height: '70%',
      });
    },
  );

  it('does not allocate a bitmap for Vite\'s visually absent inactive glow', () => {
    render(
      <NativeCollectionParityFixture
        activeTag={null}
        cards={[{ ...COLLECTION_PARITY_FIXTURES[0], ownership: undefined }]}
      />,
    );

    expect(screen.queryByTestId('native-inactive-status-glow')).toBeNull();
  });

  it('keeps incomplete mobile rows at the canonical three-column width', () => {
    render(<NativeCollectionParityFixture cards={COLLECTION_PARITY_FIXTURES.slice(0, 1)} />);

    expect(screen.getByTestId('parity-card-shiny-shadow-venusaur')).toHaveStyle({
      height: resolveNativeCollectionCardHeight(126),
      width: 126,
    });
  });

  it.each([
    [480, 149],
    [481, 70],
    [1023, 161],
    [1024, 104],
  ])('preserves the canonical responsive grid boundary at %i px', (width, cardWidth) => {
    mockUseWindowDimensions.mockReturnValue({
      width,
      height: 915,
      scale: 2.625,
      fontScale: 1,
    });

    render(<NativeCollectionParityFixture cards={COLLECTION_PARITY_FIXTURES.slice(0, 1)} />);

    expect(screen.getByTestId('parity-card-shiny-shadow-venusaur')).toHaveStyle({
      width: cardWidth,
    });
  });

  it('renders user-selected custom tag identity in both header and chip', () => {
    render(
      <NativeCollectionParityFixture
        activeTag="Shadow Shinies"
        customTagColor="#6f35c5"
        tagTone="custom"
        theme="light"
      />,
    );

    expect(screen.getByText('(SHADOW SHINIES)')).toBeTruthy();
    expect(screen.getByText('Shadow Shinies')).toBeTruthy();
    expect(screen.getByLabelText('Clear Shadow Shinies tag filter')).toBeTruthy();
  });

  it('keeps the fixture disconnected from user actions', () => {
    render(<NativeCollectionParityFixture />);

    expect(screen.getByTestId('native-collection-parity-fixture')).toBeTruthy();
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Favorite Pokémon')).toBeNull();
  });

  it('lets search filter controls receive the first tap while the search input is focused', () => {
    render(<NativeCollectionParityFixture />);

    expect(screen.getByTestId('native-collection-grid').props.keyboardShouldPersistTaps).toBe('always');
  });

  it('keeps the input and virtualized grid mounted while the search menu is open', () => {
    const view = render(<NativeCollectionParityFixture />);
    const initialGrid = view.UNSAFE_getByType(FlatList);
    const initialInput = view.getByLabelText('Search Pokémon');

    fireEvent(initialInput, 'focus');
    const initialSearchMenu = view.getByLabelText('Pokémon search filters');

    expect(view.UNSAFE_getByType(FlatList)).toBe(initialGrid);
    expect(view.getByLabelText('Search Pokémon')).toBe(initialInput);
    expect(initialGrid.props.pointerEvents).toBe('none');
    expect(initialGrid.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(view.getByLabelText('Pokémon search filters')).toBeTruthy();

    fireEvent.changeText(initialInput, 'char');

    expect(view.UNSAFE_getByType(FlatList)).toBe(initialGrid);
    expect(view.getByLabelText('Search Pokémon')).toBe(initialInput);
    expect(initialGrid.props.pointerEvents).toBe('auto');
    expect(view.queryByLabelText('Pokémon search filters')).toBeNull();
    const retainedSearchMenu = view.getByLabelText(
      'Pokémon search filters',
      { includeHiddenElements: true },
    );
    expect(retainedSearchMenu).toBe(initialSearchMenu);
    const retainedSearchScroll = view.getByTestId(
      'native-collection-filter-scroll',
      { includeHiddenElements: true },
    );
    expect(retainedSearchScroll.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(retainedSearchScroll.props.style).transform).toEqual([
      { translateY: 10_000 },
    ]);
  });

  it('dismisses the keyboard when a Vite search-filter tile is selected', () => {
    jest.useFakeTimers();
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss').mockImplementation(jest.fn());
    const onQueryChange = jest.fn();
    const view = render(
      <NativeCollectionParityFixture onQueryChange={onQueryChange} />,
    );

    fireEvent(view.getByLabelText('Search Pokémon'), 'focus');
    fireEvent.press(view.getByLabelText('Filter by Shiny'));

    expect(onQueryChange).toHaveBeenCalledWith('Shiny', 'filter');
    expect(dismissKeyboard).not.toHaveBeenCalled();
    act(() => jest.runAllTimers());
    expect(dismissKeyboard).toHaveBeenCalled();
    expect(view.queryByLabelText('Pokémon search filters')).toBeNull();
    dismissKeyboard.mockRestore();
    jest.useRealTimers();
  });

  it('holds background image work through a staged filter release frame', () => {
    jest.useFakeTimers();
    const view = render(
      <NativeCollectionParityFixture
        onCancelQueryPreview={jest.fn()}
        onQueryChange={jest.fn()}
        onQueryPreview={jest.fn()}
      />,
    );
    fireEvent(view.getByLabelText('Search Pokémon'), 'focus');
    const shiny = view.getByLabelText('Filter by Shiny');
    fireEvent(shiny, 'pressIn');
    const backgroundTask = jest.fn();
    runAfterNativeUiInteractions(backgroundTask);
    act(() => jest.runOnlyPendingTimers());
    expect(backgroundTask).not.toHaveBeenCalled();

    fireEvent(shiny, 'pressOut');
    fireEvent.press(shiny);
    act(() => {
      jest.runOnlyPendingTimers();
      jest.runOnlyPendingTimers();
    });

    expect(backgroundTask).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('keeps grid render work stable when the Vite-style data projection changes', () => {
    const view = render(
      <NativeCollectionParityFixture cards={COLLECTION_PARITY_FIXTURES.slice(0, 3)} />,
    );
    const initialGrid = view.UNSAFE_getByType(FlatList);
    const initialGetItemLayout = initialGrid.props.getItemLayout;
    const initialKeyExtractor = initialGrid.props.keyExtractor;
    const initialRenderItem = initialGrid.props.renderItem;

    view.rerender(
      <NativeCollectionParityFixture cards={COLLECTION_PARITY_FIXTURES.slice(3, 6)} />,
    );

    const updatedGrid = view.UNSAFE_getByType(FlatList);
    expect(updatedGrid).toBe(initialGrid);
    expect(updatedGrid.props.ListHeaderComponent).toBeUndefined();
    expect(updatedGrid.props.keyExtractor).toBe(initialKeyExtractor);
    expect(updatedGrid.props.getItemLayout).toBe(initialGetItemLayout);
    expect(initialGetItemLayout(COLLECTION_PARITY_FIXTURES, 2)).toEqual({
      index: 2,
      length: resolveNativeCollectionCardHeight(126),
      offset: resolveNativeCollectionCardHeight(126) * 2,
    });
    expect(initialKeyExtractor(COLLECTION_PARITY_FIXTURES[0], 0)).toBe(
      initialKeyExtractor(COLLECTION_PARITY_FIXTURES[3], 0),
    );
    expect(initialKeyExtractor(COLLECTION_PARITY_FIXTURES[0], 0)).not.toBe(
      initialKeyExtractor(COLLECTION_PARITY_FIXTURES[1], 1),
    );
    expect(updatedGrid.props.renderItem).toBe(initialRenderItem);
    expect(updatedGrid.props.stickyHeaderIndices).toBeUndefined();
    expect(updatedGrid.props.strictMode).toBe(true);
    expect(updatedGrid.props.initialNumToRender).toBe(6);
    expect(updatedGrid.props.maxToRenderPerBatch).toBe(2);
    expect(updatedGrid.props.windowSize).toBe(3);
    const firstPokemonImage = screen.getByLabelText(COLLECTION_PARITY_FIXTURES[3].name);
    expect(firstPokemonImage.props.resizeMethod).toBeUndefined();
    expect(firstPokemonImage.props.source.cache).toBe('force-cache');
    expect(screen.getByLabelText('Gigantamax').props.resizeMethod).toBe('resize');
  });

  it('can reveal a destination grid image-by-image without withholding card content', () => {
    const cards = COLLECTION_PARITY_FIXTURES.slice(0, 3);
    const view = render(
      <NativeCollectionParityFixture cards={cards} collectionImageRevealCount={1} />,
    );

    expect(view.getByText(cards[0].name)).toBeTruthy();
    expect(view.getByText(cards[1].name)).toBeTruthy();
    expect(view.getByLabelText(cards[0].name)).toBeTruthy();
    expect(view.queryByLabelText(cards[1].name)).toBeNull();

    view.rerender(
      <NativeCollectionParityFixture cards={cards} collectionImageRevealCount={2} />,
    );

    expect(view.getByLabelText(cards[1].name)).toBeTruthy();
    expect(view.queryByLabelText(cards[2].name)).toBeNull();
  });

  it('reveals each image without changing FlatList props or reconciling its parent', () => {
    const cards = COLLECTION_PARITY_FIXTURES.slice(0, 3).map((card, index) => ({
      ...card,
      ownership: (['caught', 'trade', 'wanted'] as const)[index],
    }));
    const imageRevealController = createNativeCollectionImageRevealController(1);
    const view = render(
      <NativeCollectionParityFixture
        cards={cards}
        collectionImageRevealController={imageRevealController}
      />,
    );
    const initialGrid = view.UNSAFE_getByType(FlatList);
    const initialExtraData = initialGrid.props.extraData;
    const initialRenderItem = initialGrid.props.renderItem;

    expect(view.getByLabelText(cards[0].name)).toBeTruthy();
    expect(view.queryByLabelText(cards[1].name)).toBeNull();
    expect(view.queryAllByTestId(
      /^native-(?:caught|trade|wanted)-status-glow$/,
      { includeHiddenElements: true },
    )).toHaveLength(1);

    act(() => imageRevealController.setRevealCount(2));

    const updatedGrid = view.UNSAFE_getByType(FlatList);
    expect(view.getByLabelText(cards[1].name)).toBeTruthy();
    expect(view.queryByLabelText(cards[2].name)).toBeNull();
    expect(updatedGrid).toBe(initialGrid);
    expect(updatedGrid.props.extraData).toBe(initialExtraData);
    expect(updatedGrid.props.renderItem).toBe(initialRenderItem);
    expect(view.queryAllByTestId(
      /^native-(?:caught|trade|wanted)-status-glow$/,
      { includeHiddenElements: true },
    )).toHaveLength(2);

    act(() => imageRevealController.setRevealCount(0));
    expect(view.queryAllByTestId(
      /^native-(?:caught|trade|wanted)-status-glow$/,
      { includeHiddenElements: true },
    )).toHaveLength(2);
  });

  it('resets the active destination grid before it returns from a side tag page', () => {
    const ref = createRef<NativeCollectionParityFixtureHandle>();
    const onScrollOffsetChange = jest.fn();
    render(
      <NativeCollectionParityFixture
        onScrollOffsetChange={onScrollOffsetChange}
        ref={ref}
      />,
    );
    const grid = screen.getByTestId('native-collection-grid');
    fireEvent.scroll(grid, {
      nativeEvent: {
        contentOffset: { x: 0, y: 120 },
        contentSize: { width: 412, height: 2000 },
        layoutMeasurement: { width: 412, height: 700 },
      },
    });
    expect(onScrollOffsetChange).not.toHaveBeenCalled();
    fireEvent(grid, 'momentumScrollEnd', {
      nativeEvent: {
        contentOffset: { x: 0, y: 240 },
        contentSize: { width: 412, height: 2000 },
        layoutMeasurement: { width: 412, height: 700 },
      },
    });
    expect(onScrollOffsetChange).toHaveBeenLastCalledWith(240);

    act(() => ref.current?.resetScroll());

    expect(onScrollOffsetChange).toHaveBeenLastCalledWith(0);
  });

  it('replaces floating controls with the canonical selection action', () => {
    const onSelectionActionPress = jest.fn();
    render(
      <NativeCollectionParityFixture
        onActionMenuPress={() => undefined}
        onSelectionActionPress={onSelectionActionPress}
        selectedIds={new Set([COLLECTION_PARITY_FIXTURES[0].id])}
        selectionAction="add"
      />,
    );

    expect(screen.queryByLabelText('Sort by Pokédex number ascending')).toBeNull();
    expect(screen.queryByLabelText('Open action menu')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: /Add \(1\)/i }));
    expect(onSelectionActionPress).toHaveBeenCalledTimes(1);
  });
});
