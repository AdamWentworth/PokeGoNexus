import type { TrainerAutocompleteEntry } from '@pokemongonexus/shared-contracts/users';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  buildNativeTrainerSearchRows,
  type NativeTrainerSearchRow,
} from '../features/search/trainerSearchModel';
import { NativeUiIcon } from '../components/NativeUiIcon';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type Props = {
  entries: TrainerAutocompleteEntry[];
  error?: string | null;
  hasSearched?: boolean;
  isLoading?: boolean;
  initialScrollOffset?: number;
  onOpenCatalog: (username: string) => void;
  onOpenProfile: (username: string) => void;
  onQueryChange: (query: string) => void;
  onSubmit: (query: string) => void;
  onRetry?: () => void;
  onScrollOffsetChange?: (offset: number) => void;
  query: string;
};

const TEAM_COLORS = {
  instinct: '#f0b928',
  mystic: '#3f8ee8',
  valor: '#ef5a64',
  neutral: '#61d7c7',
} as const;

const TrainerCard = ({
  light,
  onOpenCatalog,
  onOpenProfile,
  row,
}: {
  light: boolean;
  onOpenCatalog: (username: string) => void;
  onOpenProfile: (username: string) => void;
  row: NativeTrainerSearchRow;
}) => {
  const teamColor = TEAM_COLORS[row.team];
  return (
    <View
      accessibilityLabel={`Trainer ${row.username}`}
      style={[
        styles.card,
        light && styles.cardLight,
        { borderLeftColor: teamColor },
      ]}
    >
      <View style={styles.identityRow}>
        <View style={[styles.avatar, { borderColor: teamColor, backgroundColor: `${teamColor}20` }]}>
          <Text style={[styles.avatarText, { color: teamColor }]}>{row.avatarLabel}</Text>
        </View>
        <View style={styles.names}>
          <Text numberOfLines={1} style={[styles.username, light && styles.textLight]}>
            Nexus · @{row.username}
          </Text>
          <Text numberOfLines={1} style={[styles.pogoName, light && styles.secondaryLight]}>
            Pokémon GO · {row.pokemonGoName ?? 'Not shared'}
          </Text>
        </View>
      </View>
      {row.teamLabel || row.trainerLevel ? (
        <View accessibilityLabel="Trainer details" style={styles.metadata}>
          {row.teamLabel ? (
            <Text style={[styles.metadataChip, { color: teamColor, borderColor: `${teamColor}80` }]}>
              {row.teamLabel}
            </Text>
          ) : null}
          {row.trainerLevel ? (
            <Text style={[styles.metadataChip, light && styles.metadataChipLight]}>
              Level {row.trainerLevel}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenCatalog(row.username)}
          style={({ pressed }) => [styles.catalogButton, pressed && styles.pressed]}
        >
          <Text style={styles.catalogButtonText}>View Pokémon</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenProfile(row.username)}
          style={({ pressed }) => [
            styles.profileButton,
            light && styles.profileButtonLight,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.profileButtonText, light && styles.textLight]}>View profile  →</Text>
        </Pressable>
      </View>
    </View>
  );
};

export const NativeTrainerSearchScreen = ({
  entries,
  error = null,
  hasSearched = false,
  isLoading = false,
  initialScrollOffset = 0,
  onOpenCatalog,
  onOpenProfile,
  onQueryChange,
  onSubmit,
  onRetry,
  onScrollOffsetChange,
  query,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<NativeTrainerSearchRow>>(null);
  const restoredScrollRef = useRef(initialScrollOffset <= 0);
  const latestScrollOffsetRef = useRef(initialScrollOffset);
  const performanceStartsRef = useRef(new Map<string, number>());
  const rows = useMemo(() => buildNativeTrainerSearchRows(entries), [entries]);
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length >= 2;
  const beginPerformance = useCallback((event: string) => {
    performanceStartsRef.current.set(event, Date.now());
  }, []);
  const finishPerformance = useCallback((event: string) => {
    const startedAt = performanceStartsRef.current.get(event);
    if (startedAt == null) return;
    performanceStartsRef.current.delete(event);
    markNativeUiPerformanceAfterPaint(event, startedAt);
  }, []);
  useEffect(() => {
    if (!isLoading && (hasSearched || error)) {
      finishPerformance('search_trainer_query_result_painted');
    }
  }, [entries, error, finishPerformance, hasSearched, isLoading]);
  useEffect(() => {
    if (!query) finishPerformance('search_trainer_clear_result_painted');
  }, [finishPerformance, query]);
  const submit = () => {
    Keyboard.dismiss();
    if (!hasQuery) {
      inputRef.current?.focus();
      return;
    }
    beginPerformance('search_trainer_query_result_painted');
    onSubmit(trimmedQuery);
  };
  const restoreScrollPosition = useCallback(() => {
    if (restoredScrollRef.current || initialScrollOffset <= 0 || isLoading) return;
    restoredScrollRef.current = true;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ animated: false, offset: initialScrollOffset });
    });
  }, [initialScrollOffset, isLoading]);
  const reportScrollPosition = () => {
    onScrollOffsetChange?.(latestScrollOffsetRef.current);
  };

  return (
    <FlatList
      contentContainerStyle={[styles.content, { paddingBottom: 110 + insets.bottom }]}
      data={!isLoading && !error ? rows : []}
      onContentSizeChange={restoreScrollPosition}
      onMomentumScrollEnd={reportScrollPosition}
      onScroll={(event) => { latestScrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}
      onScrollEndDrag={reportScrollPosition}
      ref={listRef}
      scrollEventThrottle={100}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      keyExtractor={(row) => row.username.toLocaleLowerCase()}
      ListHeaderComponent={(
        <>
          <View style={[styles.intro, light && styles.panelLight]}>
            <View style={styles.introHeader}>
              <View style={[styles.introIcon, light && styles.introIconLight]}>
                <NativeUiIcon color="#2f9cff" name="trainers" size={21} />
              </View>
              <View style={styles.introCopy}>
                <Text style={styles.eyebrow}>TRAINER SEARCH</Text>
                <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>
                  Find a trainer
                </Text>
                <Text style={[styles.description, light && styles.secondaryLight]}>
                  Search by their Nexus username or Pokémon GO name.
                </Text>
              </View>
            </View>
            <Text style={[styles.label, light && styles.textLight]}>Trainer name</Text>
            <View style={styles.searchRow}>
              <View style={[styles.inputShell, light && styles.inputShellLight]}>
                <View style={styles.searchGlyph}>
                  <NativeUiIcon color={light ? '#6b7478' : '#9babad'} name="search" size={21} />
                </View>
                <TextInput
                  accessibilityLabel="Trainer name"
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect={false}
                  enterKeyHint="search"
                  onChangeText={(value) => {
                    beginPerformance('search_trainer_query_result_painted');
                    onQueryChange(value);
                  }}
                  onSubmitEditing={submit}
                  placeholder="Username or Pokémon GO name"
                  placeholderTextColor={light ? '#6b7478' : '#839396'}
                  ref={inputRef}
                  returnKeyType="search"
                  style={[styles.input, light && styles.inputLight]}
                  value={query}
                />
                {query ? (
                  <Pressable
                    accessibilityLabel="Clear trainer search"
                    accessibilityRole="button"
                    onPress={() => {
                      beginPerformance('search_trainer_clear_result_painted');
                      onQueryChange('');
                      inputRef.current?.focus();
                    }}
                    style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
                  >
                    <Text style={[styles.clearText, light && styles.textLight]}>×</Text>
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                accessibilityLabel="Search trainers"
                accessibilityRole="button"
                accessibilityState={{ disabled: !hasQuery }}
                disabled={!hasQuery}
                onPress={submit}
                style={({ pressed }) => [
                  styles.submitButton,
                  !hasQuery && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.submitText, !hasQuery && styles.disabledText]}>
                  {isLoading ? 'Searching…' : 'Search'}
                </Text>
              </Pressable>
            </View>
            <Text accessibilityLiveRegion="polite" style={[styles.hint, light && styles.secondaryLight]}>
              {trimmedQuery.length === 1
                ? 'Enter one more character to search.'
                : 'Results update automatically as you type.'}
            </Text>
          </View>

          {isLoading ? (
            <View accessibilityLiveRegion="polite" style={[styles.state, light && styles.panelLight]}>
              <ActivityIndicator color="#2f9cff" size="large" />
              <Text style={[styles.stateTitle, light && styles.textLight]}>Searching trainers</Text>
              <Text style={[styles.stateCopy, light && styles.secondaryLight]}>
                Looking for “{trimmedQuery}”…
              </Text>
            </View>
          ) : null}
          {!isLoading && error ? (
            <View accessibilityLiveRegion="assertive" style={[styles.state, styles.errorState]}>
              <Text style={styles.errorIcon}>!</Text>
              <Text style={[styles.stateTitle, light && styles.textLight]}>
                Trainer search couldn’t be completed
              </Text>
              <Text style={[styles.stateCopy, light && styles.secondaryLight]}>{error}</Text>
              {onRetry ? (
                <Pressable accessibilityRole="button" onPress={() => {
                  beginPerformance('search_trainer_query_result_painted');
                  onRetry();
                }} style={styles.retryButton}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {!isLoading && !error && rows.length > 0 ? (
            <View style={styles.resultsHeading}>
              <View style={styles.resultsHeadingCopy}>
                <Text style={styles.eyebrow}>SEARCH RESULTS</Text>
                <Text style={[styles.resultsTitle, light && styles.textLight]} numberOfLines={2}>
                  Trainers matching “{trimmedQuery}”
                </Text>
              </View>
              <Text style={[styles.count, light && styles.countLight]}>
                {rows.length} {rows.length === 1 ? 'trainer' : 'trainers'}
              </Text>
            </View>
          ) : null}
          {!isLoading && !error && hasQuery && hasSearched && rows.length === 0 ? (
            <View style={[styles.state, light && styles.panelLight]}>
              <NativeUiIcon color="#42d7c6" name="search" size={27} />
              <Text style={[styles.stateTitle, light && styles.textLight]}>No trainers found</Text>
              <Text style={[styles.stateCopy, light && styles.secondaryLight]}>
                Try a different Nexus username or Pokémon GO name.
              </Text>
            </View>
          ) : null}
          {!isLoading && !error && trimmedQuery.length === 0 ? (
            <View style={[styles.state, light && styles.panelLight]}>
              <NativeUiIcon color="#42d7c6" name="trainers" size={29} />
              <Text style={[styles.stateTitle, light && styles.textLight]}>Find people you know</Text>
              <Text style={[styles.stateCopy, light && styles.secondaryLight]}>
                Enter at least two characters to search the trainer community.
              </Text>
            </View>
          ) : null}
        </>
      )}
      renderItem={({ item }) => (
        <TrainerCard
          light={light}
          onOpenCatalog={onOpenCatalog}
          onOpenProfile={onOpenProfile}
          row={item}
        />
      )}
      style={[styles.screen, light && styles.screenLight]}
      testID="native-trainer-search"
    />
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#080d0f' },
  screenLight: { backgroundColor: '#f8fff9' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 12, paddingBottom: 110, gap: 12 },
  intro: { padding: 18, borderWidth: 1, borderColor: '#2d4246', borderRadius: 14, backgroundColor: '#171d1f' },
  panelLight: { borderColor: '#b8c7c9', backgroundColor: '#ffffff' },
  introHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  introIcon: { width: 48, height: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2f9cff66', borderRadius: 14, backgroundColor: '#2f9cff1f' },
  introIconLight: { backgroundColor: '#dfefff' },
  introCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#2f9cff', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 2, color: '#f7fbfc', fontSize: 25, fontWeight: '900' },
  description: { marginTop: 2, color: '#a6b1b3', fontSize: 14, lineHeight: 20 },
  label: { marginTop: 18, marginBottom: 7, color: '#edf4f5', fontSize: 13, fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  inputShell: { flex: 1, minWidth: 0, minHeight: 52, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#718286', borderRadius: 12, backgroundColor: '#0d1214' },
  inputShellLight: { borderColor: '#849397', backgroundColor: '#ffffff' },
  searchGlyph: { marginLeft: 14, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, minHeight: 50, paddingHorizontal: 10, color: '#ffffff', fontSize: 16 },
  inputLight: { color: '#11191b' },
  clearButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  clearText: { color: '#eef7f8', fontSize: 28, fontWeight: '400' },
  submitButton: { minWidth: 96, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: '#2f9cff', borderRadius: 12, backgroundColor: '#176aad' },
  submitText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
  disabled: { borderColor: '#354347', backgroundColor: '#242c2e', opacity: 0.72 },
  disabledText: { color: '#7d8a8d' },
  hint: { marginTop: 7, color: '#8ea0a3', fontSize: 12 },
  state: { marginTop: 12, alignItems: 'center', padding: 24, gap: 7, borderWidth: 1, borderColor: '#2d4246', borderRadius: 14, backgroundColor: '#12191b' },
  errorState: { borderColor: '#a94858', backgroundColor: 'rgba(103, 26, 42, 0.18)' },
  errorIcon: { width: 32, height: 32, color: '#ff6a7e', fontSize: 23, fontWeight: '900', textAlign: 'center' },
  emptyIcon: { color: '#62d9ce', fontSize: 29, fontWeight: '800' },
  stateTitle: { color: '#f6fafb', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  stateCopy: { color: '#a6b1b3', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: { minHeight: 44, marginTop: 7, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#2f9cff' },
  retryText: { color: '#06111d', fontWeight: '900' },
  resultsHeading: { marginTop: 18, marginBottom: 2, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  resultsHeadingCopy: { flex: 1, minWidth: 0 },
  resultsTitle: { marginTop: 2, color: '#f5fafb', fontSize: 19, fontWeight: '900' },
  count: { overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, color: '#dce7e9', fontSize: 12, fontWeight: '800', borderWidth: 1, borderColor: '#45585c', borderRadius: 999, backgroundColor: '#20292b' },
  countLight: { color: '#304043', borderColor: '#aebdbf', backgroundColor: '#f4f7f7' },
  card: { marginBottom: 12, padding: 14, gap: 12, borderWidth: 1, borderLeftWidth: 4, borderColor: '#2b4549', borderRadius: 14, backgroundColor: '#131b1d' },
  cardLight: { borderColor: '#aebfc1', backgroundColor: '#ffffff' },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 24 },
  avatarText: { fontSize: 20, fontWeight: '900' },
  names: { flex: 1, minWidth: 0, gap: 3 },
  username: { color: '#f8fcfd', fontSize: 17, fontWeight: '900' },
  pogoName: { color: '#a7b4b6', fontSize: 13 },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metadataChip: { overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, color: '#c8d4d6', fontSize: 11, fontWeight: '800', borderWidth: 1, borderColor: '#58696c', borderRadius: 999 },
  metadataChipLight: { color: '#455558', borderColor: '#a6b4b6' },
  actions: { flexDirection: 'row', gap: 9 },
  catalogButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#2f9cff' },
  catalogButtonText: { color: '#04131f', fontSize: 14, fontWeight: '900' },
  profileButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#53666a', borderRadius: 9 },
  profileButtonLight: { borderColor: '#8d9da0' },
  profileButtonText: { color: '#e9f1f2', fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  textLight: { color: '#152023' },
  secondaryLight: { color: '#536164' },
});
