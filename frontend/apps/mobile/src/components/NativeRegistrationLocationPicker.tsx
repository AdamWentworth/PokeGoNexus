import Constants from 'expo-constants';
import { useState, type ComponentType } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Coordinates, LocationSuggestion } from '@pokemongonexus/shared-contracts/location';
import type NativeRegistrationLocationMapCanvas from './NativeRegistrationLocationMapCanvas';

type MapProps = Parameters<typeof NativeRegistrationLocationMapCanvas>[0];

type PickerProps = {
  coordinates: Coordinates | null;
  light: boolean;
  loading: boolean;
  locations: LocationSuggestion[];
  onClose: () => void;
  onSelectCoordinates: (coordinates: Coordinates) => void;
  onSelectLocation: (location: LocationSuggestion) => void;
  visible: boolean;
};

export const NativeRegistrationLocationPicker = ({
  coordinates,
  light,
  loading,
  locations,
  onClose,
  onSelectCoordinates,
  onSelectLocation,
  visible,
}: PickerProps) => {
  const nativeMapAvailable = Platform.OS !== 'web' && Constants.appOwnership !== 'expo';
  const [MapCanvas] = useState<ComponentType<MapProps> | null>(() => {
    if (!nativeMapAvailable) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return (require('./NativeRegistrationLocationMapCanvas') as { default: ComponentType<MapProps> }).default;
    } catch {
      return null;
    }
  });

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible={visible}>
      <View style={[styles.root, light && styles.rootLight]}>
        <View style={[styles.header, light && styles.headerLight]}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>Choose on map</Text>
            <Text style={[styles.subtitle, light && styles.mutedLight]}>Tap the map, then choose the broad place name to show.</Text>
          </View>
          <Pressable accessibilityLabel="Close location map" accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text style={[styles.closeText, light && styles.textLight]}>×</Text>
          </Pressable>
        </View>
        <View style={styles.map}>
          {MapCanvas ? (
            <MapCanvas coordinates={coordinates} light={light} onSelectCoordinates={onSelectCoordinates} />
          ) : (
            <View style={[styles.fallback, light && styles.fallbackLight]}>
              <Text style={[styles.fallbackTitle, light && styles.textLight]}>Map available in the installed app</Text>
              <Text style={[styles.subtitle, light && styles.mutedLight]}>Type a city or place when using the browser preview.</Text>
            </View>
          )}
        </View>
        {loading ? (
          <View accessibilityLabel="Loading location options" style={[styles.options, light && styles.optionsLight]}>
            <ActivityIndicator color="#2098ff" />
            <Text style={[styles.subtitle, light && styles.mutedLight]}>Loading location options…</Text>
          </View>
        ) : locations.length > 0 ? (
          <ScrollView contentContainerStyle={[styles.options, light && styles.optionsLight]}>
            <Text style={[styles.optionsTitle, light && styles.textLight]}>Select a location:</Text>
            {locations.map((location, index) => (
              <Pressable
                accessibilityRole="button"
                key={`${location.displayName}-${index}`}
                onPress={() => onSelectLocation(location)}
                style={[styles.option, light && styles.optionLight]}
              >
                <Text style={[styles.optionText, light && styles.textLight]}>{location.displayName}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={[styles.hint, light && styles.mutedLight]}>Tap on the map to set coordinates.</Text>
        )}
      </View>
    </Modal>
  );
};

type OptionsProps = {
  light: boolean;
  locations: LocationSuggestion[];
  onClose: () => void;
  onSelectLocation: (location: LocationSuggestion) => void;
  visible: boolean;
};

export const NativeRegistrationLocationOptions = ({ light, locations, onClose, onSelectLocation, visible }: OptionsProps) => (
  <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
    <View style={styles.backdrop}>
      <View style={[styles.dialog, light && styles.optionsLight]}>
        <Text accessibilityRole="header" style={[styles.optionsTitle, light && styles.textLight]}>Select a location:</Text>
        <Text style={[styles.subtitle, light && styles.mutedLight]}>Your exact coordinates are kept private.</Text>
        <ScrollView contentContainerStyle={styles.dialogList}>
          {locations.map((location, index) => (
            <Pressable accessibilityRole="button" key={`${location.displayName}-${index}`} onPress={() => onSelectLocation(location)} style={[styles.option, light && styles.optionLight]}>
              <Text style={[styles.optionText, light && styles.textLight]}>{location.displayName}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.dismiss}>
          <Text style={styles.dismissText}>Dismiss options</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101719' },
  rootLight: { backgroundColor: '#f7fbfc' },
  header: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#40565a', backgroundColor: '#182124' },
  headerLight: { borderBottomColor: '#b5c1c4', backgroundColor: '#fff' },
  headerCopy: { flex: 1 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  subtitle: { marginTop: 3, color: '#a7b6bd', fontSize: 12, lineHeight: 17 },
  close: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23 },
  closeText: { color: '#fff', fontSize: 32, lineHeight: 34 },
  map: { flex: 1, minHeight: 280 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 24, backgroundColor: '#13242b' },
  fallbackLight: { backgroundColor: '#dcebf0' },
  fallbackTitle: { color: '#fff', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  options: { gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: '#40565a', backgroundColor: '#182124' },
  optionsLight: { borderTopColor: '#b5c1c4', backgroundColor: '#fff' },
  optionsTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  option: { minHeight: 46, justifyContent: 'center', borderWidth: 1, borderColor: '#52676a', borderRadius: 9, paddingHorizontal: 12, backgroundColor: '#20292b' },
  optionLight: { borderColor: '#a7b5b8', backgroundColor: '#f5f8f8' },
  optionText: { color: '#f7fbfc', fontSize: 13, fontWeight: '800' },
  hint: { minHeight: 54, padding: 16, color: '#a7b6bd', backgroundColor: '#182124', fontSize: 12, textAlign: 'center' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,.72)' },
  dialog: { width: '100%', maxWidth: 480, maxHeight: '72%', gap: 10, borderWidth: 1, borderColor: '#4179a1', borderRadius: 16, padding: 18, backgroundColor: '#182124' },
  dialogList: { gap: 8 },
  dismiss: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#0b86ee' },
  dismissText: { color: '#fff', fontWeight: '900' },
  textLight: { color: '#142126' },
  mutedLight: { color: '#5e7077' },
});
