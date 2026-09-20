import { useState } from 'react';
import { FlatList } from 'react-native';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import type { NativeCollectionRow } from '../../../src/features/collection/collectionModel';
import {
  NativeCollectionParityScreen,
  projectNativeCollectionParityCards,
} from '../../../src/screens/NativeCollectionParityScreen';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 412, height: 915, scale: 2.625, fontScale: 1 }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
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

const row = (patch: Partial<NativeCollectionRow>): NativeCollectionRow => ({
  id: 'instance-1',
  pokemonId: 1,
  pokedexNumber: 1,
  name: 'Bulbasaur',
  imageUri: 'https://pokegonexus.com/images/pokemon_1.png',
  locationBackgroundUri: null,
  maxKind: null,
  purified: false,
  lucky: false,
  typeIconUris: ['https://pokegonexus.com/images/types/grass.png'],
  status: 'caught',
  cp: 500,
  favorite: true,
  mostWanted: false,
  ...patch,
});

const rows = [
  row({
    id: 'bulbasaur',
    name: 'Bulbasaur',
    favorite: true,
    searchTerms: ['Grass', 'Shiny'],
  }),
  row({
    id: 'charizard',
    pokemonId: 6,
    pokedexNumber: 6,
    name: 'Charizard',
    favorite: false,
    searchTerms: ['Fire'],
    status: 'trade',
  }),
];

const Harness = ({
  onOpenCanonicalCollection = jest.fn(),
  onOpenInstance = jest.fn(),
  onQueryChange = jest.fn(),
  onRowsCommitted = jest.fn(),
}: {
  onOpenCanonicalCollection?: jest.Mock;
  onOpenInstance?: jest.Mock;
  onQueryChange?: jest.Mock;
  onRowsCommitted?: jest.Mock;
}) => {
  const [query, setQuery] = useState('');
  return (
    <NativeCollectionParityScreen
      activeTag={null}
      assetBaseUrl="https://pokegonexus.com"
      rows={rows}
      query={query}
      isLoading={false}
      error={null}
      onQueryChange={(nextQuery) => {
        onQueryChange(nextQuery);
        setQuery(nextQuery);
      }}
      onRowsCommitted={onRowsCommitted}
      onRetry={jest.fn()}
      onOpenInstance={onOpenInstance}
      onOpenCanonicalCollection={onOpenCanonicalCollection}
      onClearTag={jest.fn()}
      onViewChange={jest.fn()}
    />
  );
};

describe('NativeCollectionParityScreen', () => {
  it('reuses the same card projection when a Pokémon appears in multiple tags', () => {
    const sharedRow = rows[0];
    const firstTagCards = projectNativeCollectionParityCards([sharedRow], true);
    const secondTagCards = projectNativeCollectionParityCards([rows[1], sharedRow], true);

    expect(secondTagCards[1]).toBe(firstTagCards[0]);
  });

  it('reuses one Vite-style virtualized grid when the active tag changes', () => {
    const favorites = {
      key: 'system:favorites' as const,
      parent: 'caught' as const,
      name: 'Favorites',
      color: '#ffd45a',
      tone: 'favorites' as const,
      rows: [rows[0]],
    };
    const view = render(
      <NativeCollectionParityScreen
        activeTag={null}
        assetBaseUrl="https://pokegonexus.com"
        error={null}
        isLoading={false}
        onClearTag={jest.fn()}
        onOpenInstance={jest.fn()}
        onQueryChange={jest.fn()}
        onRetry={jest.fn()}
        onViewChange={jest.fn()}
        query=""
        rows={rows}
      />,
    );
    const initialGrid = view.UNSAFE_getByType(FlatList);
    expect(initialGrid.props.data[0]).toBe(rows[0]);
    expect(initialGrid.props.data[0].imagePath).toBeUndefined();
    expect(screen.queryAllByTestId('native-collection-grid')).toHaveLength(1);
    expect(screen.getByText('Charizard')).toBeTruthy();

    view.rerender(
      <NativeCollectionParityScreen
        activeTag={favorites}
        assetBaseUrl="https://pokegonexus.com"
        error={null}
        isLoading={false}
        onClearTag={jest.fn()}
        onOpenInstance={jest.fn()}
        onQueryChange={jest.fn()}
        onRetry={jest.fn()}
        onViewChange={jest.fn()}
        query=""
        rows={favorites.rows}
      />,
    );

    expect(view.UNSAFE_getByType(FlatList)).toBe(initialGrid);
    expect(screen.queryAllByTestId('native-collection-grid')).toHaveLength(1);
    expect(screen.queryAllByTestId(
      /^native-collection-surface-/,
      { includeHiddenElements: true },
    )).toHaveLength(0);
    expect(screen.getByText('Favorites')).toBeTruthy();
    expect(screen.getByText('Bulbasaur')).toBeTruthy();
    expect(screen.queryByText('Charizard')).toBeNull();
  });

  it('starts in the complete catalog context', () => {
    render(<Harness />);

    expect(screen.getByText('Bulbasaur')).toBeTruthy();
    expect(screen.getByText('Charizard')).toBeTruthy();
  });

  it('paints cold card content before progressively admitting its images', () => {
    render(<Harness />);

    expect(screen.getByText('Bulbasaur')).toBeTruthy();
    expect(screen.queryByLabelText('Bulbasaur')).toBeNull();

    act(() => jest.advanceTimersByTime(1_000));

    expect(screen.getByLabelText('Bulbasaur')).toBeTruthy();
  });

  it('searches the connected rows and opens a real instance', () => {
    const onOpenInstance = jest.fn();
    render(<Harness onOpenInstance={onOpenInstance} />);

    fireEvent.changeText(screen.getByLabelText('Search Pokémon'), 'char');
    expect(screen.queryByText('Bulbasaur')).toBeNull();
    expect(screen.getByText('Charizard')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'View Charizard' }));
    expect(onOpenInstance).toHaveBeenCalledWith(rows[1], [rows[1]]);
  });

  it('matches the canonical focus-to-filter and filter-to-results workflow', () => {
    render(<Harness />);

    fireEvent(screen.getByLabelText('Search Pokémon'), 'focus');
    expect(screen.getByLabelText('Pokémon search filters')).toBeTruthy();
    expect(screen.queryByText('Bulbasaur')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Filter by Fire' }));
    act(() => jest.advanceTimersByTime(17));
    expect(screen.queryByLabelText('Pokémon search filters')).toBeNull();
    expect(screen.getByLabelText('Clear Pokémon search')).toBeTruthy();
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });

  it('stages a filter result behind the search menu before release adopts it', () => {
    const onQueryChange = jest.fn();
    const onRowsCommitted = jest.fn();
    const view = render(
      <Harness onQueryChange={onQueryChange} onRowsCommitted={onRowsCommitted} />,
    );
    fireEvent(view.getByLabelText('Search Pokémon'), 'focus');
    const filter = view.getByRole('button', { name: 'Filter by Shiny' });
    onRowsCommitted.mockClear();

    fireEvent(filter, 'pressIn');

    expect(view.UNSAFE_getByType(FlatList).props.data).toEqual([rows[0]]);
    expect(view.getByLabelText('Search Pokémon').props.value).toBe('');
    expect(onQueryChange).not.toHaveBeenCalled();
    expect(onRowsCommitted).toHaveBeenLastCalledWith(1, 'Shiny');

    fireEvent(filter, 'pressOut');
    fireEvent.press(filter);

    // The already-staged grid is revealed imperatively on release. Adopt the
    // query/menu state on the following frame so the retained filter tree does
    // not sit in front of that visible response.
    act(() => jest.advanceTimersByTime(17));
    expect(onQueryChange).toHaveBeenCalledWith('Shiny');
    expect(view.getByLabelText('Search Pokémon').props.value).toBe('Shiny');
    expect(view.UNSAFE_getByType(FlatList).props.data).toEqual([rows[0]]);
  });

  it('restores the catalog when a staged filter press is cancelled', () => {
    const onQueryChange = jest.fn();
    const view = render(<Harness onQueryChange={onQueryChange} />);
    fireEvent(view.getByLabelText('Search Pokémon'), 'focus');
    const filter = view.getByRole('button', { name: 'Filter by Shiny' });

    fireEvent(filter, 'pressIn');
    expect(view.UNSAFE_getByType(FlatList).props.data).toEqual([rows[0]]);

    fireEvent(filter, 'pressOut');
    act(() => jest.advanceTimersByTime(0));

    expect(view.UNSAFE_getByType(FlatList).props.data).toEqual(rows);
    expect(onQueryChange).not.toHaveBeenCalled();
    expect(view.getByLabelText('Search Pokémon').props.value).toBe('');
  });

  it('lets the user choose an actual sort and direction', () => {
    render(<Harness />);

    fireEvent.press(screen.getByLabelText('Sort by NUMBER ascending'));
    fireEvent.press(screen.getByRole('radio', { name: /name/i }));
    expect(screen.getByLabelText('Sort by NAME ascending')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Sort by NAME ascending'));
    fireEvent.press(screen.getByRole('radio', { name: /name/i }));
    expect(screen.getByLabelText('Sort by NAME descending')).toBeTruthy();
  });

  it('presents the sort menu through a full-screen parent host when supplied', () => {
    const sortMenuHost = {
      dismiss: jest.fn(),
      present: jest.fn(),
    };
    render(
      <NativeCollectionParityScreen
        activeTag={null}
        assetBaseUrl="https://pokegonexus.com"
        error={null}
        isLoading={false}
        onClearTag={jest.fn()}
        onOpenInstance={jest.fn()}
        onQueryChange={jest.fn()}
        onRetry={jest.fn()}
        onViewChange={jest.fn()}
        query=""
        rows={rows}
        sortMenuHost={sortMenuHost}
      />,
    );

    fireEvent.press(screen.getByLabelText('Sort by NUMBER ascending'));

    expect(sortMenuHost.present).toHaveBeenCalledTimes(1);
    expect(sortMenuHost.present).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'ascending',
      sort: 'number',
    }));
    expect(screen.queryByRole('radio', { name: /name/i })).toBeNull();

    const presentation = sortMenuHost.present.mock.calls[0][0];
    act(() => presentation.onClose());
    expect(sortMenuHost.dismiss).toHaveBeenCalledTimes(1);
  });

  it('changes sorting on selection without reordering the grid during press-in', () => {
    const sortRows = [
      row({ id: 'zubat', name: 'Zubat', pokedexNumber: 1 }),
      row({ id: 'abra', name: 'Abra', pokedexNumber: 2 }),
    ];
    const view = render(
      <NativeCollectionParityScreen
        activeTag={null}
        assetBaseUrl="https://pokegonexus.com"
        error={null}
        isLoading={false}
        onClearTag={jest.fn()}
        onOpenInstance={jest.fn()}
        onQueryChange={jest.fn()}
        onRetry={jest.fn()}
        onViewChange={jest.fn()}
        query=""
        rows={sortRows}
      />,
    );
    expect(view.UNSAFE_getByType(FlatList).props.data).toEqual(sortRows);
    fireEvent.press(view.getByLabelText('Sort by NUMBER ascending'));
    const nameSort = view.getByRole('radio', { name: /name/i });

    fireEvent(nameSort, 'pressIn');
    expect(view.UNSAFE_getByType(FlatList).props.data).toEqual(sortRows);

    fireEvent(nameSort, 'pressOut');
    act(() => jest.advanceTimersByTime(0));
    expect(view.UNSAFE_getByType(FlatList).props.data).toEqual(sortRows);

    fireEvent.press(nameSort);

    expect(view.getByLabelText('Sort by NAME ascending')).toBeTruthy();
    expect(view.UNSAFE_getByType(FlatList).props.data).toEqual([
      sortRows[1],
      sortRows[0],
    ]);
  });

  it('prepares an evolutionary family on press-in before checking the control', () => {
    const familyRows = [
      row({
        id: 'bulbasaur-family',
        name: 'Bulbasaur',
        pokedexNumber: 1,
        pokemonId: 1,
        evolutionFamilyIds: [1, 2],
        searchTerms: ['Bulbasaur'],
      }),
      row({
        id: 'ivysaur-family',
        name: 'Ivysaur',
        pokedexNumber: 2,
        pokemonId: 2,
        evolutionFamilyIds: [1, 2],
        searchTerms: ['Ivysaur'],
      }),
    ];
    const view = render(
      <NativeCollectionParityScreen
        activeTag={null}
        assetBaseUrl="https://pokegonexus.com"
        error={null}
        isLoading={false}
        onClearTag={jest.fn()}
        onOpenInstance={jest.fn()}
        onQueryChange={jest.fn()}
        onRetry={jest.fn()}
        onViewChange={jest.fn()}
        query="Ivysaur"
        rows={familyRows}
      />,
    );
    const toggle = view.getByRole('checkbox');
    expect(view.UNSAFE_getByType(FlatList).props.data).toEqual([familyRows[1]]);
    expect(toggle.props.accessibilityState.checked).toBe(false);

    fireEvent(toggle, 'pressIn');

    expect(view.UNSAFE_getByType(FlatList).props.data).toEqual(familyRows);
    expect(toggle.props.accessibilityState.checked).toBe(false);

    fireEvent(toggle, 'pressOut');
    act(() => jest.advanceTimersByTime(0));
    expect(view.UNSAFE_getByType(FlatList).props.data).toEqual([familyRows[1]]);

    fireEvent(toggle, 'pressIn');
    fireEvent(toggle, 'pressOut');
    fireEvent.press(toggle);

    expect(view.getByRole('checkbox').props.accessibilityState.checked).toBe(true);
    expect(view.UNSAFE_getByType(FlatList).props.data).toEqual(familyRows);
  });

  it('keeps the action menu callback available', () => {
    const onOpenCanonicalCollection = jest.fn();
    render(<Harness onOpenCanonicalCollection={onOpenCanonicalCollection} />);

    fireEvent.press(screen.getByLabelText('Open action menu'));
    expect(onOpenCanonicalCollection).toHaveBeenCalledTimes(1);
  });
});
