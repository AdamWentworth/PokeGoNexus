import { pokedexCatalog } from '../../helpers/pokedexCatalog';
import { buildNativePokedexEntries } from '../../../src/features/tools/nativePokedexModel';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativePokedexDetailScreen } from '../../../src/screens/NativePokedexDetailScreen';

jest.mock('../../../src/observability/nativeUiInteractionTiming', () => ({
  markNativeUiPerformanceAfterPaint: jest.fn(),
}));

const baseEntry = {
  id: '0001-default', pokemonId: 1, pokedexNumber: 1, name: 'Bulbasaur',
  imageUri: '/bulbasaur.png', typeIconUris: ['/images/types/grass.png', '/images/types/poison.png'], maxKind: null,
  category: 'pokemon' as const, generation: 1, instanceRegistered: false,
  manualRegistrationIds: [], registered: false, registeredFacets: [], released: true, registeredSpecies: false,
};
const entry = {
  id: '0001-shiny', pokemonId: 1, pokedexNumber: 1, name: 'Shiny Bulbasaur',
  imageUri: '/bulbasaur.png', typeIconUris: ['/images/types/grass.png', '/images/types/poison.png'], maxKind: null,
  category: 'shiny' as const, generation: 1, instanceRegistered: false,
  manualRegistrationIds: [], registered: false, registeredFacets: [], released: true, registeredSpecies: false,
};
const pokemon = {
  pokemon_id: 1, name: 'Bulbasaur', pokedex_number: 1, generation: 1,
  rarity: 'Starter', attack: 118, defense: 111, stamina: 128, cp40: 1115, cp50: 1260,
  shiny_available: 1, date_available: '2016-07-06', date_shiny_available: '2018-03-25',
  moves: [
    { move_id: 1, name: 'Vine Whip', is_fast: 1, type_name: 'Grass', pvp_power: 5, raid_power: 7, legacy: false },
    { move_id: 2, name: 'Sludge Bomb', is_fast: 0, type_name: 'Poison', pvp_power: 80, raid_power: 80, legacy: false },
  ],
  sizes: {
    pokedex_height: 0.7, pokedex_weight: 6.9,
    height_xxs_threshold: 0.45, height_xs_threshold: 0.6, height_xl_threshold: 0.85, height_xxl_threshold: 1.05,
    weight_xxs_threshold: 4, weight_xs_threshold: 5.5, weight_xl_threshold: 8, weight_xxl_threshold: 10,
  },
  costumes: [], megaEvolutions: [], max: [], evolves_from: [], evolves_to: [2],
} as never;

describe('NativePokedexDetailScreen', () => {
  it('preserves registered, info, battle, and exact-combination workflows', () => {
    const onToggleRegistration = jest.fn();
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}><NativePokedexDetailScreen allEntries={[baseEntry, entry]} allPokemon={[pokemon]} assetBaseUrl="https://pokegonexus.com" entry={entry} onBack={jest.fn()} onOpenEntry={jest.fn()} onSetRegistrations={jest.fn()} onToggleRegistration={onToggleRegistration} pokemon={pokemon} /></SafeAreaProvider>);

    expect(screen.getByText('Register all')).toBeTruthy();
    expect(screen.getByText('Unregister all')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Register Shiny'));
    expect(onToggleRegistration).toHaveBeenCalledWith(expect.objectContaining({ entryId: '0001-shiny', registrationId: '0001-shiny' }), true);

    fireEvent.press(screen.getByText('Info'));
    expect(screen.getByText('1,115')).toBeTruthy();
    fireEvent.press(screen.getByText('Battle'));
    expect(screen.getByText('Vine Whip')).toBeTruthy();
    expect(screen.getByText('Sludge Bomb')).toBeTruthy();
    fireEvent.press(screen.getByText('More'));
    expect(screen.getByText('Variant combinations')).toBeTruthy();
    expect(screen.queryByLabelText('Search combinations')).toBeNull();
    fireEvent.press(screen.getByLabelText('Open combination group Pokemon'));
    expect(screen.getByText('Showing 60 of 60')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Filter Lucky'));
    expect(screen.getByText('Showing 30 of 60')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Register Lucky'));
    expect(onToggleRegistration).toHaveBeenLastCalledWith(expect.objectContaining({ registrationId: '0001-default|lucky:true' }), true);
  });

  it('does not let a manual toggle remove a quality proved by a caught instance', () => {
    const onToggleRegistration = jest.fn();
    const collectedEntry = { ...entry, instanceRegistered: true, registered: true, registeredFacets: [{ lucky: true as const }] };
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}><NativePokedexDetailScreen allEntries={[baseEntry, collectedEntry]} allPokemon={[pokemon]} assetBaseUrl="https://pokegonexus.com" entry={collectedEntry} onBack={jest.fn()} onOpenEntry={jest.fn()} onSetRegistrations={jest.fn()} onToggleRegistration={onToggleRegistration} pokemon={pokemon} /></SafeAreaProvider>);

    fireEvent.press(screen.getByText('More'));
    fireEvent.press(screen.getByLabelText('Open combination group Shiny'));
    fireEvent.press(screen.getByLabelText('Filter Lucky'));
    expect(screen.getByText('In collection')).toBeTruthy();
    const lockedCombination = screen.UNSAFE_getAllByProps({ accessibilityLabel: 'Unregister Shiny Lucky' })[0];
    expect(lockedCombination?.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(onToggleRegistration).not.toHaveBeenCalled();
  });

  it('uses the canonical female artwork when the gender selector changes', () => {
    const genderEntry = {
      ...entry,
      femaleImageUri: '/female-shiny-bulbasaur.png',
      supportedGenders: ['Male', 'Female'] as ('Male' | 'Female')[],
    };
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}><NativePokedexDetailScreen allEntries={[baseEntry, genderEntry]} allPokemon={[pokemon]} assetBaseUrl="https://pokegonexus.com" entry={genderEntry} onBack={jest.fn()} onOpenEntry={jest.fn()} onSetRegistrations={jest.fn()} onToggleRegistration={jest.fn()} pokemon={pokemon} /></SafeAreaProvider>);

    fireEvent.press(screen.getByLabelText('View Shiny'));
    expect(screen.getByText('#0001 Bulbasaur')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Show Female Bulbasaur'));
    expect(screen.getByTestId('native-pokedex-detail-hero-image').props.source).toEqual({
      uri: 'https://pokegonexus.com/female-shiny-bulbasaur.png',
    });
  });

  it('matches the web detail confirmations, collapsible combination index, and clear action', () => {
    const onSetRegistrations = jest.fn();
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}><NativePokedexDetailScreen allEntries={[baseEntry, entry]} allPokemon={[pokemon]} assetBaseUrl="https://pokegonexus.com" entry={entry} onBack={jest.fn()} onOpenEntry={jest.fn()} onSetRegistrations={onSetRegistrations} onToggleRegistration={jest.fn()} pokemon={pokemon} /></SafeAreaProvider>);

    fireEvent.press(screen.getByText('Register all'));
    expect(screen.getByText('Register all entries?')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Register all')[1]);
    expect(onSetRegistrations).toHaveBeenCalledWith(expect.any(Array), true);

    fireEvent.press(screen.getByText('More'));
    expect(screen.queryByLabelText('Search combinations')).toBeNull();
    fireEvent.press(screen.getByLabelText('Open combination group Pokemon'));
    expect(screen.getByLabelText('Search combinations')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open combination group Pokemon'));
    expect(screen.queryByLabelText('Search combinations')).toBeNull();
    fireEvent.press(screen.getByLabelText('Open combination group Pokemon'));
    fireEvent.press(screen.getByLabelText('Filter Lucky'));
    expect(screen.getByText('Showing 30 of 60')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Search combinations'), 'hundo');
    expect(screen.getByText('Showing 15 of 60')).toBeTruthy();
    fireEvent.press(screen.getByText('Info'));
    fireEvent.press(screen.getByText('More'));
    expect(screen.getByLabelText('Search combinations').props.value).toBe('hundo');
    expect(screen.getByText('Showing 15 of 60')).toBeTruthy();
    fireEvent.press(screen.getByText('Clear'));
    expect(screen.getByText('Showing 60 of 60')).toBeTruthy();
  });

  it('matches the web Info and Battle content model', () => {
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}><NativePokedexDetailScreen allEntries={[baseEntry, entry]} allPokemon={[pokemon]} assetBaseUrl="https://pokegonexus.com" entry={entry} onBack={jest.fn()} onOpenEntry={jest.fn()} onSetRegistrations={jest.fn()} onToggleRegistration={jest.fn()} pokemon={pokemon} /></SafeAreaProvider>);

    fireEvent.press(screen.getByText('Info'));
    expect(screen.getByText('Base stats')).toBeTruthy();
    expect(screen.getByLabelText('Attack 118')).toBeTruthy();
    expect(screen.getByLabelText('Defense 111')).toBeTruthy();
    expect(screen.getByLabelText('Stamina 128')).toBeTruthy();
    expect(screen.getByText('Max CP')).toBeTruthy();
    expect(screen.getByText('Size ranges')).toBeTruthy();
    expect(screen.getByText('See all Bulbasaur')).toBeTruthy();

    fireEvent.press(screen.getByText('Battle'));
    expect(screen.getByText('Type effectiveness')).toBeTruthy();
    expect(screen.getByText('Resistant to')).toBeTruthy();
    expect(screen.getByText('Weak to')).toBeTruthy();
    expect(screen.getByText('Fast attack')).toBeTruthy();
    expect(screen.getByText('Charged attack')).toBeTruthy();
  });
});


test('uses the selected Mega form for stats and types and changes the hero with a combination group', () => {
  const charizard = pokedexCatalog.find(({ pokemon_id }) => pokemon_id === 6)!;
  const entries = buildNativePokedexEntries([charizard]);
  render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}><NativePokedexDetailScreen allEntries={entries} allPokemon={[charizard]} assetBaseUrl="https://pokegonexus.com" entry={entries[0]} onBack={jest.fn()} onOpenEntry={jest.fn()} onSetRegistrations={jest.fn()} onToggleRegistration={jest.fn()} pokemon={charizard} /></SafeAreaProvider>);
  fireEvent.press(screen.getByLabelText('View Mega Charizard X'));
  expect(screen.getByText('#0006 Charizard')).toBeTruthy();
  fireEvent.press(screen.getByText('Info'));
  expect(screen.getByLabelText('Attack 273')).toBeTruthy();
  expect(screen.getByLabelText('Defense 213')).toBeTruthy();
  expect(screen.getByText('4,353')).toBeTruthy();
  fireEvent.press(screen.getByText('Battle'));
  expect(screen.getAllByText('Dragon').length).toBeGreaterThan(0);
  fireEvent.press(screen.getByText('More'));
  fireEvent.press(screen.getByLabelText('Open combination group Shiny'));
  expect(screen.getByTestId('native-pokedex-detail-hero-image').props.source.uri).toContain('shiny');
  fireEvent.press(screen.getByText('Info'));
  expect(screen.getByLabelText('Attack 223')).toBeTruthy();
});
