import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import { fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { NativePokemonSearchScreen } from '../../../src/screens/NativePokemonSearchScreen';
import { createNativePokemonSearchDraft } from '../../../src/features/search/nativePokemonSearchDraft';
import type { NativePokemonSearchResult } from '../../../src/features/search/pokemonSearchModel';

jest.mock('@maplibre/maplibre-react-native', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    Camera: () => null,
    Map: ({ children, ...props }: React.ComponentProps<typeof View>) => React.createElement(View, props, children),
    Marker: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
  };
});

jest.mock('../../../src/services/locationApi', () => ({
  getNativeLocationSuggestions: jest.fn().mockResolvedValue([]),
}));

const pokemon = {
  pokemon_id: 25,
  pokedex_number: 25,
  name: 'Pikachu',
  form: null,
  image_url: 'https://assets/pikachu.png',
  image_url_shiny: 'https://assets/shiny-pikachu.png',
  image_url_shadow: '',
  image_url_shiny_shadow: '',
  type_1_icon: '',
  type_2_icon: '',
  costumes: [],
  backgrounds: [],
  moves: [],
  fusion: [],
  megaEvolutions: [],
  evolves_from: [],
  max: [],
} as unknown as BasePokemon;

const row = (id: string, name: string, status: 'trade' | 'wanted') => ({
  id,
  pokemonId: 25,
  pokedexNumber: 25,
  name,
  imageUri: 'https://assets/pikachu.png',
  locationBackgroundUri: null,
  maxKind: null,
  purified: false,
  lucky: false,
  typeIconUris: [],
  status,
  source: 'instance' as const,
  cp: null,
  favorite: false,
  mostWanted: false,
});

const result: NativePokemonSearchResult = {
  id: 'listing-1',
  username: 'OtherTrainer',
  distanceKm: 1.2,
  mode: 'trade',
  row: row('listing-1', 'Shiny Detective Pikachu', 'trade'),
  details: {
    gender: 'Female',
    weight: 6,
    height: 0.4,
    moves: ['Thunder Shock', 'Wild Charge'],
    attackIv: 15,
    defenseIv: 14,
    staminaIv: 13,
    locationCaught: 'Burnaby, British Columbia, Canada',
    dateCaught: '2026-08-26',
    friendshipLevel: null,
    prefLucky: false,
    wantedSizeLabels: [],
  },
  relatedRows: [{ ...row('wanted-1', 'Gigantamax Charizard', 'wanted'), match: true }],
  hasMutualMatch: true,
  mapCoordinate: [-122.98, 49.24],
  mapCoordinateIsApproximate: false,
};

const draft = {
  ...createNativePokemonSearchDraft({
    city: 'Burnaby, British Columbia, Canada',
    latitude: 49.24,
    longitude: -122.98,
  }),
  pokemonId: 25,
  pokemonName: 'Pikachu',
  ownership: 'trade' as const,
  shiny: true,
};

const baseProps = {
  assetBaseUrl: 'https://pokegonexus.com',
  catalog: [pokemon],
  draft,
  onDraftChange: jest.fn(),
  onOpenListing: jest.fn(),
  onOpenProfile: jest.fn(),
  onSearch: jest.fn(),
  results: [] as NativePokemonSearchResult[],
};

describe('NativePokemonSearchScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('runs a valid search immediately and publishes the exact canonical query', () => {
    const view = render(<NativePokemonSearchScreen {...baseProps} />);
    fireEvent.press(view.getByRole('button', { name: 'Search' }));
    expect(baseProps.onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        pokemon_id: 25,
        ownership: 'trade',
        latitude: 49.24,
        longitude: -122.98,
      }),
      draft,
    );
  });

  it('keeps validation feedback inside the relevant filter stage', () => {
    const invalidDraft = { ...draft, latitude: null, longitude: null };
    const view = render(<NativePokemonSearchScreen {...baseProps} draft={invalidDraft} />);
    fireEvent.press(view.getByRole('button', { name: 'Search' }));
    expect(view.getByTestId('native-pokemon-search-filter-sheet').props.edges).toMatchObject({
      bottom: 'additive',
      top: 'additive',
    });
    expect(view.getByText('Choose a location before searching.')).toBeTruthy();
    expect(view.getByText('Where should we look?')).toBeTruthy();
    expect(baseProps.onSearch).not.toHaveBeenCalled();
  });

  it('keeps Pokémon selection in the canonical primary search surface', () => {
    const view = render(<NativePokemonSearchScreen {...baseProps} />);
    fireEvent.press(view.getByRole('button', { name: 'Choose Pokémon' }));
    expect(view.getByTestId('native-option-picker').props.edges).toMatchObject({
      bottom: 'additive',
      top: 'additive',
    });
    expect(view.getByLabelText('Search Choose a Pokémon')).toBeTruthy();
    expect(view.getByText('#0025')).toBeTruthy();
  });

  it('commits a Pokémon selection from the searchable picker', () => {
    const onDraftChange = jest.fn();
    const unselectedDraft = { ...draft, pokemonId: null, pokemonName: '', form: null };
    const view = render(
      <NativePokemonSearchScreen
        {...baseProps}
        draft={unselectedDraft}
        onDraftChange={onDraftChange}
      />,
    );

    fireEvent.press(view.getByRole('button', { name: 'Choose Pokémon' }));
    fireEvent.changeText(view.getByLabelText('Search Choose a Pokémon'), 'Pika');
    fireEvent.press(view.getByRole('radio', { name: 'Select Pikachu' }));

    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      pokemonId: 25,
      pokemonName: 'Pikachu',
      form: null,
    }));
    expect(view.queryByTestId('native-option-picker')).toBeNull();
  });

  it('returns a submitted search to the complete primary controls before editing', () => {
    const view = render(
      <NativePokemonSearchScreen {...baseProps} hasSearched results={[result]} />,
    );
    expect(view.getByText('CURRENT SEARCH')).toBeTruthy();
    fireEvent.press(view.getByText(/Modify/));
    expect(view.getByText('LOOKING FOR')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Choose Pokémon' })).toBeTruthy();
  });

  it('matches Vite reset semantics without silently restoring the profile location', () => {
    const onDraftChange = jest.fn();
    const view = render(
      <NativePokemonSearchScreen
        {...baseProps}
        onDraftChange={onDraftChange}
        savedLocation={{ label: 'Burnaby', latitude: 49.24, longitude: -122.98 }}
      />,
    );

    fireEvent.press(view.getByRole('button', { name: 'Filters' }));
    fireEvent.press(view.getByRole('button', { name: 'Reset filters' }));

    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      city: '',
      latitude: null,
      longitude: null,
      ownership: 'caught',
      pokemonId: 25,
      pokemonName: 'Pikachu',
      shiny: false,
      useCurrentLocation: false,
    }));
  });

  it('renders reciprocal listings and preserves both explicit destinations', () => {
    const onOpenListing = jest.fn();
    const onOpenProfile = jest.fn();
    const view = render(
      <NativePokemonSearchScreen
        {...baseProps}
        hasSearched
        onOpenListing={onOpenListing}
        onOpenProfile={onOpenProfile}
        results={[result]}
      />,
    );
    expect(view.getByText('MUTUAL MATCH')).toBeTruthy();
    expect(view.getByText('Gigantamax Charizard')).toBeTruthy();
    expect(view.getByText('♀')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Listing details' }));
    expect(view.getByText('Thunder Shock · Wild Charge')).toBeTruthy();
    expect(view.getAllByText(/Burnaby, British Columbia, Canada/).length).toBeGreaterThan(0);
    fireEvent.press(view.getByText('View trainer'));
    fireEvent.press(view.getByText('Open listing  →'));
    expect(onOpenProfile).toHaveBeenCalledWith('OtherTrainer');
    expect(onOpenListing).toHaveBeenCalledWith(result);
  });

  it('switches between list and native map results without losing actions', () => {
    const onDisplayModeChange = jest.fn();
    const view = render(
      <NativePokemonSearchScreen
        {...baseProps}
        hasSearched
        onDisplayModeChange={onDisplayModeChange}
        results={[result]}
      />,
    );
    fireEvent.press(view.getByRole('tab', { name: /Map/ }));
    expect(onDisplayModeChange).toHaveBeenCalledWith('map');
    expect(view.getByTestId('native-search-map')).toBeTruthy();
    expect(view.getByText('1 on map')).toBeTruthy();
  });

  it('places loading and errors before any result cards', () => {
    const view = render(<NativePokemonSearchScreen {...baseProps} isLoading />);
    expect(view.getByText('Searching community listings')).toBeTruthy();
    view.rerender(<NativePokemonSearchScreen {...baseProps} error="Search service unavailable." />);
    expect(view.getByText('Search couldn’t be completed')).toBeTruthy();
    expect(view.getByText('Search service unavailable.')).toBeTruthy();
  });

  it('announces successful searches without adding a redundant visual banner', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const view = render(
      <NativePokemonSearchScreen
        {...baseProps}
        hasSearched
        notice="Search complete. 1 listing found."
        results={[result]}
      />,
    );

    expect(announce).toHaveBeenCalledWith('Search complete. 1 listing found.');
    expect(view.queryByText('Search complete. 1 listing found.')).toBeNull();
    expect(view.getByText(/SEARCH COMPLETE/)).toBeTruthy();

    announce.mockRestore();
  });
});
