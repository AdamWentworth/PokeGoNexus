import type { Coordinates } from '@pokemongonexus/shared-contracts/location';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import type { PokemonSearchQueryParams } from '@pokemongonexus/shared-contracts/search';
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativePokemonSearchResult } from '../features/search/pokemonSearchModel';
import {
  countNativePokemonSearchFilters,
  createNativePokemonSearchDraft,
  nativePokemonSearchPreviewImage,
  normalizeNativePokemonSelection,
  prepareNativePokemonSearch,
  setNativePokemonSearchOwnership,
  type NativePokemonSearchDraft,
} from '../features/search/nativePokemonSearchDraft';
import {
  NativePokemonSearchFilterSheet,
  type NativeSearchFilterSection,
} from '../features/search/NativePokemonSearchFilterSheet';
import { NativeSearchMapView } from '../features/search/NativeSearchMapView';
import { NativeOptionPicker, type NativeOptionPickerEntry } from '../components/NativeOptionPicker';
import { NativeUiIcon } from '../components/NativeUiIcon';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type SavedLocation = Coordinates & { label: string };

type Props = {
  assetBaseUrl: string;
  catalog: BasePokemon[];
  draft: NativePokemonSearchDraft;
  error?: string | null;
  hasSearched?: boolean;
  initialDisplayMode?: 'list' | 'map';
  isLoading?: boolean;
  initialScrollOffset?: number;
  notice?: string | null;
  onDisplayModeChange?: (mode: 'list' | 'map') => void;
  onDraftChange: (draft: NativePokemonSearchDraft) => void;
  onFilterVisibilityChange?: (visible: boolean) => void;
  onOpenListing: (result: NativePokemonSearchResult) => void;
  onOpenProfile: (username: string) => void;
  onSearch: (
    query: PokemonSearchQueryParams,
    draft: NativePokemonSearchDraft,
  ) => void;
  onRetry?: () => void;
  onScrollOffsetChange?: (offset: number) => void;
  results: NativePokemonSearchResult[];
  savedLocation?: SavedLocation | null;
};

const modeLabel = (mode: NativePokemonSearchResult['mode']): string => (
  mode === 'trade' ? 'For Trade' : mode === 'wanted' ? 'Wanted' : 'Caught'
);

const distanceLabel = (distance: number | null): string | null => {
  if (distance == null) return null;
  return distance <= 0.01 ? 'Nearby' : `${distance.toFixed(1)} km away`;
};

const absoluteUri = (value: string | null | undefined, origin: string): string | null => {
  if (!value) return null;
  try { return new URL(value, origin).toString(); } catch { return null; }
};

const pokemonKey = (pokemon: BasePokemon): string => `${pokemon.pokemon_id}:${pokemon.form ?? ''}`;

const displayPokemonName = (pokemon: BasePokemon): string => (
  pokemon.form?.trim() ? `${pokemon.form.trim()} ${pokemon.name}` : pokemon.name
);

const SearchArtwork = ({
  assetBaseUrl,
  backgroundUri,
  imageUri,
  light,
  lucky = false,
  maxKind,
  size = 'large',
}: {
  assetBaseUrl: string;
  backgroundUri: string | null;
  imageUri: string | null;
  light: boolean;
  lucky?: boolean;
  maxKind: 'dynamax' | 'gigantamax' | null;
  size?: 'large' | 'small';
}) => (
  <View style={[
    styles.artwork,
    light && styles.artworkLight,
    !backgroundUri && !lucky && styles.artworkTransparent,
    size === 'small' && styles.artworkSmall,
  ]}>
    {backgroundUri ? <Image fadeDuration={0} resizeMode="cover" source={{ uri: backgroundUri }} style={StyleSheet.absoluteFill} /> : null}
    {!backgroundUri && lucky ? (
      <Image fadeDuration={0}
        resizeMode="cover"
        source={{ uri: `${assetBaseUrl.replace(/\/$/, '')}/images/lucky.png` }}
        style={StyleSheet.absoluteFill}
      />
    ) : null}
    {imageUri ? <Image fadeDuration={0} resizeMode="contain" source={{ uri: imageUri }} style={styles.artworkPokemon} /> : <Text style={styles.imageFallback}>No image</Text>}
    {maxKind ? (
      <Image fadeDuration={0}
        resizeMode="contain"
        source={{ uri: `${assetBaseUrl.replace(/\/$/, '')}/images/${maxKind}.png` }}
        style={[styles.artworkMax, size === 'small' && styles.artworkMaxSmall]}
      />
    ) : null}
  </View>
);

const ResultCard = ({
  assetBaseUrl,
  light,
  onOpenListing,
  onOpenProfile,
  result,
}: {
  assetBaseUrl: string;
  light: boolean;
  onOpenListing: (result: NativePokemonSearchResult) => void;
  onOpenProfile: (username: string) => void;
  result: NativePokemonSearchResult;
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsStartedAtRef = useRef<number | null>(null);
  const accent = light
    ? result.mode === 'trade' ? '#087454' : result.mode === 'wanted' ? '#b0003b' : '#005bb5'
    : result.mode === 'trade' ? '#35c680' : result.mode === 'wanted' ? '#f25f78' : '#2f9cff';
  const relatedTitle = result.mode === 'trade' ? 'Trainer wants' : 'Trainer can offer';
  const relatedRows = [...result.relatedRows].sort(
    (left, right) => Number(Boolean(right.match)) - Number(Boolean(left.match)),
  );
  const details = result.details;
  const hasAdditionalDetails = result.mode === 'caught' || Boolean(
    details.weight != null
    || details.height != null
    || details.moves.length
    || details.attackIv != null
    || details.defenseIv != null
    || details.staminaIv != null
    || details.locationCaught
    || details.dateCaught
    || details.friendshipLevel != null
    || details.prefLucky
    || details.wantedSizeLabels.length,
  );
  const detailsLabel = result.mode === 'wanted'
    ? 'Wanted conditions'
    : result.mode === 'caught'
      ? 'Pokémon details'
      : 'Listing details';
  useEffect(() => {
    const startedAt = detailsStartedAtRef.current;
    if (startedAt == null) return;
    detailsStartedAtRef.current = null;
    markNativeUiPerformanceAfterPaint('search_details_result_painted', startedAt);
  }, [detailsOpen]);
  return (
    <View style={[styles.resultCard, light && styles.resultCardLight, { borderTopColor: accent }]}>
      <View style={[styles.resultHeader, { backgroundColor: `${accent}12` }]}>
        <View style={[styles.trainerAvatar, { borderColor: accent }]}>
          <NativeUiIcon color={accent} name="user" size={21} />
        </View>
        <View style={styles.resultHeaderCopy}>
          <Text style={[styles.listingType, { color: accent }]}>{modeLabel(result.mode).toLocaleUpperCase()}</Text>
          <Text numberOfLines={1} style={[styles.trainerName, light && styles.textLight]}>{result.username}</Text>
        </View>
        {distanceLabel(result.distanceKm) ? (
          <View style={styles.distanceRow}>
            <NativeUiIcon color={light ? '#566467' : '#a9b5b7'} name="map" size={12} />
            <Text style={[styles.distance, light && styles.secondaryLight]}>{distanceLabel(result.distanceKm)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.listingBody}>
        <SearchArtwork
          assetBaseUrl={assetBaseUrl}
          backgroundUri={result.row.locationBackgroundUri}
          imageUri={result.row.imageUri}
          light={light}
          lucky={result.row.lucky}
          maxKind={result.row.maxKind}
        />
        <View style={styles.listingCopy}>
          {result.row.cp != null ? (
            <Text style={[styles.listingCp, light && styles.secondaryLight]}>CP {result.row.cp}</Text>
          ) : null}
          <View style={styles.listingNameRow}>
            <Text numberOfLines={3} style={[styles.listingName, light && styles.textLight]}>{result.row.name}</Text>
            {details.gender === 'Female' ? <Text style={styles.genderFemale}>♀</Text> : null}
            {details.gender === 'Male' ? <Text style={styles.genderMale}>♂</Text> : null}
          </View>
        </View>
      </View>
      {hasAdditionalDetails ? (
        <View style={[styles.detailsDisclosure, light && styles.detailsDisclosureLight]}>
          <Pressable
            accessibilityLabel={detailsLabel}
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsOpen }}
            onPress={() => {
              detailsStartedAtRef.current = Date.now();
              setDetailsOpen((current) => !current);
            }}
            style={styles.detailsSummary}
          >
            <Text style={[styles.detailsSummaryText, light && styles.textLight]}>▸  {detailsLabel}</Text>
          </Pressable>
          {detailsOpen ? (
            <View style={styles.detailsBody}>
              <View style={styles.detailFacts}>
                {details.weight != null ? <Text style={[styles.detailFact, light && styles.secondaryLight]}><Text style={[styles.detailValue, light && styles.textLight]}>{details.weight} kg</Text>{'\n'}Weight</Text> : null}
                {details.height != null ? <Text style={[styles.detailFact, light && styles.secondaryLight]}><Text style={[styles.detailValue, light && styles.textLight]}>{details.height} m</Text>{'\n'}Height</Text> : null}
                {details.friendshipLevel != null ? <Text style={[styles.detailFact, light && styles.secondaryLight]}><Text style={[styles.detailValue, light && styles.textLight]}>{details.friendshipLevel}/5 hearts</Text>{'\n'}Friendship</Text> : null}
                {details.prefLucky ? <Text style={[styles.detailFact, light && styles.secondaryLight]}><Text style={[styles.detailValue, light && styles.textLight]}>Requested</Text>{'\n'}Lucky trade</Text> : null}
              </View>
              {details.wantedSizeLabels.length ? <Text style={[styles.detailLine, light && styles.secondaryLight]}>{details.wantedSizeLabels.join(' · ')}</Text> : null}
              {details.moves.length ? <Text style={[styles.detailLine, light && styles.secondaryLight]}>Moves: <Text style={[styles.detailValue, light && styles.textLight]}>{details.moves.join(' · ')}</Text></Text> : null}
              {[details.attackIv, details.defenseIv, details.staminaIv].some((value) => value != null) ? (
                <Text style={[styles.detailLine, light && styles.secondaryLight]}>IVs: <Text style={[styles.detailValue, light && styles.textLight]}>{[
                  ['Attack', details.attackIv],
                  ['Defense', details.defenseIv],
                  ['HP', details.staminaIv],
                ].filter(([, value]) => value != null).map(([label, value]) => `${label} ${value}`).join(' · ')}</Text></Text>
              ) : null}
              {details.locationCaught ? <Text style={[styles.detailLine, light && styles.secondaryLight]}>Caught in <Text style={[styles.detailValue, light && styles.textLight]}>{details.locationCaught}</Text></Text> : null}
              {details.dateCaught ? <Text style={[styles.detailLine, light && styles.secondaryLight]}>Caught on <Text style={[styles.detailValue, light && styles.textLight]}>{details.dateCaught.slice(0, 10)}</Text></Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}
      {result.relatedRows.length > 0 ? (
        <View style={[styles.related, { borderColor: `${accent}66`, backgroundColor: `${accent}0c` }]}>
          <View style={styles.relatedHeader}>
            <View>
              <Text style={[styles.relatedEyebrow, { color: accent }]}>TRADE COMPATIBILITY</Text>
              <Text style={[styles.relatedTitle, light && styles.textLight]}>{relatedTitle}</Text>
            </View>
            <Text style={[styles.relatedCount, { backgroundColor: `${accent}36`, color: accent }]}>{result.relatedRows.length}</Text>
          </View>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={styles.relatedScroll} style={styles.relatedViewport}>
            {relatedRows.map((row) => (
              <View key={row.id} style={[styles.relatedCard, light && styles.relatedCardLight, row.match && { borderColor: accent }]}>
                <SearchArtwork assetBaseUrl={assetBaseUrl} backgroundUri={row.locationBackgroundUri} imageUri={row.imageUri} light={light} lucky={row.lucky} maxKind={row.maxKind} size="small" />
                <Text numberOfLines={3} style={[styles.relatedName, light && styles.textLight]}>{row.name}</Text>
                {row.match ? <Text style={[styles.matchLabel, { color: accent }]}>MUTUAL MATCH</Text> : null}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => onOpenProfile(result.username)} style={[styles.secondaryButton, light && styles.secondaryButtonLight]}>
          <Text style={[styles.secondaryButtonText, light && styles.textLight]}>View trainer</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => onOpenListing(result)} style={[styles.primaryButton, { backgroundColor: accent }]}>
          <Text style={[styles.primaryButtonText, light && styles.primaryButtonTextLight]}>
            {result.mode === 'caught' ? 'View Pokémon' : 'Open listing'}  →
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

export const NativePokemonSearchScreen = ({
  assetBaseUrl,
  catalog,
  draft,
  error = null,
  hasSearched = false,
  initialDisplayMode = 'list',
  isLoading = false,
  initialScrollOffset = 0,
  notice = null,
  onDisplayModeChange,
  onDraftChange,
  onFilterVisibilityChange,
  onOpenListing,
  onOpenProfile,
  onSearch,
  onRetry,
  onScrollOffsetChange,
  results,
  savedLocation = null,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const accent = light ? '#005bb5' : '#2f9cff';
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSection, setFilterSection] = useState<NativeSearchFilterSection>('pokemon');
  const [filterError, setFilterError] = useState<string | null>(null);
  const [filterNotice, setFilterNotice] = useState<string | null>(null);
  const [filterPrepared, setFilterPrepared] = useState(false);
  const [preparedFilterDraft, setPreparedFilterDraft] = useState(draft);
  const [displayMode, setDisplayMode] = useState<'list' | 'map'>(initialDisplayMode);
  const [editingSubmittedSearch, setEditingSubmittedSearch] = useState(!hasSearched);
  const [pokemonPickerOpen, setPokemonPickerOpen] = useState(false);
  const listRef = useRef<FlatList<NativePokemonSearchResult>>(null);
  const restoredScrollRef = useRef(initialScrollOffset <= 0);
  const latestScrollOffsetRef = useRef(initialScrollOffset);
  const performanceStartsRef = useRef(new Map<string, number>());
  const selectedPokemon = useMemo(() => catalog.find((pokemon) => (
    pokemon.pokemon_id === draft.pokemonId && (pokemon.form ?? null) === draft.form
  )) ?? catalog.find((pokemon) => pokemon.pokemon_id === draft.pokemonId) ?? null, [catalog, draft.form, draft.pokemonId]);
  const filterCount = countNativePokemonSearchFilters(draft);
  const previewImage = nativePokemonSearchPreviewImage(draft, selectedPokemon);
  const pokemonOptions = useMemo<NativeOptionPickerEntry[]>(() => [...catalog]
    .sort((left, right) => left.pokedex_number - right.pokedex_number
      || displayPokemonName(left).localeCompare(displayPokemonName(right)))
    .map((pokemon) => ({
      key: pokemonKey(pokemon),
      label: displayPokemonName(pokemon),
      description: `#${String(pokemon.pokedex_number).padStart(4, '0')}`,
      imageUri: absoluteUri(pokemon.image_url, assetBaseUrl),
    })), [assetBaseUrl, catalog]);

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
    if (displayMode === 'list') finishPerformance('search_display_result_painted');
  }, [displayMode, finishPerformance]);
  useEffect(() => {
    if (editingSubmittedSearch) finishPerformance('search_modify_result_painted');
  }, [editingSubmittedSearch, finishPerformance]);
  useEffect(() => {
    if (pokemonPickerOpen) finishPerformance('search_pokemon_picker_painted');
  }, [finishPerformance, pokemonPickerOpen]);
  useEffect(() => {
    if (filtersOpen) finishPerformance('search_filters_painted');
  }, [filtersOpen, finishPerformance]);
  useEffect(() => {
    finishPerformance('search_ownership_result_painted');
  }, [draft.ownership, finishPerformance]);
  useEffect(() => {
    finishPerformance('search_pokemon_selection_painted');
  }, [draft.form, draft.pokemonId, finishPerformance]);
  useEffect(() => {
    finishPerformance('search_filter_result_painted');
  }, [draft, finishPerformance]);
  useEffect(() => {
    if (!editingSubmittedSearch && hasSearched && !isLoading && !error) {
      finishPerformance('search_results_painted');
    }
  }, [editingSubmittedSearch, error, finishPerformance, hasSearched, isLoading, results]);

  useEffect(() => {
    if (notice) AccessibilityInfo.announceForAccessibility(notice);
  }, [notice]);
  useEffect(() => {
    if (!onFilterVisibilityChange || filterPrepared || !editingSubmittedSearch) return undefined;
    const timer = setTimeout(() => {
      setPreparedFilterDraft(draft);
      setFilterPrepared(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, editingSubmittedSearch, filterPrepared, onFilterVisibilityChange]);

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

  const changeDisplayMode = (mode: 'list' | 'map') => {
    if (mode === displayMode) return;
    beginPerformance('search_display_result_painted');
    setDisplayMode(mode);
    onDisplayModeChange?.(mode);
    // The canonical Search layout keeps the submitted-search summary in view
    // when moving between List and Map. Browser focus scrolling can otherwise
    // leave that card partly above the native-web viewport.
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ animated: false, offset: 0 });
      latestScrollOffsetRef.current = 0;
    });
  };

  const openFilters = (section: NativeSearchFilterSection = 'pokemon') => {
    beginPerformance('search_filters_painted');
    setFilterError(null);
    setFilterSection(section);
    setPreparedFilterDraft(draft);
    setFilterPrepared(true);
    onFilterVisibilityChange?.(true);
    setFiltersOpen(true);
  };
  const submittedFromFiltersRef = useRef(false);
  const closeFilters = () => {
    setFiltersOpen(false);
    onFilterVisibilityChange?.(false);
    if (submittedFromFiltersRef.current) {
      submittedFromFiltersRef.current = false;
      setEditingSubmittedSearch(false);
    }
  };
  const runSearch = () => {
    const prepared = prepareNativePokemonSearch(draft, selectedPokemon);
    if (!prepared.ok) {
      setFilterSection(prepared.section);
      setFilterError(prepared.message);
      onFilterVisibilityChange?.(true);
      setFiltersOpen(true);
      return false;
    }
    setFilterError(null);
    beginPerformance('search_results_painted');
    if (filtersOpen) submittedFromFiltersRef.current = true;
    else setEditingSubmittedSearch(false);
    onSearch(prepared.query, draft);
    return filtersOpen;
  };

  const resetFilters = () => {
    const reset = createNativePokemonSearchDraft();
    onDraftChange({
      ...reset,
      pokemonId: draft.pokemonId,
      pokemonName: draft.pokemonName,
      form: draft.form,
    });
  };

  const primarySearchControls = (
    <View style={[styles.primarySurface, light && styles.primarySurfaceLight]}>
      <Text style={[styles.primaryLegend, light && styles.secondaryLight]}>POKÉMON</Text>
      <Pressable
        accessibilityLabel="Choose Pokémon"
        accessibilityRole="button"
        onPress={() => {
          beginPerformance('search_pokemon_picker_painted');
          setPokemonPickerOpen(true);
        }}
        style={[styles.primaryPokemon, light && styles.primaryPokemonLight]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.primaryPokemonText,
            !selectedPokemon && styles.primaryPokemonPlaceholder,
            light && styles.primaryPokemonTextLight,
          ]}
        >
          {selectedPokemon ? displayPokemonName(selectedPokemon) : 'Enter Pokémon name'}
        </Text>
        <Text style={[styles.primaryChevron, light && styles.primaryPokemonTextLight]}>⌄</Text>
      </Pressable>
      <Text style={[styles.primaryLegend, light && styles.secondaryLight]}>LOOKING FOR</Text>
      <View style={styles.primaryOwnership}>
        {(['caught', 'trade', 'wanted'] as const).map((ownership) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: draft.ownership === ownership }}
            key={ownership}
            onPress={() => {
              beginPerformance('search_ownership_result_painted');
              onDraftChange(setNativePokemonSearchOwnership(draft, ownership));
            }}
            style={[
              styles.primaryOwnershipButton,
              light && styles.primaryOwnershipButtonLight,
              draft.ownership === ownership && styles.primaryOwnershipButtonActive,
            ]}
          >
            <Text style={[
              styles.primaryOwnershipText,
              light && styles.primaryOwnershipTextLight,
              draft.ownership === ownership && styles.primaryOwnershipTextActive,
            ]}>{modeLabel(ownership)}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => openFilters('location')}
        style={[styles.primaryLocation, light && styles.primaryLocationLight]}
      >
        <NativeUiIcon color="#2f9cff" name="map" size={22} />
        <View style={styles.primaryLocationCopy}>
          <Text style={[styles.primaryLocationLabel, light && styles.secondaryLight]}>LOCATION</Text>
          <Text numberOfLines={1} style={[styles.primaryLocationValue, light && styles.textLight]}>
            {draft.useCurrentLocation ? 'Current location' : draft.city || `Within ${draft.rangeKm} km`}
          </Text>
        </View>
      </Pressable>
      <View style={styles.primaryActions}>
        <Pressable
          accessibilityLabel="Filters"
          accessibilityRole="button"
          onPress={() => openFilters('pokemon')}
          style={[styles.primaryFilterButton, light && styles.primaryFilterButtonLight]}
        >
          <View style={styles.iconLabelRow}>
            <NativeUiIcon color={light ? '#172124' : '#f8fcfd'} name="filters" size={16} />
            <Text style={[styles.primaryFilterText, light && styles.textLight]}>Filters{filterCount ? '  •' : ''}</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityLabel="Search"
          accessibilityRole="button"
          disabled={isLoading}
          onPress={runSearch}
          style={[styles.primarySubmit, isLoading && styles.disabled]}
        >
          <View style={styles.iconLabelRow}>
            <NativeUiIcon color="#04131f" name="search" size={16} />
            <Text style={styles.primarySubmitText}>{isLoading ? 'Searching…' : 'Search'}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Fragment>
      <FlatList
      contentContainerStyle={[styles.content, { paddingBottom: 110 + insets.bottom }]}
      data={!isLoading && !error && displayMode === 'list' ? results : []}
      onContentSizeChange={restoreScrollPosition}
      onMomentumScrollEnd={reportScrollPosition}
      onScroll={(event) => { latestScrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}
      onScrollEndDrag={reportScrollPosition}
      ref={listRef}
      scrollEventThrottle={100}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      keyExtractor={(result) => result.id}
      ListHeaderComponent={(
        <>
          {hasSearched && !editingSubmittedSearch && selectedPokemon ? (
            <View style={[styles.summary, light && styles.summaryLight]}>
              <View style={styles.summaryImageFrame}>
                {previewImage ? (
                  <Image fadeDuration={0}
                    resizeMode="contain"
                    source={{ uri: absoluteUri(previewImage, assetBaseUrl) ?? previewImage }}
                    style={styles.summaryImage}
                  />
                ) : null}
                {draft.gigantamax || draft.dynamax ? (
                  <Image fadeDuration={0}
                    resizeMode="contain"
                    source={{ uri: `${assetBaseUrl.replace(/\/$/, '')}/images/${draft.gigantamax ? 'gigantamax' : 'dynamax'}.png` }}
                    style={styles.summaryMaxBadge}
                  />
                ) : null}
              </View>
              <View style={styles.summaryCopy}>
                <Text style={[styles.summaryEyebrow, { color: accent }]}>CURRENT SEARCH</Text>
                <Text numberOfLines={2} style={[styles.summaryTitle, light && styles.textLight]}>{[
                  draft.shiny ? 'Shiny' : '',
                  draft.shadow ? 'Shadow' : '',
                  draft.gigantamax ? 'Gigantamax' : draft.dynamax ? 'Dynamax' : '',
                  selectedPokemon.name,
                ].filter(Boolean).join(' ')}</Text>
                <View style={styles.summaryChips}>
                  <Text style={styles.modeChip}>{modeLabel(draft.ownership)}</Text>
                  <View style={[styles.neutralChip, styles.summaryChipRow, light && styles.neutralChipLight]}>
                    <NativeUiIcon color={light ? '#566467' : '#c1ccce'} name="map" size={10} />
                    <Text numberOfLines={2} style={[styles.neutralChipText, light && styles.secondaryLight]}>{draft.useCurrentLocation ? 'Current location' : draft.city ? draft.city.replace(/,\s*([^,]+)$/, ',\n$1') : 'Choose location'}</Text>
                  </View>
                  {filterCount ? (
                    <View style={[styles.neutralChip, styles.summaryChipRow, light && styles.neutralChipLight]}>
                      <NativeUiIcon color={light ? '#566467' : '#c1ccce'} name="filters" size={10} />
                      <Text style={[styles.neutralChipText, light && styles.secondaryLight]}>{filterCount} filters</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Pressable accessibilityLabel="Modify search" accessibilityRole="button" onPress={() => {
                beginPerformance('search_modify_result_painted');
                setEditingSubmittedSearch(true);
              }} style={styles.modifyButton}>
                <View style={styles.iconLabelRow}>
                  <NativeUiIcon color="#ffffff" name="filters" size={15} />
                  <Text style={styles.modifyButtonText}>Modify</Text>
                </View>
              </Pressable>
            </View>
          ) : primarySearchControls}
          <View accessibilityRole="tablist" style={[styles.displayModes, light && styles.displayModesLight]}>
            <Pressable
              aria-selected={displayMode === 'list'}
              accessibilityLabel="List view"
              accessibilityRole="tab"
              accessibilityState={{ selected: displayMode === 'list' }}
              onPress={() => changeDisplayMode('list')}
              style={[styles.displayMode, displayMode === 'list' && styles.displayModeActive]}
              testID="native-search-list-view"
            >
              <View style={styles.iconLabelRow}>
                <NativeUiIcon color={displayMode === 'list' ? '#ffffff' : light ? '#566467' : '#9caaad'} name="list" size={15} />
                <Text style={[styles.displayModeText, light && styles.secondaryLight, displayMode === 'list' && styles.displayModeTextActive]}>List</Text>
              </View>
            </Pressable>
            <Pressable
              aria-selected={displayMode === 'map'}
              accessibilityLabel="Map view"
              accessibilityRole="tab"
              accessibilityState={{ selected: displayMode === 'map' }}
              onPress={() => changeDisplayMode('map')}
              style={[styles.displayMode, displayMode === 'map' && styles.displayModeActive]}
              testID="native-search-map-view"
            >
              <View style={styles.iconLabelRow}>
                <NativeUiIcon color={displayMode === 'map' ? '#ffffff' : light ? '#566467' : '#9caaad'} name="map" size={15} />
                <Text style={[styles.displayModeText, light && styles.secondaryLight, displayMode === 'map' && styles.displayModeTextActive]}>Map</Text>
              </View>
            </Pressable>
          </View>
          {error ? (
            <View accessibilityLiveRegion="assertive" style={styles.errorState}>
              <Text style={styles.errorIcon}>!</Text>
              <Text style={[styles.stateTitle, light && styles.textLight]}>Search couldn’t be completed</Text>
              <Text style={[styles.stateCopy, light && styles.secondaryLight]}>{error}</Text>
              {onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable> : null}
            </View>
          ) : null}
          {isLoading ? (
            <View accessibilityLiveRegion="polite" style={[styles.loadingState, light && styles.summaryLight]}>
              <ActivityIndicator color="#2f9cff" size="large" />
              <Text style={[styles.stateTitle, light && styles.textLight]}>Searching community listings</Text>
              <Text style={[styles.stateCopy, light && styles.secondaryLight]}>Checking nearby trainers for the Pokémon you selected…</Text>
            </View>
          ) : null}
          {!isLoading && !error && hasSearched && results.length > 0 ? (
            <>
              <View style={styles.resultsHeader}>
                <View>
                  <View style={styles.resultsCompleteRow}>
                    <NativeUiIcon color={accent} name="check" size={12} />
                    <Text style={[styles.resultsComplete, { color: accent }]}>SEARCH COMPLETE</Text>
                  </View>
                  <Text style={[styles.resultsTitle, light && styles.textLight]}>{modeLabel(draft.ownership)} {draft.ownership === 'caught' ? 'Pokémon' : 'listings'}</Text>
                </View>
                <Text style={[styles.resultsCount, light && styles.neutralChipLight]}>{results.length} results</Text>
              </View>
              {displayMode === 'map' ? (
                <NativeSearchMapView
                  onReady={() => finishPerformance('search_display_result_painted')}
                  onOpenListing={onOpenListing}
                  onOpenProfile={onOpenProfile}
                  results={results}
                />
              ) : null}
            </>
          ) : null}
          {!isLoading && !error && hasSearched && results.length === 0 ? (
            <View style={[styles.loadingState, light && styles.summaryLight]}>
              <NativeUiIcon color="#2f9cff" name="search" size={31} />
              <Text style={[styles.stateTitle, light && styles.textLight]}>No listings fit these filters</Text>
              <Text style={[styles.stateCopy, light && styles.secondaryLight]}>Try a larger distance, fewer variant details, or another listing type.</Text>
              <Pressable accessibilityRole="button" onPress={() => openFilters()} style={styles.retryButton}><Text style={styles.retryText}>Modify filters</Text></Pressable>
            </View>
          ) : null}
          {!isLoading && !error && !hasSearched ? (
            <View style={styles.emptyState}>
              <NativeUiIcon color="#2f9cff" name="search" size={31} />
              <Text style={[styles.emptyEyebrow, { color: accent }]}>COMMUNITY LISTINGS</Text>
              <Text style={[styles.stateTitle, light && styles.textLight]}>Find your next Pokémon</Text>
              <Text style={[styles.stateCopy, light && styles.secondaryLight]}>Choose a Pokémon and listing type above to discover nearby trainers.</Text>
            </View>
          ) : null}
        </>
      )}
      renderItem={({ item }) => (
        <ResultCard assetBaseUrl={assetBaseUrl} light={light} onOpenListing={onOpenListing} onOpenProfile={onOpenProfile} result={item} />
      )}
      style={[styles.screen, light && styles.screenLight]}
      testID="native-pokemon-search"
      />
      {filtersOpen || (onFilterVisibilityChange && filterPrepared) ? (
        <NativePokemonSearchFilterSheet
          assetBaseUrl={assetBaseUrl}
          catalog={catalog}
          draft={filtersOpen ? draft : preparedFilterDraft}
          embedded={Boolean(onFilterVisibilityChange)}
          error={filterError}
          initialSection={filterSection}
          isSearching={isLoading}
          notice={filterNotice}
          onApply={runSearch}
          onChange={(nextDraft) => {
            beginPerformance('search_filter_result_painted');
            onDraftChange(nextDraft);
          }}
          onClose={closeFilters}
          onNotice={setFilterNotice}
          onReset={() => {
            beginPerformance('search_filter_result_painted');
            resetFilters();
          }}
          savedLocation={savedLocation}
          visible={filtersOpen}
        />
      ) : null}
      {pokemonPickerOpen ? (
        <NativeOptionPicker
          onClose={() => setPokemonPickerOpen(false)}
          onSelect={(option) => {
            const selected = catalog.find((pokemon) => pokemonKey(pokemon) === option.key);
            if (selected) {
              beginPerformance('search_pokemon_selection_painted');
              onDraftChange(normalizeNativePokemonSelection(draft, selected));
            }
            setPokemonPickerOpen(false);
          }}
          options={pokemonOptions}
          searchable
          selectedKey={selectedPokemon ? pokemonKey(selectedPokemon) : null}
          title="Choose a Pokémon"
          visible
        />
      ) : null}
    </Fragment>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#080d0f' },
  screenLight: { backgroundColor: '#f8fff9' },
  content: { width: '100%', maxWidth: 1200, alignSelf: 'center', padding: 10, paddingBottom: 110 },
  summary: { minHeight: 114, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderWidth: 1, borderColor: '#4c5d61', borderRadius: 13, backgroundColor: '#202527' },
  summaryLight: { borderColor: '#b4c1c3', backgroundColor: '#ffffff' },
  summaryImageFrame: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#5b696c', borderRadius: 11, backgroundColor: '#171d1f' },
  summaryImage: { width: '88%', height: '88%' },
  summaryMaxBadge: { position: 'absolute', width: 20, height: 20, top: 5, right: 5 },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryEyebrow: { alignSelf: 'stretch', color: '#2f9cff', fontSize: 9, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  summaryTitle: { alignSelf: 'stretch', marginTop: 2, color: '#f7fbfc', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  summaryChips: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  modeChip: { overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3, color: '#71e4b0', fontSize: 10, fontWeight: '900', borderWidth: 1, borderColor: '#2e9e6a', borderRadius: 999, backgroundColor: '#163a2b' },
  neutralChip: { overflow: 'hidden', maxWidth: 210, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: '#59686b', borderRadius: 999 },
  neutralChipText: { minWidth: 0, flexShrink: 1, color: '#c1ccce', fontSize: 10, fontWeight: '800' },
  summaryChipRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  neutralChipLight: { color: '#435154', borderColor: '#a8b5b7', backgroundColor: '#f4f7f7' },
  modifyButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#2f9cff', borderRadius: 9, backgroundColor: '#153d66' },
  modifyButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  primarySurface: { gap: 8, padding: 10, borderWidth: 1, borderColor: '#4c5d61', borderRadius: 13, backgroundColor: '#202527' },
  primarySurfaceLight: { borderColor: '#b4c1c3', backgroundColor: '#ffffff' },
  primaryLegend: { marginBottom: -4, color: '#aab5b7', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textAlign: 'center' },
  primaryPokemon: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, borderRadius: 9, backgroundColor: '#ffffff' },
  primaryPokemonLight: { borderWidth: 1, borderColor: '#aab8bb' },
  primaryPokemonText: { flex: 1, color: '#172124', fontSize: 15, fontWeight: '800' },
  primaryPokemonTextLight: { color: '#172124' },
  primaryPokemonPlaceholder: { color: '#6e7b7e', fontWeight: '500' },
  primaryChevron: { color: '#172124', fontSize: 20 },
  primaryOwnership: { flexDirection: 'row', gap: 6 },
  primaryOwnershipButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#58686b', borderRadius: 9, backgroundColor: '#24292b' },
  primaryOwnershipButtonLight: { borderColor: '#a8b5b8', backgroundColor: '#f4f7f7' },
  primaryOwnershipButtonActive: { borderColor: '#2f9cff', backgroundColor: '#153d66' },
  primaryOwnershipText: { color: '#aab5b7', fontSize: 12, fontWeight: '900' },
  primaryOwnershipTextLight: { color: '#566467' },
  primaryOwnershipTextActive: { color: '#ffffff' },
  primaryLocation: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: '#58686b', borderRadius: 9, backgroundColor: '#24292b' },
  primaryLocationLight: { borderColor: '#a8b5b8', backgroundColor: '#f4f7f7' },
  primaryLocationCopy: { flex: 1, minWidth: 0 },
  primaryLocationLabel: { color: '#aab5b7', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  primaryLocationValue: { color: '#f5f8f9', fontSize: 13, fontWeight: '900' },
  primaryActions: { flexDirection: 'row', gap: 8 },
  iconLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryFilterButton: { flex: 1.35, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#647477', borderRadius: 9 },
  primaryFilterButtonLight: { borderColor: '#8e9c9f' },
  primaryFilterText: { color: '#eef4f5', fontSize: 13, fontWeight: '900' },
  primarySubmit: { flex: 0.8, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#138cff' },
  primarySubmitText: { color: '#04131f', fontSize: 13, fontWeight: '900' },
  start: { alignItems: 'center', gap: 7, padding: 24, borderWidth: 1, borderColor: '#35484c', borderRadius: 14, backgroundColor: '#151d1f' },
  startIcon: { color: '#2f9cff', fontSize: 31 },
  startTitle: { color: '#f7fbfc', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  startCopy: { maxWidth: 430, color: '#a4b0b2', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  startButton: { minHeight: 48, marginTop: 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, borderRadius: 9, backgroundColor: '#2f9cff' },
  startButtonText: { color: '#05131e', fontWeight: '900' },
  emptyState: { alignItems: 'center', gap: 7, paddingTop: 64, paddingHorizontal: 24, paddingBottom: 32 },
  emptyEyebrow: { color: '#2f9cff', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  searchButton: { minHeight: 50, marginTop: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#138cff' },
  searchButtonText: { color: '#04131f', fontSize: 14, fontWeight: '900' },
  errorState: { marginTop: 10, alignItems: 'center', gap: 6, padding: 20, borderWidth: 1, borderColor: '#b94e61', borderRadius: 13, backgroundColor: '#361a22' },
  errorIcon: { color: '#ff6e83', fontSize: 28, fontWeight: '900' },
  loadingState: { marginTop: 10, alignItems: 'center', gap: 7, padding: 25, borderWidth: 1, borderColor: '#34484c', borderRadius: 13, backgroundColor: '#141c1e' },
  stateTitle: { color: '#f6fafb', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  stateCopy: { color: '#a6b1b3', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retryButton: { minHeight: 44, marginTop: 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 9, backgroundColor: '#2f9cff' },
  retryText: { color: '#06131f', fontWeight: '900' },
  resultsHeader: { marginTop: 26, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-end' },
  displayModes: { alignSelf: 'flex-end', flexDirection: 'row', gap: 3, marginTop: 0, marginBottom: 0, padding: 3, borderWidth: 1, borderColor: '#435458', borderRadius: 11, backgroundColor: '#111719' },
  displayModesLight: { borderColor: '#b1bec0', backgroundColor: '#ffffff' },
  displayMode: { minWidth: 80, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  displayModeActive: { backgroundColor: '#123a61' },
  displayModeText: { color: '#9ba8aa', fontSize: 13, fontWeight: '900' },
  displayModeTextActive: { color: '#ffffff' },
  resultsComplete: { color: '#2f9cff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  resultsCompleteRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resultsTitle: { color: '#f7fbfc', fontSize: 19, fontWeight: '900' },
  resultsCount: { marginLeft: 'auto', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, color: '#c2ccce', fontSize: 11, borderWidth: 1, borderColor: '#59686b', borderRadius: 999 },
  resultCard: { marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderTopWidth: 3, borderColor: '#385055', borderRadius: 14, backgroundColor: '#141c1e' },
  resultCardLight: { borderColor: '#aebdc0', backgroundColor: '#ffffff' },
  resultHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#34484c' },
  trainerAvatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 20 },
  trainerAvatarText: { fontSize: 16, fontWeight: '900' },
  resultHeaderCopy: { flex: 1, minWidth: 0 },
  listingType: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  trainerName: { color: '#f6fafb', fontSize: 16, fontWeight: '900' },
  distanceRow: { maxWidth: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  distance: { minWidth: 0, flexShrink: 1, color: '#a9b5b7', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  listingBody: { minHeight: 112, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8, padding: 10 },
  listingCopy: { flex: 1, minWidth: 0, alignSelf: 'flex-start', alignItems: 'flex-start', paddingTop: 8 },
  listingCp: { marginBottom: 2, color: '#a9b5b7', fontSize: 10, fontWeight: '800' },
  artwork: { width: 96, height: 96, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#0d1416' },
  artworkLight: { backgroundColor: '#f4f8f8' },
  artworkTransparent: { backgroundColor: 'transparent' },
  artworkSmall: { width: '100%', height: 62 },
  artworkPokemon: { width: '86%', height: '86%' },
  artworkMax: { position: 'absolute', width: 24, height: 24, top: 5, right: 5 },
  artworkMaxSmall: { width: 22, height: 22, top: 4, right: 4 },
  imageFallback: { color: '#829194', fontSize: 11 },
  listingNameRow: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 5 },
  listingName: { flexShrink: 1, color: '#f6fafb', fontSize: 18, fontWeight: '900', lineHeight: 21, textAlign: 'left' },
  genderFemale: { color: '#ff3b87', fontSize: 27, fontWeight: '900' },
  genderMale: { color: '#30a7ff', fontSize: 27, fontWeight: '900' },
  detailsDisclosure: { marginHorizontal: 10, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#405155', borderRadius: 9, backgroundColor: '#11191b' },
  detailsDisclosureLight: { borderColor: '#b6c3c5', backgroundColor: '#f4f7f7' },
  detailsSummary: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  detailsSummaryText: { color: '#c0cbcd', fontSize: 12, fontWeight: '900' },
  detailsBody: { gap: 7, paddingHorizontal: 12, paddingBottom: 12 },
  detailFacts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18 },
  detailFact: { color: '#a7b3b5', fontSize: 10, lineHeight: 15, textAlign: 'center' },
  detailValue: { color: '#f1f6f7', fontWeight: '900' },
  detailLine: { color: '#a7b3b5', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  related: { marginHorizontal: 10, padding: 10, borderWidth: 1, borderRadius: 11 },
  relatedHeader: { flexDirection: 'row', alignItems: 'center' },
  relatedEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  relatedTitle: { color: '#f0f6f7', fontSize: 15, fontWeight: '900' },
  relatedCount: { marginLeft: 'auto', overflow: 'hidden', minWidth: 32, paddingHorizontal: 7, paddingVertical: 5, fontSize: 11, fontWeight: '900', textAlign: 'center', borderRadius: 999 },
  relatedViewport: { maxHeight: 235, marginTop: 9 },
  relatedScroll: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingRight: 3, paddingBottom: 2 },
  relatedCard: { width: '31.5%', minHeight: 108, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 7, borderWidth: 1, borderColor: '#405155', borderRadius: 9, backgroundColor: '#101719' },
  relatedCardLight: { borderColor: '#aebdc0', backgroundColor: '#ffffff' },
  relatedName: { marginTop: 5, color: '#f0f6f7', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  matchLabel: { marginTop: 'auto', paddingTop: 4, fontSize: 8, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8, padding: 10 },
  secondaryButton: { flex: 0.85, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#596a6d', borderRadius: 9 },
  secondaryButtonLight: { borderColor: '#89999c' },
  secondaryButtonText: { color: '#ecf3f4', fontSize: 12, fontWeight: '900' },
  primaryButton: { flex: 1.15, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  primaryButtonText: { color: '#04130d', fontSize: 12, fontWeight: '900' },
  primaryButtonTextLight: { color: '#ffffff' },
  disabled: { opacity: 0.5 },
  textLight: { color: '#172124' },
  secondaryLight: { color: '#566467' },
});
