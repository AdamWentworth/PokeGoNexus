import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { NativeCollectionRow } from '../collection/collectionModel';
import { NativePokemonLocationBackdrop } from '../collection/parity/NativePokemonLocationBackdrop';
import { useNativeColorScheme } from '../settings/useNativeColorScheme';
import { runNativeUiWorkAfterPaint } from '../../observability/nativeUiInteractionTiming';

type Props = {
  assetBaseUrl: string;
  candidates: NativeCollectionRow[];
  onClear: () => void;
  onClose: () => void;
  onSelect: (instanceId: string) => void;
  selectedIds: string[];
  slotIndex: number;
  visible: boolean;
};

const INITIAL_VISIBLE_CANDIDATES = 48;
const INITIAL_PAINT_CANDIDATES = 12;
const CANDIDATE_RENDER_BATCH = 6;

export const NativeTrainerShowcasePicker = ({
  assetBaseUrl,
  candidates,
  onClear,
  onClose,
  onSelect,
  selectedIds,
  slotIndex,
  visible,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_CANDIDATES);
  const [renderedCount, setRenderedCount] = useState(INITIAL_PAINT_CANDIDATES);
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => {
    const normalized = deferredQuery.trim().toLocaleLowerCase();
    if (!normalized) return candidates;
    return candidates.filter((row) => (
      row.name.toLocaleLowerCase().includes(normalized)
      || String(row.pokedexNumber).includes(normalized)
      || String(row.cp ?? '').includes(normalized)
    ));
  }, [candidates, deferredQuery]);
  const selected = useMemo(
    () => new Set(selectedIds.filter(Boolean)),
    [selectedIds],
  );
  const currentId = selectedIds[slotIndex] ?? '';
  const targetRenderedCount = Math.min(visibleCount, filtered.length);
  const visibleCandidates = filtered.slice(0, Math.min(renderedCount, targetRenderedCount));

  useEffect(() => {
    if (!visible || renderedCount >= targetRenderedCount) return;
    let mounted = true;
    runNativeUiWorkAfterPaint(() => {
      if (!mounted) return;
      setRenderedCount((current) => Math.min(
        current + CANDIDATE_RENDER_BATCH,
        targetRenderedCount,
      ));
    });
    return () => {
      mounted = false;
    };
  }, [renderedCount, targetRenderedCount, visible]);

  if (!visible) return null;

  return (
    <View
      accessibilityLabel={`Choose Pokémon for featured slot ${slotIndex + 1}`}
      style={[styles.screen, light && styles.screenLight]}
      testID="native-trainer-showcase-picker"
    >
      <View style={[styles.header, light && styles.dividerLight]}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>FEATURED SLOT {slotIndex + 1}</Text>
          <Text style={[styles.title, light && styles.textLight]}>Choose a caught Pokémon</Text>
        </View>
        <View style={styles.headerActions}>
          {currentId ? (
            <Pressable accessibilityRole="button" onPress={onClear} style={[styles.clearButton, light && styles.clearButtonLight]}>
              <Text style={[styles.clearText, light && styles.textLight]}>Clear slot</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityLabel="Close showcase picker" accessibilityRole="button" onPress={onClose} style={[styles.close, light && styles.closeLight]}>
            <Text style={[styles.closeText, light && styles.textLight]}>×</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel="Search caught Pokémon"
          onChangeText={(value) => {
            setQuery(value);
            setVisibleCount(INITIAL_VISIBLE_CANDIDATES);
            setRenderedCount(INITIAL_PAINT_CANDIDATES);
          }}
          placeholder="Search caught Pokémon"
          placeholderTextColor={light ? '#718083' : '#7f9495'}
          selectionColor="#35a8ff"
          style={[styles.search, light && styles.searchLight, light && styles.textLight]}
          value={query}
        />
        <Text style={[styles.resultCount, light && styles.mutedLight]}>{filtered.length.toLocaleString('en-US')}</Text>
      </View>

      {visibleCandidates.length ? (
        <View style={styles.grid} testID="native-trainer-showcase-grid">
          {visibleCandidates.map((row) => {
            const isCurrent = row.id === currentId;
            const usedElsewhere = !isCurrent && selected.has(row.id);
            return (
              <Pressable
                accessibilityLabel={`${row.name}${isCurrent ? ', selected in this slot' : usedElsewhere ? ', already featured' : ''}`}
                accessibilityRole="button"
                disabled={usedElsewhere}
                key={row.id}
                onPress={() => onSelect(row.id)}
                style={[
                  styles.card,
                  light && styles.cardLight,
                  isCurrent && styles.cardSelected,
                  usedElsewhere && styles.cardDisabled,
                ]}
              >
                {row.locationBackgroundUri ? <NativePokemonLocationBackdrop uri={row.locationBackgroundUri} /> : null}
                {row.imageUri ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: row.imageUri }} style={styles.image} /> : null}
                {row.maxKind ? (
                  <Image
                    fadeDuration={0}
                    resizeMode="contain"
                    source={{ uri: `${assetBaseUrl.replace(/\/$/, '')}/images/${row.maxKind}.png` }}
                    style={styles.maxIcon}
                  />
                ) : null}
                <Text numberOfLines={2} style={[styles.name, light && styles.textLight]}>{row.name}</Text>
                <Text style={[styles.detail, light && styles.mutedLight]}>
                  {row.cp ? `CP ${row.cp.toLocaleString('en-US')}` : `#${String(row.pokedexNumber).padStart(4, '0')}`}
                </Text>
                {isCurrent || usedElsewhere ? (
                  <Text style={[styles.badge, isCurrent ? styles.badgeCurrent : styles.badgeUsed]}>
                    {isCurrent ? 'THIS SLOT' : 'FEATURED'}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, light && styles.textLight]}>No caught Pokémon match</Text>
          <Text style={[styles.copy, light && styles.mutedLight]}>Try another name, number, or CP.</Text>
        </View>
      )}
      {visibleCount < filtered.length ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisibleCount((current) => Math.min(current + INITIAL_VISIBLE_CANDIDATES, filtered.length))}
          style={[styles.moreButton, light && styles.clearButtonLight]}
        >
          <Text style={[styles.clearText, light && styles.textLight]}>Show more</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { overflow: 'hidden', marginVertical: 12, borderWidth: 1, borderColor: '#315052', borderRadius: 9, backgroundColor: '#081012' },
  screenLight: { borderColor: '#bdc8ca', backgroundColor: '#f8fff9' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderBottomWidth: 1, borderColor: '#315052' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrow: { color: '#35a8ff', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#f7fbfa', fontSize: 23, lineHeight: 29, fontWeight: '900' },
  copy: { color: '#9db5b4', fontSize: 12, lineHeight: 17 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#456265', borderRadius: 22, backgroundColor: '#171f20' },
  closeLight: { borderColor: '#aababc', backgroundColor: '#ffffff' },
  closeText: { color: '#ffffff', fontSize: 28, lineHeight: 30 },
  dividerLight: { borderColor: '#bdc8ca' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  search: { flex: 1, minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: '#456265', borderRadius: 10, backgroundColor: '#171f20', color: '#f7fbfa', fontSize: 14, fontWeight: '700' },
  searchLight: { borderColor: '#aababc', backgroundColor: '#ffffff' },
  clearButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 11, borderWidth: 1, borderColor: '#a9434d', borderRadius: 10, backgroundColor: '#3b1d22' },
  clearButtonLight: { backgroundColor: '#fff2f3' },
  clearText: { color: '#ff9ba8', fontSize: 11, fontWeight: '900' },
  resultCount: { minWidth: 30, color: '#9db5b4', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  card: { position: 'relative', width: '31.5%', minWidth: 0, minHeight: 144, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', padding: 7, borderWidth: 1, borderColor: '#315052', borderRadius: 9, backgroundColor: '#11191a' },
  cardLight: { borderColor: '#bdc8ca', backgroundColor: '#ffffff' },
  cardSelected: { borderWidth: 2, borderColor: '#35a8ff', backgroundColor: '#12324b' },
  cardDisabled: { opacity: 0.42 },
  image: { width: 80, height: 78, marginBottom: 3 },
  maxIcon: { position: 'absolute', top: 7, right: 7, width: 23, height: 23 },
  name: { color: '#f7fbfa', fontSize: 11, lineHeight: 14, fontWeight: '900', textAlign: 'center' },
  detail: { color: '#9db5b4', fontSize: 9, lineHeight: 12 },
  badge: { position: 'absolute', top: 7, left: 7, overflow: 'hidden', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 8, color: '#061617', fontSize: 7, fontWeight: '900' },
  badgeCurrent: { backgroundColor: '#5eb1f4' },
  badgeUsed: { backgroundColor: '#9db5b4' },
  empty: { width: '100%', alignItems: 'center', gap: 3, paddingVertical: 50 },
  emptyTitle: { color: '#f7fbfa', fontSize: 17, fontWeight: '900' },
  moreButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: '#456265', borderRadius: 8, backgroundColor: '#171f20' },
  textLight: { color: '#172124' },
  mutedLight: { color: '#5e6c6f' },
});
