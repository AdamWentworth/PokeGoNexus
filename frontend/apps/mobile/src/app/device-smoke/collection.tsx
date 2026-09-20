import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type {
  CreateCustomTagRequest,
  CustomTagParent,
  PokemonTagOrderKey,
  UpdateCustomTagRequest,
} from '@pokemongonexus/shared-contracts/users';
import type {
  NativeCollectionRow,
  NativeTagSummary,
} from '../../features/collection/collectionModel';
import {
  buildNativeCatalogRows,
  buildNativeCollectionRows,
  buildNativeTagSummaries,
} from '../../features/collection/collectionModel';
import { runtimeConfig } from '../../config/runtimeConfig';
import { NativeCollectionHubScreen } from '../../screens/NativeCollectionHubScreen';
import { NativeInstanceDetailScreen } from '../../screens/NativeInstanceDetailScreen';

const ASSET_BASE_URL = 'https://pokegonexus.com';
const CATALOG_FIXTURE_URL = Platform.OS === 'web'
  ? 'http://127.0.0.1:8092/pokemons.json'
  : `http://${runtimeConfig.mobile.deviceSmokeHost}:8092/pokemons.json`;
const INSTANCES_FIXTURE_URL = Platform.OS === 'web'
  ? 'http://127.0.0.1:8092/instances.json'
  : `http://${runtimeConfig.mobile.deviceSmokeHost}:8092/instances.json`;
const PERFORMANCE_INSTANCE_LIMIT = 180;

const normalizePerformanceInstances = (
  value: Record<string, PokemonInstance>,
): Record<string, PokemonInstance> => Object.fromEntries(
  Object.entries(value).slice(0, PERFORMANCE_INSTANCE_LIMIT).map(
    ([instanceId, instance], index) => {
      const normalized = {
        ...instance,
        instance_id: instance.instance_id ?? instanceId,
        variant_id: instance.variant_id ?? instanceId.replace(
          /_[0-9a-f]{8}-[0-9a-f-]{27}$/i,
          '',
        ),
      };
      if (index === 0) return [instanceId, { ...normalized, favorite: true }];
      if (index === 1) {
        return [instanceId, {
          ...normalized,
          is_caught: false,
          is_for_trade: false,
          is_wanted: true,
        }];
      }
      return [instanceId, normalized];
    },
  ),
);

const row = ({
  id,
  pokemonId,
  name,
  imagePath,
  status,
  cp = 2500,
  favorite = false,
  mostWanted = false,
  lucky = false,
  maxKind = null,
  typeIconPaths = [],
}: {
  id: string;
  pokemonId: number;
  name: string;
  imagePath: string;
  status: NativeCollectionRow['status'];
  cp?: number | null;
  favorite?: boolean;
  mostWanted?: boolean;
  lucky?: boolean;
  maxKind?: NativeCollectionRow['maxKind'];
  typeIconPaths?: string[];
}): NativeCollectionRow => ({
  id,
  pokemonId,
  pokedexNumber: pokemonId,
  name,
  imageUri: `${ASSET_BASE_URL}${imagePath}`,
  locationBackgroundUri: null,
  maxKind,
  purified: false,
  lucky,
  typeIconUris: typeIconPaths.map((path) => `${ASSET_BASE_URL}${path}`),
  status,
  source: 'instance',
  cp,
  favorite,
  mostWanted,
});

const ROWS: NativeCollectionRow[] = [
  row({
    id: 'smoke-shadow-venusaur',
    pokemonId: 3,
    name: 'Shiny Shadow Venusaur',
    imagePath: '/images/shiny_shadow/shiny_shadow_pokemon_3.png',
    status: 'caught',
    favorite: true,
    typeIconPaths: ['/images/types/grass.png', '/images/types/poison.png'],
  }),
  row({
    id: 'smoke-gmax-charizard',
    pokemonId: 6,
    name: 'Shiny Gigantamax Charizard',
    imagePath: '/images/shiny_gigantamax/shiny_gigantamax_6.png',
    status: 'trade',
    maxKind: 'gigantamax',
    typeIconPaths: ['/images/types/fire.png', '/images/types/flying.png'],
  }),
  row({
    id: 'smoke-shadow-typhlosion',
    pokemonId: 157,
    name: 'Shiny Shadow Typhlosion',
    imagePath: '/images/shiny_shadow/shiny_shadow_pokemon_157.png',
    status: 'caught',
    favorite: true,
    typeIconPaths: ['/images/types/fire.png'],
  }),
  row({
    id: 'smoke-suicune',
    pokemonId: 245,
    name: 'Shiny Suicune',
    imagePath: '/images/shiny/shiny_pokemon_245.png',
    status: 'trade',
    typeIconPaths: ['/images/types/water.png'],
  }),
  row({
    id: 'smoke-metagross',
    pokemonId: 376,
    name: 'Shiny Metagross',
    imagePath: '/images/shiny/shiny_pokemon_376.png',
    status: 'caught',
    favorite: true,
    maxKind: 'dynamax',
    typeIconPaths: ['/images/types/steel.png', '/images/types/psychic.png'],
  }),
  row({
    id: 'smoke-rayquaza',
    pokemonId: 384,
    name: 'Shiny Rayquaza',
    imagePath: '/images/shiny/shiny_pokemon_384.png',
    status: 'trade',
    typeIconPaths: ['/images/types/dragon.png', '/images/types/flying.png'],
  }),
  row({
    id: 'smoke-zacian',
    pokemonId: 888,
    name: 'Shiny Zacian',
    imagePath: '/images/shiny/shiny_pokemon_2290.png',
    status: 'caught',
    typeIconPaths: ['/images/types/fairy.png'],
  }),
  row({
    id: 'smoke-necrozma',
    pokemonId: 800,
    name: 'Necrozma',
    imagePath: '/images/default/pokemon_800.png',
    status: 'caught',
    typeIconPaths: ['/images/types/psychic.png'],
  }),
  row({
    id: 'smoke-lunala',
    pokemonId: 792,
    name: 'Lunala',
    imagePath: '/images/default/pokemon_792.png',
    status: 'caught',
    typeIconPaths: ['/images/types/psychic.png', '/images/types/ghost.png'],
  }),
  row({
    id: 'smoke-gmax-blastoise',
    pokemonId: 9,
    name: 'Gigantamax Blastoise',
    imagePath: '/images/gigantamax/gigantamax_9.png',
    status: 'wanted',
    cp: null,
    maxKind: 'gigantamax',
    mostWanted: true,
    typeIconPaths: ['/images/types/water.png'],
  }),
  row({
    id: 'smoke-pikachu',
    pokemonId: 25,
    name: 'Shiny Pikachu',
    imagePath: '/images/shiny/shiny_pokemon_25.png',
    status: 'wanted',
    cp: null,
    typeIconPaths: ['/images/types/electric.png'],
  }),
  row({
    id: 'smoke-mewtwo',
    pokemonId: 150,
    name: 'Shiny Mewtwo',
    imagePath: '/images/shiny/shiny_pokemon_150.png',
    status: 'wanted',
    cp: null,
    mostWanted: true,
    typeIconPaths: ['/images/types/psychic.png'],
  }),
];

// Keep the broad device-smoke inventory above for interaction coverage, while
// giving visual parity captures the exact three states used by the canonical
// Vite demo. These rows are intentionally direct-route-only so adding them does
// not change the collection/tag screenshots or Maestro fixture ordering.
const PARITY_REFERENCE_ROWS: NativeCollectionRow[] = [
  row({
    id: '0006-default_demo-charizard',
    pokemonId: 6,
    name: 'League Ace',
    imagePath: '/images/default/pokemon_6.png',
    status: 'caught',
    cp: 2799,
    favorite: true,
    typeIconPaths: ['/images/types/fire.png', '/images/types/flying.png'],
  }),
  row({
    id: '0025-party_hat_default_demo-trade',
    pokemonId: 25,
    name: 'Festival spare',
    imagePath: '/images/costumes/pokemon_25_party_default.png',
    status: 'trade',
    cp: 812,
    typeIconPaths: ['/images/types/electric.png'],
  }),
  row({
    id: '0094-default_demo-wanted',
    pokemonId: 94,
    name: 'Mirror target',
    imagePath: '/images/default/pokemon_94.png',
    status: 'wanted',
    cp: null,
    mostWanted: true,
    typeIconPaths: ['/images/types/ghost.png', '/images/types/poison.png'],
  }),
];

const ALL_FIXTURE_ROWS = [...ROWS, ...PARITY_REFERENCE_ROWS];

const PARITY_REFERENCE_TARGET_ROWS = PARITY_REFERENCE_ROWS.map((referenceRow) => ({
  ...referenceRow,
  lucky: referenceRow.id === '0094-default_demo-wanted' || referenceRow.lucky,
  name: referenceRow.id === '0006-default_demo-charizard'
    ? 'Charizard'
    : referenceRow.id === '0025-party_hat_default_demo-trade'
      ? 'Party Hat Pikachu'
      : 'Gengar',
}));

// The real trade-preference overlays can contain long candidate grids. Keep the
// direct-route fixture long enough to require nested Android scrolling so the
// smoke test cannot pass while only exercising a single, non-scrollable row.
const SCROLLABLE_WANTED_TARGET_ROWS: NativeCollectionRow[] = [
  PARITY_REFERENCE_TARGET_ROWS.find((candidate) => candidate.status === 'wanted'),
  ...ROWS.filter((candidate) => candidate.status === 'wanted'),
  ...ROWS.filter((candidate) => candidate.status === 'caught').slice(0, 4).map((candidate) => ({
    ...candidate,
    status: 'wanted' as const,
  })),
].filter((candidate): candidate is NativeCollectionRow => Boolean(candidate));
const SCROLLABLE_TRADE_TARGET_ROWS: NativeCollectionRow[] = [
  PARITY_REFERENCE_TARGET_ROWS.find((candidate) => candidate.status === 'trade'),
  ...ROWS.filter((candidate) => candidate.status === 'trade'),
  ...ROWS.filter((candidate) => candidate.status === 'caught').slice(0, 4).map((candidate) => ({
    ...candidate,
    status: 'trade' as const,
  })),
].filter((candidate): candidate is NativeCollectionRow => Boolean(candidate));

const PARITY_INVENTORY_ROWS: NativeCollectionRow[] = [
  row({ id: '0003-default_demo-venusaur', pokemonId: 3, name: 'Garden lead', imagePath: '/images/default/pokemon_3.png', status: 'caught', cp: 2411, typeIconPaths: ['/images/types/grass.png', '/images/types/poison.png'] }),
  { ...PARITY_REFERENCE_ROWS[0], name: 'League Ace', cp: 2844, favorite: true },
  row({ id: '0009-default_demo-blastoise', pokemonId: 9, name: 'Blastoise', imagePath: '/images/default/pokemon_9.png', status: 'caught', cp: 2388, lucky: true, typeIconPaths: ['/images/types/water.png'] }),
  { ...PARITY_REFERENCE_ROWS[1], name: 'Festival spare' },
  row({ id: '0094-default_demo-gengar', pokemonId: 94, name: 'Night shift', imagePath: '/images/default/pokemon_94.png', status: 'caught', cp: 2567, favorite: true, typeIconPaths: ['/images/types/ghost.png', '/images/types/poison.png'] }),
  row({ id: '0133-flower_crown_default_demo-eevee', pokemonId: 133, name: 'Flower trade', imagePath: '/images/costumes/pokemon_133_flower_default.png', status: 'caught', cp: 742, typeIconPaths: ['/images/types/normal.png'] }),
  row({ id: '0149-default_demo-dragonite', pokemonId: 149, name: 'Dragonite', imagePath: '/images/default/pokemon_149.png', status: 'caught', cp: 3472, typeIconPaths: ['/images/types/dragon.png', '/images/types/flying.png'] }),
  row({ id: '0150-default_demo-mewtwo', pokemonId: 150, name: 'Mewtwo', imagePath: '/images/default/pokemon_150.png', status: 'caught', cp: 4188, favorite: true, typeIconPaths: ['/images/types/psychic.png'] }),
];
const PARITY_WANTED_ROWS = [{ ...PARITY_REFERENCE_ROWS[2], name: 'Mirror target', mostWanted: true }];

const rowsWithStatus = (status: NativeCollectionRow['status']) =>
  ROWS.filter((candidate) => candidate.status === status);

const combatStatsFor = (pokemonId: number) => {
  if (pokemonId === 3) return { attack: 198, defense: 189, stamina: 190 };
  if (pokemonId === 6) return { attack: 223, defense: 173, stamina: 186 };
  if (pokemonId === 25) return { attack: 112, defense: 96, stamina: 111 };
  if (pokemonId === 94) return { attack: 261, defense: 149, stamina: 155 };
  if (pokemonId === 376) return { attack: 257, defense: 228, stamina: 190 };
  if (pokemonId === 800) return { attack: 251, defense: 195, stamina: 219 };
  if (pokemonId === 888) return { attack: 254, defense: 236, stamina: 192 };
  return { attack: 200, defense: 200, stamina: 200 };
};

const PARITY_INVENTORY_TAGS: NativeTagSummary[] = [
  {
    key: 'system:caught',
    parent: 'caught',
    name: 'All Caught',
    filterName: 'Caught',
    color: '#5798ff',
    tone: 'caught',
    rows: PARITY_INVENTORY_ROWS,
  },
  {
    key: 'system:favorites',
    parent: 'caught',
    name: 'Favorites',
    color: '#ffd45a',
    tone: 'favorites',
    rows: [
      PARITY_INVENTORY_ROWS.find((candidate) => candidate.pokemonId === 150)!,
      PARITY_INVENTORY_ROWS.find((candidate) => candidate.pokemonId === 6)!,
      PARITY_INVENTORY_ROWS.find((candidate) => candidate.pokemonId === 94)!,
    ],
  },
  {
    key: 'system:trade',
    parent: 'caught',
    name: 'For Trade',
    filterName: 'Trade',
    color: '#4bc574',
    tone: 'trade',
    rows: PARITY_INVENTORY_ROWS.filter((candidate) => candidate.status === 'trade'),
  },
];

const PARITY_WISHLIST_TAGS: NativeTagSummary[] = [
  {
    key: 'system:wanted',
    parent: 'wanted',
    name: 'All Wanted',
    filterName: 'Wanted',
    color: '#ef5b72',
    tone: 'wanted',
    rows: PARITY_WANTED_ROWS,
  },
  {
    key: 'system:most-wanted',
    parent: 'wanted',
    name: 'Most Wanted',
    color: '#ff704d',
    tone: 'most-wanted',
    rows: PARITY_WANTED_ROWS,
  },
];

// The long-running Android interaction flows exercise a broader collection
// than the compact Vite demo reference used by parity screenshots. Keep both
// deterministic fixture sets available instead of making one test mode break
// the other.
const INTERACTION_INVENTORY_TAGS: NativeTagSummary[] = [
  {
    key: 'system:favorites',
    parent: 'caught',
    name: 'Favorites',
    color: '#ffd45a',
    tone: 'favorites',
    rows: ROWS.filter((candidate) => candidate.favorite),
  },
  {
    key: 'system:trade',
    parent: 'caught',
    name: 'For Trade',
    filterName: 'Trade',
    color: '#4bc574',
    tone: 'trade',
    rows: rowsWithStatus('trade'),
  },
  {
    key: 'system:caught',
    parent: 'caught',
    name: 'All Caught',
    filterName: 'Caught',
    color: '#5798ff',
    tone: 'caught',
    rows: ROWS.filter((candidate) => candidate.status !== 'wanted'),
  },
  {
    key: 'custom:shadow-shinies',
    parent: 'caught',
    name: 'Shadow Shinies',
    color: '#6f35c5',
    tone: 'custom',
    rows: ROWS.filter((candidate) => candidate.name.includes('Shadow')),
  },
];

const INTERACTION_WISHLIST_TAGS: NativeTagSummary[] = [
  {
    key: 'system:wanted',
    parent: 'wanted',
    name: 'All Wanted',
    filterName: 'Wanted',
    color: '#ef5b72',
    tone: 'wanted',
    rows: rowsWithStatus('wanted'),
  },
  {
    key: 'system:most-wanted',
    parent: 'wanted',
    name: 'Most Wanted',
    color: '#ff704d',
    tone: 'most-wanted',
    rows: ROWS.filter((candidate) => candidate.mostWanted),
  },
];

const PARITY_INSTANCE_OVERRIDES: Record<string, Partial<PokemonInstance>> = {
  '0006-default_demo-charizard': {
    variant_id: '0006-default',
    nickname: 'League Ace',
    // The canonical overlay recomputes the displayed CP from level and IVs.
    // Store that derived value here so the native reference renders the same
    // visible state rather than the stale raw demo payload value (2844).
    cp: 2799,
    level: 38,
    attack_iv: 15,
    defense_iv: 14,
    stamina_iv: 15,
    fast_move_id: 54,
    charged_move1_id: 186,
    charged_move2_id: 83,
    favorite: true,
    caught_tags: ['Raid team', 'Kanto'],
    location_caught: 'Vancouver, BC',
    date_caught: '2026-06-15',
  },
  '0025-party_hat_default_demo-trade': {
    variant_id: '0025-party_hat_default',
    nickname: 'Festival spare',
    cp: 812,
    level: null,
    gender: null,
    weight: null,
    height: null,
    attack_iv: 11,
    defense_iv: 13,
    stamina_iv: 14,
    fast_move_id: null,
    charged_move1_id: null,
    charged_move2_id: null,
    costume_id: 41,
    trade_tags: ['Costume', 'Local trade'],
    location_caught: 'Seattle, WA',
    date_caught: '2026-05-28',
  },
  '0094-default_demo-wanted': {
    variant_id: '0094-default',
    nickname: 'Mirror target',
    registered: false,
    most_wanted: true,
    wanted_tags: ['Lucky mirror', 'Ghost'],
    fast_move_id: null,
    charged_move1_id: null,
    charged_move2_id: null,
    friendship_level: 4,
    pref_lucky: true,
  },
};

const SMOKE_INSTANCES = Object.fromEntries(ALL_FIXTURE_ROWS.map((entry) => [entry.id, {
  instance_id: entry.id,
  variant_id: `${String(entry.pokemonId).padStart(4, '0')}-default`,
  pokemon_id: entry.pokemonId,
  is_caught: entry.status !== 'wanted',
  is_for_trade: entry.status === 'trade',
  is_wanted: entry.status === 'wanted',
  favorite: entry.favorite,
  most_wanted: entry.mostWanted,
  caught_tags: entry.name.includes('Shadow') ? ['shadow-shinies'] : [],
  wanted_tags: [],
  registered: true,
  disabled: false,
  lucky: false,
  shadow: entry.name.includes('Shadow'),
  purified: false,
  nickname: null,
  cp: entry.cp,
  level: entry.status === 'wanted' ? null : 40,
  gender: entry.status === 'wanted' ? null : 'Male',
  weight: entry.status === 'wanted' ? null : 90.5,
  height: entry.status === 'wanted' ? null : 1.7,
  attack_iv: entry.status === 'wanted' ? null : 15,
  defense_iv: entry.status === 'wanted' ? null : 12,
  stamina_iv: entry.status === 'wanted' ? null : 13,
  fast_move_id: 101,
  charged_move1_id: 102,
  charged_move2_id: null,
  friendship_level: entry.status === 'wanted' ? 4 : null,
  pref_lucky: entry.status === 'wanted',
  location_card: null,
  location_caught: entry.status === 'wanted' || entry.id === 'smoke-metagross'
    ? null
    : 'Burnaby, British Columbia, Canada',
  date_caught: entry.status === 'wanted' ? null : '2026-08-24',
  mega: false,
  is_mega: false,
  crown: false,
  dynamax: entry.maxKind === 'dynamax',
  gigantamax: entry.maxKind === 'gigantamax',
  max_attack: entry.maxKind ? 1 : null,
  max_guard: entry.maxKind ? 0 : null,
  max_spirit: entry.maxKind ? 0 : null,
  is_fused: false,
  ...PARITY_INSTANCE_OVERRIDES[entry.id],
} as unknown as PokemonInstance]));

export default function DeviceSmokeCollectionRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    foreign?: string | string[];
    interaction?: string | string[];
    instance?: string | string[];
    performance?: string | string[];
    tag?: string | string[];
    targetScroll?: string | string[];
  }>();
  const foreignParam = Array.isArray(params.foreign) ? params.foreign[0] : params.foreign;
  const interactionParam = Array.isArray(params.interaction) ? params.interaction[0] : params.interaction;
  const performanceParam = Array.isArray(params.performance)
    ? params.performance[0]
    : params.performance;
  const tagParam = Array.isArray(params.tag) ? params.tag[0] : params.tag;
  const targetScrollParam = Array.isArray(params.targetScroll)
    ? params.targetScroll[0]
    : params.targetScroll;
  const scrollableTargets = targetScrollParam === '1';
  const foreignMode = foreignParam === '1';
  const initialTagKey = tagParam === 'trade'
    ? 'system:trade'
    : tagParam === 'wanted'
      ? 'system:wanted'
      : foreignMode ? 'system:caught' : null;
  const initialInstanceId = Array.isArray(params.instance)
    ? params.instance[0]
    : params.instance;
  const interactionFixtures = interactionParam === '1'
    || foreignMode
    || initialInstanceId?.startsWith('smoke-') === true;
  const performanceFixtures = performanceParam === '1';
  const initialRow = ALL_FIXTURE_ROWS.find((entry) => entry.id === initialInstanceId) ?? null;
  const [openedContext, setOpenedContext] = useState<{
    row: NativeCollectionRow;
    orderedRows: NativeCollectionRow[];
  } | null>(() => initialRow ? {
    row: initialRow,
    orderedRows: rowsWithStatus(initialRow.status),
  } : null);
  const [catalogRows, setCatalogRows] = useState<NativeCollectionRow[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [smokeInstances, setSmokeInstances] = useState(SMOKE_INSTANCES);
  const [inventoryTags, setInventoryTags] = useState(() => (
    interactionFixtures ? INTERACTION_INVENTORY_TAGS : PARITY_INVENTORY_TAGS
  ));
  const [wishlistTags, setWishlistTags] = useState(() => (
    interactionFixtures ? INTERACTION_WISHLIST_TAGS : PARITY_WISHLIST_TAGS
  ));
  const [nextTagId, setNextTagId] = useState(1);

  useEffect(() => {
    if (!initialInstanceId) return;
    const requestedRow = ALL_FIXTURE_ROWS.find((entry) => entry.id === initialInstanceId);
    if (!requestedRow) return;
    const update = setTimeout(() => {
      setOpenedContext({
        row: requestedRow,
        orderedRows: rowsWithStatus(requestedRow.status),
      });
    }, 0);
    return () => clearTimeout(update);
  }, [initialInstanceId]);

  useEffect(() => {
    if (!runtimeConfig.mobile.deviceSmokeMode) return undefined;
    const controller = new AbortController();
    const loadFixture = async () => {
      const [catalogResponse, instancesResponse] = await Promise.all([
        fetch(CATALOG_FIXTURE_URL, { signal: controller.signal }),
        performanceFixtures
          ? fetch(INSTANCES_FIXTURE_URL, { signal: controller.signal })
          : Promise.resolve(null),
      ]);
      if (!catalogResponse.ok) {
        throw new Error(`Catalog fixture returned ${catalogResponse.status}.`);
      }
      const catalogPayload: unknown = await catalogResponse.json();
      if (!Array.isArray(catalogPayload)) throw new Error('Catalog fixture is not an array.');
      const catalog = catalogPayload as BasePokemon[];
      setCatalogRows(buildNativeCatalogRows(catalog, ASSET_BASE_URL));
      if (instancesResponse) {
        if (!instancesResponse.ok) {
          throw new Error(`Instances fixture returned ${instancesResponse.status}.`);
        }
        const instancesPayload: unknown = await instancesResponse.json();
        if (!instancesPayload || typeof instancesPayload !== 'object' || Array.isArray(instancesPayload)) {
          throw new Error('Instances fixture is not an object.');
        }
        const normalizedInstances = normalizePerformanceInstances(
          instancesPayload as Record<string, PokemonInstance>,
        );
        const collectionRows = buildNativeCollectionRows(
          normalizedInstances,
          catalog,
          ASSET_BASE_URL,
        );
        setSmokeInstances(normalizedInstances);
        setInventoryTags(buildNativeTagSummaries(
          collectionRows,
          normalizedInstances,
          null,
          'caught',
        ));
        setWishlistTags(buildNativeTagSummaries(
          collectionRows,
          normalizedInstances,
          null,
          'wanted',
        ));
      }
    };
    void loadFixture()
      .then(() => {
        setCatalogError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogError(error instanceof Error ? error.message : 'Catalog fixture failed to load.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setCatalogLoading(false);
      });
    return () => controller.abort();
  }, [performanceFixtures]);

  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;

  const openedRow = openedContext?.row ?? null;
  const openedRows = openedContext?.orderedRows ?? [];
  const openedIndex = openedRow
    ? openedRows.findIndex((row) => row.id === openedRow.id)
    : -1;
  const previousRow = openedIndex > 0 ? openedRows[openedIndex - 1] : null;
  const nextRow = openedIndex >= 0 && openedIndex < openedRows.length - 1
    ? openedRows[openedIndex + 1]
    : null;
  const navigateWithinOverlay = (row: NativeCollectionRow) => {
    setOpenedContext((current) => ({
      row,
      orderedRows: current?.orderedRows ?? rowsWithStatus(row.status),
    }));
  };
  const updateTags = (
    parent: CustomTagParent,
    update: (current: NativeTagSummary[]) => NativeTagSummary[],
  ) => {
    if (parent === 'wanted') setWishlistTags(update);
    else setInventoryTags(update);
  };
  const createTag = async (request: CreateCustomTagRequest) => {
    const tagId = `created-${nextTagId}`;
    setNextTagId((current) => current + 1);
    updateTags(request.parent, (current) => [...current, {
      key: `custom:${tagId}`,
      parent: request.parent,
      name: request.name,
      color: request.color,
      tone: 'custom',
      rows: [],
    }]);
  };
  const deleteTag = async (tagId: string) => {
    const remove = (current: NativeTagSummary[]) => current.filter(
      (tag) => tag.key !== `custom:${tagId}`,
    );
    setInventoryTags(remove);
    setWishlistTags(remove);
  };
  const updateTag = async (tagId: string, request: UpdateCustomTagRequest) => {
    const replace = (current: NativeTagSummary[]) => current.map((tag) => (
      tag.key === `custom:${tagId}`
        ? {
            ...tag,
            name: request.name ?? tag.name,
            color: request.color ?? tag.color,
          }
        : tag
    ));
    setInventoryTags(replace);
    setWishlistTags(replace);
  };
  const saveTagOrder = async (
    parent: CustomTagParent,
    tagKeys: PokemonTagOrderKey[],
  ) => {
    updateTags(parent, (current) => {
      const byKey = new Map(current.map((tag) => [tag.key, tag]));
      return tagKeys.flatMap((key) => {
        const tag = byKey.get(key);
        return tag ? [tag] : [];
      });
    });
  };

  const isParityCharizard = openedRow?.id === '0006-default_demo-charizard';
  const isParityTrade = openedRow?.id === '0025-party_hat_default_demo-trade';
  const isParityWanted = openedRow?.id === '0094-default_demo-wanted';
  const targetRows = isParityTrade
    ? scrollableTargets
      ? SCROLLABLE_WANTED_TARGET_ROWS
      : PARITY_REFERENCE_TARGET_ROWS.filter((row) => row.id === '0094-default_demo-wanted')
    : isParityWanted
      ? scrollableTargets
        ? SCROLLABLE_TRADE_TARGET_ROWS
        : PARITY_REFERENCE_TARGET_ROWS.filter((row) => row.id === '0025-party_hat_default_demo-trade')
      : openedRow?.status === 'wanted'
        ? rowsWithStatus('trade')
        : openedRow?.status === 'trade'
          ? rowsWithStatus('wanted')
          : [];
  const detailStats = isParityCharizard
    ? [{ label: 'Level', value: '38' }]
    : openedRow?.status !== 'wanted' && !isParityTrade
      ? [{ label: 'Level', value: '40' }]
      : [];
  const detailIvs = isParityCharizard
    ? [
        { label: 'Attack', value: 15 },
        { label: 'Defense', value: 14 },
        { label: 'HP', value: 15 },
      ]
    : isParityTrade
      ? [
          { label: 'Attack', value: 11 },
          { label: 'Defense', value: 13 },
          { label: 'HP', value: 14 },
        ]
      : openedRow?.status !== 'wanted'
        ? [
            { label: 'Attack', value: 15 },
            { label: 'Defense', value: 12 },
            { label: 'HP', value: 13 },
          ]
        : [];
  const detailMoves = isParityCharizard
    ? [
        { label: 'Fast move', value: 'Fire Spin', typeName: 'Fire', typeIconUri: `${ASSET_BASE_URL}/images/types/fire.png`, raidPower: 14, pvpPower: 9 },
        { label: 'Charged move', value: 'Overheat', typeName: 'Fire', typeIconUri: `${ASSET_BASE_URL}/images/types/fire.png`, raidPower: 160, pvpPower: 130 },
      ]
    : openedRow?.status !== 'wanted' && !isParityTrade
      ? openedRow?.pokemonId === 376
        ? [
            { label: 'Fast move', value: 'Bullet Punch', typeName: 'Steel', typeIconUri: `${ASSET_BASE_URL}/images/types/steel.png`, raidPower: 9, pvpPower: 9 },
            { label: 'Charged move', value: 'Meteor Mash', legacy: true, typeName: 'Steel', typeIconUri: `${ASSET_BASE_URL}/images/types/steel.png`, raidPower: 100, pvpPower: 100 },
          ]
        : [
            { label: 'Fast move', value: 'Vine Whip', typeName: 'Grass', typeIconUri: `${ASSET_BASE_URL}/images/types/grass.png`, raidPower: 7, pvpPower: 5 },
            { label: 'Charged move', value: 'Frenzy Plant', legacy: true, typeName: 'Grass', typeIconUri: `${ASSET_BASE_URL}/images/types/grass.png`, raidPower: 100, pvpPower: 100 },
          ]
      : [];
  const detailProvenance = isParityCharizard
    ? [
        { label: 'Caught near', value: 'Vancouver, BC' },
        { label: 'Caught on', value: '2026-06-15' },
      ]
    : isParityTrade
      ? [
          { label: 'Caught near', value: 'Seattle, WA' },
          { label: 'Caught on', value: '2026-05-28' },
        ]
      : openedRow?.status === 'caught'
        ? [
            { label: 'Caught near', value: 'Burnaby, British Columbia, Canada' },
            { label: 'Caught on', value: '2026-08-24' },
          ]
        : [];

  return (
    <>
      <NativeCollectionHubScreen
        assetBaseUrl={ASSET_BASE_URL}
        catalogOwner={foreignMode ? 'OtherTrainer' : null}
        catalogRows={foreignMode ? ROWS : catalogRows}
        error={catalogError}
        initialTagKey={initialTagKey}
        inventoryTags={inventoryTags}
        instances={smokeInstances}
        isLoading={catalogLoading}
        onActionMenuNavigate={(path) => {
          if (path === '/raid') {
            router.push({ pathname: '/device-smoke/tools', params: { tool: 'raid' } });
          }
        }}
        onActionMenuPress={() => undefined}
        onCreateTag={createTag}
        onDeleteTag={deleteTag}
        onOpenEntry={(row, orderedRows) => setOpenedContext({ row, orderedRows })}
        onOrganizePokemon={async () => ({
          message: 'Pokémon organized in the device fixture.',
        })}
        onRetry={() => undefined}
        onReturnToContext={foreignMode ? () => undefined : undefined}
        onSaveTagOrder={saveTagOrder}
        onUpdateTag={updateTag}
        requireTagSelection={foreignMode}
        wishlistTags={wishlistTags}
      />
      {openedRow ? (
        <Modal
          animationType="slide"
          onRequestClose={() => setOpenedContext(null)}
          presentationStyle="fullScreen"
          visible
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
              <NativeInstanceDetailScreen
            assetBaseUrl={ASSET_BASE_URL}
            cachedAt={null}
            canEdit={!foreignMode}
            detail={{
              instance: smokeInstances[openedRow.id],
              row: openedRow,
              baseStats: combatStatsFor(openedRow.pokemonId),
              targetRows,
              traits: openedRow.name.includes('Shiny') ? ['Shiny'] : [],
              stats: detailStats,
              ivs: detailIvs,
              moves: detailMoves,
              preferences: openedRow.status === 'wanted'
                ? [
                    { label: 'Friendship', value: '4/5 hearts' },
                    { label: 'Lucky trade', value: 'Requested' },
                  ]
                : [],
              moveOptions: openedRow.pokemonId === 376
                ? [
                    { id: 101, name: 'Bullet Punch', kind: 'fast', legacy: false, typeName: 'Steel', typeIconUri: `${ASSET_BASE_URL}/images/types/steel.png`, raidPower: 9, pvpPower: 9 },
                    { id: 102, name: 'Meteor Mash', kind: 'charged', legacy: true, typeName: 'Steel', typeIconUri: `${ASSET_BASE_URL}/images/types/steel.png`, raidPower: 100, pvpPower: 100 },
                    { id: 103, name: 'Psychic', kind: 'charged', legacy: false, typeName: 'Psychic', typeIconUri: `${ASSET_BASE_URL}/images/types/psychic.png`, raidPower: 90, pvpPower: 75 },
                  ]
                : [
                    { id: 101, name: 'Vine Whip', kind: 'fast', legacy: false, typeName: 'Grass', typeIconUri: `${ASSET_BASE_URL}/images/types/grass.png`, raidPower: 7, pvpPower: 5 },
                    { id: 102, name: 'Frenzy Plant', kind: 'charged', legacy: true, typeName: 'Grass', typeIconUri: `${ASSET_BASE_URL}/images/types/grass.png`, raidPower: 100, pvpPower: 100 },
                    { id: 103, name: 'Sludge Bomb', kind: 'charged', legacy: false, typeName: 'Poison', typeIconUri: `${ASSET_BASE_URL}/images/types/poison.png`, raidPower: 80, pvpPower: 80 },
                  ],
              backgroundOptions: [{
                id: 9,
                name: 'Vancouver City Safari',
                imageUri: `${ASSET_BASE_URL}/images/backgrounds/bg_grass.png`,
              }],
              appearanceImageUris: {
                base: openedRow.imageUri,
                shadow: openedRow.imageUri,
                purified: openedRow.name.includes('Shiny')
                  ? `${ASSET_BASE_URL}/images/shiny/shiny_pokemon_${openedRow.pokemonId}.png`
                  : `${ASSET_BASE_URL}/images/pokemon/pokemon_${openedRow.pokemonId}.png`,
              },
              megaOptions: openedRow.pokemonId === 6
                ? [
                    {
                      form: 'X',
                      imageUri: `${ASSET_BASE_URL}/images/mega/mega_6_X.png`,
                      label: 'Mega Charizard X',
                      primal: false,
                      stats: { attack: 273, defense: 213, stamina: 186 },
                      typeIconUris: [
                        `${ASSET_BASE_URL}/images/types/fire.png`,
                        `${ASSET_BASE_URL}/images/types/dragon.png`,
                      ],
                    },
                    {
                      form: 'Y',
                      imageUri: `${ASSET_BASE_URL}/images/mega/mega_6_Y.png`,
                      label: 'Mega Charizard Y',
                      primal: false,
                      stats: { attack: 319, defense: 212, stamina: 186 },
                      typeIconUris: [
                        `${ASSET_BASE_URL}/images/types/fire.png`,
                        `${ASSET_BASE_URL}/images/types/flying.png`,
                      ],
                    },
                  ]
                : openedRow.pokemonId === 376
                  ? [{
                    form: null,
                    imageUri: openedRow.imageUri,
                    label: 'Mega',
                    primal: false,
                    stats: { attack: 300, defense: 289, stamina: 190 },
                    typeIconUris: [
                      `${ASSET_BASE_URL}/images/types/steel.png`,
                      `${ASSET_BASE_URL}/images/types/dragon.png`,
                    ],
                  }]
                : [],
              fusionOptions: openedRow.pokemonId === 800
                ? [{
                    id: 2,
                    imageUri: `${ASSET_BASE_URL}/images/fusion/fusion_2.png`,
                    moveOptions: [{
                      id: 202,
                      name: 'Moongeist Beam',
                      kind: 'charged',
                      legacy: false,
                      typeName: 'Ghost',
                    }],
                    name: 'Dawn Wings Necrozma',
                    stats: { attack: 277, defense: 220, stamina: 200 },
                    typeIconUris: [
                      `${ASSET_BASE_URL}/images/types/psychic.png`,
                      `${ASSET_BASE_URL}/images/types/ghost.png`,
                    ],
                    partnerPokemonId: 792,
                    partnerRows: ROWS.filter((candidate) => candidate.id === 'smoke-lunala'),
                    backgroundOptions: [{
                      id: 501,
                      name: 'Fusion sky',
                      imageUri: `${ASSET_BASE_URL}/images/backgrounds/bg_psychic.png`,
                    }],
                    partnerBackgroundIds: { 'smoke-lunala': 502 },
                    comboBackgrounds: [{
                      ownBackgroundId: 501,
                      partnerBackgroundId: 502,
                      option: {
                        id: 503,
                        name: 'Combined fusion sky',
                        imageUri: `${ASSET_BASE_URL}/images/backgrounds/bg_ghost.png`,
                      },
                    }],
                  }]
                : [],
              crownOptions: openedRow.pokemonId === 888
                ? [{
                    form: 'Crowned Sword',
                    imageUri: `${ASSET_BASE_URL}/images/shiny/shiny_pokemon_888.png`,
                    label: 'Crowned Sword',
                    stats: { attack: 332, defense: 240, stamina: 192 },
                    typeIconUris: [
                      `${ASSET_BASE_URL}/images/types/fairy.png`,
                      `${ASSET_BASE_URL}/images/types/steel.png`,
                    ],
                  }]
                : [],
              sizeThresholds: {
                pokedex_height: 2,
                pokedex_weight: 100,
                height_standard_deviation: 0.2,
                weight_standard_deviation: 10,
                height_xxs_threshold: 1.4,
                height_xs_threshold: 1.7,
                height_xl_threshold: 2.3,
                height_xxl_threshold: 2.6,
                weight_xxs_threshold: 70,
                weight_xs_threshold: 85,
                weight_xl_threshold: 115,
                weight_xxl_threshold: 130,
              },
              provenance: detailProvenance,
            }}
            error={null}
            isLoading={false}
            isSaving={false}
            movesWarning={null}
            onBack={() => setOpenedContext(null)}
            onEditInCurrentApp={() => undefined}
            onNext={openedRow.status !== 'wanted' && nextRow ? () => navigateWithinOverlay(nextRow) : undefined}
            onOpenTarget={(instanceId) => {
              const target = ALL_FIXTURE_ROWS.find((row) => row.id === instanceId);
              if (target) setOpenedContext({ row: target, orderedRows: [target] });
            }}
            onPrevious={openedRow.status !== 'wanted' && previousRow ? () => navigateWithinOverlay(previousRow) : undefined}
            onRetry={() => undefined}
            onSaveDetails={async (patch) => {
              setSmokeInstances((current) => ({
                ...current,
                [openedRow.id]: { ...current[openedRow.id], ...patch },
              }));
            }}
            onToggleFavorite={() => undefined}
            saveError={null}
            saveNotice={null}
              />
            </SafeAreaView>
          </GestureHandlerRootView>
        </Modal>
      ) : null}
    </>
  );
}
