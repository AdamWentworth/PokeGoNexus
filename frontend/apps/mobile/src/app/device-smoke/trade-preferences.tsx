import { Redirect, useLocalSearchParams } from 'expo-router';
import { Animated, StyleSheet, View } from 'react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import { runtimeConfig } from '../../config/runtimeConfig';
import {
  NativeHorizontalPageSlider,
  type NativeHorizontalPageSliderHandle,
} from '../../components/NativeHorizontalPageSlider';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import {
  NativeTradeHubHeader,
  type NativeTradeHubView,
} from '../../features/trades/NativeTradeHubHeader';
import {
  buildNativeTradePreferenceEntrySets,
  resolveNativeTradePreferenceDraftCandidates,
} from '../../features/trades/nativeTradePreferencesModel';
import { persistNativeTradePreferenceMutation } from '../../features/trades/nativeTradePreferencesMutation';
import { nativeCollectionOutbox } from '../../storage/nativeCollectionOutbox';
import { NativeTradeActivityScreen } from '../../screens/NativeTradeActivityScreen';
import { NativeTradePreferencesScreen } from '../../screens/NativeTradePreferencesScreen';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../../observability/nativeUiInteractionTiming';

const ASSET_BASE_URL = 'https://pokegonexus.com';

const pokemon = (
  id: number,
  name: string,
  imagePath: string,
  shinyPath: string,
  patch: Record<string, unknown> = {},
): BasePokemon => ({
  pokemon_id: id,
  pokedex_number: id,
  name,
  attack: 100,
  defense: 100,
  stamina: 100,
  image_url: imagePath,
  image_url_shiny: shinyPath,
  shiny_available: 1,
  costumes: [],
  megaEvolutions: [],
  fusion: [],
  max: [],
  ...patch,
} as unknown as BasePokemon);

const CATALOG = [
  pokemon(1, 'Bulbasaur', '/images/default/default_pokemon_1.png', '/images/shiny/shiny_pokemon_1.png'),
  pokemon(3, 'Venusaur', '/images/default/default_pokemon_3.png', '/images/shiny/shiny_pokemon_3.png'),
  pokemon(4, 'Charmander', '/images/default/default_pokemon_4.png', '/images/shiny/shiny_pokemon_4.png', {
    shiny_rarity: 'community_day',
  }),
  pokemon(6, 'Charizard', '/images/default/default_pokemon_6.png', '/images/shiny/shiny_pokemon_6.png', {
    max: [{
      pokemon_id: 6,
      gigantamax: true,
      gigantamax_image_url: '/images/gigantamax/gigantamax_6.png',
      shiny_gigantamax_image_url: '/images/shiny_gigantamax/shiny_gigantamax_6.png',
    }],
  }),
  pokemon(7, 'Squirtle', '/images/default/default_pokemon_7.png', '/images/shiny/shiny_pokemon_7.png'),
  pokemon(25, 'Pikachu', '/images/default/default_pokemon_25.png', '/images/shiny/shiny_pokemon_25.png'),
  pokemon(150, 'Mewtwo', '/images/default/default_pokemon_150.png', '/images/shiny/shiny_pokemon_150.png', {
    rarity: 'Legendary',
  }),
  pokemon(245, 'Suicune', '/images/default/default_pokemon_245.png', '/images/shiny/shiny_pokemon_245.png', {
    rarity: 'Legendary',
  }),
  pokemon(376, 'Metagross', '/images/default/default_pokemon_376.png', '/images/shiny/shiny_pokemon_376.png'),
] as BasePokemon[];

const instance = ({
  id,
  pokemonId,
  status,
  shiny = false,
  gigantamax = false,
  locationCard = null,
  patch = {},
}: {
  id: string;
  pokemonId: number;
  status: 'trade' | 'wanted';
  shiny?: boolean;
  gigantamax?: boolean;
  locationCard?: string | null;
  patch?: Partial<PokemonInstance>;
}): PokemonInstance => ({
  instance_id: id,
  variant_id: `${String(pokemonId).padStart(4, '0')}-${shiny ? 'shiny_' : ''}${gigantamax ? 'gigantamax' : 'default'}`,
  pokemon_id: pokemonId,
  nickname: null,
  cp: null,
  level: null,
  attack_iv: null,
  defense_iv: null,
  stamina_iv: null,
  shiny,
  costume_id: null,
  lucky: false,
  shadow: false,
  purified: false,
  fast_move_id: null,
  charged_move1_id: null,
  charged_move2_id: null,
  weight: null,
  height: null,
  gender: null,
  mega: false,
  mega_form: null,
  is_mega: false,
  dynamax: false,
  gigantamax,
  crown: false,
  max_attack: null,
  max_guard: null,
  max_spirit: null,
  is_fused: false,
  fusion: null,
  fusion_form: null,
  fused_with: null,
  is_traded: false,
  traded_date: null,
  original_trainer_id: null,
  original_trainer_name: null,
  is_caught: status === 'trade',
  is_for_trade: status === 'trade',
  is_wanted: status === 'wanted',
  most_wanted: false,
  caught_tags: null,
  trade_tags: null,
  wanted_tags: null,
  not_trade_list: null,
  not_wanted_list: null,
  trade_filters: null,
  wanted_filters: null,
  mirror: false,
  pref_lucky: false,
  friendship_level: null,
  registered: true,
  favorite: false,
  disabled: false,
  pokeball: null,
  location_card: locationCard,
  location_caught: null,
  date_caught: null,
  date_added: '2026-08-24T00:00:00Z',
  last_update: 1,
  ...patch,
});

const INSTANCES: Record<string, PokemonInstance> = {
  'trade-bulbasaur': instance({
    id: 'trade-bulbasaur',
    pokemonId: 1,
    status: 'trade',
    shiny: true,
    patch: { not_wanted_list: { 'wanted-mewtwo': true } },
  }),
  'trade-charizard': instance({
    id: 'trade-charizard',
    pokemonId: 6,
    status: 'trade',
    shiny: true,
    gigantamax: true,
  }),
  'trade-squirtle': instance({ id: 'trade-squirtle', pokemonId: 7, status: 'trade', shiny: true }),
  'trade-pikachu': instance({ id: 'trade-pikachu', pokemonId: 25, status: 'trade', shiny: true }),
  'trade-metagross': instance({ id: 'trade-metagross', pokemonId: 376, status: 'trade', shiny: true }),
  'wanted-venusaur': instance({
    id: 'wanted-venusaur',
    pokemonId: 3,
    status: 'wanted',
    shiny: true,
    patch: { most_wanted: true },
  }),
  'wanted-charmander': instance({ id: 'wanted-charmander', pokemonId: 4, status: 'wanted', shiny: true }),
  'wanted-mewtwo': instance({ id: 'wanted-mewtwo', pokemonId: 150, status: 'wanted', shiny: true }),
  'wanted-suicune': instance({ id: 'wanted-suicune', pokemonId: 245, status: 'wanted', shiny: true }),
  'wanted-metagross': instance({ id: 'wanted-metagross', pokemonId: 376, status: 'wanted', shiny: true }),
};

const PARITY_CATALOG = [
  ...CATALOG.map((entry) => entry.pokemon_id === 25 ? {
    ...entry,
    costumes: [{
      costume_id: 62,
      name: 'party_hat',
      image_url: '/images/costumes/pokemon_25_party_default.png',
      image_url_shiny: '/images/costumes_shiny/pokemon_25_party_shiny.png',
      shiny_available: 1,
    }],
  } as BasePokemon : entry),
  pokemon(94, 'Gengar', '/images/default/pokemon_94.png', '/images/shiny/shiny_pokemon_94.png'),
];
const PARITY_INSTANCES: Record<string, PokemonInstance> = {
  '0025-party_hat_default_demo-trade': instance({
    id: '0025-party_hat_default_demo-trade',
    pokemonId: 25,
    status: 'trade',
    patch: {
      variant_id: '0025-party_hat_default',
      costume_id: 62,
      nickname: 'Festival spare',
      cp: 812,
    },
  }),
  '0094-default_demo-wanted': instance({
    id: '0094-default_demo-wanted',
    pokemonId: 94,
    status: 'wanted',
    patch: {
      friendship_level: 4,
      most_wanted: true,
      nickname: 'Mirror target',
      pref_lucky: true,
      registered: false,
      variant_id: '0094-default',
    },
  }),
};

export default function DeviceSmokeTradePreferencesRoute() {
  const params = useLocalSearchParams<{ coverage?: string | string[] }>();
  const coverage = (Array.isArray(params.coverage) ? params.coverage[0] : params.coverage) === '1';
  const catalog = coverage ? CATALOG : PARITY_CATALOG;
  const instances = coverage ? INSTANCES : PARITY_INSTANCES;
  const light = useNativeColorScheme() === 'light';
  const [activeView, setActiveView] = useState<NativeTradeHubView>('preferences');
  const [pageScrollX] = useState(() => new Animated.Value(0));
  const sliderRef = useRef<NativeHorizontalPageSliderHandle>(null);
  const changeView = useCallback((view: NativeTradeHubView) => {
    const startedAt = Date.now();
    setActiveView(view);
    sliderRef.current?.setPage(view === 'preferences' ? 0 : 1);
    markNativeUiPerformanceAfterPaint('trade_section_result_painted', startedAt);
  }, []);
  const entries = useMemo(() => buildNativeTradePreferenceEntrySets({
    assetOrigin: ASSET_BASE_URL,
    catalog,
    instances,
  }), [catalog, instances]);

  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;

  return (
    <View style={[styles.screen, light && styles.screenLight]}>
      <NativeHorizontalPageSlider
        activeIndex={activeView === 'preferences' ? 0 : 1}
        onIndexChange={(index) => setActiveView(index === 1 ? 'activity' : 'preferences')}
        ref={sliderRef}
        scrollX={pageScrollX}
      >
        <NativeTradePreferencesScreen
          assetBaseUrl={ASSET_BASE_URL}
          entries={entries}
          onOpenActivity={() => changeView('activity')}
          onSave={async (entry, draft) => {
            const candidates = resolveNativeTradePreferenceDraftCandidates({
              entry,
              filters: draft.filters,
              manuallyExcludedIds: new Set(draft.manuallyExcludedIds),
              mirror: draft.mirror,
            });
            await persistNativeTradePreferenceMutation({
              userId: 'device-smoke-trades',
              snapshot: { catalog, instances },
              request: {
                filteredOutIds: candidates
                  .filter((candidate) => candidate.excludedByRule)
                  .map((candidate) => candidate.collectionKey),
                filters: draft.filters,
                manuallyExcludedIds: draft.manuallyExcludedIds,
                mirror: draft.mirror,
                mode: entry.mode,
                selectedInstanceId: entry.collectionKey,
              },
              outbox: nativeCollectionOutbox,
              receiverClient: {
                post: async <T,>() => ({ accepted: true } as T),
              },
            });
          }}
          pageHeader={(
            <NativeTradeHubHeader
              activeView={activeView}
              assetBaseUrl={ASSET_BASE_URL}
              onOpenTradeBoard={() => undefined}
              onViewChange={changeView}
              scrollX={pageScrollX}
            />
          )}
          showModeTabs={false}
        />
        <NativeTradeActivityScreen
          assetBaseUrl={ASSET_BASE_URL}
          error={null}
          isLoading={false}
          onAction={async () => undefined}
          onOpenPreferences={() => changeView('preferences')}
          onRetry={() => undefined}
          onRevealPartner={async () => { throw new Error('No fixture partner.'); }}
          pageHeader={(
            <NativeTradeHubHeader
              activeView={activeView}
              assetBaseUrl={ASSET_BASE_URL}
              onOpenTradeBoard={() => undefined}
              onViewChange={changeView}
              scrollX={pageScrollX}
            />
          )}
          rows={[]}
          showModeTabs={false}
        />
      </NativeHorizontalPageSlider>
      <NativeRouteActionMenu currentPath="/trades" signedIn />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#071012' },
  screenLight: { backgroundColor: '#f8fff9' },
});
