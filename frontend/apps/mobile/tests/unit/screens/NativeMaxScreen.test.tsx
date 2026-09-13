import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { webCssVarTokens } from '@pokemongonexus/shared-ui-tokens';
import { Animated, Easing } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon, Move } from '@pokemongonexus/shared-contracts/pokemon';
import { NativeMaxScreen } from '../../../src/screens/NativeMaxScreen';
const fast = { move_id: 1, name: 'Vine Whip', raid_power: 10, raid_energy: 8, raid_cooldown: 1, is_fast: 1, type_name: 'grass', type: 'grass' } as Move;
const charged = { ...fast, move_id: 2, name: 'Power Whip', raid_power: 90, raid_energy: -50, raid_cooldown: 2.5, is_fast: 0 } as Move;
const catalog = [
  { pokemon_id: 1, name: 'Bulbasaur', pokedex_number: 1, attack: 118, defense: 111, stamina: 128, available: 1, cp40: 1000, cp50: 1200, type1_name: 'grass', type2_name: 'poison', image_url: '/1.png', moves: [fast, charged], max: [{ pokemon_id: 1, dynamax: 1, gigantamax: 0, dynamax_release_date: null, gigantamax_release_date: null }] },
  { pokemon_id: 2, name: 'Ivysaur', pokedex_number: 2, attack: 151, defense: 143, stamina: 155, available: 1, cp40: 1700, cp50: 1900, type1_name: 'grass', type2_name: 'poison', image_url: '/2.png', moves: [fast, charged], max: [{ pokemon_id: 2, dynamax: 1, gigantamax: 0, dynamax_release_date: null, gigantamax_release_date: null }] },
] as BasePokemon[];
const owned = {
  instance_id: 'leafy',
  variant_id: '0001-default',
  pokemon_id: 1,
  nickname: 'Leafy',
  cp: 987,
  level: 37,
  attack_iv: 12,
  defense_iv: 13,
  stamina_iv: 14,
  fast_move_id: 1,
  charged_move1_id: 2,
  is_caught: true,
  dynamax: true,
  max_attack: 2,
  max_guard: 1,
  max_spirit: 3,
  disabled: false,
} as PokemonInstance;
describe('NativeMaxScreen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('switches roles and exposes the canonical boss simulator', () => {
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}><NativeMaxScreen assetBaseUrl="https://pokegonexus.com" catalog={catalog} onBack={jest.fn()} onOpenPokemon={jest.fn()} onRetry={jest.fn()} signedIn={false} /></SafeAreaProvider>);
    expect(screen.getByText('Max Battles')).toBeTruthy();
    fireEvent.press(screen.getByText('Tank'));
    expect(screen.getByText('Top tanks')).toBeTruthy();
    fireEvent.press(screen.getByText('Boss teams'));
    expect(screen.getByText('Can this group beat Dynamax Bulbasaur?')).toBeTruthy();
    expect(screen.getByText('More help needed')).toBeTruthy();
  });

  it('slides the shared view indicator before swapping the Max workspace', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}><NativeMaxScreen assetBaseUrl="https://pokegonexus.com" catalog={catalog} onBack={jest.fn()} onOpenPokemon={jest.fn()} onRetry={jest.fn()} signedIn={false} /></SafeAreaProvider>);
    timing.mockClear();

    fireEvent(
      screen.getByTestId('native-max-view-switcher'),
      'layout',
      { nativeEvent: { layout: { height: 56, width: 374, x: 0, y: 0 } } },
    );
    fireEvent.press(screen.getByText('Boss teams'));

    expect(screen.getByTestId('native-max-view-indicator', {
      includeHiddenElements: true,
    })).toBeTruthy();
    expect(timing).toHaveBeenCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({
        duration: webCssVarTokens.motionSeconds.fast * 1000,
        easing: Easing.ease,
        isInteraction: false,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    expect(screen.getByText('Can this group beat Dynamax Bulbasaur?')).toBeTruthy();
    timing.mockRestore();
  });

  it('renders the complete recorded copy and canonical Max-role metrics', () => {
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativeMaxScreen
          assetBaseUrl="https://pokegonexus.com"
          catalog={catalog}
          instances={{ leafy: owned }}
          onBack={jest.fn()}
          onOpenPokemon={jest.fn()}
          onRetry={jest.fn()}
          signedIn
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByRole('button', { name: 'MY POKÉMON 1' }).props.accessibilityHint).toBe('1 Max-ready entries from 1 caught Max Pokémon. Uses each copy\'s recorded level, IVs, Fast Move, and Max Move levels.');
    expect(screen.queryByText(/Max-ready entries from/)).toBeNull();
    expect(screen.getByText('Leafy')).toBeTruthy();
    expect(screen.getByText('CP 987 · Level 37 · 87% IV')).toBeTruthy();
    expect(screen.getByText('Max Move · Grass')).toBeTruthy();
    expect(screen.getByText('Attack index')).toBeTruthy();
    expect(screen.getByText('Max power')).toBeTruthy();
  });

  it('matches Vite by rendering 18 rankings initially and paging the remainder', () => {
    const manyCatalog = Array.from({ length: 19 }, (_, index) => {
      const pokemonId = index + 1;
      return {
        ...catalog[0],
        image_url: `/${pokemonId}.png`,
        max: [{
          pokemon_id: pokemonId,
          dynamax: 1,
          gigantamax: 0,
          dynamax_release_date: null,
          gigantamax_release_date: null,
        }],
        name: `Maxmon ${pokemonId}`,
        pokedex_number: pokemonId,
        pokemon_id: pokemonId,
      };
    }) as BasePokemon[];
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativeMaxScreen
          assetBaseUrl="https://pokegonexus.com"
          catalog={manyCatalog}
          onBack={jest.fn()}
          onOpenPokemon={jest.fn()}
          onRetry={jest.fn()}
          signedIn={false}
        />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByLabelText('Show 1 more Max rankings'));
    expect(screen.queryByLabelText('Show 1 more Max rankings')).toBeNull();
  });

  it('matches Vite boss search, ranking filters, methodology, and shareable route state', () => {
    const onRouteStateChange = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativeMaxScreen
          assetBaseUrl="https://pokegonexus.com"
          catalog={catalog}
          onBack={jest.fn()}
          onOpenPokemon={jest.fn()}
          onRetry={jest.fn()}
          onRouteStateChange={onRouteStateChange}
          signedIn={false}
        />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByText('Tank'));
    expect(screen.getByText('Top tanks')).toBeTruthy();
    expect(onRouteStateChange).toHaveBeenCalledWith({ role: 'tank' });
    fireEvent.press(screen.getByLabelText('grass'));
    expect(screen.getByText('Top tanks vs Grass')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Search Max rankings'), 'Ivy');
    expect(screen.getByText('Dynamax Ivysaur')).toBeTruthy();

    fireEvent.press(screen.getByText('▸  How Max roles are ranked'));
    expect(screen.getByText(/Damage uses Attack/)).toBeTruthy();
    fireEvent.press(screen.getByText('Boss teams'));
    fireEvent.changeText(screen.getByLabelText('Search Max Battle bosses'), 'Ivy');
    fireEvent.press(screen.getByLabelText('Select Dynamax Ivysaur Max boss'));
    expect(screen.getByText('Can this group beat Dynamax Ivysaur?')).toBeTruthy();
    expect(onRouteStateChange).toHaveBeenCalledWith({
      bossId: '0002-dynamax',
      difficulty: null,
      trainerCount: null,
    });
  });
});
