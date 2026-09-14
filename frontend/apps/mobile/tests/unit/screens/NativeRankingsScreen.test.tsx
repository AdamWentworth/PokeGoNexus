import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';
import { NATIVE_HORIZONTAL_PAGE_TRANSITION_MS } from '../../../src/components/NativeHorizontalPageSlider';
import { NativeRankingsScreen } from '../../../src/screens/NativeRankingsScreen';

const row = {
  caughtUsers: 3,
  entry: { id: '0001-shiny', pokemonId: 1, pokedexNumber: 1, name: 'Shiny Bulbasaur', imageUri: '/1.png', typeIconUris: [], maxKind: null },
  mostWantedUsers: 2,
  personal: { caughtCount: 1, registered: true, tradeCount: 0, wanted: true },
  rank: 1,
  wantedUsers: 4,
};

const renderRankings = (overrides: Partial<ComponentProps<typeof NativeRankingsScreen>> = {}) => {
  const props: ComponentProps<typeof NativeRankingsScreen> = {
    assetBaseUrl: 'https://pokegonexus.com',
    collectionFilterCounts: { all: 1, missing: 0, owned: 1, trade: 0, wanted: 1 },
    collectorCount: 5,
    onBack: jest.fn(),
    onChangeCategory: jest.fn(),
    onChangeCollectionFilter: jest.fn(),
    onChangeMode: jest.fn(),
    onChangeQuery: jest.fn(),
    onOpenEntry: jest.fn(),
    onOpenPokemon: jest.fn(),
    onRetry: jest.fn(),
    privacyThreshold: 3,
    query: '',
    rows: [row],
    selectedCategory: 'all',
    selectedCollectionFilter: 'all',
    selectedMode: 'wanted',
    showCollectionFilters: true,
    snapshotLabel: 'Recently updated',
    ...overrides,
  };
  const view = render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
      <NativeRankingsScreen {...props} />
    </SafeAreaProvider>,
  );
  return { ...props, view };
};

describe('NativeRankingsScreen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });
  it('changes ranking controls and opens the exact signed-in Pokémon workflow', () => {
    const props = renderRankings();
    expect(screen.getByText('Community Rankings')).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'Rarest owned' }));
    expect(props.onChangeMode).toHaveBeenCalledWith('rarest');
    fireEvent.press(screen.getByLabelText('View wishlist, rank 1, Shiny Bulbasaur'));
    expect(props.onOpenEntry).toHaveBeenCalledWith(row);
  });

  it('slides distinct ranking rows while retaining each panel and its expanded help', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const rareRow = { ...row, entry: { ...row.entry, id: '0002-default', name: 'Ivysaur' } };
    const counts = { all: 1, missing: 0, owned: 1, trade: 0, wanted: 1 };
    const props = renderRankings({ workspaces: {
      wanted: { rows: [row], collectionFilterCounts: counts, selectedCategory: 'all' },
      rarest: { rows: [rareRow], collectionFilterCounts: counts, selectedCategory: 'all' },
    } });
    const switchMode = (selectedMode: 'wanted' | 'rarest') => props.view.rerender(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativeRankingsScreen {...props} selectedMode={selectedMode} />
      </SafeAreaProvider>,
    );
    fireEvent(screen.getByTestId('native-horizontal-page-slider'), 'layout', { nativeEvent: { layout: { width: 390, height: 650 } } });
    fireEvent.press(screen.getByText('How these rankings work'));
    const wantedPanel = screen.getByTestId('native-rankings-panel-wanted');
    timing.mockClear();
    fireEvent.press(screen.getByRole('tab', { name: 'Rarest owned' }));
    expect(props.onChangeMode).toHaveBeenCalledWith('rarest');
    switchMode('rarest');
    expect(timing).toHaveBeenCalledWith(expect.any(Animated.Value), expect.objectContaining({
      duration: NATIVE_HORIZONTAL_PAGE_TRANSITION_MS, toValue: 390, useNativeDriver: true,
    }));
    expect(screen.getByText('Ivysaur')).toBeTruthy();
    expect(screen.queryByText('Shiny Bulbasaur')).toBeNull();
    expect(screen.getByText('Shiny Bulbasaur', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('native-rankings-panel-wanted', { includeHiddenElements: true })).toBe(wantedPanel);
    switchMode('wanted');
    expect(screen.getByText(/Duplicate wanted copies do not add votes/)).toBeTruthy();
    expect(screen.getByText('Shiny Bulbasaur')).toBeTruthy();
    timing.mockRestore();
  });

  it('keeps public ranking rows informational like Vite', () => {
    renderRankings({ showCollectionFilters: false });
    expect(screen.getByLabelText('Rank 1, Shiny Bulbasaur')).toBeTruthy();
    expect(screen.queryByText('View Pokémon')).toBeNull();
  });

  it('matches Vite empty-state destinations and clear actions', () => {
    const onOpenPokemon = jest.fn();
    renderRankings({
      collectionFilterCounts: { all: 4, missing: 1, owned: 3, trade: 0, wanted: 1 },
      onOpenPokemon,
      rows: [],
      selectedCollectionFilter: 'trade',
    });
    expect(screen.getByText('Nothing is listed for trade')).toBeTruthy();
    fireEvent.press(screen.getByText('View my Pokémon'));
    expect(onOpenPokemon).toHaveBeenCalledWith('caught');
    fireEvent.press(screen.getByText('How these rankings work'));
    expect(screen.getByText(/Duplicate wanted copies do not add votes/)).toBeTruthy();
  });

  it('uses the exact zero and privacy count copy from Vite', () => {
    const privateRow = { ...row, entry: { ...row.entry, id: '0002-default', name: 'Ivysaur' }, rank: 2, wantedUsers: null };
    renderRankings({ rows: [{ ...row, wantedUsers: 0 }, privateRow] });
    expect(screen.getByText('No trainers want this')).toBeTruthy();
    expect(screen.getByText('Fewer than 3 trainers want this')).toBeTruthy();
  });

  it('paginates in the same 30-row increments as Vite', () => {
    const rows = Array.from({ length: 31 }, (_, index) => ({
      ...row,
      entry: { ...row.entry, id: `${index + 1}-default`, name: `Ranking ${index + 1}` },
      rank: index + 1,
    }));
    renderRankings({ collectionFilterCounts: { all: 31, missing: 30, owned: 1, trade: 0, wanted: 1 }, rows });
    expect(screen.queryByText('Ranking 31')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Show 1 more rankings' }));
    expect(screen.queryByRole('button', { name: /Show \d+ more rankings/ })).toBeNull();
  });

  it('reveals working compact controls only after the filter summary scrolls away', () => {
    const props = renderRankings();
    expect(screen.queryByLabelText('Quick ranking controls')).toBeNull();
    fireEvent(screen.getByTestId('native-ranking-filter-summary'), 'layout', { nativeEvent: { layout: { height: 42, width: 390, x: 0, y: 400 } } });
    fireEvent.scroll(screen.getByTestId('native-rankings-list'), { nativeEvent: { contentOffset: { x: 0, y: 1000 }, contentSize: { height: 2400, width: 390 }, layoutMeasurement: { height: 800, width: 390 } } });
    expect(screen.getByLabelText('Quick ranking controls')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Ranking view'));
    fireEvent.press(screen.getByLabelText('Select Rarest owned'));
    expect(props.onChangeMode).toHaveBeenCalledWith('rarest');
  });
});
