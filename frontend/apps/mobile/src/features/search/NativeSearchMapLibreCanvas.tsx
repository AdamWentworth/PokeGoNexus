import {
  Camera,
  Map,
  Marker,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { NativePokemonSearchResult } from './pokemonSearchModel';

export type NativeSearchMapLibreCanvasProps = {
  camera: { center: [number, number]; zoom: number };
  light: boolean;
  mappable: NativePokemonSearchResult[];
  onSelect: (id: string) => void;
  selectedId: string | null;
};

const LIGHT_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: { carto: { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'], tileSize: 256, attribution: '© OpenStreetMap contributors © CARTO' } },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
};

const DARK_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: { carto: { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'], tileSize: 256, attribution: '© OpenStreetMap contributors © CARTO' } },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
};

const accentFor = (result: NativePokemonSearchResult): string => (
  result.mode === 'trade' ? '#35c680' : result.mode === 'wanted' ? '#f25f78' : '#2f9cff'
);

export default function NativeSearchMapLibreCanvas({ camera, light, mappable, onSelect, selectedId }: NativeSearchMapLibreCanvasProps) {
  return (
    <View collapsable={false} style={styles.map} testID="native-search-maplibre">
      <Map attribution compass mapStyle={light ? LIGHT_MAP_STYLE : DARK_MAP_STYLE} style={styles.map} touchPitch={false} touchRotate={false}>
        <Camera initialViewState={{ center: camera.center, zoom: camera.zoom }} maxZoom={16} minZoom={2} />
        {mappable.map((result) => {
          const active = result.id === selectedId;
          return (
            <Marker anchor="center" id={result.id} key={result.id} lngLat={result.mapCoordinate!} onPress={() => onSelect(result.id)}>
              <View
                accessible
                accessibilityLabel={`${result.username}, ${result.row.name}${result.mapCoordinateIsApproximate ? ', approximate area' : ''}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.marker, { backgroundColor: accentFor(result) }, result.mapCoordinateIsApproximate && styles.approximateMarker, active && styles.markerActive]}
                testID={`native-search-map-marker-${result.id}`}
              >
                <Text style={styles.markerText}>{result.username.slice(0, 1).toLocaleUpperCase()}</Text>
              </View>
            </Marker>
          );
        })}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  marker: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', borderRadius: 17, shadowColor: '#000', shadowOpacity: .35, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
  approximateMarker: { borderStyle: 'dashed' },
  markerActive: { width: 42, height: 42, borderRadius: 21, borderWidth: 4 },
  markerText: { color: '#041312', fontSize: 13, fontWeight: '900' },
});
