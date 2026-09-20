import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Pressable, Platform, StyleSheet, Text, View } from 'react-native';
import type { NativePokemonSearchResult } from './pokemonSearchModel';
import type { NativeSearchMapLibreCanvasProps } from './NativeSearchMapLibreCanvas';
import { useNativeColorScheme } from '../settings/useNativeColorScheme';
import { NativeUiIcon } from '../../components/NativeUiIcon';
import { markNativeUiPerformanceAfterPaint } from '../../observability/nativeUiInteractionTiming';
import { runtimeConfig } from '../../config/runtimeConfig';

type Props = {
  onOpenListing: (result: NativePokemonSearchResult) => void;
  onOpenProfile: (username: string) => void;
  onReady?: () => void;
  results: NativePokemonSearchResult[];
};

const accentFor = (result: NativePokemonSearchResult): string => (
  result.mode === 'trade' ? '#35c680' : result.mode === 'wanted' ? '#f25f78' : '#2f9cff'
);

const initialCamera = (results: NativePokemonSearchResult[]) => {
  const coordinates = results.flatMap((result) => result.mapCoordinate ? [result.mapCoordinate] : []);
  if (coordinates.length === 0) return { center: [-123.009, 49.233] as [number, number], zoom: 8 };
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  const span = Math.max(
    Math.max(...longitudes) - Math.min(...longitudes),
    Math.max(...latitudes) - Math.min(...latitudes),
  );
  return {
    center: [
      (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
      (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    ] as [number, number],
    zoom: span > 8 ? 3 : span > 2 ? 5 : span > 0.5 ? 7 : span > 0.1 ? 9 : 11,
  };
};

export const NativeSearchMapView = ({ onOpenListing, onOpenProfile, onReady, results }: Props) => {
  const light = useNativeColorScheme() === 'light';
  const mappable = useMemo(() => results.filter((result) => result.mapCoordinate), [results]);
  const [selectedId, setSelectedId] = useState<string | null>(() => mappable[0]?.id ?? null);
  const selected = mappable.find((result) => result.id === selectedId) ?? mappable[0] ?? null;
  const camera = useMemo(() => initialCamera(mappable), [mappable]);
  const expoGo = Constants.appOwnership === 'expo';
  const nativeMapAvailable = Platform.OS !== 'web' && !expoGo;
  const [MapCanvas] = useState<ComponentType<NativeSearchMapLibreCanvasProps> | null>(() => {
    // MapLibre's native package cannot be evaluated by react-native-web. The
    // deterministic area preview is the intentional browser fallback, just as
    // Expo Go uses it when the native module is unavailable.
    if (!nativeMapAvailable) return null;
    try {
      // Keep the native canvas in Metro's main bundle. A deferred `import()`
      // works in the ordinary development server, but its split module was
      // unavailable to a no-dev/minified client and silently left the release
      // proxy on the preview fallback. Runtime gating still prevents native
      // MapLibre from being evaluated by react-native-web or Expo Go.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require('./NativeSearchMapLibreCanvas') as {
        default: ComponentType<NativeSearchMapLibreCanvasProps>;
      };
      return module.default;
    } catch (error) {
      if (runtimeConfig.mobile.deviceSmokeMode) {
        console.warn('[mobile:search-map] Native MapLibre canvas unavailable', error);
      }
      return null;
    }
  });
  const selectionStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!nativeMapAvailable || MapCanvas || mappable.length === 0) onReady?.();
  }, [MapCanvas, mappable.length, nativeMapAvailable, onReady]);

  useEffect(() => {
    const startedAt = selectionStartedAtRef.current;
    if (startedAt == null) return;
    selectionStartedAtRef.current = null;
    markNativeUiPerformanceAfterPaint('search_map_selection_result_painted', startedAt);
  }, [selectedId]);

  const selectResult = useCallback((id: string) => {
    selectionStartedAtRef.current = Date.now();
    setSelectedId(id);
  }, []);

  if (mappable.length === 0) {
    return (
      <View style={[styles.empty, light && styles.emptyLight]}>
        <NativeUiIcon color="#2f9cff" name="map" size={36} />
        <Text style={[styles.emptyTitle, light && styles.textLight]}>No map locations available</Text>
        <Text style={[styles.emptyCopy, light && styles.mutedLight]}>
          These trainers have not shared even an approximate public area. Their listings remain available in List view.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.shell, light && styles.shellLight]} testID="native-search-map">
      {MapCanvas ? <MapCanvas camera={camera} light={light} mappable={mappable} onSelect={selectResult} selectedId={selected?.id ?? null} /> : (
        <View style={[styles.previewMap, light && styles.previewMapLight]}>
          <View style={styles.previewGrid} />
          {mappable.slice(0, 12).map((result, index) => {
            const active = result.id === selected?.id;
            const column = index % 4;
            const row = Math.floor(index / 4);
            return <Pressable accessibilityRole="button" accessibilityLabel={`${result.username}, ${result.row.name}`} key={result.id} onPress={() => selectResult(result.id)} style={[styles.previewMarker, { backgroundColor: accentFor(result), left: `${10 + column * 24}%`, top: `${15 + row * 28}%` }, active && styles.previewMarkerActive]}><Text style={styles.markerText}>{result.username.slice(0, 1).toLocaleUpperCase()}</Text></Pressable>;
          })}
          <Text style={[styles.previewMapLabel, light && styles.mutedLight]}>Approximate public areas</Text>
        </View>
      )}
      {runtimeConfig.mobile.deviceSmokeMode ? mappable.map((result, index) => (
        <Pressable
          accessibilityLabel={`Select map listing ${result.username} for performance test`}
          accessibilityRole="button"
          key={`performance-${result.id}`}
          onPress={() => selectResult(result.id)}
          style={[styles.performanceSelectionTarget, { top: 58 + index * 46 }]}
          testID={`native-search-map-performance-select-${result.id}`}
        />
      )) : null}
      <View style={[styles.mapCount, light && styles.mapCountLight]}>
        <Text style={[styles.mapCountText, light && styles.textLight]}>{mappable.length} on map</Text>
      </View>
      {selected ? (
        <View
          accessible
          accessibilityLabel={`Selected map listing: ${selected.username}, ${selected.row.name}`}
          style={[styles.preview, light && styles.previewLight]}
        >
          <View style={styles.previewCopy}>
            <Text style={[styles.previewName, light && styles.textLight]} numberOfLines={1}>{selected.row.name}</Text>
            <Text style={[styles.previewMeta, light && styles.mutedLight]} numberOfLines={1}>
              {selected.username}{selected.mapCoordinateIsApproximate ? ' · approximate area' : ''}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => onOpenProfile(selected.username)} style={[styles.previewSecondary, light && styles.previewSecondaryLight]}>
            <Text style={[styles.previewSecondaryText, light && styles.textLight]}>Trainer</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onOpenListing(selected)} style={[styles.previewPrimary, { backgroundColor: accentFor(selected) }]}>
            <Text style={styles.previewPrimaryText}>Open</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  shell: { height: 530, overflow: 'hidden', borderWidth: 1, borderColor: '#3d5256', borderRadius: 14, backgroundColor: '#11191b' },
  shellLight: { borderColor: '#aebdc0', backgroundColor: '#ffffff' },
  previewMap: { flex: 1, overflow: 'hidden', backgroundColor: '#13242b' },
  previewMapLight: { backgroundColor: '#dcebf0' },
  previewGrid: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: .32, borderWidth: 1, borderColor: '#6f858d' },
  previewMarker: { position: 'absolute', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', borderRadius: 18, elevation: 3 },
  previewMarkerActive: { width: 44, height: 44, borderRadius: 22, borderWidth: 4 },
  previewMapLabel: { position: 'absolute', right: 10, bottom: 10, overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, color: '#d8e8ed', backgroundColor: '#071216bb', fontSize: 9, fontWeight: '800' },
  markerText: { color: '#041312', fontSize: 13, fontWeight: '900' },
  // MapLibre marker children are drawn into a native surface and do not enter
  // Android's accessibility hierarchy. Performance fixture builds expose
  // transparent equivalents that start the same selection handler reliably.
  performanceSelectionTarget: { position: 'absolute', right: 4, zIndex: 3, width: 44, height: 44, backgroundColor: 'transparent' },
  mapCount: { position: 'absolute', top: 10, left: 10, minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#53666a', borderRadius: 17, backgroundColor: '#131b1ddd' },
  mapCountLight: { borderColor: '#a6b4b7', backgroundColor: '#fffffff2' },
  mapCountText: { color: '#f7fbfc', fontSize: 12, fontWeight: '900' },
  preview: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: '#40565a', backgroundColor: '#151d1f' },
  previewLight: { borderTopColor: '#b5c1c4', backgroundColor: '#ffffff' },
  previewCopy: { flex: 1, minWidth: 0 },
  previewName: { color: '#f7fbfc', fontSize: 15, fontWeight: '900' },
  previewMeta: { marginTop: 2, color: '#9badb0', fontSize: 11, fontWeight: '700' },
  previewSecondary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#52676a', borderRadius: 9, backgroundColor: '#20292b' },
  previewSecondaryLight: { borderColor: '#a7b5b8', backgroundColor: '#f5f8f8' },
  previewSecondaryText: { color: '#f7fbfc', fontSize: 12, fontWeight: '900' },
  previewPrimary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 9 },
  previewPrimaryText: { color: '#041312', fontSize: 12, fontWeight: '900' },
  empty: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 24, borderWidth: 1, borderColor: '#3d5256', borderRadius: 14, backgroundColor: '#151d1f' },
  emptyLight: { borderColor: '#b4c1c3', backgroundColor: '#ffffff' },
  emptyTitle: { color: '#f7fbfc', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyCopy: { maxWidth: 420, color: '#9badb0', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  textLight: { color: '#172124' },
  mutedLight: { color: '#5c696c' },
});
