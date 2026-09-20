import { fireEvent, render } from '@testing-library/react-native';
import NativeSearchMapLibreCanvas from '../../../../src/features/search/NativeSearchMapLibreCanvas';
import type { NativePokemonSearchResult } from '../../../../src/features/search/pokemonSearchModel';

jest.mock('@maplibre/maplibre-react-native', () => {
  const React = jest.requireActual('react');
  const { Pressable, View } = jest.requireActual('react-native');
  return {
    Camera: () => React.createElement(View, { testID: 'map-camera' }),
    Map: ({ children }: { children: React.ReactNode }) => React.createElement(View, { testID: 'map-canvas' }, children),
    Marker: ({ children, id, onPress }: { children: React.ReactNode; id: string; onPress: () => void }) => React.createElement(Pressable, { accessibilityLabel: `Map marker ${id}`, onPress, testID: `map-marker-${id}` }, children),
  };
});

const result: NativePokemonSearchResult = {
  id: 'listing-1',
  username: 'OtherTrainer',
  distanceKm: 1.2,
  mode: 'trade',
  details: {
    gender: null,
    weight: null,
    height: null,
    moves: [],
    attackIv: null,
    defenseIv: null,
    staminaIv: null,
    locationCaught: null,
    dateCaught: null,
    friendshipLevel: null,
    prefLucky: false,
    wantedSizeLabels: [],
  },
  row: {
    id: 'listing-1',
    pokemonId: 25,
    pokedexNumber: 25,
    name: 'Shiny Pikachu',
    imageUri: 'https://assets.example/pikachu.png',
    locationBackgroundUri: null,
    maxKind: null,
    purified: false,
    lucky: false,
    typeIconUris: [],
    status: 'trade',
    source: 'instance',
    cp: null,
    favorite: false,
    mostWanted: false,
  },
  relatedRows: [],
  hasMutualMatch: false,
  mapCoordinate: [-122.98, 49.24],
  mapCoordinateIsApproximate: true,
};

describe('NativeSearchMapLibreCanvas', () => {
  it('renders the release-build map and preserves marker selection semantics', () => {
    const onSelect = jest.fn();
    const view = render(
      <NativeSearchMapLibreCanvas
        camera={{ center: [-122.98, 49.24], zoom: 11 }}
        light={false}
        mappable={[result]}
        onSelect={onSelect}
        selectedId={result.id}
      />,
    );

    expect(view.getByTestId('native-search-maplibre')).toBeTruthy();
    expect(view.getByTestId('map-canvas')).toBeTruthy();
    expect(view.getByTestId('map-camera')).toBeTruthy();
    const marker = view.getByRole('button', { name: 'OtherTrainer, Shiny Pikachu, approximate area' });
    expect(marker.props.accessibilityState).toEqual({ selected: true });
    expect(view.getByTestId('native-search-map-marker-listing-1')).toBeTruthy();

    fireEvent.press(view.getByTestId('map-marker-listing-1'));
    expect(onSelect).toHaveBeenCalledWith('listing-1');
  });
});
