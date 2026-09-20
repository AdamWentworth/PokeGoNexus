import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import { Redirect } from 'expo-router';
import { Animated, StyleSheet, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeHorizontalPageSlider,
  type NativeHorizontalPageSliderHandle,
} from '../../components/NativeHorizontalPageSlider';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { runtimeConfig } from '../../config/runtimeConfig';
import {
  createNativePokemonSearchDraft,
  type NativePokemonSearchDraft,
} from '../../features/search/nativePokemonSearchDraft';
import type { NativePokemonSearchResult } from '../../features/search/pokemonSearchModel';
import {
  NativeSearchHubHeader,
  type NativeSearchHubView,
} from '../../features/search/NativeSearchHubHeader';
import { NativePokemonSearchScreen } from '../../screens/NativePokemonSearchScreen';
import { NativeTrainerSearchScreen } from '../../screens/NativeTrainerSearchScreen';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../../observability/nativeUiInteractionTiming';

const ASSET_BASE_URL = 'https://pokegonexus.com';
const VIEWS: NativeSearchHubView[] = ['pokemon', 'trainers'];

const pokemon = (
  id: number,
  name: string,
  image: string,
  shinyImage: string,
  patch: Record<string, unknown> = {},
): BasePokemon => ({
  pokemon_id: id,
  pokedex_number: id,
  name,
  form: null,
  image_url: image,
  image_url_shiny: shinyImage,
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
  ...patch,
} as unknown as BasePokemon);

const CATALOG = [
  pokemon(6, 'Charizard', '/images/default/pokemon_6.png', '/images/shiny/shiny_pokemon_6.png', {
    max: [{
      pokemon_id: 6,
      gigantamax: true,
      gigantamax_image_url: '/images/gigantamax/gigantamax_6.png',
      shiny_gigantamax_image_url: '/images/shiny_gigantamax/shiny_gigantamax_6.png',
    }],
  }),
  pokemon(25, 'Pikachu', '/images/default/pokemon_25.png', '/images/shiny/shiny_pokemon_25.png'),
  pokemon(150, 'Mewtwo', '/images/default/pokemon_150.png', '/images/shiny/shiny_pokemon_150.png'),
];

const row = (
  id: string,
  pokemonId: number,
  name: string,
  status: 'trade' | 'wanted',
  imageUri: string,
  cp: number | null = null,
) => ({
  id,
  pokemonId,
  pokedexNumber: pokemonId,
  name,
  imageUri,
  locationBackgroundUri: null,
  maxKind: null,
  purified: false,
  lucky: false,
  typeIconUris: [],
  status,
  source: 'instance' as const,
  cp,
  favorite: false,
  mostWanted: false,
});

const EMPTY_DETAILS = {
  weight: null,
  height: null,
  moves: [],
  attackIv: null,
  defenseIv: null,
  staminaIv: null,
  friendshipLevel: null,
  prefLucky: false,
  wantedSizeLabels: [],
};

const RESULTS: NativePokemonSearchResult[] = [{
  id: 'search-trade-pikachu',
  username: 'HarbourMew',
  distanceKm: 2.8,
  mode: 'trade',
  details: {
    ...EMPTY_DETAILS,
    gender: 'Female',
    locationCaught: 'Coal Harbour',
    dateCaught: '2026-06-18',
  },
  row: row(
    'search-trade-pikachu',
    25,
    'Shiny Pikachu',
    'trade',
    `${ASSET_BASE_URL}/images/shiny/shiny_pokemon_25.png`,
    821,
  ),
  // The canonical Vite list capture cannot resolve this instance reference
  // into its optional compatibility grid, so its initial card omits that
  // section. Keep the native capture in that same rendered state.
  relatedRows: [],
  hasMutualMatch: true,
  mapCoordinate: [-123.119, 49.289],
  mapCoordinateIsApproximate: false,
}, {
  id: 'search-trade-pikachu-2',
  username: 'GranvilleDex',
  distanceKm: 5.4,
  mode: 'trade',
  details: {
    ...EMPTY_DETAILS,
    gender: 'Male',
    locationCaught: 'Granville Island',
    dateCaught: '2026-06-10',
  },
  row: row(
    'search-trade-pikachu-2',
    25,
    'Pikachu',
    'trade',
    `${ASSET_BASE_URL}/images/default/pokemon_25.png`,
    744,
  ),
  relatedRows: [],
  hasMutualMatch: false,
  mapCoordinate: [-123.13, 49.276],
  mapCoordinateIsApproximate: false,
}, {
  id: 'search-trade-pikachu-3',
  username: 'KitsCollector',
  distanceKm: 7.1,
  mode: 'trade',
  details: {
    ...EMPTY_DETAILS,
    gender: 'Female',
    locationCaught: 'Kitsilano',
    dateCaught: '2026-06-12',
  },
  row: row(
    'search-trade-pikachu-3',
    25,
    'Pikachu',
    'trade',
    `${ASSET_BASE_URL}/images/default/pokemon_25.png`,
    903,
  ),
  relatedRows: [],
  hasMutualMatch: false,
  mapCoordinate: [-123.155, 49.268],
  mapCoordinateIsApproximate: false,
}];

export default function DeviceSmokeSearchRoute() {
  const light = useNativeColorScheme() === 'light';
  const [activeView, setActiveView] = useState<NativeSearchHubView>('pokemon');
  const [pageScrollX] = useState(() => new Animated.Value(0));
  const sliderRef = useRef<NativeHorizontalPageSliderHandle>(null);
  const [draft, setDraft] = useState<NativePokemonSearchDraft>(() => ({
    ...createNativePokemonSearchDraft({
      city: 'Vancouver, British Columbia, Canada',
      latitude: 49.2827,
      longitude: -123.1207,
    }),
    pokemonId: 25,
    pokemonName: 'Pikachu',
    ownership: 'trade' as const,
    shiny: false,
    onlyMatchingTrades: false,
    limit: 5,
  }));
  const [hasSearched, setHasSearched] = useState(true);
  const [searchFiltersOpen, setSearchFiltersOpen] = useState(false);
  const [trainerQuery, setTrainerQuery] = useState('');
  const [debouncedTrainerQuery, setDebouncedTrainerQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTrainerQuery(trainerQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [trainerQuery]);
  const changeView = useCallback((view: NativeSearchHubView) => {
    const startedAt = Date.now();
    setActiveView(view);
    sliderRef.current?.setPage(VIEWS.indexOf(view), undefined, () => {
      markNativeUiPerformanceAfterPaint('search_mode_result_painted', startedAt);
    });
  }, []);
  const trainers = useMemo(() => debouncedTrainerQuery.length < 2 ? [] : [{
    username: 'OtherTrainer',
    pokemonGoName: 'OtherPogoName',
    team: 'Mystic',
    trainer_level: 50,
  }], [debouncedTrainerQuery]);
  const trainerResultIsCurrent = trainerQuery.trim().length >= 2
    && trainerQuery.trim() === debouncedTrainerQuery;

  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;

  return (
    <View style={[styles.screen, light && styles.screenLight]}>
      {!searchFiltersOpen ? (
        <NativeSearchHubHeader
          activeView={activeView}
          onViewChange={changeView}
          scrollX={pageScrollX}
        />
      ) : null}
      <NativeHorizontalPageSlider
        activeIndex={VIEWS.indexOf(activeView)}
        onIndexChange={(index) => setActiveView(VIEWS[index] ?? 'pokemon')}
        ref={sliderRef}
        scrollX={pageScrollX}
      >
        <NativePokemonSearchScreen
          assetBaseUrl={ASSET_BASE_URL}
          catalog={CATALOG}
          draft={draft}
          hasSearched={hasSearched}
          notice={hasSearched ? 'Search complete · 3 listings found.' : null}
          onDraftChange={setDraft}
          onFilterVisibilityChange={setSearchFiltersOpen}
          onOpenListing={() => undefined}
          onOpenProfile={() => undefined}
          onSearch={() => setHasSearched(true)}
          results={hasSearched ? RESULTS : []}
          savedLocation={{
            label: 'Vancouver, British Columbia, Canada',
            latitude: 49.2827,
            longitude: -123.1207,
          }}
        />
        <NativeTrainerSearchScreen
          entries={trainerResultIsCurrent ? trainers : []}
          hasSearched={trainerResultIsCurrent}
          onOpenCatalog={() => undefined}
          onOpenProfile={() => undefined}
          onQueryChange={setTrainerQuery}
          onSubmit={(query) => setDebouncedTrainerQuery(query.trim())}
          query={trainerQuery}
        />
      </NativeHorizontalPageSlider>
      {!searchFiltersOpen ? <NativeRouteActionMenu currentPath="/search" signedIn /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#080d0f' },
  screenLight: { backgroundColor: '#f8fff9' },
});
