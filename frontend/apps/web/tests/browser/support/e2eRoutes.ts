import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Page, Route } from '@playwright/test';

export type E2eRouteOptions = {
  baseUrl?: string;
  mockImages?: boolean;
  preserveBrowserConnectivity?: boolean;
  searchResults?: unknown[];
  communityRankings?: unknown;
  locationSuggestions?: unknown[];
  trainerSuggestions?: unknown[];
  trainerProfile?: unknown;
  friendsOverview?: unknown;
  trainerPreferences?: unknown;
  userInstances?: unknown;
  syncInstances?: Record<string, unknown>;
  publicUser?: unknown;
  userOverview?: unknown;
  trades?: unknown;
  pokedexSpecies?: unknown[];
  pokemonCatalogDelayMs?: number;
  pvpData?: unknown;
  raidDataDelayMs?: number;
  customTags?: unknown[];
  tagOrders?: {
    caught: string[];
    wanted: string[];
  };
};

const fixturePath = (relativePath: string) =>
  path.resolve(process.cwd(), '../../packages/app-core/tests/__helpers__/fixtures', relativePath);
const placeholderImagePath = path.resolve(
  process.cwd(),
  '../../packages/app-core/public/icons/icon-48x48.png',
);

type PokemonFixtureEntry = Record<string, unknown>;

const pokemonFixture = JSON.parse(
  readFileSync(fixturePath('pokemons.json'), 'utf8'),
) as PokemonFixtureEntry[];

const asRecords = (value: unknown): PokemonFixtureEntry[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is PokemonFixtureEntry => !!entry && typeof entry === 'object')
    : [];

const stripMovePools = (value: unknown): PokemonFixtureEntry[] =>
  asRecords(value).map((entry) => ({ ...entry, moves: [] }));

const catalogFixture = pokemonFixture.map((pokemon) => ({
  ...pokemon,
  moves: [],
  raid_boss: [],
  fusion: stripMovePools(pokemon.fusion),
  crownForms: stripMovePools(pokemon.crownForms),
}));

const movesFixture = pokemonFixture.map((pokemon) => ({
  pokemon_id: pokemon.pokemon_id,
  moves: Array.isArray(pokemon.moves) ? pokemon.moves : [],
  fusion: asRecords(pokemon.fusion).map((fusion) => ({
    fusion_id: fusion.fusion_id,
    moves: Array.isArray(fusion.moves) ? fusion.moves : [],
  })),
  crownForms: asRecords(pokemon.crownForms).map((crown) => ({
    id: crown.id,
    moves: Array.isArray(crown.moves) ? crown.moves : [],
  })),
}));

const raidDataFixture = pokemonFixture.map((pokemon) => ({
  pokemon_id: pokemon.pokemon_id,
  raid_boss: Array.isArray(pokemon.raid_boss) ? pokemon.raid_boss : [],
}));

const pokedexSpeciesFixture = pokemonFixture.map((pokemon) => ({
  pokemon_id: pokemon.pokemon_id,
  name: pokemon.name,
  pokedex_number: pokemon.pokedex_number,
  image_url: pokemon.image_url,
  gender_rate: pokemon.gender_rate,
  form: pokemon.form,
  generation: pokemon.generation,
  available: pokemon.available,
}));

const maxDataFixture = pokemonFixture.filter((pokemon) => {
  const pokemonId = Number(pokemon.pokemon_id);
  return asRecords(pokemon.max).length > 0 || [888, 889, 890].includes(pokemonId);
});

const makePvPEntry = (
  rank: number,
  speciesId: string,
  name: string,
  type: string,
  moveName: string,
  pokemonId = rank,
) => ({
  rank,
  sourceRank: rank,
  speciesId,
  name,
  pokemonId,
  variantKind: 'pokemon',
  imageUrl: `/images/default/pokemon_${pokemonId}.png`,
  types: [type],
  moveset: [
    {
      id: `${speciesId}-fast`,
      name: 'Quick Attack',
      type: 'normal',
      kind: 'fast',
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
      id: `${speciesId}-charged`,
      name: moveName,
      type,
      kind: 'charged',
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
  score: 96 - rank,
  rating: 700,
  categoryScores: rank === 1
    ? [70, 72, 74, 76, 78, 80]
    : [90, 88, 86, 84, 82, 81],
  matchups: [
    { speciesId: 'talonflame', rating: 740 - rank },
  ],
  counters: [
    { speciesId: 'lanturn', rating: 310 + rank },
  ],
  moveUsage: [
    {
      id: `${speciesId}-fast`,
      name: 'Quick Attack',
      type: 'normal',
      kind: 'fast',
      uses: 120,
    },
  ],
  recommendedLevel: 20 + rank / 2,
  attackIv: 0,
  defenseIv: 15,
  staminaIv: 15,
  battleAttack: 100 + rank,
  battleDefense: 130 - rank,
  battleHp: 140 + rank,
  statProduct: (100 + rank) * (130 - rank) * (140 + rank),
});

export const pvpDataFixture = {
  source: {
    name: 'PvPoke',
    version: 'e2e-pvpoke',
    url: 'https://github.com/pvpoke/pvpoke',
    license: 'MIT',
    importedAt: '2026-07-23T00:00:00Z',
    metadata: {},
  },
  leagues: {
    great: {
      key: 'great',
      label: 'Great League',
      cpLimit: 1_500,
      entries: [
        makePvPEntry(1, 'clodsire', 'Clodsire', 'poison', 'Earthquake', 980),
        makePvPEntry(2, 'azumarill', 'Azumarill', 'water', 'Play Rough', 184),
        makePvPEntry(3, 'bulbasaur', 'Bulbasaur', 'grass', 'Seed Bomb', 1),
      ],
    },
    ultra: {
      key: 'ultra',
      label: 'Ultra League',
      cpLimit: 2_500,
      entries: [
        makePvPEntry(1, 'feraligatr', 'Feraligatr', 'water', 'Hydro Cannon'),
      ],
    },
    master: {
      key: 'master',
      label: 'Master League',
      cpLimit: null,
      entries: [
        makePvPEntry(1, 'zacian_crowned_sword', 'Zacian Crowned Sword', 'steel', 'Behemoth Blade'),
      ],
    },
  },
};

const pokemonManifestFixture = {
  schemaVersion: 3,
  catalogVersion: 'e2e-catalog-v3',
  generatedAt: '2026-07-14T00:00:00.000Z',
  chunks: {
    pokemonFull: {
      name: 'pokemonFull',
      endpoint: '/pokemons',
      contentType: 'application/json',
      etag: '"e2e-pokemons"',
      version: 'e2e-pokemons',
      bytesJson: 1,
      bytesGzip: 1,
    },
    catalog: {
      name: 'catalog',
      endpoint: '/catalog',
      contentType: 'application/json',
      etag: '"e2e-catalog-v2"',
      version: 'e2e-catalog-v2',
      bytesJson: 1,
      bytesGzip: 1,
    },
    pokedex: {
      name: 'pokedex',
      endpoint: '/pokedex',
      contentType: 'application/json',
      etag: '"e2e-pokedex-v1"',
      version: 'e2e-pokedex-v1',
      bytesJson: 1,
      bytesGzip: 1,
    },
    moves: {
      name: 'moves',
      endpoint: '/moves',
      contentType: 'application/json',
      etag: '"e2e-moves-v2"',
      version: 'e2e-moves-v2',
      bytesJson: 1,
      bytesGzip: 1,
    },
    raidData: {
      name: 'raidData',
      endpoint: '/raid-data',
      contentType: 'application/json',
      etag: '"e2e-raid-data-v2"',
      version: 'e2e-raid-data-v2',
      bytesJson: 1,
      bytesGzip: 1,
    },
    maxData: {
      name: 'maxData',
      endpoint: '/max-data',
      contentType: 'application/json',
      etag: '"e2e-max-data-v1"',
      version: 'e2e-max-data-v1',
      bytesJson: 1,
      bytesGzip: 1,
    },
    pvpData: {
      name: 'pvpData',
      endpoint: '/pvp-data',
      contentType: 'application/json',
      etag: '"e2e-pvp-data-v1"',
      version: 'e2e-pvp-data-v1',
      bytesJson: 1,
      bytesGzip: 1,
    },
  },
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  const requestOrigin = route.request().headers()['origin'];
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': requestOrigin ?? '*',
      'access-control-allow-credentials': 'true',
      vary: 'Origin',
    },
    body: JSON.stringify(body),
  });
}

const defaultUserInstances = { username: 'e2e', instances: {} };
const defaultPublicUser = { user: { user_id: 'e2e-user', username: 'e2e' }, instances: {} };
const defaultUserOverview = {
  user: { user_id: 'e2e-user', username: 'e2e' },
  pokemon_instances: {},
  trades: {},
  related_instances: {},
  registrations: {},
};

export async function installE2eRoutes(page: Page, options: E2eRouteOptions = {}) {
  const overviewRecord =
    options.userOverview && typeof options.userOverview === 'object'
      ? options.userOverview as Record<string, unknown>
      : {};
  const tradeRecord =
    options.trades && typeof options.trades === 'object'
      ? options.trades as Record<string, unknown>
      : overviewRecord.trades && typeof overviewRecord.trades === 'object'
        ? overviewRecord.trades as Record<string, unknown>
        : {};
  const relatedTradeInstances =
    overviewRecord.related_instances &&
    typeof overviewRecord.related_instances === 'object'
      ? overviewRecord.related_instances as Record<string, unknown>
      : {};
  let trainerProfileState = JSON.parse(
    JSON.stringify(
      options.trainerProfile ?? {
        user: {
          user_id: 'e2e-user',
          username: 'e2e',
          app_joined_at: '2026-01-01T00:00:00Z',
        },
        trainer_titles: [],
        location: null,
        trainer_code: null,
        stats: {
          caught: 0,
          for_trade: 0,
          wanted: 0,
          favorites: 0,
          registered: 0,
        },
        highlights: [],
        viewer: {
          relationship: 'self',
          can_view_profile: true,
          can_view_collection: true,
        },
      },
    ),
  ) as Record<string, unknown>;
  const tagOrders = options.tagOrders ?? {
    caught: ['system:caught', 'system:favorites', 'system:trade'],
    wanted: ['system:wanted', 'system:most-wanted'],
  };

  if (options.mockImages ?? true) {
    await page.route('**/images/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        path: placeholderImagePath,
      });
    });
  }

  for (const pathPattern of ['**/api/events/getUpdates**', '**/__e2e/events/getUpdates**']) {
    await page.route(pathPattern, async (route) => {
      await fulfillJson(route, {});
    });
  }

  if (!options.preserveBrowserConnectivity) {
    // Mocked browser tests are intentionally self-contained and should not inherit a
    // transient offline signal from the host or a neighboring Chromium context.
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'onLine', {
        configurable: true,
        get: () => true,
      });
    });
  }

  await page.addInitScript(() => {
    const eventSources = new Set<MockEventSource>();
    class MockEventSource extends EventTarget {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 2;

      readonly CONNECTING = MockEventSource.CONNECTING;
      readonly OPEN = MockEventSource.OPEN;
      readonly CLOSED = MockEventSource.CLOSED;
      readonly url: string;
      readonly withCredentials = false;
      readyState = MockEventSource.CONNECTING;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor(url: string | URL) {
        super();
        this.url = String(url);
        eventSources.add(this);
        queueMicrotask(() => {
          if (this.readyState === MockEventSource.CLOSED) return;
          this.readyState = MockEventSource.OPEN;
          const event = new Event('open');
          this.dispatchEvent(event);
          this.onopen?.(event);
        });
      }

      close() {
        this.readyState = MockEventSource.CLOSED;
        eventSources.delete(this);
      }
    }

    window.EventSource = MockEventSource as typeof EventSource;
    Object.assign(window, {
      __emitE2eEventSourceMessage: (payload: unknown) => {
        const event = new MessageEvent('message', { data: JSON.stringify(payload) });
        let delivered = 0;
        eventSources.forEach((source) => {
          if (source.readyState !== MockEventSource.OPEN) return;
          source.dispatchEvent(event);
          source.onmessage?.(event);
          if (source.onmessage) delivered += 1;
        });
        return delivered;
      },
      __e2eEventSourceCount: () => Array.from(eventSources).filter(
        (source) => source.readyState === MockEventSource.OPEN,
      ).length,
    });
  });

  await page.route('**/api/pokemon/pokemons', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { etag: '"e2e-pokemons"' },
      path: fixturePath('pokemons.json'),
    });
  });

  await page.route('**/__e2e/pokemon/pokemons', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { etag: '"e2e-pokemons"' },
      path: fixturePath('pokemons.json'),
    });
  });

  for (const pathPattern of ['**/api/pokemon/manifest', '**/__e2e/pokemon/manifest']) {
    await page.route(pathPattern, async (route) => {
      await fulfillJson(route, pokemonManifestFixture);
    });
  }

  for (const pathPattern of ['**/api/pokemon/catalog', '**/__e2e/pokemon/catalog']) {
    await page.route(pathPattern, async (route) => {
      if (options.pokemonCatalogDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.pokemonCatalogDelayMs));
      }
      await fulfillJson(route, catalogFixture);
    });
  }

  for (const pathPattern of ['**/api/pokemon/pokedex', '**/__e2e/pokemon/pokedex']) {
    await page.route(pathPattern, async (route) => {
      await fulfillJson(route, options.pokedexSpecies ?? pokedexSpeciesFixture);
    });
  }

  for (const pathPattern of ['**/api/pokemon/moves**', '**/__e2e/pokemon/moves**']) {
    await page.route(pathPattern, async (route) => {
      await fulfillJson(route, movesFixture);
    });
  }

  for (const pathPattern of ['**/api/pokemon/raid-data', '**/__e2e/pokemon/raid-data']) {
    await page.route(pathPattern, async (route) => {
      if (options.raidDataDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.raidDataDelayMs));
      }
      await fulfillJson(route, raidDataFixture);
    });
  }

  for (const pathPattern of ['**/api/pokemon/max-data', '**/__e2e/pokemon/max-data']) {
    await page.route(pathPattern, async (route) => {
      await fulfillJson(route, maxDataFixture);
    });
  }

  for (const pathPattern of ['**/api/pokemon/pvp-data', '**/__e2e/pokemon/pvp-data']) {
    await page.route(pathPattern, async (route) => {
      await fulfillJson(route, options.pvpData ?? pvpDataFixture);
    });
  }

  await page.route('**/api/search/searchPokemon**', async (route) => {
    await fulfillJson(route, options.searchResults ?? []);
  });

  await page.route('**/__e2e/search/searchPokemon**', async (route) => {
    await fulfillJson(route, options.searchResults ?? []);
  });

  const rankings = options.communityRankings ?? {
    privacy_threshold: 5,
    snapshot: {
      collector_users: 0,
      wishlist_users: 0,
      updated_at: '2026-07-25T12:00:00Z',
    },
    most_wanted: [],
    rarest: [],
  };
  await page.route('**/api/search/rankings**', async (route) => {
    await fulfillJson(route, rankings);
  });
  await page.route('**/__e2e/search/rankings**', async (route) => {
    await fulfillJson(route, rankings);
  });

  await page.route('**/api/location/autocomplete**', async (route) => {
    await fulfillJson(route, options.locationSuggestions ?? []);
  });

  await page.route('**/__e2e/location/autocomplete**', async (route) => {
    await fulfillJson(route, options.locationSuggestions ?? []);
  });

  await page.route('**/api/location/reverse**', async (route) => {
    await fulfillJson(route, { locations: [] });
  });

  await page.route('**/__e2e/location/reverse**', async (route) => {
    await fulfillJson(route, { locations: [] });
  });

  await page.route('**/api/users/autocomplete-trainers**', async (route) => {
    await fulfillJson(route, options.trainerSuggestions ?? []);
  });

  await page.route('**/__e2e/users/autocomplete-trainers**', async (route) => {
    await fulfillJson(route, options.trainerSuggestions ?? []);
  });

  for (const pathPattern of ['**/api/users/profiles/*', '**/__e2e/users/profiles/*']) {
    await page.route(pathPattern, async (route) => {
      await fulfillJson(route, trainerProfileState);
    });
  }

  for (const pathPattern of ['**/api/users/friends', '**/__e2e/users/friends']) {
    await page.route(pathPattern, async (route) => {
      await fulfillJson(
        route,
        options.friendsOverview ?? { friends: [], incoming: [], outgoing: [], blocked: [] },
      );
    });
  }

  let trainerPreferences = options.trainerPreferences ?? {
    profile_visibility: 'public',
    collection_visibility: 'public',
    friend_request_permission: 'everyone',
    trainer_code_visibility: 'friends',
    show_location: true,
    show_pokemon_go_name: true,
  };
  for (const pathPattern of ['**/api/users/preferences', '**/__e2e/users/preferences']) {
    await page.route(pathPattern, async (route) => {
      if (route.request().method() === 'PUT') {
        trainerPreferences = {
          ...(trainerPreferences as Record<string, unknown>),
          ...(route.request().postDataJSON() as Record<string, unknown>),
        };
      }
      await fulfillJson(route, trainerPreferences);
    });
  }

  for (const pathPattern of ['**/api/users/trades', '**/__e2e/users/trades']) {
    await page.route(pathPattern, async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === 'GET' && /\/trades$/.test(url.pathname)) {
        await fulfillJson(route, {
          trades: Object.values(tradeRecord),
          related_instances: relatedTradeInstances,
        });
        return;
      }
      await fulfillJson(route, {
        message: `Unhandled trade route: ${route.request().method()} ${url.pathname}`,
      }, 404);
    });
  }

  for (const pathPattern of ['**/api/users/tags', '**/__e2e/users/tags']) {
    await page.route(pathPattern, async (route) => {
      if (route.request().method() === 'GET') {
        await fulfillJson(route, {
          tags: options.customTags ?? [],
          orders: tagOrders,
        });
        return;
      }
      await fulfillJson(route, {
        message: `Unhandled tag route: ${route.request().method()}`,
      }, 404);
    });
  }

  for (const pathPattern of ['**/api/users/tags/order', '**/__e2e/users/tags/order']) {
    await page.route(pathPattern, async (route) => {
      const request = route.request().postDataJSON() as {
        parent?: 'caught' | 'wanted';
        tag_keys?: string[];
      };
      const parent = request.parent;
      if (route.request().method() !== 'PUT' || !parent) {
        await fulfillJson(route, { message: 'Invalid tag order request' }, 400);
        return;
      }
      tagOrders[parent] = [...(request.tag_keys ?? [])];
      await fulfillJson(route, { parent, tag_keys: tagOrders[parent] });
    });
  }

  for (const pathPattern of ['**/api/users/profile', '**/__e2e/users/profile']) {
    await page.route(pathPattern, async (route) => {
      if (route.request().method() === 'PUT') {
        const update = route.request().postDataJSON() as Record<string, unknown>;
        if (Array.isArray(update.trainer_titles)) {
          trainerProfileState = {
            ...trainerProfileState,
            trainer_titles: [...update.trainer_titles],
          };
        }
        await fulfillJson(route, { success: true });
        return;
      }
      await fulfillJson(route, trainerProfileState);
    });
  }

  await page.route('**/api/users/instances/by-username/**', async (route) => {
    await fulfillJson(route, options.userInstances ?? defaultUserInstances);
  });

  await page.route('**/__e2e/users/instances/by-username/**', async (route) => {
    await fulfillJson(route, options.userInstances ?? defaultUserInstances);
  });

  for (const pathPattern of ['**/api/users/instances/sync**', '**/__e2e/users/instances/sync**']) {
    await page.route(pathPattern, async (route) => {
      await fulfillJson(route, options.syncInstances
        ? {
            checkpoint: 'e2e-performance-checkpoint',
            instances: options.syncInstances,
            not_modified: false,
          }
        : { checkpoint: 'e2e-checkpoint', not_modified: true });
    });
  }

  await page.route('**/api/users/public/users/**', async (route) => {
    await fulfillJson(route, options.publicUser ?? defaultPublicUser);
  });

  await page.route('**/__e2e/users/public/users/**', async (route) => {
    await fulfillJson(route, options.publicUser ?? defaultPublicUser);
  });

  await page.route('**/api/users/users/*/overview**', async (route) => {
    await fulfillJson(route, options.userOverview ?? defaultUserOverview);
  });

  await page.route('**/__e2e/users/users/*/overview**', async (route) => {
    await fulfillJson(route, options.userOverview ?? defaultUserOverview);
  });
}
