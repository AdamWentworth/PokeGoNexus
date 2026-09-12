import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import type {
  BasePokemon,
  Move,
  PokemonPvPRankingsPayload,
} from "@pokemongonexus/shared-contracts/pokemon";
import type { PokemonCommunityRankingsPayload } from "@pokemongonexus/shared-contracts/search";
import type { PokemonInstance } from "@pokemongonexus/shared-contracts/instances";
import { buildPokemonCatalogEntries } from "@pokemongonexus/shared-domain/catalog";
import { runtimeConfig } from "../../config/runtimeConfig";
import { NativeMaxScreen } from "../../screens/NativeMaxScreen";
import { NativePokedexDetailScreen } from "../../screens/NativePokedexDetailScreen";
import { NativePokedexScreen } from "../../screens/NativePokedexScreen";
import { NativePvpScreen } from "../../screens/NativePvpScreen";
import { NativeRaidScreen } from "../../screens/NativeRaidScreen";
import { NativeRankingsScreen } from "../../screens/NativeRankingsScreen";
import type { NativePokedexManualRegistration } from "../../features/tools/nativePokedexModel";
import { buildNativePokedexEntries } from "../../features/tools/nativePokedexModel";
import type {
  NativeRankingCategory,
  NativeRankingCollectionFilter,
  NativeRankingMode,
} from "../../features/tools/nativeRankingsModel";
import {
  buildNativeRankingRows,
  countNativeRankingCollectionFilters,
  filterNativeRankingRowsByCollection,
} from "../../features/tools/nativeRankingsModel";
import { NativeRouteActionMenu } from "../../components/NativeRouteActionMenu";

const ASSET_BASE_URL = runtimeConfig.api.frontendAppUrl;
const CATALOG_FIXTURE_URL = Platform.OS === "web"
  ? "http://127.0.0.1:8092/pokemons.json"
  : `http://${runtimeConfig.mobile.deviceSmokeHost}:8092/pokemons.json`;
const imageUri = `${ASSET_BASE_URL}/images/shiny/shiny_pokemon_1.png`;
const fastMove = {
  move_id: 1,
  name: "Vine Whip",
  raid_power: 10,
  raid_energy: 8,
  raid_cooldown: 1,
  pvp_power: 5,
  pvp_energy: 8,
  pvp_turns: 2,
  is_fast: 1,
  type_name: "grass",
  type: "grass",
} as Move;
const chargedMove = {
  ...fastMove,
  move_id: 2,
  name: "Power Whip",
  raid_power: 90,
  raid_energy: -50,
  raid_cooldown: 2.5,
  pvp_power: 90,
  pvp_energy: -50,
  pvp_turns: 1,
  is_fast: 0,
} as Move;
const FALLBACK_BATTLE_CATALOG = [
  {
    pokemon_id: 1,
    name: "Bulbasaur",
    pokedex_number: 1,
    attack: 118,
    defense: 111,
    stamina: 128,
    available: 1,
    cp40: 1_000,
    cp50: 1_200,
    type1_name: "grass",
    type2_name: "poison",
    image_url: imageUri,
    moves: [fastMove, chargedMove],
    raid_boss: [
      {
        id: 1,
        pokemon_id: 1,
        name: "Bulbasaur",
        form: "Normal",
        type: "1",
        boosted_weather: "",
        max_boosted_cp: 500,
        max_unboosted_cp: 400,
        min_boosted_cp: 300,
        min_unboosted_cp: 200,
        possible_shiny: 1,
        tier: "1",
      },
    ],
    max: [
      {
        pokemon_id: 1,
        dynamax: 1,
        gigantamax: 0,
        dynamax_release_date: null,
        gigantamax_release_date: null,
      },
    ],
  },
] as BasePokemon[];
const pvpPayload = {
  source: null,
  leagues: {
    great: {
      key: "great",
      label: "Great",
      cpLimit: 1_500,
      entries: [
        {
          rank: 1,
          sourceRank: 1,
          speciesId: "bulbasaur",
          name: "Bulbasaur",
          pokemonId: 1,
          variantKind: "pokemon",
          imageUrl: imageUri,
          types: ["grass"],
          moveset: [
            {
              id: "vine-whip",
              name: "Vine Whip",
              type: "grass",
              kind: "fast",
              power: 5,
              energyGain: 8,
              energyCost: 0,
              turns: 2,
              buff: {
                attackerAttack: 0,
                attackerDefense: 0,
                targetAttack: 0,
                targetDefense: 0,
                chance: 0,
              },
            },
            {
              id: "power-whip",
              name: "Power Whip",
              type: "grass",
              kind: "charged",
              power: 90,
              energyGain: 0,
              energyCost: 50,
              turns: 1,
              buff: {
                attackerAttack: 0,
                attackerDefense: 0,
                targetAttack: 0,
                targetDefense: 0,
                chance: 0,
              },
            },
          ],
          score: 95,
          rating: 700,
          categoryScores: [91, 90, 89, 88, 87, 86],
          matchups: [],
          counters: [],
          moveUsage: [],
          recommendedLevel: 20,
          attackIv: 0,
          defenseIv: 15,
          staminaIv: 15,
          battleAttack: 121,
          battleDefense: 120,
          battleHp: 125,
        },
        {
          rank: 2,
          sourceRank: 2,
          speciesId: "ivysaur",
          name: "Ivysaur",
          pokemonId: 2,
          variantKind: "pokemon",
          imageUrl: imageUri,
          types: ["grass", "poison"],
          moveset: [
            {
              id: "razor-leaf",
              name: "Razor Leaf",
              type: "grass",
              kind: "fast",
              power: 10,
              energyGain: 4,
              energyCost: 0,
              turns: 2,
              buff: {
                attackerAttack: 0,
                attackerDefense: 0,
                targetAttack: 0,
                targetDefense: 0,
                chance: 0,
              },
            },
            {
              id: "sludge-bomb",
              name: "Sludge Bomb",
              type: "poison",
              kind: "charged",
              power: 80,
              energyGain: 0,
              energyCost: 50,
              turns: 1,
              buff: {
                attackerAttack: 0,
                attackerDefense: 0,
                targetAttack: 0,
                targetDefense: 0,
                chance: 0,
              },
            },
          ],
          score: 92,
          rating: 680,
          categoryScores: [89, 88, 87, 86, 85, 84],
          matchups: [],
          counters: [],
          moveUsage: [],
          recommendedLevel: 22,
          attackIv: 1,
          defenseIv: 14,
          staminaIv: 14,
          battleAttack: 118,
          battleDefense: 124,
          battleHp: 127,
        },
        {
          rank: 3,
          sourceRank: 3,
          speciesId: "venusaur",
          name: "Venusaur",
          pokemonId: 3,
          variantKind: "pokemon",
          imageUrl: `${ASSET_BASE_URL}/images/shiny/shiny_pokemon_3.png`,
          types: ["grass", "poison"],
          moveset: [
            {
              id: "vine-whip-venusaur",
              name: "Vine Whip",
              type: "grass",
              kind: "fast",
              power: 5,
              energyGain: 8,
              energyCost: 0,
              turns: 2,
              buff: {
                attackerAttack: 0,
                attackerDefense: 0,
                targetAttack: 0,
                targetDefense: 0,
                chance: 0,
              },
            },
            {
              id: "frenzy-plant",
              name: "Frenzy Plant",
              type: "grass",
              kind: "charged",
              power: 100,
              energyGain: 0,
              energyCost: 45,
              turns: 1,
              buff: {
                attackerAttack: 0,
                attackerDefense: 0,
                targetAttack: 0,
                targetDefense: 0,
                chance: 0,
              },
            },
          ],
          score: 89,
          rating: 665,
          categoryScores: [86, 90, 84, 88, 82, 85],
          matchups: [],
          counters: [],
          moveUsage: [],
          recommendedLevel: 24,
          attackIv: 1,
          defenseIv: 15,
          staminaIv: 13,
          battleAttack: 116,
          battleDefense: 126,
          battleHp: 130,
        },
      ],
    },
    ultra: { key: "ultra", label: "Ultra", cpLimit: 2_500, entries: [] },
    master: { key: "master", label: "Master", cpLimit: null, entries: [] },
  },
  formats: [],
} as PokemonPvPRankingsPayload;
const CANONICAL_PVP_IDENTITIES = [
  { chargedMove: "Earthquake", name: "Clodsire", pokemonId: 980, speciesId: "clodsire", type: "poison" },
  { chargedMove: "Play Rough", name: "Azumarill", pokemonId: 184, speciesId: "azumarill", type: "water" },
  { chargedMove: "Seed Bomb", name: "Bulbasaur", pokemonId: 1, speciesId: "bulbasaur", type: "grass" },
] as const;
const canonicalPvpBaseEntries = pvpPayload.leagues.great.entries.map((entry, index) => {
  const identity = CANONICAL_PVP_IDENTITIES[index] ?? CANONICAL_PVP_IDENTITIES[0];
  const rank = index + 1;
  return {
    ...entry,
    attackIv: 0,
    battleAttack: 100 + rank,
    battleDefense: 130 - rank,
    battleHp: 140 + rank,
    categoryScores: rank === 1 ? [70, 72, 74, 76, 78, 80] : [90, 88, 86, 84, 82, 81],
    counters: [{ speciesId: "lanturn", rating: 310 + rank }],
    defenseIv: 15,
    imageUrl: `/images/default/pokemon_${identity.pokemonId}.png`,
    matchups: [{ speciesId: "talonflame", rating: 740 - rank }],
    moveUsage: [{
      id: `${identity.speciesId}-fast`,
      kind: "fast" as const,
      name: "Quick Attack",
      type: "normal",
      uses: 120,
    }],
    moveset: [
      {
        ...entry.moveset[0],
        id: `${identity.speciesId}-fast`,
        name: "Quick Attack",
        type: "normal",
        power: 5,
        energyGain: 8,
        energyCost: 0,
        turns: 2,
      },
      {
        ...entry.moveset[1],
        id: `${identity.speciesId}-charged`,
        name: identity.chargedMove,
        type: identity.type,
        power: 80,
        energyGain: 0,
        energyCost: 50,
        turns: 1,
      },
    ],
    name: identity.name,
    pokemonId: identity.pokemonId,
    rank,
    rating: 700,
    recommendedLevel: 20 + rank / 2,
    score: 96 - rank,
    sourceRank: rank,
    speciesId: identity.speciesId,
    staminaIv: 15,
    statProduct: (100 + rank) * (130 - rank) * (140 + rank),
    types: [identity.type],
  };
});
const canonicalPvpGreatEntries = [
  ...canonicalPvpBaseEntries,
  ...Array.from({ length: 57 }, (_, offset) => {
    const rank = offset + 4;
    const template = canonicalPvpBaseEntries[offset % canonicalPvpBaseEntries.length];
    return {
      ...template,
      rank,
      sourceRank: rank,
      speciesId: `meta-pokemon-${rank}`,
      name: `Meta Pokémon ${rank}`,
      score: Math.max(35, 96 - rank * 0.75),
      rating: Math.max(300, 700 - rank * 3),
      categoryScores: template.categoryScores.map((score) => Math.max(25, score - rank / 4)),
    };
  }),
];
const canonicalPvpPayload: PokemonPvPRankingsPayload = {
  ...pvpPayload,
  source: {
    importedAt: "2026-07-23T00:00:00Z",
    license: "MIT",
    metadata: {},
    name: "PvPoke",
    url: "https://github.com/pvpoke/pvpoke",
    version: "e2e-pvpoke",
  },
  leagues: {
    ...pvpPayload.leagues,
    great: {
      ...pvpPayload.leagues.great,
      label: "Great League",
      entries: canonicalPvpGreatEntries,
    },
  },
  formats: [{
    key: "jungle-cup",
    label: "Jungle Cup",
    league: "great",
    cup: "Jungle",
    cpLimit: 1_500,
    rules: ["Only Normal, Grass, Electric, Poison, Ground, Flying, Bug, and Dark types"],
    mechanics: "current-2026",
    entries: canonicalPvpGreatEntries.slice(0, 20),
  }],
};
const pokedexEntry = {
  id: "0001-shiny",
  pokemonId: 1,
  pokedexNumber: 1,
  name: "Shiny Bulbasaur",
  imageUri,
  typeIconUris: ["/images/types/grass.png", "/images/types/poison.png"],
  maxKind: null,
  category: "shiny" as const,
  generation: 1,
  instanceRegistered: true,
  manualRegistrationIds: [],
  registered: true,
  registeredFacets: [{}],
  released: true,
  registeredSpecies: true,
};
const basePokedexEntry = {
  ...pokedexEntry,
  id: "0001-default",
  name: "Bulbasaur",
  category: "pokemon" as const,
};
const shadowPokedexEntry = {
  ...pokedexEntry,
  id: "0001-shadow",
  name: "Shadow Bulbasaur",
  imageUri: `${ASSET_BASE_URL}/images/shadow/shadow_pokemon_1.png`,
  category: "shadow" as const,
  instanceRegistered: false,
  registered: false,
  registeredFacets: [],
  registeredSpecies: true,
};
const dynamaxPokedexEntry = {
  ...pokedexEntry,
  id: "0001-dynamax",
  name: "Dynamax Bulbasaur",
  imageUri: `${ASSET_BASE_URL}/images/default/pokemon_1.png`,
  maxKind: "dynamax" as const,
  category: "dynamax" as const,
  instanceRegistered: false,
  registered: false,
  registeredFacets: [],
  registeredSpecies: true,
};
const detailPokemon = {
  ...FALLBACK_BATTLE_CATALOG[0],
  generation: 1,
  date_available: "2016-07-06",
  date_shiny_available: "2018-03-25",
  shiny_available: 1,
  evolves_to: [2],
  sizes: {
    pokedex_height: 0.7,
    pokedex_weight: 6.9,
    height_standard_deviation: 0.1,
    weight_standard_deviation: 1,
    height_xxs_threshold: 0.45,
    height_xs_threshold: 0.6,
    height_xl_threshold: 0.85,
    height_xxl_threshold: 1.05,
    weight_xxs_threshold: 4,
    weight_xs_threshold: 5.5,
    weight_xl_threshold: 8,
    weight_xxl_threshold: 10,
  },
} as BasePokemon;
const detailEntries = [basePokedexEntry, pokedexEntry, shadowPokedexEntry, dynamaxPokedexEntry];
const POKEDEX_REGISTRATIONS: NativePokedexManualRegistration[] = [3, 6, 9, 25, 94, 133, 149, 150].map((pokemonId) => ({
  entryId: `${String(pokemonId).padStart(4, "0")}-default`,
  facets: {},
  registrationId: `demo-${pokemonId}`,
}));
const RAID_INSTANCE = {
  instance_id: "0006-default_demo-charizard",
  variant_id: "0006-default",
  pokemon_id: 6,
  nickname: "League Ace",
  cp: 2_844,
  level: 38,
  attack_iv: 15,
  defense_iv: 14,
  stamina_iv: 15,
  fast_move_id: 54,
  charged_move1_id: 186,
  charged_move2_id: 83,
  is_caught: true,
  is_for_trade: false,
  is_wanted: false,
  registered: true,
  favorite: true,
  disabled: false,
} as PokemonInstance;
const OWNED_BATTLE_INSTANCE = {
  instance_id: "0001-default_demo-leafy",
  variant_id: "0001-default",
  pokemon_id: 1,
  nickname: "Leafy",
  cp: 987,
  level: 37,
  attack_iv: 12,
  defense_iv: 13,
  stamina_iv: 14,
  fast_move_id: 15,
  charged_move1_id: 108,
  charged_move2_id: null,
  is_caught: true,
  is_for_trade: false,
  is_wanted: false,
  registered: true,
  favorite: true,
  dynamax: true,
  gigantamax: false,
  max_attack: 2,
  max_guard: 1,
  max_spirit: 3,
  disabled: false,
} as PokemonInstance;
const OWNED_PVP_INSTANCE = {
  ...OWNED_BATTLE_INSTANCE,
  instance_id: "0001-default_demo-pvp-leafy",
  cp: 1_477,
  level: 40,
  attack_iv: 0,
  defense_iv: 15,
  stamina_iv: 15,
  fast_move_id: 15,
  charged_move1_id: 155,
  dynamax: false,
  max_attack: null,
  max_guard: null,
  max_spirit: null,
} as PokemonInstance;
const noOp = () => undefined;

const updatePokedexRegistrations = (
  existing: NativePokedexManualRegistration[],
  nextRegistrations: NativePokedexManualRegistration[],
  registered: boolean,
) => registered
  ? [...existing.filter(({ registrationId }) => !nextRegistrations.some((next) => next.registrationId === registrationId)), ...nextRegistrations]
  : existing.filter(({ registrationId }) => !nextRegistrations.some((next) => next.registrationId === registrationId));

const DeviceSmokeToolChrome = ({ children, currentPath, ready }: { children: ReactNode; currentPath: string; ready: boolean }) => (
  <View style={styles.screen}>
    {children}
    {ready ? <View style={styles.readyMarker} testID="device-smoke-tools-ready" /> : null}
    <NativeRouteActionMenu anchorInteractive={false} currentPath={currentPath} signedIn={false} />
  </View>
);

function DeviceSmokePokedexDetail() {
  const [registrations, setRegistrations] = useState<NativePokedexManualRegistration[]>([]);
  const entries = detailEntries.map((candidate) => {
    const candidateRegistrations = registrations.filter(({ entryId }) => entryId === candidate.id);
    return {
      ...candidate,
      manualRegistrationIds: candidateRegistrations.map(({ registrationId }) => registrationId),
      registered: candidate.instanceRegistered || candidateRegistrations.length > 0,
      registeredFacets: [
        ...(candidate.instanceRegistered ? candidate.registeredFacets : []),
        ...candidateRegistrations.map(({ facets }) => facets),
      ],
    };
  });
  const current = entries.find(({ id }) => id === pokedexEntry.id) ?? pokedexEntry;

  return (
    <NativePokedexDetailScreen
      allEntries={entries}
      allPokemon={[detailPokemon]}
      assetBaseUrl={ASSET_BASE_URL}
      entry={current}
      onBack={noOp}
      onOpenEntry={noOp}
      onSetRegistrations={(nextRegistrations, registered) => {
        setRegistrations((existing) => updatePokedexRegistrations(existing, nextRegistrations, registered));
      }}
      onToggleRegistration={(registration, registered) => {
        setRegistrations((existing) => updatePokedexRegistrations(existing, [registration], registered));
      }}
      pokemon={detailPokemon}
    />
  );
}

function DeviceSmokePokedex({ catalog }: { catalog: BasePokemon[] }) {
  const [registrations, setRegistrations] = useState<NativePokedexManualRegistration[]>(POKEDEX_REGISTRATIONS);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const entries = useMemo(
    () => buildNativePokedexEntries(catalog, {}, registrations),
    [catalog, registrations],
  );
  const selectedEntry = entries.find(({ id }) => id === selectedEntryId) ?? null;
  const selectedPokemon = catalog.find(({ pokemon_id: pokemonId }) => pokemonId === selectedEntry?.pokemonId) ?? null;
  const setRegistrationState = (
    nextRegistrations: NativePokedexManualRegistration[],
    registered: boolean,
  ) => setRegistrations((existing) => updatePokedexRegistrations(existing, nextRegistrations, registered));

  if (selectedEntry) {
    return <NativePokedexDetailScreen
      allEntries={entries}
      allPokemon={catalog}
      assetBaseUrl={ASSET_BASE_URL}
      entry={selectedEntry}
      onBack={() => setSelectedEntryId(null)}
      onOpenEntry={(nextEntry) => setSelectedEntryId(nextEntry.id)}
      onSetRegistrations={setRegistrationState}
      onToggleRegistration={(registration, registered) => setRegistrationState([registration], registered)}
      pokemon={selectedPokemon}
    />;
  }
  return <NativePokedexScreen
    assetBaseUrl={ASSET_BASE_URL}
    entries={entries}
    onBack={noOp}
    onOpenEntry={(nextEntry) => setSelectedEntryId(nextEntry.id)}
    onRetry={noOp}
    onSetRegistrations={setRegistrationState}
  />;
}

function DeviceSmokeRankings({ catalog }: { catalog: BasePokemon[] }) {
  const [category, setCategory] = useState<NativeRankingCategory>('all');
  const [collectionFilter, setCollectionFilter] = useState<NativeRankingCollectionFilter>('all');
  const [mode, setMode] = useState<NativeRankingMode>('wanted');
  const [query, setQuery] = useState('');
  const rankingCatalog = useMemo(() => buildPokemonCatalogEntries(catalog), [catalog]);
  const fixtureEntries = useMemo(() => {
    const priorityIds = [
      '0001-shiny',
      '0001-default',
      rankingCatalog.find((entry) => entry.variantType?.includes('shiny_shadow'))?.id,
      rankingCatalog.find((entry) => entry.variantType?.includes('shiny_dynamax'))?.id,
      rankingCatalog.find((entry) => entry.variantType?.includes('costume'))?.id,
    ].filter((id): id is string => Boolean(id));
    const byId = new Map(rankingCatalog.map((entry) => [entry.id, entry]));
    return [...new Set([...priorityIds, ...rankingCatalog.map((entry) => entry.id)])]
      .flatMap((id) => byId.get(id) ?? [])
      .slice(0, 90);
  }, [rankingCatalog]);
  const instances = useMemo<Record<string, PokemonInstance>>(() => {
    const wanted = fixtureEntries.find((entry) => entry.id === '0001-shiny') ?? fixtureEntries[0];
    const trade = fixtureEntries.find((entry) => entry.id === '0001-default') ?? fixtureEntries[1];
    const owned = fixtureEntries[2];
    const next: Record<string, PokemonInstance> = {};
    if (wanted) next['rankings-wanted'] = { instance_id: 'rankings-wanted', pokemon_id: wanted.pokemonId, variant_id: wanted.id, is_caught: false, is_for_trade: false, is_wanted: true, registered: false, disabled: false } as PokemonInstance;
    if (trade) next['rankings-trade'] = { instance_id: 'rankings-trade', pokemon_id: trade.pokemonId, variant_id: trade.id, is_caught: true, is_for_trade: true, is_wanted: false, registered: true, disabled: false } as PokemonInstance;
    if (owned) next['rankings-owned'] = { instance_id: 'rankings-owned', pokemon_id: owned.pokemonId, variant_id: owned.id, is_caught: true, is_for_trade: false, is_wanted: false, registered: true, disabled: false } as PokemonInstance;
    return next;
  }, [fixtureEntries]);
  const payload = useMemo<PokemonCommunityRankingsPayload>(() => {
    const ranking = (variantId: string, index: number) => ({
      caught_users: Math.max(1, 100 - index),
      most_wanted_users: Math.max(1, 20 - Math.floor(index / 5)),
      variant_id: variantId,
      wanted_users: Math.max(0, 120 - index),
    });
    return {
      most_wanted: fixtureEntries.map((entry, index) => ranking(entry.id, index)),
      privacy_threshold: 5,
      rarest: [...fixtureEntries].reverse().map((entry, index) => ranking(entry.id, index)),
      snapshot: { collector_users: 120, wishlist_users: 140, updated_at: '2026-07-25T12:00:00Z' },
    };
  }, [fixtureEntries]);
  const rowsBeforeCollection = useMemo(() => buildNativeRankingRows({
    catalog: rankingCatalog,
    category,
    instances,
    mode,
    payload,
    query,
  }), [category, instances, mode, payload, query, rankingCatalog]);
  const collectionFilterCounts = useMemo(
    () => countNativeRankingCollectionFilters(rowsBeforeCollection),
    [rowsBeforeCollection],
  );
  const rows = useMemo(
    () => filterNativeRankingRowsByCollection(rowsBeforeCollection, collectionFilter),
    [collectionFilter, rowsBeforeCollection],
  );
  return (
    <NativeRankingsScreen
      assetBaseUrl={ASSET_BASE_URL}
      collectionFilterCounts={collectionFilterCounts}
      collectorCount={140}
      onBack={noOp}
      onChangeCategory={setCategory}
      onChangeCollectionFilter={setCollectionFilter}
      onChangeMode={setMode}
      onChangeQuery={setQuery}
      onOpenEntry={noOp}
      onOpenPokemon={noOp}
      onRetry={noOp}
      privacyThreshold={5}
      query={query}
      rows={rows}
      selectedCategory={category}
      selectedCollectionFilter={collectionFilter}
      selectedMode={mode}
      showCollectionFilters
      snapshotLabel="Updated Jul 25, 2026, 5:00 AM"
    />
  );
}

export default function DeviceSmokeToolsRoute() {
  const params = useLocalSearchParams<{
    owned?: string | string[];
    tool?: string | string[];
  }>();
  const tool = Array.isArray(params.tool) ? params.tool[0] : params.tool;
  const ownedParam = Array.isArray(params.owned) ? params.owned[0] : params.owned;
  const ownedFixture = ownedParam === "1";
  const needsCatalog = tool === "pokedex" || tool === "raid" || tool === "pvp" || tool === "max" || tool === "rankings";
  const [catalog, setCatalog] = useState<BasePokemon[]>(FALLBACK_BATTLE_CATALOG);
  const [catalogReady, setCatalogReady] = useState(false);
  useEffect(() => {
    if (!runtimeConfig.mobile.deviceSmokeMode || !needsCatalog) return undefined;
    const controller = new AbortController();
    void fetch(CATALOG_FIXTURE_URL, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Catalog fixture returned ${response.status}.`);
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) throw new Error("Catalog fixture is not an array.");
        setCatalog(payload as BasePokemon[]);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalog(FALLBACK_BATTLE_CATALOG);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCatalogReady(true);
      });
    return () => controller.abort();
  }, [needsCatalog]);
  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;

  if (tool === "pokedex") {
    return (
      <DeviceSmokeToolChrome currentPath="/pokedex" ready={!needsCatalog || catalogReady}>
        <DeviceSmokePokedex catalog={catalog} />
      </DeviceSmokeToolChrome>
    );
  }
  if (tool === "pokedex-detail") return (
    <DeviceSmokeToolChrome currentPath="/pokedex" ready={!needsCatalog || catalogReady}>
      <DeviceSmokePokedexDetail />
    </DeviceSmokeToolChrome>
  );
  if (tool === "raid") {
    return (
      <DeviceSmokeToolChrome currentPath="/raid" ready={!needsCatalog || catalogReady}>
        <NativeRaidScreen
          assetBaseUrl={ASSET_BASE_URL}
          catalog={catalog}
          instances={ownedFixture
            ? { "0001-default_demo-leafy": OWNED_BATTLE_INSTANCE }
            : { "0006-default_demo-charizard": RAID_INSTANCE }}
          onBack={noOp}
          onMethodology={noOp}
          onOpenPokemon={noOp}
          onRetry={noOp}
          signedIn
        />
      </DeviceSmokeToolChrome>
    );
  }
  if (tool === "pvp") {
    return (
      <DeviceSmokeToolChrome currentPath="/pvp" ready={!needsCatalog || catalogReady}>
        <NativePvpScreen
          assetBaseUrl={ASSET_BASE_URL}
          catalog={catalog}
          instances={ownedFixture ? { "0001-default_demo-pvp-leafy": OWNED_PVP_INSTANCE } : {}}
          onBack={noOp}
          onMethodology={noOp}
          onRetry={noOp}
          payload={canonicalPvpPayload}
          persistTeamBuilder={false}
          signedIn
        />
      </DeviceSmokeToolChrome>
    );
  }
  if (tool === "max") {
    return (
      <DeviceSmokeToolChrome currentPath="/max" ready={!needsCatalog || catalogReady}>
        <NativeMaxScreen
          assetBaseUrl={ASSET_BASE_URL}
          catalog={catalog}
          instances={ownedFixture ? { "0001-default_demo-leafy": OWNED_BATTLE_INSTANCE } : {}}
          onBack={noOp}
          onOpenPokemon={noOp}
          onRetry={noOp}
          signedIn
        />
      </DeviceSmokeToolChrome>
    );
  }
  if (tool === "rankings") {
    return (
      <DeviceSmokeToolChrome currentPath="/rankings" ready={!needsCatalog || catalogReady}>
        <DeviceSmokeRankings catalog={catalog} />
      </DeviceSmokeToolChrome>
    );
  }
  return <Redirect href="/device-smoke/home" />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0 },
  readyMarker: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
