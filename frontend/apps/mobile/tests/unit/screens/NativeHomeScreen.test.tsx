import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativeHomeScreen } from '../../../src/screens/NativeHomeScreen';
import { homeExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import type { NativeCollectionRow } from '../../../src/features/collection/collectionModel';

const renderHome = (props = baseProps) => render(
  <SafeAreaProvider initialMetrics={{
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  }}>
    <NativeHomeScreen {...props} />
  </SafeAreaProvider>,
);

const baseProps = {
  assetBaseUrl: 'https://pokegonexus.com',
  collection: {
    caught: 20,
    favorites: 3,
    forTrade: 4,
    wanted: 7,
    mostWanted: 2,
  },
  error: null as string | null,
  friendsState: 'ready' as const,
  incomingFriends: 0,
  isCollectionLoading: false,
  isRecentLoading: false,
  onDismissActionMenuHint: jest.fn(),
  onDismissOnboarding: jest.fn(),
  onNavigate: jest.fn(),
  onRetry: jest.fn(),
  onboardingProgress: null as import('../../../src/features/home/nativeHomeDashboardModel').NativeHomeOnboardingProgress | null,
  pokemonGoName: 'MistyGO',
  recentRows: [] as NativeCollectionRow[],
  showActionMenuHint: true,
  trades: {
    needsResponse: 0,
    readyToConfirm: 0,
    waiting: 0,
    completed: 8,
    active: 0,
  },
  username: 'misty',
};

const recentRow: NativeCollectionRow = {
  id: 'caught-bulbasaur',
  pokemonId: 1,
  pokedexNumber: 1,
  name: 'Bulbasaur',
  imageUri: 'https://pokegonexus.com/images/default/pokemon_1.png',
  locationBackgroundUri: null,
  maxKind: null,
  purified: false,
  lucky: false,
  typeIconUris: [],
  status: 'caught',
  source: 'instance',
  cp: 500,
  favorite: false,
  mostWanted: false,
};

describe('NativeHomeScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('matches the canonical dashboard hierarchy and routes each primary action', () => {
    renderHome();

    expect(screen.getByText('Welcome back,\nMistyGO')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('You’re all caught up')).toBeTruthy();

    fireEvent.press(screen.getByRole('link', { name: 'Find Pokémon' }));
    fireEvent.press(screen.getByRole('link', { name: 'Open collection' }));
    fireEvent.press(screen.getByRole('link', { name: 'Trade activity' }));

    expect(baseProps.onNavigate).toHaveBeenNthCalledWith(1, '/search');
    expect(baseProps.onNavigate).toHaveBeenNthCalledWith(2, '/pokemon');
    expect(baseProps.onNavigate).toHaveBeenNthCalledWith(3, '/trades?section=activity');
  });

  it('keeps the quick-navigation education dismissible', () => {
    renderHome();

    expect(screen.getByText('Tap the Poké Ball below for quick navigation.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Dismiss action menu tip' }));
    expect(baseProps.onDismissActionMenuHint).toHaveBeenCalledTimes(1);
  });

  it('preserves every collection summary filter in its canonical Pokémon link', () => {
    const onNavigate = jest.fn();
    renderHome({ ...baseProps, onNavigate });

    fireEvent.press(screen.getByRole('link', { name: /Caught/ }));
    fireEvent.press(screen.getByRole('link', { name: /Favorites/ }));
    fireEvent.press(screen.getByRole('link', { name: /For Trade/ }));
    fireEvent.press(screen.getByRole('link', { name: /Wanted/ }));

    expect(onNavigate.mock.calls).toEqual(
      Object.values(homeExperienceParityContract.collectionSummaryPaths).map((path) => [path]),
    );
  });

  it('opens recent Pokémon through the same collection link as Vite', () => {
    const onNavigate = jest.fn();
    renderHome({ ...baseProps, onNavigate, recentRows: [recentRow] });

    fireEvent.press(screen.getByRole('link', {
      name: 'Open Bulbasaur in your Pokémon collection',
    }));

    expect(onNavigate).toHaveBeenCalledWith(homeExperienceParityContract.recentPokemonPath);
  });

  it('puts a combined dashboard failure next to a retry action', () => {
    const onRetry = jest.fn();
    renderHome({ ...baseProps, error: 'Service unavailable', onRetry });

    expect(screen.getByText('Service unavailable')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses the same collection and recent loading surfaces as Vite', () => {
    renderHome({
      ...baseProps,
      isCollectionLoading: true,
      isRecentLoading: true,
    });

    expect(screen.getByText('Loading your collection…')).toBeTruthy();
    expect(screen.getByText('Loading recent Pokémon…')).toBeTruthy();
    expect(screen.queryByText('20')).toBeNull();
    expect(screen.queryByText('Start your collection')).toBeNull();
  });

  it('routes every Vite signed-in Home destination from a native link', () => {
    const onNavigate = jest.fn();
    renderHome({ ...baseProps, onNavigate, recentRows: [recentRow] });

    screen.getAllByRole('link').forEach((link) => fireEvent.press(link));
    const destinations = new Set(onNavigate.mock.calls.map(([path]) => path));
    expect(destinations).toEqual(new Set([
      '/', '/help', '/max', '/pokedex', '/pokemon', '/pokemon?filter=caught',
      '/pokemon?filter=favorites', '/pokemon?filter=trade', '/pokemon?filter=wanted',
      '/profile', '/profile/friends', '/pvp', '/raid', '/search', '/trade-board',
      '/trades?section=activity', '/trades?section=preferences',
    ]));
  });

  it('replaces the dashboard with the canonical milestone onboarding until dismissed', () => {
    const onDismissOnboarding = jest.fn();
    const onNavigate = jest.fn();
    renderHome({
      ...baseProps,
      onDismissOnboarding,
      onNavigate,
      onboardingProgress: {
        completed: 1,
        total: 4,
        tasks: [
          { id: 'collection', title: 'Add your first Pokémon', description: 'Begin.', action: 'Open Pokémon', to: '/pokemon', complete: true },
          { id: 'wanted', title: 'Create a Wanted listing', description: 'Choose details.', action: 'Open wishlist', to: '/pokemon?filter=wanted', complete: false },
          { id: 'trade', title: 'List a Pokémon For Trade', description: 'Choose an offer.', action: 'Open collection', to: '/pokemon?filter=trade', complete: false },
          { id: 'connect', title: 'Make your first connection', description: 'Find trainers.', action: 'Find trainers', to: '/search', complete: false },
        ],
      },
    });

    expect(screen.getByText('Let’s make your account useful.')).toBeTruthy();
    expect(screen.queryByText('You’re all caught up')).toBeNull();
    fireEvent.press(screen.getByRole('link', { name: 'Open wishlist' }));
    fireEvent.press(screen.getByRole('button', { name: 'Open trainer dashboard' }));
    expect(onNavigate).toHaveBeenCalledWith('/pokemon?filter=wanted');
    expect(onDismissOnboarding).toHaveBeenCalledTimes(1);
  });
});
