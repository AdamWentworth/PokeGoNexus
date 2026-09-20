import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type {
  NativeTradePreferenceCandidate,
  NativeTradePreferenceEntry,
} from '../../../src/features/trades/nativeTradePreferencesModel';
import { NativeTradePreferencesScreen } from '../../../src/screens/NativeTradePreferencesScreen';

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

const instance = (
  id: string,
  status: 'trade' | 'wanted',
  pokemonId: number,
): PokemonInstance => ({
  instance_id: id,
  variant_id: `${String(pokemonId).padStart(4, '0')}-shiny`,
  pokemon_id: pokemonId,
  is_caught: status === 'trade',
  is_for_trade: status === 'trade',
  is_wanted: status === 'wanted',
  disabled: false,
  shiny: true,
} as PokemonInstance);

const candidate = ({
  id,
  name,
  pokemonId,
  status,
  allowed = true,
  manuallyExcluded = false,
}: {
  id: string;
  name: string;
  pokemonId: number;
  status: 'trade' | 'wanted';
  allowed?: boolean;
  manuallyExcluded?: boolean;
}): NativeTradePreferenceCandidate => ({
  collectionKey: id,
  instance: instance(id, status, pokemonId),
  row: {
    id,
    pokemonId,
    pokedexNumber: pokemonId,
    name,
    imageUri: `https://pokegonexus.com/${id}.png`,
    locationBackgroundUri: null,
    maxKind: null,
    purified: false,
    lucky: false,
    typeIconUris: [],
    status,
    source: 'instance',
    cp: null,
    favorite: false,
    mostWanted: false,
  },
  allowed,
  excludedByRule: false,
  manuallyExcluded,
  traits: { variantType: 'shiny' },
});

const entry = ({
  id,
  mode,
  name,
  pokemonId,
  candidates,
  filters = {},
}: {
  id: string;
  mode: 'trade' | 'wanted';
  name: string;
  pokemonId: number;
  candidates: NativeTradePreferenceCandidate[];
  filters?: NativeTradePreferenceEntry['filters'];
}): NativeTradePreferenceEntry => ({
  activeRuleCount: Object.values(filters).filter(Boolean).length,
  allowedCount: candidates.filter((item) => item.allowed).length,
  candidates,
  collectionKey: id,
  filters,
  instance: instance(id, mode, pokemonId),
  mirror: false,
  mode,
  row: {
    id,
    pokemonId,
    pokedexNumber: pokemonId,
    name,
    imageUri: `https://pokegonexus.com/${id}.png`,
    locationBackgroundUri: null,
    maxKind: null,
    purified: false,
    lucky: false,
    typeIconUris: [],
    status: mode,
    source: 'instance',
    cp: null,
    favorite: false,
    mostWanted: false,
  },
});

const tradeEntry = entry({
  id: 'trade-bulbasaur',
  mode: 'trade',
  name: 'Shiny Bulbasaur',
  pokemonId: 1,
  candidates: [
    candidate({ id: 'wanted-charizard', name: 'Shiny Charizard', pokemonId: 6, status: 'wanted' }),
    candidate({
      id: 'wanted-mewtwo',
      name: 'Shiny Mewtwo',
      pokemonId: 150,
      status: 'wanted',
      allowed: false,
      manuallyExcluded: true,
    }),
  ],
});

const wantedEntry = entry({
  id: 'wanted-venusaur',
  mode: 'wanted',
  name: 'Shiny Venusaur',
  pokemonId: 3,
  candidates: [
    candidate({ id: 'trade-charizard', name: 'Gigantamax Charizard', pokemonId: 6, status: 'trade' }),
  ],
});

const secondTradeEntry = entry({
  id: 'trade-pikachu',
  mode: 'trade',
  name: 'Shiny Pikachu',
  pokemonId: 25,
  candidates: [
    candidate({ id: 'wanted-rayquaza', name: 'Shiny Rayquaza', pokemonId: 384, status: 'wanted' }),
  ],
});

const renderScreen = (onSave = jest.fn().mockResolvedValue(undefined)) => render(
  <NativeTradePreferencesScreen
    assetBaseUrl="https://pokegonexus.com"
    entries={{ trade: [tradeEntry], wanted: [wantedEntry] }}
    onOpenActivity={jest.fn()}
    onSave={onSave}
  />,
);

describe('NativeTradePreferencesScreen', () => {
  beforeEach(() => {
    mockUseWindowDimensions.mockReturnValue({
      width: 412,
      height: 915,
      scale: 2.625,
      fontScale: 1,
    });
  });

  it('starts with the canonical For Trade editor and hides disallowed targets outside edit mode', () => {
    const { getAllByText, getByLabelText, getByRole, getByText, queryByText } = renderScreen();

    expect(getAllByText('Trade Preferences')).toHaveLength(2);
    expect(getByText('WANTED POKÉMON')).toBeTruthy();
    expect(getByText('Shiny Charizard')).toBeTruthy();
    expect(queryByText('Shiny Mewtwo')).toBeNull();
    expect(getByText('1 wanted · no advanced rules')).toBeTruthy();
    expect(getByLabelText('Search preference Pokémon')).toBeTruthy();
    expect(getByRole('button', { name: '↶ Reset' }).props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it('hydrates saved rules and exclusions when live collection data arrives after mount', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const screen = render(
      <NativeTradePreferencesScreen
        assetBaseUrl="https://pokegonexus.com"
        entries={{ trade: [], wanted: [] }}
        isLoading
        onOpenActivity={jest.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getByText('Loading trade preferences')).toBeTruthy();
    screen.rerender(
      <NativeTradePreferencesScreen
        assetBaseUrl="https://pokegonexus.com"
        entries={{ trade: [tradeEntry], wanted: [wantedEntry] }}
        onOpenActivity={jest.fn()}
        onSave={onSave}
      />,
    );

    await waitFor(() => expect(screen.getByText('Shiny Charizard')).toBeTruthy());
    expect(screen.queryByText('Shiny Mewtwo')).toBeNull();
    expect(screen.getByText('1 wanted · no advanced rules')).toBeTruthy();
  });

  it('opens the listing requested by contextual route navigation', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const screen = render(
      <NativeTradePreferencesScreen
        assetBaseUrl="https://pokegonexus.com"
        entries={{ trade: [tradeEntry, secondTradeEntry], wanted: [wantedEntry] }}
        initialEntryId="trade-pikachu"
        initialMode="trade"
        onOpenActivity={jest.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getByText('Shiny Rayquaza')).toBeTruthy();
    expect(screen.getByText('Shiny Pikachu')).toBeTruthy();
    expect(screen.queryByText('Shiny Charizard')).toBeNull();
  });

  it('switches to Wanted semantics without reusing For Trade copy', () => {
    const { getByText, queryByText } = renderScreen();

    fireEvent.press(getByText(/^Wanted \(/));
    expect(getByText(/^For Trade Pokémon$/i)).toBeTruthy();
    expect(getByText('Gigantamax Charizard')).toBeTruthy();
    expect(getByText('1 available · no advanced rules')).toBeTruthy();
    expect(queryByText(/^Wanted Pokémon$/i)).toBeNull();
  });

  it('uses a full-screen mobile listing picker', () => {
    const { getAllByText, getByText } = renderScreen();

    fireEvent.press(getAllByText('Shiny Bulbasaur')[0]);
    expect(getByText('SELECT A LISTING')).toBeTruthy();
    expect(getByText(/^For Trade Pokémon$/i)).toBeTruthy();
  });

  it('edits manual candidate access and saves the complete draft', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByTestId, getByText } = renderScreen(onSave);

    fireEvent.press(getByText('Edit preferences'));
    expect(getByText('Shiny Mewtwo')).toBeTruthy();
    fireEvent.press(getByTestId('preference-candidate-wanted-mewtwo'));
    fireEvent.press(getByText('Save changes'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      tradeEntry,
      expect.objectContaining({ manuallyExcludedIds: [], mirror: false }),
    ));
    expect(getByText('Preferences saved.')).toBeTruthy();
  });

  it('keeps the mobile edit action on-screen after saving with advanced rules expanded', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByTestId, getByText } = renderScreen(onSave);

    fireEvent.press(getByText('No additional rules'));
    fireEvent.press(getByText('Edit preferences'));
    fireEvent.press(getByTestId('preference-candidate-wanted-charizard'));
    fireEvent.press(getByText('Save changes'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const editStyle = StyleSheet.flatten(getByTestId('trade-preferences-edit').props.style);
    expect(editStyle.width).toBe('100%');
    expect(editStyle.maxWidth).toBe('100%');
  });

  it('keeps advanced rules read-only until edit mode and includes the mirror rule', () => {
    const { getByText } = renderScreen();

    fireEvent.press(getByText('No additional rules'));
    expect(getByText('Mirror trade')).toBeTruthy();
    expect(getByText('Must match')).toBeTruthy();
    expect(getByText('Leave out')).toBeTruthy();
    fireEvent.press(getByText('Edit preferences'));
    fireEvent.press(getByText('Mirror trade'));
    expect(getByText('Mirror trade enabled')).toBeTruthy();
  });

  it('protects a dirty draft before changing preference modes', () => {
    const { getByTestId, getByText } = renderScreen();

    fireEvent.press(getByText('Edit preferences'));
    fireEvent.press(getByTestId('preference-candidate-wanted-charizard'));
    fireEvent.press(getByText(/^Wanted \(/));
    expect(getByText('Discard your changes?')).toBeTruthy();
    expect(getByText('Keep editing')).toBeTruthy();
  });

  it('keeps a failed save visible and remains in edit mode', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('Receiver is unavailable.'));
    const { getByText } = renderScreen(onSave);

    fireEvent.press(getByText('Edit preferences'));
    fireEvent.press(getByText('Save changes'));
    await waitFor(() => expect(getByText('Receiver is unavailable.')).toBeTruthy());
    expect(getByText('Save changes')).toBeTruthy();
  });
});
