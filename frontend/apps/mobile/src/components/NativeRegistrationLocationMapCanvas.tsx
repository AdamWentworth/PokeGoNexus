import {
  Camera,
  Map,
  Marker,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import type { Coordinates } from '@pokemongonexus/shared-contracts/location';
import { StyleSheet, View } from 'react-native';

type Props = {
  coordinates: Coordinates | null;
  light: boolean;
  onSelectCoordinates: (coordinates: Coordinates) => void;
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

export default function NativeRegistrationLocationMapCanvas({ coordinates, light, onSelectCoordinates }: Props) {
  const center: [number, number] = coordinates
    ? [coordinates.longitude, coordinates.latitude]
    : [0, 20];
  return (
    <View collapsable={false} style={styles.root} testID="native-registration-location-map">
      <Map
        attribution
        compass
        mapStyle={light ? LIGHT_MAP_STYLE : DARK_MAP_STYLE}
        onPress={(event) => {
          const [longitude, latitude] = event.nativeEvent.lngLat;
          onSelectCoordinates({ latitude, longitude });
        }}
        style={styles.root}
        touchPitch={false}
        touchRotate={false}
      >
        <Camera initialViewState={{ center, zoom: coordinates ? 10 : 2 }} maxZoom={16} minZoom={2} />
        {coordinates ? (
          <Marker anchor="center" id="registration-location" lngLat={[coordinates.longitude, coordinates.latitude]}>
            <View style={styles.marker} />
          </Marker>
        ) : null}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  marker: { width: 18, height: 18, borderWidth: 3, borderColor: '#fff', borderRadius: 9, backgroundColor: '#ef3340', elevation: 5 },
});
