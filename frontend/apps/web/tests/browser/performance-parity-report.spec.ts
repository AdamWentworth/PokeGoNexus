import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  chromium,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import type { AccountSecuritySummary } from '@pokemongonexus/shared-contracts/auth';

import { installE2eRoutes, pvpDataFixture } from './support/e2eRoutes';
import type { E2eRouteOptions } from './support/e2eRoutes';
import { expectActivePokemonView, openPokemonPage } from './support/pokemonApp';

type ContractRoute = {
  id: string;
  auth: 'guest' | 'signed-in';
  vite: string;
  native: string;
};

type MetricSample = {
  scenarioId: string;
  metric: string;
  unit: 'ms' | 'bytes' | 'count' | 'fps' | 'percent';
  direction: 'lower' | 'higher';
  value: number;
  sampleIndex: number;
  phase?: string;
  diagnostic?: boolean;
};

type BrowserSnapshot = {
  routeReadyMs: number;
  mainThreadBlockingMs: number;
  maxFrameGapMs: number;
  firstContentfulPaintMs: number | null;
  largestContentfulPaintMs: number | null;
  transferSizeBytes: number;
  domNodeCount: number;
  jsHeapBytes: number | null;
};

const frontendDirectory = path.resolve(process.cwd(), '../..');
const contract = JSON.parse(readFileSync(
  path.resolve(frontendDirectory, 'performance-parity/contract.json'),
  'utf8',
)) as { routes: ContractRoute[] };
const performanceProfile = process.env.POKEGONEXUS_PERFORMANCE_PROFILE === 'physical-android'
  ? 'physical-android'
  : 'browser-proxy';
const reportPath = path.resolve(
  process.env.POKEGONEXUS_PERFORMANCE_REPORT
    ?? path.resolve(
      process.cwd(),
      `.artifacts/performance-parity/vite-${performanceProfile}.json`,
    ),
);
const repetitions = Math.max(1, Number(process.env.POKEGONEXUS_PERFORMANCE_SAMPLES ?? 3));
const workflowsOnly = process.env.POKEGONEXUS_PERFORMANCE_WORKFLOWS_ONLY === 'true';
const workflowFilter = process.env.POKEGONEXUS_PERFORMANCE_WORKFLOW_FILTER?.trim().toLocaleLowerCase() ?? '';
const workflowScreenshotDirectory = process.env.POKEGONEXUS_PERFORMANCE_SCREENSHOT_DIR?.trim() ?? '';
const androidArtifactDirectory = path.resolve(
  process.env.POKEGONEXUS_PERFORMANCE_ANDROID_ARTIFACT_DIR?.trim()
    || path.resolve(path.dirname(reportPath), 'vite-android-system'),
);
const routeFilter = process.env.POKEGONEXUS_PERFORMANCE_ROUTE_FILTER?.trim() ?? '';
const routeFilters = routeFilter.split(',').map((value) => value.trim()).filter(Boolean);
const routeMatchesFilter = (id: string, path: string) => (
  routeFilters.length === 0
  || routeFilters.some((filter) => id.includes(filter) || path.includes(filter))
);
const samples: MetricSample[] = [];
const androidDeviceId = process.env.POKEGONEXUS_ANDROID_DEVICE_ID?.trim() ?? '';
const androidChromePackage = process.env.POKEGONEXUS_ANDROID_CHROME_PACKAGE?.trim()
  || 'com.android.chrome';
const androidCdpUrl = process.env.POKEGONEXUS_ANDROID_CDP_URL?.trim()
  || 'http://127.0.0.1:9222';
const webBaseUrl = (process.env.E2E_BASE_URL?.trim()
  || `http://127.0.0.1:${process.env.E2E_PORT?.trim() || '3100'}`).replace(/\/+$/, '');
const androidMemoryMetricSamples = new Set<number>();
let physicalAutomationPage: Page | null = null;

const captureWorkflowScreenshot = async (
  page: Page,
  sampleIndex: number,
  name: string,
  focus?: ReturnType<Page['locator']>,
) => {
  if (!workflowScreenshotDirectory || sampleIndex !== 0) return;
  if (focus) await focus.scrollIntoViewIfNeeded();
  mkdirSync(workflowScreenshotDirectory, { recursive: true });
  await page.screenshot({
    animations: 'disabled',
    path: path.resolve(workflowScreenshotDirectory, `vite-${name}.png`),
  });
};

const adbPath = process.env.ADB_BIN?.trim()
  || path.resolve(
    process.env.ANDROID_SDK_ROOT?.trim()
      || process.env.ANDROID_HOME?.trim()
      || path.resolve(os.homedir(), 'Android/Sdk'),
    'platform-tools/adb',
  );

const signedInUser = {
  accessTokenExpiry: '2099-01-01T00:00:00.000Z',
  allowLocation: false,
  email: 'performance@example.test',
  location: 'Burnaby, British Columbia, Canada',
  pokemonGoName: 'PerformanceTrainerGO',
  refreshTokenExpiry: '2099-01-02T00:00:00.000Z',
  trainerCode: '1234 5678 9012',
  user_id: 'performance-user',
  username: 'PerformanceTrainer',
};

const allPerformanceInstances = JSON.parse(readFileSync(
  path.resolve(
    frontendDirectory,
    'packages/app-core/tests/__helpers__/fixtures/instances.json',
  ),
  'utf8',
).replace(/^\uFEFF/, '')) as Record<string, Record<string, unknown>>;
const performanceCatalog = JSON.parse(readFileSync(
  path.resolve(
    frontendDirectory,
    'packages/app-core/tests/__helpers__/fixtures/pokemons.json',
  ),
  'utf8',
).replace(/^\uFEFF/, '')) as BasePokemon[];
const performanceCatalogEntries = performanceCatalog.length;
const performanceInstances = Object.fromEntries(
  Object.entries(allPerformanceInstances).slice(0, 180).map(([instanceId, instance], index) => {
    const normalized = {
      ...instance,
      instance_id: instance.instance_id ?? instanceId,
      variant_id: instance.variant_id ?? instanceId.replace(
        /_[0-9a-f]{8}-[0-9a-f-]{27}$/i,
        '',
      ),
    };
    if (index === 0) return [instanceId, {
      ...normalized,
      // The trade fixture must also pass the instance editor's save rules.
      favorite: false,
      is_caught: true,
      is_for_trade: true,
      is_wanted: false,
      mirror: false,
      not_wanted_list: {},
      wanted_filters: {},
    }];
    if (index === 1) {
      return [instanceId, {
        ...normalized,
      is_caught: false,
      is_for_trade: false,
      is_wanted: true,
      not_trade_list: {},
      trade_filters: {},
      }];
    }
    if (index === 2) {
      return [instanceId, {
        ...normalized,
      is_caught: true,
      is_for_trade: true,
      is_wanted: false,
      mirror: false,
      not_wanted_list: {},
      wanted_filters: {},
      }];
    }
    if (index === 3) {
      return [instanceId, {
        ...normalized,
      is_caught: false,
      is_for_trade: false,
      is_wanted: true,
      not_trade_list: {},
      trade_filters: {},
      }];
    }
    return [instanceId, normalized];
  }),
);
const performanceRankingCatalogIds = performanceCatalog.flatMap((pokemon) => {
  const dexId = String(pokemon.pokemon_id).padStart(4, '0');
  const ids = pokemon.image_url ? [`${dexId}-default`] : [];
  if (pokemon.shiny_available && pokemon.image_url_shiny) ids.push(`${dexId}-shiny`);
  if (pokemon.date_shadow_available && pokemon.image_url_shadow) ids.push(`${dexId}-shadow`);
  if (pokemon.date_shiny_shadow_available && pokemon.image_url_shiny_shadow) ids.push(`${dexId}-shiny_shadow`);
  for (const costume of pokemon.costumes ?? []) {
    if (costume.image_url) ids.push(`${dexId}-${costume.name}_default`);
    if (costume.shiny_available && costume.image_url_shiny) ids.push(`${dexId}-${costume.name}_shiny`);
    if (costume.shadow_costume?.image_url_shadow_costume) ids.push(`${dexId}-shadow_${costume.name}_default`);
    if (costume.shadow_costume?.image_url_shiny_shadow_costume) ids.push(`${dexId}-shadow_${costume.name}_shiny`);
  }
  if ((pokemon.max ?? []).some((form) => Boolean(form.dynamax))) {
    ids.push(`${dexId}-dynamax`);
    if (pokemon.shiny_available && pokemon.image_url_shiny) ids.push(`${dexId}-shiny_dynamax`);
  }
  if ((pokemon.max ?? []).some((form) => Boolean(form.gigantamax))) {
    ids.push(`${dexId}-gigantamax`);
    if (pokemon.shiny_available) ids.push(`${dexId}-shiny_gigantamax`);
  }
  return ids;
});
const performanceRankingIds = [...new Set([
  '0001-shiny',
  '0001-default',
  ...Object.values(performanceInstances).map((instance) => String(instance.variant_id ?? '')),
  ...performanceRankingCatalogIds,
])].filter((id) => performanceRankingCatalogIds.includes(id)).slice(0, 90);
const performanceCommunityRankings = {
  privacy_threshold: 5,
  snapshot: {
    collector_users: 120,
    wishlist_users: 140,
    updated_at: '2026-07-25T12:00:00Z',
  },
  most_wanted: performanceRankingIds.map((variantId, index) => ({
    variant_id: variantId,
    wanted_users: Math.max(0, 120 - index),
    most_wanted_users: Math.max(1, 20 - Math.floor(index / 5)),
    caught_users: Math.max(1, 100 - index),
  })),
  rarest: [...performanceRankingIds].reverse().map((variantId, index) => ({
    variant_id: variantId,
    wanted_users: Math.max(0, 120 - index),
    most_wanted_users: Math.max(1, 20 - Math.floor(index / 5)),
    caught_users: Math.max(1, 100 - index),
  })),
};
const performanceTradeInstanceIds = Object.keys(performanceInstances).slice(0, 4);
const [
  performanceIncomingMineId,
  performanceIncomingPartnerId,
  performanceActiveMineId,
  performanceActivePartnerId,
] = performanceTradeInstanceIds;
const performanceTradeRelatedInstances = Object.fromEntries(
  performanceTradeInstanceIds.map((instanceId) => [instanceId, {
    ...performanceInstances[instanceId],
    instance_id: instanceId,
  }]),
);
const performanceTrades = {
  'performance-incoming': {
    trade_id: 'performance-incoming',
    trade_status: 'proposed',
    username_proposed: 'OtherTrainer',
    username_accepting: signedInUser.username,
    pokemon_instance_id_user_proposed: performanceIncomingPartnerId,
    pokemon_instance_id_user_accepting: performanceIncomingMineId,
    trade_friendship_level: 'Best',
    trade_dust_cost: 800,
    is_lucky_trade: false,
    trade_proposal_date: '2026-08-24T10:00:00.000Z',
    last_update: 1,
  },
  'performance-active': {
    trade_id: 'performance-active',
    trade_status: 'pending',
    username_proposed: signedInUser.username,
    username_accepting: 'OtherTrainer',
    pokemon_instance_id_user_proposed: performanceActiveMineId,
    pokemon_instance_id_user_accepting: performanceActivePartnerId,
    trade_friendship_level: 'Forever',
    trade_dust_cost: 40_000,
    is_lucky_trade: true,
    trade_proposal_date: '2026-08-23T10:00:00.000Z',
    trade_accepted_date: '2026-08-23T11:00:00.000Z',
    last_update: 1,
  },
};
const performancePvpBaseEntries = pvpDataFixture.leagues.great.entries;
const performancePvpGreatEntries = [
  ...performancePvpBaseEntries,
  ...Array.from({ length: 57 }, (_, offset) => {
    const rank = offset + 4;
    const template = performancePvpBaseEntries[offset % performancePvpBaseEntries.length]!;
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
const performancePvpData = {
  ...pvpDataFixture,
  leagues: {
    ...pvpDataFixture.leagues,
    great: {
      ...pvpDataFixture.leagues.great,
      entries: performancePvpGreatEntries,
    },
  },
  formats: [{
    key: 'jungle-cup',
    label: 'Jungle Cup',
    league: 'great',
    cup: 'Jungle',
    cpLimit: 1_500,
    rules: ['Only Normal, Grass, Electric, Poison, Ground, Flying, Bug, and Dark types'],
    mechanics: 'current-2026',
    entries: performancePvpGreatEntries.slice(0, 20),
  }],
};
const performancePvpEntries = Object.values(performancePvpData.leagues)
  .reduce((total, league) => total + league.entries.length, 0);
const performanceSearchResults = [{
  pokemon_id: 25,
  instance_id: 'performance-search-pikachu',
  username: 'OtherTrainer',
  distance: 2.8,
  latitude: 49.289,
  longitude: -123.119,
  cp: 821,
  shiny: true,
  gender: 'Female',
  location_caught: 'Coal Harbour',
  date_caught: '2026-06-18',
  wanted_list: {},
}];
const performanceProfileHighlights = Object.entries(performanceInstances).slice(0, 3).map(
  ([instanceId, instance]) => ({
    ...instance,
    disabled: false,
    instance_id: instanceId,
    is_caught: true,
  }),
);
const performanceTrainerProfile = {
  user: {
    user_id: signedInUser.user_id,
    username: signedInUser.username,
    pokemonGoName: signedInUser.pokemonGoName,
    team: 'Mystic',
    trainer_level: 50,
    total_xp: 88_000_000,
    pogo_started_on: '2016-07-06T00:00:00Z',
    app_joined_at: '2026-01-01T00:00:00Z',
  },
  trainer_titles: ['raid-regular', 'shiny-hunter'],
  location: signedInUser.location,
  trainer_code: signedInUser.trainerCode,
  stats: { caught: 120, for_trade: 18, wanted: 9, favorites: 24, registered: 846 },
  highlights: performanceProfileHighlights,
  viewer: {
    relationship: 'self',
    can_view_profile: true,
    can_view_collection: true,
  },
};
const performanceFriend = {
  user_id: 'performance-friend',
  username: 'NexusFriend',
  pokemonGoName: 'NexusFriendGO',
  team: 'Valor',
  trainer_level: 48,
  friendship_id: 'performance-friendship',
};
const performanceRouteOptions = {
  baseUrl: webBaseUrl,
  communityRankings: performanceCommunityRankings,
  locationSuggestions: [{
    displayName: 'Vancouver, British Columbia, Canada',
    latitude: 49.2827,
    longitude: -123.1207,
    boundary: null,
  }],
  mockImages: false,
  friendsOverview: {
    blocked: [],
    friends: [performanceFriend],
    incoming: [{ ...performanceFriend, friendship_id: 'performance-incoming', username: 'IncomingTrainer' }],
    outgoing: [],
  },
  pvpData: performancePvpData,
  searchResults: performanceSearchResults,
  syncInstances: performanceInstances,
  trainerSuggestions: [{
    username: 'OtherTrainer',
    pokemonGoName: 'OtherPogoName',
    team: 'Mystic',
    trainer_level: 50,
  }],
  trainerPreferences: {
    profile_visibility: 'public',
    collection_visibility: 'public',
    friend_request_permission: 'everyone',
    trainer_code_visibility: 'friends',
    coordination_method: 'campfire',
    coordination_handle: 'PerformanceTrainer',
    share_trade_contact: true,
    show_location: true,
    show_pokemon_go_name: true,
  },
  trainerProfile: performanceTrainerProfile,
  trades: performanceTrades,
  userOverview: {
    related_instances: performanceTradeRelatedInstances,
  },
  userInstances: {
    instances: performanceInstances,
    username: signedInUser.username,
  },
};

const addMetric = (
  scenarioId: string,
  metric: string,
  value: number | null,
  sampleIndex: number,
  options: Pick<MetricSample, 'unit' | 'direction' | 'diagnostic'>,
) => {
  if (value == null || !Number.isFinite(value) || value < 0) return;
  samples.push({ scenarioId, metric, value, sampleIndex, ...options });
};

const installBrowserProbe = async (page: Page) => {
  await page.addInitScript(() => {
    const state = {
      frameTimes: [] as number[],
      longTasks: [] as number[],
      largestContentfulPaint: null as number | null,
      lastInputAt: null as number | null,
      lastPointerDownAt: null as number | null,
      measurementStartedAt: 0,
    };
    Object.defineProperty(window, '__performanceParityProbe', {
      configurable: true,
      value: state,
    });
    document.addEventListener('pointerdown', () => {
      state.lastPointerDownAt = performance.now();
    }, { capture: true });
    // Native interaction traces begin in their Pressable/TextInput handler.
    // Use the corresponding DOM activation event for like-for-like software
    // response latency; pointer-down additionally remains available for the
    // one explicit touch-to-motion contract.
    document.addEventListener('click', () => {
      state.lastInputAt = performance.now();
    }, { capture: true });
    document.addEventListener('input', () => {
      state.lastInputAt = performance.now();
    }, { capture: true });
    document.addEventListener('keydown', () => {
      state.lastInputAt = performance.now();
    }, { capture: true });
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // Long Task timing is Chromium-only and remains zero when unavailable.
    }
    try {
      new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1);
        if (last) state.largestContentfulPaint = last.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // LCP is diagnostic and optional.
    }
    const frame = (timestamp: number) => {
      state.frameTimes.push(timestamp);
      if (state.frameTimes.length > 2_000) state.frameTimes.shift();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
};

const setAuthAndTheme = async (
  page: Page,
  auth: ContractRoute['auth'],
  theme: 'dark' | 'light',
) => {
  await page.addInitScript(({ activeTheme, authState, user }) => {
    // These are warm-route measurements: IndexedDB survives between pages.
    // Keep its catalog metadata with it. Clearing only the version markers
    // forces every page to rebuild and rewrite the same catalog, creating an
    // artificial backlog of catalog/tag writes that blocks preference saves.
    const catalogMetadata = [
      'variantsTimestamp',
      'variantsPayloadHash',
      'pokemonCatalogVersion',
      'pokemonMovesVersion',
      'pokemonRaidDataVersion',
    ].map((key) => [key, localStorage.getItem(key)] as const);
    localStorage.clear();
    sessionStorage.clear();
    for (const [key, value] of catalogMetadata) {
      if (value !== null) localStorage.setItem(key, value);
    }
    localStorage.setItem('isLightMode', String(activeTheme === 'light'));
    if (authState === 'signed-in') localStorage.setItem('user', JSON.stringify(user));
  }, { activeTheme: theme, authState: auth, user: signedInUser });
};

const seedPerformanceInstances = async (
  context: BrowserContext,
  instancePayload: Record<string, Record<string, unknown>> = performanceInstances,
) => {
  const reusablePhysicalPage = performanceProfile === 'physical-android'
    && physicalAutomationPage
    && !physicalAutomationPage.isClosed()
    ? physicalAutomationPage
    : null;
  const page = reusablePhysicalPage ?? await context.newPage();
  await page.route('**/__performance-seed', (route) => route.fulfill({
    body: '<!doctype html><title>performance seed</title>',
    contentType: 'text/html',
    status: 200,
  }));
  try {
    await page.goto(`${webBaseUrl}/__performance-seed`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async (instances) => {
      // Preference saves are durably queued in updatesDB. A physical Chrome
      // profile survives between runs, so seeding only instancesDB can replay
      // stale filters and silently change the measured workload.
      await Promise.all(['instancesDB', 'updatesDB'].map((databaseName) => (
        new Promise<void>((resolveDelete, rejectDelete) => {
          const deletion = indexedDB.deleteDatabase(databaseName);
          deletion.onsuccess = () => resolveDelete();
          deletion.onerror = () => rejectDelete(deletion.error);
          deletion.onblocked = () => rejectDelete(new Error(`Could not reset ${databaseName}`));
        })
      )));
      await new Promise<void>((resolveSeed, rejectSeed) => {
        const request = indexedDB.open('instancesDB', 5);
        request.onerror = () => rejectSeed(request.error);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('instances')) {
            db.createObjectStore('instances', { keyPath: 'instance_id' });
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('instances', 'readwrite');
          const store = transaction.objectStore('instances');
          for (const instance of Object.values(instances)) store.put(instance);
          transaction.oncomplete = () => {
            db.close();
            resolveSeed();
          };
          transaction.onerror = () => {
            db.close();
            rejectSeed(transaction.error);
          };
        };
      });
    }, instancePayload);
  } finally {
    if (!reusablePhysicalPage) await page.close();
  }
};

const waitUntilVisuallyReady = async (page: Page) => {
  await page.locator('#root').waitFor({ state: 'visible', timeout: 30_000 });
  // A root with a heading is not necessarily a ready route: several Vite
  // screens intentionally reveal their shell while collection/tool queries
  // are still resolving. Wait for the deterministic fixture traffic to go
  // quiet before evaluating loading surfaces and taking the paint snapshot.
  await page.waitForLoadState('networkidle', { timeout: 30_000 });
  await page.waitForFunction(() => {
    const root = document.querySelector('#root');
    const overlay = document.querySelector('.app-loading-overlay');
    const content = root?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    // PageState announces loading through aria-live without role="status".
    // Its shell is not a ready page or a valid performance result.
    const pendingStatus = Array.from(document.querySelectorAll(
      '[role="status"], .page-state[aria-live="polite"], .page-state[aria-live="assertive"]',
    )).some(
      (element) => /^(Loading|Preparing|Opening|Syncing)\b/i.test(
        element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ),
    );
    return !overlay && !pendingStatus && content.length >= 12;
  }, null, { timeout: 30_000 }).catch(async (cause: unknown) => {
    const statuses = await page.locator('[role="status"], .page-state').allTextContents();
    await test.info().attach('route-not-ready', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    throw new Error(`Route did not become ready: ${page.url()}; statuses: ${JSON.stringify(statuses)}`, { cause });
  });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(page.locator('.app-error-fallback'), `Render failure on ${page.url()}`).toHaveCount(0);
};

const resetBrowserProbe = async (page: Page) => page.evaluate(() => {
  const probe = (window as Window & {
    __performanceParityProbe?: {
      frameTimes: number[];
      longTasks: number[];
      largestContentfulPaint: number | null;
      measurementStartedAt: number;
    };
  }).__performanceParityProbe;
  if (!probe) return;
  probe.frameTimes = [];
  probe.longTasks = [];
  probe.largestContentfulPaint = null;
  probe.measurementStartedAt = performance.now();
});

const takeSnapshot = async (page: Page): Promise<BrowserSnapshot> => page.evaluate(() => {
  const probe = (window as Window & {
    __performanceParityProbe?: {
      frameTimes: number[];
      longTasks: number[];
      largestContentfulPaint: number | null;
      measurementStartedAt: number;
    };
  }).__performanceParityProbe;
  const measurementStartedAt = probe?.measurementStartedAt ?? 0;
  const frameGaps = (probe?.frameTimes ?? []).slice(1).map(
    (timestamp, index) => timestamp - (probe?.frameTimes[index] ?? timestamp),
  );
  const firstContentfulPaint = performance.getEntriesByName('first-contentful-paint').at(-1);
  const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
  return {
    routeReadyMs: performance.now() - measurementStartedAt,
    mainThreadBlockingMs: (probe?.longTasks ?? []).reduce(
      (total, duration) => total + Math.max(0, duration - 50),
      0,
    ),
    maxFrameGapMs: frameGaps.length ? Math.max(...frameGaps) : 0,
    firstContentfulPaintMs: firstContentfulPaint && firstContentfulPaint.startTime >= measurementStartedAt
      ? firstContentfulPaint.startTime - measurementStartedAt
      : null,
    largestContentfulPaintMs: probe?.largestContentfulPaint != null
      ? Math.max(0, probe.largestContentfulPaint - measurementStartedAt)
      : null,
    transferSizeBytes: performance.getEntriesByType('resource').reduce(
      (total, entry) => total + (
        entry.startTime >= measurementStartedAt
          ? (entry as PerformanceResourceTiming).transferSize || 0
          : 0
      ),
      0,
    ),
    domNodeCount: document.getElementsByTagName('*').length,
    jsHeapBytes: memory?.usedJSHeapSize ?? null,
  };
});

const recordRouteSnapshot = (
  route: ContractRoute,
  snapshot: BrowserSnapshot,
  sampleIndex: number,
) => {
  addMetric(route.id, 'route_ready_ms', snapshot.routeReadyMs, sampleIndex, {
    direction: 'lower', unit: 'ms',
  });
  addMetric(route.id, 'main_thread_blocking_ms', snapshot.mainThreadBlockingMs, sampleIndex, {
    direction: 'lower', unit: 'ms',
  });
  addMetric(route.id, 'max_frame_gap_ms', snapshot.maxFrameGapMs, sampleIndex, {
    direction: 'lower', unit: 'ms',
  });
  addMetric(route.id, 'first_contentful_paint_ms', snapshot.firstContentfulPaintMs, sampleIndex, {
    diagnostic: true, direction: 'lower', unit: 'ms',
  });
  addMetric(route.id, 'largest_contentful_paint_ms', snapshot.largestContentfulPaintMs, sampleIndex, {
    diagnostic: true, direction: 'lower', unit: 'ms',
  });
  addMetric(route.id, 'transfer_size_bytes', snapshot.transferSizeBytes, sampleIndex, {
    diagnostic: true, direction: 'lower', unit: 'bytes',
  });
  addMetric(route.id, 'dom_node_count', snapshot.domNodeCount, sampleIndex, {
    diagnostic: true, direction: 'lower', unit: 'count',
  });
  addMetric(route.id, 'js_heap_bytes', snapshot.jsHeapBytes, sampleIndex, {
    diagnostic: true, direction: 'lower', unit: 'bytes',
  });
};

const inputLatency = async (page: Page, start: 'activation' | 'pointerdown' = 'activation') => page.evaluate((inputStart) => {
  const probe = (window as Window & {
    __performanceParityProbe?: {
      lastInputAt: number | null;
      lastPointerDownAt: number | null;
    };
  }).__performanceParityProbe;
  const startedAt = inputStart === 'pointerdown'
    ? probe?.lastPointerDownAt
    : probe?.lastInputAt;
  return startedAt == null ? null : performance.now() - startedAt;
}, start);

const createMeasuredPage = async (
  context: BrowserContext,
  auth: ContractRoute['auth'],
  theme: 'dark' | 'light',
  routeOptions: E2eRouteOptions = performanceRouteOptions,
) => {
  const page = performanceProfile === 'physical-android'
    && physicalAutomationPage
    && !physicalAutomationPage.isClosed()
    ? physicalAutomationPage
    : await context.newPage();
  if (performanceProfile === 'physical-android') physicalAutomationPage = page;
  // CDP creates Android Chrome tabs in the background. Playwright can inspect
  // the background tab's DOM while real touch injection still lands on the
  // foreground tab, producing false overlap/interception failures. Explicitly
  // foreground every measured page; this is a no-op for the desktop proxy.
  await page.bringToFront();
  await installE2eRoutes(page, routeOptions);
  // Route measurements visit account security before its interactive workflow
  // installs the mutable provider fixture. Supply its actual response contract
  // here too; an error boundary must never count as a successful route paint.
  for (const pattern of ['**/api/auth/account/security', '**/__e2e/auth/account/security']) {
    await page.route(pattern, (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        email: signedInUser.email,
        hasPassword: true,
        activeSessions: 2,
        providers: [],
      } satisfies AccountSecuritySummary),
    }));
  }
  await setAuthAndTheme(page, auth, theme);
  await installBrowserProbe(page);
  return page;
};

const closeMeasuredPage = async (page: Page) => {
  // Android sends real touch input only to Chrome's foreground tab. Reuse the
  // one foreground automation tab across physical samples; creating/closing
  // background tabs makes DOM inspection and touch injection target different
  // pages. Desktop contexts retain their normal page isolation.
  if (performanceProfile === 'physical-android') return;
  await page.close();
};

const recordInteraction = async (
  page: Page,
  scenarioId: string,
  sampleIndex: number,
  start: 'activation' | 'pointerdown' = 'activation',
) => {
  const latency = await inputLatency(page, start);
  addMetric(scenarioId, 'interaction_ready_ms', latency, sampleIndex, {
    direction: 'lower', unit: 'ms',
  });
};

const activateMeasuredControl = async (locator: Locator) => {
  if (performanceProfile === 'physical-android') {
    // Native interaction traces start inside the Pressable handler. Dispatching
    // the DOM activation event is the like-for-like start on Android Chrome and
    // avoids CDP's incorrect CSS-to-device coordinate conversion on high-DPI
    // physical screens.
    await locator.dispatchEvent('click');
    return;
  }
  await locator.click();
};

const collectHomeInteractions = async (
  context: BrowserContext,
  sampleIndex: number,
) => {
  const guest = await createMeasuredPage(context, 'guest', 'dark');
  try {
    await guest.goto(`${webBaseUrl}/`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(guest);
    const hintDismiss = guest.getByRole('button', { name: 'Dismiss action menu tip' });
    await activateMeasuredControl(hintDismiss);
    await expect(guest.getByRole('note', { name: 'Action menu tip' })).toHaveCount(0);
    await recordInteraction(guest, 'interaction.home.hint-dismiss', sampleIndex);

    const explore = guest.getByRole('link', { name: /Explore the app/i });
    await activateMeasuredControl(explore);
    const directory = guest.locator('#feature-directory');
    await expect.poll(() => directory.evaluate(
      (element) => Math.abs(element.getBoundingClientRect().top),
    )).toBeLessThan(30);
    await recordInteraction(guest, 'interaction.home.guest-explore', sampleIndex);
    await captureWorkflowScreenshot(guest, sampleIndex, 'home-guest-directory', directory);
  } finally {
    await closeMeasuredPage(guest);
  }

  await seedPerformanceInstances(context, {});
  const emptyHomeOptions: E2eRouteOptions = {
    ...performanceRouteOptions,
    friendsOverview: { blocked: [], friends: [], incoming: [], outgoing: [] },
    syncInstances: {},
    trades: {},
    userInstances: { instances: {}, username: signedInUser.username },
    userOverview: {
      pokemon_instances: {},
      registrations: {},
      related_instances: {},
      trades: {},
      user: { user_id: signedInUser.user_id, username: signedInUser.username },
    },
  };
  const onboarding = await createMeasuredPage(context, 'signed-in', 'dark', emptyHomeOptions);
  try {
    await onboarding.goto(`${webBaseUrl}/`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(onboarding);
    await onboarding.getByRole('heading', { name: 'Let’s make your account useful.' })
      .waitFor({ state: 'visible' });
    const onboardingHintDismiss = onboarding.getByRole('button', {
      name: 'Dismiss action menu tip',
    });
    if (await onboardingHintDismiss.isVisible().catch(() => false)) {
      await activateMeasuredControl(onboardingHintDismiss);
      await expect(onboarding.getByRole('note', { name: 'Action menu tip' })).toHaveCount(0);
    }
    const openDashboard = onboarding.getByRole('button', { name: 'Open trainer dashboard' });
    await activateMeasuredControl(openDashboard);
    await onboarding.getByRole('heading', { name: /Welcome back, PerformanceTrainerGO/ })
      .waitFor({ state: 'visible' });
    await recordInteraction(onboarding, 'interaction.home.onboarding-dismiss', sampleIndex);
    await captureWorkflowScreenshot(onboarding, sampleIndex, 'home-signed-in-dashboard');
  } finally {
    await closeMeasuredPage(onboarding);
    await seedPerformanceInstances(context);
  }
};

const installAuthPerformanceRoutes = async (page: Page) => {
  const handleAuthRequest = async (route: Route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    const path = new URL(request.url()).pathname.replace(/^\/(?:__e2e|api)\/auth/, '');
    if (path === '/reset-password') {
      await route.fulfill({
        body: JSON.stringify({ message: 'Reset instructions sent.' }),
        contentType: 'application/json',
        status: 202,
      });
      return;
    }
    if (path === '/reset-password/confirm') {
      await route.fulfill({
        body: JSON.stringify({ message: 'Password updated.' }),
        contentType: 'application/json',
        status: 200,
      });
      return;
    }
    await route.fallback();
  };
  await page.route('**/__e2e/auth/**', handleAuthRequest);
  await page.route('**/api/auth/**', handleAuthRequest);
};

const collectAuthInteractions = async (
  context: BrowserContext,
  sampleIndex: number,
) => {
  const login = await createMeasuredPage(context, 'guest', 'dark');
  try {
    await installAuthPerformanceRoutes(login);
    await login.goto(`${webBaseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(login);

    const showPassword = login.getByRole('button', { name: 'Show password' });
    await activateMeasuredControl(showPassword);
    const hidePassword = login.getByRole('button', { name: 'Hide password' });
    await expect(hidePassword).toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(login, 'interaction.auth.login.password-visibility', sampleIndex);

    await activateMeasuredControl(login.getByRole('button', { name: 'Reset Password' }));
    const recovery = login.getByRole('dialog', { name: 'Reset your password' });
    await recovery.waitFor({ state: 'visible' });
    await recordInteraction(login, 'interaction.auth.recovery.open', sampleIndex);

    await recovery.getByPlaceholder('you@example.com').fill('PerfAuth');
    await activateMeasuredControl(recovery.getByRole('button', { name: 'Email reset link' }));
    await expect(recovery).toHaveCount(0);
    await expect(login.getByText('If that account exists, reset instructions are on the way.'))
      .toBeVisible();
    await recordInteraction(login, 'interaction.auth.recovery.request-result', sampleIndex);
    await captureWorkflowScreenshot(login, sampleIndex, 'auth-login-recovery-result');
  } finally {
    await closeMeasuredPage(login);
  }

  const register = await createMeasuredPage(context, 'guest', 'dark');
  try {
    await register.goto(`${webBaseUrl}/register`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(register);
    await activateMeasuredControl(register.getByRole('button', { name: 'Continue with email' }));
    await register.getByRole('heading', { name: 'Your account', exact: true })
      .waitFor({ state: 'visible' });
    await recordInteraction(register, 'interaction.auth.registration.method-result', sampleIndex);

    await register.getByLabel('Username', { exact: true }).fill('PerfAuth');
    await register.getByLabel('Email', { exact: true }).fill('performance@example.invalid');
    await activateMeasuredControl(register.getByRole('button', { name: /Continue/ }));
    await register.getByRole('heading', { name: 'Protect your account' }).waitFor({ state: 'visible' });
    await recordInteraction(register, 'interaction.auth.registration.step-result', sampleIndex * 4);

    await register.getByLabel('Password', { exact: true }).fill('Strong_password_42!');
    await register.getByLabel('Confirm password', { exact: true }).fill('Strong_password_42!');
    await activateMeasuredControl(register.getByRole('button', { name: /Continue/ }));
    await register.getByRole('heading', { name: 'Your Pokémon GO identity' })
      .waitFor({ state: 'visible' });
    await recordInteraction(register, 'interaction.auth.registration.step-result', sampleIndex * 4 + 1);

    const sameName = register.getByRole('checkbox', { name: /Use PerfAuth as my Pokémon GO name/ });
    await activateMeasuredControl(sameName);
    await expect(sameName).toBeChecked();
    await expect(register.getByRole('textbox', { name: 'Pokémon GO name', exact: true }))
      .toHaveValue('PerfAuth');
    await recordInteraction(register, 'interaction.auth.registration.same-name-result', sampleIndex);

    await activateMeasuredControl(register.getByRole('button', { name: /Continue/ }));
    await register.getByRole('heading', { name: 'Your area' }).waitFor({ state: 'visible' });
    await recordInteraction(register, 'interaction.auth.registration.step-result', sampleIndex * 4 + 2);
    await activateMeasuredControl(register.getByRole('button', { name: /Continue/ }));
    const review = register.getByRole('heading', { name: 'Ready to join' });
    await review.waitFor({ state: 'visible' });
    await recordInteraction(register, 'interaction.auth.registration.step-result', sampleIndex * 4 + 3);
    await captureWorkflowScreenshot(register, sampleIndex, 'auth-registration-review');
  } finally {
    await closeMeasuredPage(register);
  }

  const reset = await createMeasuredPage(context, 'guest', 'dark');
  try {
    await installAuthPerformanceRoutes(reset);
    await reset.goto(`${webBaseUrl}/reset-password?token=${'a'.repeat(64)}`, {
      waitUntil: 'domcontentloaded',
    });
    await waitUntilVisuallyReady(reset);
    await reset.getByLabel('New password', { exact: true }).fill('Strong_password_42!');
    await reset.getByLabel('Confirm new password', { exact: true }).fill('Strong_password_42!');
    await activateMeasuredControl(reset.getByRole('button', { name: 'Update password' }));
    const complete = reset.getByRole('heading', { name: 'Password updated' });
    await complete.waitFor({ state: 'visible' });
    await recordInteraction(reset, 'interaction.auth.password-reset.result', sampleIndex);
    await captureWorkflowScreenshot(reset, sampleIndex, 'auth-password-reset-result');
  } finally {
    await closeMeasuredPage(reset);
  }
};

const waitForTrainerPageSlide = async (page: Page) => {
  await page.locator('.trainer-page-slider .horizontal-page-slider__track').evaluate(
    (track) => new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        track.removeEventListener('transitionend', finish);
        resolve();
      };
      track.addEventListener('transitionend', finish, { once: true });
      window.setTimeout(finish, 360);
    }),
  );
};

const collectTrainerWorkspaceInteractions = async (
  context: BrowserContext,
  sampleIndex: number,
) => {
  const profile = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    for (const pattern of ['**/api/auth/update/*', '**/__e2e/auth/update/*']) {
      await profile.route(pattern, async (route) => {
        await route.fulfill({ body: '{}', contentType: 'application/json', status: 200 });
      });
    }
    await profile.goto(`${webBaseUrl}/profile`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(profile);
    const card = profile.getByRole('region', {
      name: `${signedInUser.username}'s trainer card`,
    });
    await card.waitFor({ state: 'visible' });

    await activateMeasuredControl(profile.getByRole('button', { name: 'Edit', exact: true }));
    await card.getByLabel('Pokemon GO name').waitFor({ state: 'visible' });
    await recordInteraction(profile, 'interaction.profile.edit-result', sampleIndex);

    const maxBattler = card.getByRole('button', { name: /Max Battler/i });
    await activateMeasuredControl(maxBattler);
    await expect(maxBattler).toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(profile, 'interaction.profile.title-result', sampleIndex);

    await activateMeasuredControl(card.getByRole('button', {
      name: 'Choose featured Pokemon for slot 4',
    }));
    const picker = card.getByLabel('Choose Pokemon for featured slot 4');
    await picker.waitFor({ state: 'visible' });
    await recordInteraction(profile, 'interaction.profile.showcase-picker', sampleIndex);

    const candidate = picker.getByRole('button', {
      name: /^Choose .* for featured slot 4$/,
    }).first();
    const candidateLabel = await candidate.getAttribute('aria-label');
    const candidateName = candidateLabel?.match(/^Choose (.*) for featured slot 4$/)?.[1];
    if (!candidateName) throw new Error('Profile performance fixture exposed no unassigned showcase candidate.');
    await activateMeasuredControl(candidate);
    const selectedSlot = card.getByRole('button', {
      name: `Change featured Pokemon in slot 4, currently ${candidateName}`,
    });
    await selectedSlot.waitFor({ state: 'visible' });
    await recordInteraction(profile, 'interaction.profile.showcase-selection-result', sampleIndex);

    await selectedSlot.focus();
    await profile.keyboard.press('Alt+ArrowLeft');
    await card.getByRole('button', {
      name: `Change featured Pokemon in slot 3, currently ${candidateName}`,
    }).waitFor({ state: 'visible' });
    await recordInteraction(profile, 'interaction.profile.showcase-reorder-result', sampleIndex);

    await activateMeasuredControl(card.getByRole('button', { name: 'Save profile' }));
    const profileSaveFeedback = profile.locator('.feedback-card').last();
    await profileSaveFeedback.waitFor({ state: 'visible' });
    await expect(profileSaveFeedback).toContainText('Profile updated');
    await profile.getByRole('button', { name: 'Edit', exact: true }).waitFor({ state: 'visible' });
    await recordInteraction(profile, 'interaction.profile.save-result', sampleIndex);
    await captureWorkflowScreenshot(profile, sampleIndex, 'trainer-profile-saved');
  } finally {
    await closeMeasuredPage(profile);
  }

  const relationshipProfile = await createMeasuredPage(context, 'signed-in', 'dark', {
    ...performanceRouteOptions,
    trainerProfile: {
      ...performanceTrainerProfile,
      user: {
        ...performanceTrainerProfile.user,
        user_id: performanceFriend.user_id,
        username: performanceFriend.username,
        pokemonGoName: performanceFriend.pokemonGoName,
      },
      viewer: {
        relationship: 'friend',
        friendship_id: performanceFriend.friendship_id,
        can_view_profile: true,
        can_view_collection: true,
      },
    },
  });
  try {
    for (const pattern of ['**/api/users/friends/*', '**/__e2e/users/friends/*']) {
      await relationshipProfile.route(pattern, async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({ status: 204 });
          return;
        }
        await route.fallback();
      });
    }
    await relationshipProfile.goto(`${webBaseUrl}/profile/${performanceFriend.username}`, {
      waitUntil: 'domcontentloaded',
    });
    await waitUntilVisuallyReady(relationshipProfile);
    await activateMeasuredControl(relationshipProfile.getByRole('button', { name: 'Friends', exact: true }));
    const confirmation = relationshipProfile.getByRole('dialog', { name: 'Confirm action' });
    await confirmation.waitFor({ state: 'visible' });
    await recordInteraction(relationshipProfile, 'interaction.profile.relationship-confirmation', sampleIndex);
    await activateMeasuredControl(confirmation.getByRole('button', { name: 'OK', exact: true }));
    await relationshipProfile.getByText('Friend removed', { exact: true }).waitFor({ state: 'visible' });
    await recordInteraction(relationshipProfile, 'interaction.profile.relationship-result', sampleIndex);
  } finally {
    await closeMeasuredPage(relationshipProfile);
  }

  const friends = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    for (const pattern of ['**/api/users/friends/requests/**', '**/__e2e/users/friends/requests/**']) {
      await friends.route(pattern, async (route) => {
        await route.fulfill({ body: '{}', contentType: 'application/json', status: 200 });
      });
    }
    await friends.goto(`${webBaseUrl}/profile/friends`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(friends);

    await activateMeasuredControl(friends.getByRole('button', { name: /Requests\s*1/ }));
    await waitForTrainerPageSlide(friends);
    await expect(friends.locator('.trainer-tabs button.active')).toContainText('Requests');
    await recordInteraction(friends, 'interaction.friends.view-result', sampleIndex);

    await activateMeasuredControl(friends.getByRole('button', { name: 'Accept IncomingTrainer' }));
    await friends.getByText('Friend request accepted', { exact: true }).waitFor({ state: 'visible' });
    await recordInteraction(friends, 'interaction.friends.command-result', sampleIndex);

    await activateMeasuredControl(friends.getByRole('button', { name: /^Find$/ }));
    await waitForTrainerPageSlide(friends);
    await friends.getByPlaceholder('Username or Pokemon GO name').fill('Other');
    await activateMeasuredControl(friends.getByRole('button', { name: 'Search', exact: true }));
    await friends.getByText('OtherPogoName', { exact: true }).waitFor({ state: 'visible' });
    await recordInteraction(friends, 'interaction.friends.search-result', sampleIndex);

    await activateMeasuredControl(friends.getByRole('button', { name: /Friends\s*1/ }));
    await waitForTrainerPageSlide(friends);
    await activateMeasuredControl(friends.getByRole('button', { name: `Remove ${performanceFriend.username}` }));
    await friends.getByRole('dialog', { name: 'Confirm action' }).waitFor({ state: 'visible' });
    await recordInteraction(friends, 'interaction.friends.confirmation', sampleIndex);
  } finally {
    await closeMeasuredPage(friends);
  }

  const settings = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    await settings.goto(`${webBaseUrl}/settings`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(settings);
    const profileVisibility = settings.getByLabel('Profile visibility');
    await profileVisibility.selectOption('friends');
    await expect(profileVisibility).toHaveValue('friends');
    await recordInteraction(settings, 'interaction.settings.selection-result', sampleIndex);

    const location = settings.getByRole('checkbox', { name: 'Show profile location' });
    await activateMeasuredControl(location);
    await expect(location).not.toBeChecked();
    await recordInteraction(settings, 'interaction.settings.toggle-result', sampleIndex);

    await activateMeasuredControl(settings.getByRole('button', { name: 'Save privacy' }));
    await settings.getByText('Privacy settings saved', { exact: true }).waitFor({ state: 'visible' });
    await recordInteraction(settings, 'interaction.settings.save-result', sampleIndex);
    await captureWorkflowScreenshot(settings, sampleIndex, 'trainer-settings-saved');
  } finally {
    await closeMeasuredPage(settings);
  }

  const account = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    let googleConnected = true;
    const accountSecurity = () => ({
      email: signedInUser.email,
      hasPassword: true,
      activeSessions: 2,
      providers: googleConnected ? [{
        provider: 'google',
        email: signedInUser.email,
        emailVerified: true,
        linkedAt: '2026-07-01T00:00:00.000Z',
      }] : [],
    });
    for (const pattern of ['**/api/auth/**', '**/__e2e/auth/**']) {
      await account.route(pattern, async (route) => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname.replace(/^\/(?:api|__e2e)\/auth/, '');
        if (request.method() === 'GET' && pathname === '/account/security') {
          await route.fulfill({ body: JSON.stringify(accountSecurity()), contentType: 'application/json', status: 200 });
          return;
        }
        if (request.method() === 'DELETE' && pathname === '/account/identities/google') {
          googleConnected = false;
          await route.fulfill({ body: '{}', contentType: 'application/json', status: 200 });
          return;
        }
        await route.fallback();
      });
    }
    await account.goto(`${webBaseUrl}/settings/account`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(account);

    await account.getByLabel('New password', { exact: true }).fill('Valid_password_42!');
    await account.getByLabel('Confirm new password', { exact: true }).fill('Different_password_42!');
    await activateMeasuredControl(account.getByRole('button', { name: 'Update account' }));
    await account.getByText('Passwords do not match.', { exact: true }).waitFor({ state: 'visible' });
    await recordInteraction(account, 'interaction.account.update-result', sampleIndex);

    const googleRow = account.locator('.trainer-connected-account').filter({ hasText: 'Google' });
    await activateMeasuredControl(googleRow.getByRole('button', { name: 'Disconnect' }));
    const confirmation = account.getByRole('dialog', { name: 'Confirm action' });
    await confirmation.waitFor({ state: 'visible' });
    await recordInteraction(account, 'interaction.account.confirmation', sampleIndex);
    await activateMeasuredControl(confirmation.getByRole('button', { name: 'OK', exact: true }));
    await account.getByText('Google disconnected', { exact: true }).waitFor({ state: 'visible' });
    await recordInteraction(account, 'interaction.account.provider-result', sampleIndex);
    await captureWorkflowScreenshot(account, sampleIndex, 'trainer-account-provider-result');
  } finally {
    await closeMeasuredPage(account);
  }
};

const collectTradeBoardInteractions = async (
  context: BrowserContext,
  sampleIndex: number,
) => {
  const page = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => undefined },
      });
    });
    await page.goto(`${webBaseUrl}/trade-board`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(page);
    const workspace = page.getByRole('region', { name: 'Share your Trade Board' });
    await workspace.waitFor({ state: 'visible' });

    const wanted = workspace.locator('.trade-board-composer__section-option--wanted input');
    await activateMeasuredControl(wanted);
    await expect(wanted).not.toBeChecked();
    await recordInteraction(page, 'interaction.trade-board.section-result', sampleIndex);

    const lightTheme = workspace.getByRole('button', { name: /Nexus Light/ });
    await activateMeasuredControl(lightTheme);
    await expect(lightTheme).toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.trade-board.theme-result', sampleIndex);

    const identity = workspace.locator('.trade-board-composer__identity-option input');
    await activateMeasuredControl(identity);
    await expect(identity).not.toBeChecked();
    await recordInteraction(page, 'interaction.trade-board.identity-result', sampleIndex);

    await activateMeasuredControl(workspace.getByRole('button', { name: 'Copy live link' }));
    await page.getByText('Live Trade Board link copied.', { exact: true }).waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.trade-board.copy-result', sampleIndex);
    await captureWorkflowScreenshot(page, sampleIndex, 'trade-board-owner-result');
  } finally {
    await closeMeasuredPage(page);
  }
};

const collectInformationInteractions = async (
  context: BrowserContext,
  sampleIndex: number,
) => {
  const page = await createMeasuredPage(context, 'guest', 'dark');
  try {
    await page.goto(`${webBaseUrl}/faq`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(page);

    const trading = page.getByRole('button', { name: 'Browse Trading questions' });
    await activateMeasuredControl(trading);
    await expect(page.getByText('7 questions', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.information.faq.category-result', sampleIndex);

    const expand = page.getByRole('button', { name: 'Expand answers', exact: true });
    await activateMeasuredControl(expand);
    await expect(page.getByRole('button', { name: 'Collapse answers', exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.information.faq.answer-result', sampleIndex);

    const search = page.getByRole('searchbox', { name: 'Search questions and answers' });
    await search.fill('Forever Friends');
    await expect(page.getByText('1 question matching “Forever Friends”', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.information.faq.search-result', sampleIndex);

    await activateMeasuredControl(page.getByRole('button', { name: 'Clear FAQ search' }));
    await expect(page.getByText('Common questions', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.information.faq.clear-result', sampleIndex);
  } finally {
    await closeMeasuredPage(page);
  }
};

const openPerformanceCaughtList = async (page: Page) => {
  // This workload already has a canonical caught roster. Open it through the
  // UI without rewriting IndexedDB or reloading during reconciliation, as the
  // general synthetic-card helper does. Preserve the same builds native uses.
  await openPokemonPage(page, performanceRouteOptions);
  await page.getByText('TAGS', { exact: true }).click();
  await expectActivePokemonView(page, 'TAGS');
  const caughtTag = page.locator('.tag-item[data-tag="Caught"]');
  await expect(caughtTag.locator('.tag-subtitle')).toContainText(
    /[1-9]\d* Pokémon have this tag\./,
  );
  await caughtTag.click();
  await expectActivePokemonView(page, 'Pokémon');
  const firstCaughtCard = page.locator('.pokemon-card[role="button"]').first();
  await expect(firstCaughtCard).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.app-loading-overlay')).toHaveCount(0);
  return { firstCaughtCard };
};

const collectSharedInteractions = async (
  context: BrowserContext,
  sampleIndex: number,
) => {
  if (workflowFilter === 'pokedex') {
    await collectPokedexInteractions(context, sampleIndex);
    return;
  }
  if (workflowFilter === 'raid') {
    await collectRaidInteractions(context, sampleIndex);
    return;
  }
  if (workflowFilter === 'pvp') {
    await collectPvpInteractions(context, sampleIndex);
    return;
  }
  if (workflowFilter === 'search') {
    await collectSearchInteractions(context, sampleIndex);
    return;
  }
  if (workflowFilter === 'trades') {
    await collectTradeInteractions(context, sampleIndex);
    return;
  }
  if (workflowFilter === 'max') {
    await collectMaxInteractions(context, sampleIndex);
    return;
  }
  if (workflowFilter === 'rankings') {
    await collectRankingsInteractions(context, sampleIndex);
    return;
  }
  if (workflowFilter === 'home') {
    await collectHomeInteractions(context, sampleIndex);
    return;
  }
  if (workflowFilter === 'auth') {
    await collectAuthInteractions(context, sampleIndex);
    return;
  }
  if (workflowFilter === 'trainer') {
    await collectTrainerWorkspaceInteractions(context, sampleIndex);
    return;
  }
  if (workflowFilter === 'trade-board') {
    await collectTradeBoardInteractions(context, sampleIndex);
    return;
  }
  if (workflowFilter === 'information') {
    await collectInformationInteractions(context, sampleIndex);
    return;
  }
  if (workflowFilter !== 'collection') {
    const home = await createMeasuredPage(context, 'signed-in', 'dark');
    try {
      await home.goto(`${webBaseUrl}/`, { waitUntil: 'domcontentloaded' });
      await waitUntilVisuallyReady(home);
      await home.getByRole('button', { name: 'Action Menu', exact: true }).click();
      await home.getByRole('dialog', { name: 'Quick navigation' }).waitFor({ state: 'visible' });
      await recordInteraction(home, 'interaction.action-menu.open', sampleIndex);

      const theme = home.locator('.action-menu-overlay .switch');
      await theme.click();
      await expect(home.locator('html')).toHaveAttribute('data-theme', 'light');
      await recordInteraction(home, 'interaction.theme.toggle', sampleIndex);
    } finally {
      await closeMeasuredPage(home);
    }
    await collectHomeInteractions(context, sampleIndex);
  }

  const createCollectionPage = async () => {
    // Each collection scenario must start with the canonical roster. Previous
    // scenarios close pages while their cache reconciliation may still be
    // writing, and their queued preferences otherwise leak into the next one.
    await seedPerformanceInstances(context);
    return createMeasuredPage(context, 'signed-in', 'dark');
  };
  const collection = await createCollectionPage();
  try {
    await openPerformanceCaughtList(collection);

    const search = collection.getByLabel('Search Pokémon', { exact: true });
    await search.click();
    await collection.locator('.search-menu').waitFor({ state: 'visible' });
    await recordInteraction(collection, 'interaction.collection.search-open', sampleIndex);

    await collection.locator('.filter-item').filter({ hasText: /^Shiny$/ }).click();
    await collection.locator('.search-menu').waitFor({ state: 'detached' });
    await collection.locator('.pokemon-card').first().waitFor({ state: 'visible' });
    await recordInteraction(collection, 'interaction.collection.filter', sampleIndex);
    await recordInteraction(collection, 'interaction.collection.query-result', sampleIndex);
  } finally {
    await closeMeasuredPage(collection);
  }

  const queryCollection = await createCollectionPage();
  try {
    await openPokemonPage(queryCollection, performanceRouteOptions);
    const querySearch = queryCollection.getByLabel('Search Pokémon', { exact: true });
    await querySearch.fill('Bulbasaur');
    await queryCollection.getByRole('button', { name: /Select Bulbasaur/i }).first()
      .waitFor({ state: 'visible' });
    await recordInteraction(queryCollection, 'interaction.collection.typed-query', sampleIndex);
    await queryCollection.locator('.evo-line-checkbox').click();
    await queryCollection.getByRole('button', { name: /Select Ivysaur/i }).first()
      .waitFor({ state: 'visible' });
    await recordInteraction(queryCollection, 'interaction.collection.evolution-result', sampleIndex);
  } finally {
    await closeMeasuredPage(queryCollection);
  }

  const sortCollection = await createCollectionPage();
  try {
    await openPokemonPage(sortCollection, performanceRouteOptions);
    await sortCollection.locator('.sort-button').first().click();
    await sortCollection.locator('.sort-menu-overlay.visible').waitFor({ state: 'visible' });
    await recordInteraction(sortCollection, 'interaction.collection.sort-open', sampleIndex);
    await sortCollection.locator('.sort-menu-overlay .sort-type-button')
      .filter({ hasText: 'NAME' }).click();
    await sortCollection.locator('.sort-menu-overlay').waitFor({ state: 'detached' });
    await expect(sortCollection.locator('.sort-button-img')).toHaveAttribute('alt', 'NAME');
    await recordInteraction(sortCollection, 'interaction.collection.sort-result', sampleIndex);
  } finally {
    await closeMeasuredPage(sortCollection);
  }

  const tagCollection = await createCollectionPage();
  try {
    await openPerformanceCaughtList(tagCollection);
    await tagCollection.getByText('TAGS', { exact: true }).click();
    await tagCollection.locator('.tag-item[data-tag="Caught"]').waitFor({ state: 'visible' });
    await tagCollection.locator('.tag-item[data-tag="Caught"]').click();
    await tagCollection.locator('.toggle-text.active').filter({ hasText: 'Pokémon' })
      .waitFor({ state: 'visible' });
    await recordInteraction(
      tagCollection,
      'interaction.collection.tag-slide',
      sampleIndex,
      'pointerdown',
    );
    await tagCollection.locator('.pokemon-card').first().waitFor({ state: 'visible' });
    await recordInteraction(tagCollection, 'interaction.collection.tag-result', sampleIndex);

    await tagCollection.getByRole('button', { name: 'Clear Caught tag filter', exact: true }).click();
    await tagCollection.locator('.modal-overlay').waitFor({ state: 'visible' });
    await recordInteraction(tagCollection, 'interaction.collection.clear-tag-dialog', sampleIndex);
  } finally {
    await closeMeasuredPage(tagCollection);
  }

  const organizer = await createCollectionPage();
  try {
    await openPokemonPage(organizer, performanceRouteOptions);
    await organizer.locator('.pokemon-card').first().click();
    await organizer.locator('.highlight-action-container').waitFor({ state: 'visible' });
    await recordInteraction(organizer, 'interaction.collection.selection', sampleIndex);
    await organizer.getByRole('button', { name: 'Add (1)', exact: true }).click();
    await organizer.locator('.pokemon-organizer').waitFor({ state: 'visible' });
    await recordInteraction(organizer, 'interaction.collection.organizer', sampleIndex);
  } finally {
    await closeMeasuredPage(organizer);
  }

  const instance = await createCollectionPage();
  try {
    const { firstCaughtCard } = await openPerformanceCaughtList(instance);
    await firstCaughtCard.click();
    const overlay = instance.locator('.instance-overlay.caught-mode');
    await overlay.waitFor({ state: 'visible' });
    const previousButton = instance.getByRole('button', { name: 'Previous Pokemon', exact: true });
    await expect(previousButton).toBeHidden();
    await instance.getByRole('button', { name: 'Next Pokemon', exact: true }).click();
    await previousButton.waitFor({ state: 'visible' });
    await recordInteraction(instance, 'interaction.instance.navigate', sampleIndex * 2);
    await previousButton.click();
    await expect(previousButton).toBeHidden();
    await recordInteraction(instance, 'interaction.instance.navigate', sampleIndex * 2 + 1);
    const editButton = overlay.getByRole('button', { name: 'Edit', exact: true });
    await editButton.click();
    const saveButton = overlay.getByRole('button', { name: 'Save', exact: true });
    await saveButton.waitFor({ state: 'visible' });
    await recordInteraction(instance, 'interaction.instance.edit-result', sampleIndex);
    await saveButton.click();
    await editButton.waitFor({ state: 'visible' });
    await recordInteraction(instance, 'interaction.instance.save-result', sampleIndex);
  } finally {
    await closeMeasuredPage(instance);
  }

  if (workflowFilter === 'collection') return;

  await collectPokedexInteractions(context, sampleIndex);
  await collectRaidInteractions(context, sampleIndex);
  await collectPvpInteractions(context, sampleIndex);
  await collectSearchInteractions(context, sampleIndex);
  await collectTradeInteractions(context, sampleIndex);
  await collectTradeBoardInteractions(context, sampleIndex);
  await collectMaxInteractions(context, sampleIndex);
  await collectRankingsInteractions(context, sampleIndex);
};

const collectRankingsInteractions = async (
  context: BrowserContext,
  sampleIndex: number,
) => {
  const page = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    await page.goto(`${webBaseUrl}/rankings`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(page);
    await page.getByRole('heading', { name: 'Community Rankings', exact: true }).waitFor({ state: 'visible' });

    const rarest = page.getByRole('tab', { name: 'Rarest owned', exact: true });
    await activateMeasuredControl(rarest);
    await expect(rarest).toHaveAttribute('aria-selected', 'true');
    await page.getByText(/Owned by \d+ trainers?/).first().waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.rankings.mode-result', sampleIndex);

    const shiny = page.getByRole('button', { name: 'Shiny', exact: true });
    await activateMeasuredControl(shiny);
    await expect(shiny).toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.rankings.category-result', sampleIndex);

    await activateMeasuredControl(page.getByRole('button', { name: 'All', exact: true }).first());
    const forTrade = page.getByRole('button', { name: 'For trade', exact: true });
    await activateMeasuredControl(forTrade);
    await expect(forTrade).toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.rankings.collection-result', sampleIndex);

    await activateMeasuredControl(page.getByRole('button', { name: 'All', exact: true }).last());
    const query = page.getByRole('searchbox', { name: 'Search rankings' }).first();
    await query.fill('Bulbasaur');
    await page.getByText(/Bulbasaur/).first().waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.rankings.query-result', sampleIndex);
    await activateMeasuredControl(page.getByRole('button', { name: 'Clear', exact: true }));
    await expect(query).toHaveValue('');
    await recordInteraction(page, 'interaction.rankings.clear-result', sampleIndex);

    const wanted = page.getByRole('tab', { name: 'Most wanted', exact: true });
    await activateMeasuredControl(wanted);
    await expect(wanted).toHaveAttribute('aria-selected', 'true');
    const showMore = page.getByRole('button', { name: 'Show more', exact: true });
    await showMore.scrollIntoViewIfNeeded();
    const rowsBefore = await page.locator('.community-ranking-row').count();
    await activateMeasuredControl(showMore);
    await expect.poll(() => page.locator('.community-ranking-row').count()).toBeGreaterThan(rowsBefore);
    await recordInteraction(page, 'interaction.rankings.more-result', sampleIndex);

    await page.locator('.community-ranking-filter-summary').evaluate((element) => {
      window.scrollTo({ top: element.getBoundingClientRect().bottom + window.scrollY + 50 });
    });
    await page.getByRole('navigation', { name: 'Quick ranking controls' }).waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.rankings.quick-controls', sampleIndex);

    const method = page.locator('.community-rankings-method summary');
    await method.scrollIntoViewIfNeeded();
    await activateMeasuredControl(method);
    await expect(page.locator('.community-rankings-method')).toHaveAttribute('open', '');
    await recordInteraction(page, 'interaction.rankings.method-result', sampleIndex);
    await captureWorkflowScreenshot(page, sampleIndex, 'community-rankings', page.locator('.community-rankings-page'));
    if (performanceProfile === 'physical-android') {
      await page.waitForTimeout(250);
      collectAndroidFrameTimelineMetrics(sampleIndex);
      collectAndroidChromeMemoryMetric(sampleIndex);
    }
  } finally {
    await closeMeasuredPage(page);
  }
};

const collectMaxInteractions = async (
  context: BrowserContext,
  sampleIndex: number,
) => {
  const page = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    await page.goto(`${webBaseUrl}/max`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(page);
    await page.getByRole('heading', { name: 'Max Battles', exact: true }).waitFor({ state: 'visible' });

    const allPokemon = page.getByRole('button', { name: 'All Pokémon', exact: true });
    await activateMeasuredControl(allPokemon);
    await expect(allPokemon).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('heading', { name: 'Top damage dealers', exact: true }).waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.max.scope-result', sampleIndex);

    const tank = page.getByRole('button', { name: 'Tank', exact: true });
    await activateMeasuredControl(tank);
    await page.getByRole('heading', { name: 'Top tanks', exact: true }).waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.max.role-result', sampleIndex);

    const water = page.getByRole('button', { name: 'Water', exact: true });
    await activateMeasuredControl(water);
    await page.getByRole('heading', { name: 'Top tanks vs Water', exact: true }).waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.max.type-result', sampleIndex);

    const allTypes = page.getByRole('button', { name: 'All types', exact: true });
    await activateMeasuredControl(allTypes);
    const rankingSearch = page.getByRole('searchbox', { name: 'Search Max rankings' });
    await rankingSearch.fill('z');
    await page.locator('.max-ranking-row').first().waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.max.query-result', sampleIndex);
    await rankingSearch.fill('');

    const showMore = page.getByRole('button', { name: /Show \d+ more/ });
    await showMore.scrollIntoViewIfNeeded();
    const rowsBefore = await page.locator('.max-ranking-row').count();
    await activateMeasuredControl(showMore);
    await expect.poll(() => page.locator('.max-ranking-row').count()).toBeGreaterThan(rowsBefore);
    await recordInteraction(page, 'interaction.max.more-result', sampleIndex);

    const method = page.locator('.max-method-note summary');
    await activateMeasuredControl(method);
    await expect(page.locator('.max-method-note')).toHaveAttribute('open', '');
    await recordInteraction(page, 'interaction.max.method-result', sampleIndex);

    const bosses = page.getByRole('button', { name: 'Boss teams', exact: true });
    await activateMeasuredControl(bosses);
    await page.locator('.max-simulator').waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.max.view-result', sampleIndex);

    const addTrainer = page.getByRole('button', { name: 'Add one Trainer', exact: true });
    const trainerCount = page.getByLabel('Trainer count');
    const trainersBefore = Number(await trainerCount.inputValue());
    await activateMeasuredControl(addTrainer);
    await expect(trainerCount).toHaveValue(String(trainersBefore + 1));
    await recordInteraction(page, 'interaction.max.trainer-result', sampleIndex);

    const damagePicker = page.getByLabel('Damage team member');
    const replacement = await damagePicker.locator('option').nth(1).getAttribute('value');
    if (!replacement) throw new Error('Max damage team member has no alternate candidate.');
    await damagePicker.selectOption(replacement);
    await expect(damagePicker).toHaveValue(replacement);
    await recordInteraction(page, 'interaction.max.party-result', sampleIndex);

    const advanced = page.locator('.max-simulator-advanced summary');
    await activateMeasuredControl(advanced);
    await expect(page.locator('.max-simulator-advanced')).toHaveAttribute('open', '');
    await recordInteraction(page, 'interaction.max.advanced-result', sampleIndex);

    const execution = page.getByLabel('Max Battle execution');
    await execution.selectOption('stress-test');
    await expect(execution).toHaveValue('stress-test');
    await recordInteraction(page, 'interaction.max.execution-result', sampleIndex);

    const difficulty = page.getByLabel('Max Battle difficulty');
    await difficulty.selectOption('two-star');
    await expect(difficulty).toHaveValue('two-star');
    await recordInteraction(page, 'interaction.max.difficulty-result', sampleIndex);

    const bossHp = page.getByLabel('Boss HP estimate');
    await bossHp.fill('50009');
    await expect(bossHp).toHaveValue('50009');
    await recordInteraction(page, 'interaction.max.hp-result', sampleIndex);

    await activateMeasuredControl(page.getByRole('button', { name: 'Reset recommendations', exact: true }));
    await expect(execution).toHaveValue('standard');
    await recordInteraction(page, 'interaction.max.reset-result', sampleIndex);

    const bossSearch = page.getByRole('searchbox', { name: 'Search Max Battle bosses' });
    await bossSearch.fill('z');
    const charizard = page
      .getByRole('listbox', { name: 'Boss results' })
      .getByRole('option', { name: /Gigantamax Charizard/ });
    await charizard.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.max.boss-query-result', sampleIndex);
    await activateMeasuredControl(charizard);
    await page.locator('.max-selected-boss h2', { hasText: 'Gigantamax Charizard' }).waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.max.boss-result', sampleIndex);
    await captureWorkflowScreenshot(page, sampleIndex, 'max-battle-simulator');
  } finally {
    await closeMeasuredPage(page);
  }
};

const collectTradeInteractions = async (
  context: BrowserContext,
  sampleIndex: number,
) => {
  const preferences = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    await preferences.goto(`${webBaseUrl}/trades`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(preferences);
    await preferences.getByRole('heading', { name: 'Trade Preferences', exact: true })
      .waitFor({ state: 'visible' });

    const wantedMode = preferences.getByRole('button', { name: /^Wanted \(/ });
    await activateMeasuredControl(wantedMode);
    await expect(wantedMode).toHaveClass(/active/);
    await recordInteraction(preferences, 'interaction.trades.preference-mode-result', sampleIndex * 2);
    const tradeMode = preferences.getByRole('button', { name: /^For Trade \(/ });
    await activateMeasuredControl(tradeMode);
    await expect(tradeMode).toHaveClass(/active/);
    await recordInteraction(preferences, 'interaction.trades.preference-mode-result', sampleIndex * 2 + 1);

    const pickerButton = preferences.locator('.trade-target-mobile-picker');
    await activateMeasuredControl(pickerButton);
    const picker = preferences.locator('.trade-target-entry-list.is-open');
    await picker.waitFor({ state: 'visible' });
    await recordInteraction(preferences, 'interaction.trades.preference-picker', sampleIndex);
    const nextEntry = picker.locator(':scope > button:not(.active)').first();
    await activateMeasuredControl(nextEntry);
    await picker.waitFor({ state: 'detached' });
    await recordInteraction(preferences, 'interaction.trades.preference-selection-result', sampleIndex);

    const edit = preferences.getByRole('button', { name: 'Edit preferences', exact: true });
    await activateMeasuredControl(edit);
    const save = preferences.getByRole('button', { name: /^Save changes/ });
    await save.waitFor({ state: 'visible' });
    await recordInteraction(preferences, 'interaction.trades.preference-edit-result', sampleIndex);

    const candidateToggle = preferences.locator('.toggle-not-wanted').first();
    const candidate = candidateToggle.locator('xpath=../..');
    const candidateWasExcluded = await candidate.evaluate((element) => element.classList.contains('is-not-wanted'));
    await activateMeasuredControl(candidateToggle);
    await expect(candidate).toHaveClass(candidateWasExcluded ? /wanted-item(?!.*is-not-wanted)/ : /is-not-wanted/);
    await recordInteraction(preferences, 'interaction.trades.preference-candidate-result', sampleIndex);

    const candidateSearch = preferences.getByRole('searchbox', { name: 'Search Wanted Pokémon' });
    await candidateSearch.fill('Bulba');
    await preferences.locator('.wanted-item, .preference-candidate-empty').first().waitFor({ state: 'visible' });
    await recordInteraction(preferences, 'interaction.trades.preference-query-result', sampleIndex);

    const advanced = preferences.locator('.trade-preference-rules__toggle');
    await activateMeasuredControl(advanced);
    await preferences.getByRole('heading', { name: 'Must match', exact: true }).waitFor({ state: 'visible' });
    await recordInteraction(preferences, 'interaction.trades.preference-rules-result', sampleIndex);
    const firstRule = preferences.locator('.preference-rule-group--require button').first();
    const ruleWasSelected = await firstRule.getAttribute('aria-pressed');
    await activateMeasuredControl(firstRule);
    await expect(firstRule).toHaveAttribute('aria-pressed', ruleWasSelected === 'true' ? 'false' : 'true');
    await recordInteraction(preferences, 'interaction.trades.preference-rule-result', sampleIndex);
    await captureWorkflowScreenshot(preferences, sampleIndex, 'trade-preferences-edit');

    await activateMeasuredControl(save);
    await preferences.getByRole('button', { name: /^(Saved|Edit preferences)$/ }).waitFor({ state: 'visible' });
    await recordInteraction(preferences, 'interaction.trades.preference-save-result', sampleIndex);
  } finally {
    await closeMeasuredPage(preferences);
  }

  const discard = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    await discard.goto(`${webBaseUrl}/trades`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(discard);
    await activateMeasuredControl(discard.getByRole('button', { name: 'Edit preferences', exact: true }));
    const toggle = discard.locator('.toggle-not-wanted').first();
    await activateMeasuredControl(toggle);
    await activateMeasuredControl(discard.getByRole('button', { name: /^Wanted \(/ }));
    await discard.getByRole('dialog', { name: 'Confirm action' }).waitFor({ state: 'visible' });
    await recordInteraction(discard, 'interaction.trades.preference-discard-dialog', sampleIndex);
  } finally {
    await closeMeasuredPage(discard);
  }

  const activity = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    for (const pattern of [
      '**/api/users/trades/performance-active/partner',
      '**/__e2e/users/trades/performance-active/partner',
    ]) {
      await activity.route(pattern, (route) => route.fulfill({
        body: JSON.stringify({
          sharingEnabled: true,
          trainerCode: '1234 5678 9012',
          pokemonGoName: 'OtherPogoName',
          coordinationMethod: 'campfire',
          coordinationHandle: 'OtherTrainer',
          location: 'Burnaby, British Columbia, Canada',
        }),
        contentType: 'application/json',
        status: 200,
      }));
    }
    for (const pattern of [
      '**/api/users/trades/performance-incoming/accept',
      '**/__e2e/users/trades/performance-incoming/accept',
    ]) {
      await activity.route(pattern, (route) => route.fulfill({
        body: JSON.stringify({
          trade: { ...performanceTrades['performance-incoming'], trade_status: 'pending', last_update: 2 },
          affected_instances: {},
        }),
        contentType: 'application/json',
        status: 200,
      }));
    }
    await activity.goto(`${webBaseUrl}/trades?section=activity`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(activity);
    await activity.getByRole('heading', { name: 'Your trades', exact: true }).waitFor({ state: 'visible' });

    const activeStatus = activity.getByRole('button', { name: /^Active, / });
    await activateMeasuredControl(activeStatus);
    const activeCard = activity.locator('.trade-activity-card-shell.status-pending');
    await activeCard.waitFor({ state: 'visible' });
    await recordInteraction(activity, 'interaction.trades.activity-status-result', sampleIndex);

    const details = activeCard.locator('.toggle-details-button').first();
    await activateMeasuredControl(details);
    await expect(details).toHaveText('Hide Details');
    await recordInteraction(activity, 'interaction.trades.activity-details-result', sampleIndex);

    await activateMeasuredControl(activeCard.getByRole('button', { name: 'Coordinate trade', exact: true }));
    const partner = activity.getByRole('dialog', { name: 'Coordinate the exchange' });
    await partner.waitFor({ state: 'visible' });
    await recordInteraction(activity, 'interaction.trades.activity-partner-result', sampleIndex);
    await captureWorkflowScreenshot(activity, sampleIndex, 'trade-activity-partner', partner);
    await activateMeasuredControl(partner.getByRole('button', { name: 'Close trade coordination' }));

    await activateMeasuredControl(activity.getByRole('button', { name: /^Needs response, / }));
    const incomingCard = activity.locator('.trade-activity-card-shell.status-accepting');
    await incomingCard.waitFor({ state: 'visible' });
    await activateMeasuredControl(incomingCard.getByRole('button', { name: 'Accept offer', exact: true }));
    const confirmation = activity.getByRole('dialog', { name: 'Confirm action' });
    await confirmation.waitFor({ state: 'visible' });
    await recordInteraction(activity, 'interaction.trades.activity-confirmation', sampleIndex);
    await activateMeasuredControl(confirmation.getByRole('button', { name: 'OK', exact: true }));
    await incomingCard.waitFor({ state: 'detached' });
    await recordInteraction(activity, 'interaction.trades.activity-action-result', sampleIndex);
    await captureWorkflowScreenshot(activity, sampleIndex, 'trade-activity-action');
  } finally {
    await closeMeasuredPage(activity);
  }

  const section = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    await section.goto(`${webBaseUrl}/trades`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(section);
    await activateMeasuredControl(section.getByRole('tab', { name: 'Trade Activity', exact: true }));
    const activePanel = section.locator(
      '.horizontal-page-slider__panel:has(#trade-section-activity)',
    );
    await expect(activePanel).toHaveAttribute('data-active', 'true');
    await recordInteraction(section, 'interaction.trades.section-result', sampleIndex);
  } finally {
    await closeMeasuredPage(section);
  }
};

const collectSearchInteractions = async (
  context: BrowserContext,
  sampleIndex: number,
) => {
  const page = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    await page.goto(`${webBaseUrl}/search`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(page);
    const pokemonInput = page.getByRole('combobox', { name: 'Pokémon' });
    await pokemonInput.waitFor({ state: 'visible' });

    await pokemonInput.fill('Pika');
    const pikachu = page.getByRole('option', { name: /Pikachu/i }).first();
    await pikachu.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.search.pokemon-picker', sampleIndex);
    await activateMeasuredControl(pikachu);
    await expect(pokemonInput).toHaveValue('Pikachu');
    await recordInteraction(page, 'interaction.search.pokemon-selection', sampleIndex);

    const forTrade = page.getByRole('button', { name: 'For Trade', exact: true });
    await activateMeasuredControl(forTrade);
    await expect(forTrade).toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.search.ownership-result', sampleIndex);

    await activateMeasuredControl(page.getByRole('button', { name: /^Filters/ }));
    const filters = page.getByRole('dialog', { name: 'Refine your search' });
    await filters.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.search.filters-open', sampleIndex);

    const locationTab = filters.getByRole('tab', { name: 'Location', exact: true });
    await activateMeasuredControl(locationTab);
    await expect(locationTab).toHaveAttribute('aria-selected', 'true');
    await filters.getByText('Where should we look?').waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.search.filter-section', sampleIndex * 2);

    const city = filters.getByPlaceholder('Search for a city');
    await city.fill('Vancouver');
    await activateMeasuredControl(filters.getByRole('button', { name: 'Vancouver, British Columbia, Canada' }));
    await expect(city).toHaveValue('Vancouver, British Columbia, Canada');
    await recordInteraction(page, 'interaction.search.filter-result', sampleIndex * 2);

    const matchingTab = filters.getByRole('tab', { name: 'Matching', exact: true });
    await activateMeasuredControl(matchingTab);
    await expect(matchingTab).toHaveAttribute('aria-selected', 'true');
    const mutualMatches = filters.getByRole('switch', { name: 'Mutual matches only' });
    await mutualMatches.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.search.filter-section', sampleIndex * 2 + 1);
    await activateMeasuredControl(mutualMatches);
    await expect(mutualMatches).toHaveAttribute('aria-checked', 'true');
    await recordInteraction(page, 'interaction.search.filter-result', sampleIndex * 2 + 1);
    await captureWorkflowScreenshot(page, sampleIndex, 'search-filters', filters);

    await activateMeasuredControl(filters.getByRole('button', { name: 'Apply and search' }));
    await filters.waitFor({ state: 'detached' });
    const results = page.getByRole('region', { name: 'Pokémon search results' });
    await results.getByText('OtherTrainer').waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.search.results', sampleIndex);

    const details = results.locator('details.search-result-details-disclosure').first();
    await activateMeasuredControl(details.locator('summary'));
    await expect(details).toHaveAttribute('open', '');
    await recordInteraction(page, 'interaction.search.details-result', sampleIndex);
    await captureWorkflowScreenshot(page, sampleIndex, 'search-results', results);

    await activateMeasuredControl(page.getByRole('button', { name: 'Map view', exact: true }));
    const map = page.locator('.search-map-shell');
    await map.waitFor({ state: 'visible' });
    // OpenLayers deliberately fits the result extent over a one-second
    // animation. The map is not interaction-ready until that camera motion
    // settles; including it also makes the native comparison honest.
    await page.waitForTimeout(1_100);
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await recordInteraction(page, 'interaction.search.display-result', sampleIndex * 2);

    const mapViewport = map.locator('.ol-viewport');
    const bounds = await mapViewport.boundingBox();
    if (!bounds) throw new Error('Search map viewport has no visible bounds.');
    await mapViewport.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    const popup = map.locator('.ol-popup');
    await expect(popup).toContainText('OtherTrainer');
    await recordInteraction(page, 'interaction.search.map-selection', sampleIndex);

    await activateMeasuredControl(page.getByRole('button', { name: 'List view', exact: true }));
    await results.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.search.display-result', sampleIndex * 2 + 1);

    await activateMeasuredControl(page.getByRole('button', { name: 'Modify search', exact: true }));
    await forTrade.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.search.modify-result', sampleIndex);

    const trainersTab = page.getByRole('tab', { name: 'Trainers', exact: true });
    await activateMeasuredControl(trainersTab);
    await expect(trainersTab).toHaveAttribute('aria-selected', 'true');
    await page.waitForTimeout(330);
    const trainerInput = page.getByRole('searchbox', { name: 'Trainer name' });
    await trainerInput.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.search.mode-result', sampleIndex);

    await trainerInput.fill('Other');
    await page.getByText('Nexus · @OtherTrainer').waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.search.trainer-query-result', sampleIndex);
    await captureWorkflowScreenshot(page, sampleIndex, 'search-trainers');
    await activateMeasuredControl(page.getByRole('button', { name: 'Clear trainer search' }));
    await page.getByText('Find people you know').waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.search.trainer-clear-result', sampleIndex);
  } finally {
    await closeMeasuredPage(page);
  }
};

const collectPokedexInteractions = async (
  context: BrowserContext,
  sampleIndex: number,
) => {
  const page = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    await page.goto(`${webBaseUrl}/pokedex`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(page);
    await expect(page.getByRole('heading', { name: 'Pokédex', exact: true })).toBeVisible();

    const advanced = page.getByRole('switch', { name: /Advanced/i });
    await advanced.click();
    await expect(page.getByRole('button', { name: 'XS', exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.pokedex.advanced-result', sampleIndex);

    const shinyTab = page.getByRole('tab', { name: 'Shiny', exact: true });
    await shinyTab.click();
    await expect(shinyTab).toHaveAttribute('aria-selected', 'true');
    await recordInteraction(page, 'interaction.pokedex.category-result', sampleIndex);

    const lucky = page.getByRole('button', { name: 'Lucky', exact: true });
    await lucky.click();
    await expect(lucky).toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.pokedex.facet-result', sampleIndex);

    const activeCategoryPanel = page.locator('.pokedex-category-panel[aria-hidden="false"]');
    const kantoCard = activeCategoryPanel.locator('.pokedex-region-card').filter({ hasText: 'Kanto' }).first();
    await kantoCard.click();
    const kantoSection = page.locator('.pokedex-category-panel[aria-hidden="false"] .pokedex-region-detail__section').filter({ hasText: 'Kanto' }).first();
    await kantoSection.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pokedex.region-index', sampleIndex);

    const search = page.getByRole('searchbox', { name: 'Search', exact: true });
    await search.fill('bulba');
    const bulbasaurCell = page.locator('.pokedex-category-panel[aria-hidden="false"] .pokedex-region-grid__cell').filter({ hasText: /Bulbasaur/i }).first();
    await bulbasaurCell.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pokedex.search-result', sampleIndex);
    await captureWorkflowScreenshot(page, sampleIndex, 'pokedex-region-index', kantoSection);

    const kantoFolder = page.getByRole('button', { name: /Collapse Kanto/i });
    await kantoFolder.click();
    const expandKanto = page.getByRole('button', { name: /Expand Kanto/i });
    await expect(expandKanto).toHaveAttribute('aria-expanded', 'false');
    await recordInteraction(page, 'interaction.pokedex.region-section', sampleIndex * 2);
    await expandKanto.click();
    await expect(page.getByRole('button', { name: /Collapse Kanto/i })).toHaveAttribute('aria-expanded', 'true');
    await bulbasaurCell.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pokedex.region-section', sampleIndex * 2 + 1);

    const visibleActions = page.getByLabel('Visible registration actions');
    await visibleActions.getByRole('button', { name: 'Register all', exact: true }).click();
    const rootConfirmation = page.getByRole('dialog', { name: 'Confirm action' });
    await rootConfirmation.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pokedex.bulk-dialog', sampleIndex);
    await rootConfirmation.getByRole('button', { name: 'Cancel', exact: true }).click();

    const registrationToggle = bulbasaurCell.locator('.pokedex-region-grid__registration-toggle');
    const rootRegistrationBefore = await registrationToggle.getAttribute('aria-pressed');
    await registrationToggle.click();
    await expect(registrationToggle).toHaveAttribute('aria-pressed', rootRegistrationBefore === 'true' ? 'false' : 'true');
    await recordInteraction(page, 'interaction.pokedex.registration-result', sampleIndex);

    await bulbasaurCell.locator('.pokedex-region-grid__open').click();
    const detail = page.locator('.pokedex-pokemon-detail');
    await detail.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pokedex.detail-open', sampleIndex);

    const shinySlot = detail.locator('.pokedex-pokemon-detail-card').filter({ hasText: /^Shiny/i }).first();
    await shinySlot.locator('.pokedex-pokemon-detail-card__select').click();
    await expect(shinySlot).toHaveClass(/is-selected/);
    await recordInteraction(page, 'interaction.pokedex.detail.slot-result', sampleIndex);

    const female = detail.getByTitle('Female');
    await female.click();
    await expect(female).toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.pokedex.detail.gender-result', sampleIndex);
    await captureWorkflowScreenshot(page, sampleIndex, 'pokedex-detail-registered', shinySlot);

    await detail.getByLabel('Registered tab bulk actions').getByRole('button', { name: 'Register all', exact: true }).click();
    const detailConfirmation = page.getByRole('dialog', { name: 'Confirm action' });
    await detailConfirmation.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pokedex.detail.bulk-dialog', sampleIndex);
    await detailConfirmation.getByRole('button', { name: 'Cancel', exact: true }).click();

    const missingRegistration = detail.locator('.pokedex-pokemon-detail-card__registration-toggle[aria-pressed="false"]').first();
    const missingRegistrationLabel = await missingRegistration.getAttribute('aria-label');
    if (!missingRegistrationLabel?.startsWith('Register ')) {
      throw new Error('Pokédex detail produced no registerable slot.');
    }
    await missingRegistration.click();
    await detail.getByRole('button', {
      name: missingRegistrationLabel.replace(/^Register /, 'Clear '),
      exact: true,
    }).waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pokedex.detail.registration-result', sampleIndex);

    const infoTab = detail.getByRole('tab', { name: 'Info', exact: true });
    await infoTab.click();
    const sizeRanges = detail.getByRole('heading', { name: 'Size ranges', exact: true });
    await sizeRanges.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pokedex.detail.tab-result', sampleIndex * 3);
    await captureWorkflowScreenshot(page, sampleIndex, 'pokedex-detail-info', sizeRanges);
    const battleTab = detail.getByRole('tab', { name: 'Battle', exact: true });
    await battleTab.click();
    const typeEffectiveness = detail.getByRole('heading', { name: 'Type effectiveness', exact: true });
    await typeEffectiveness.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pokedex.detail.tab-result', sampleIndex * 3 + 1);
    await captureWorkflowScreenshot(page, sampleIndex, 'pokedex-detail-battle', typeEffectiveness);
    const moreTab = detail.getByRole('tab', { name: /More/i });
    await moreTab.click();
    let openComboSection = detail.locator('.pokedex-pokemon-detail__combo-section.is-open').first();
    await openComboSection.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pokedex.detail.tab-result', sampleIndex * 3 + 2);
    await recordInteraction(page, 'interaction.pokedex.detail.combo-section', sampleIndex * 3);

    await openComboSection.locator('.pokedex-pokemon-detail__combo-section-button').click();
    await expect(detail.locator('.pokedex-pokemon-detail__combo-section.is-open')).toHaveCount(0);
    await recordInteraction(page, 'interaction.pokedex.detail.combo-section', sampleIndex * 3 + 1);
    const shinyComboSection = detail.locator('.pokedex-pokemon-detail__combo-section').filter({ hasText: /^Shiny/i }).first();
    await shinyComboSection.locator('.pokedex-pokemon-detail__combo-section-button').click();
    openComboSection = detail.locator('.pokedex-pokemon-detail__combo-section.is-open').first();
    await openComboSection.locator('.pokedex-pokemon-detail__combo-section-body').waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pokedex.detail.combo-section', sampleIndex * 3 + 2);

    const luckyFilter = openComboSection.getByRole('button', { name: 'Lucky', exact: true });
    await luckyFilter.click();
    await expect(openComboSection.getByText('Showing 30 of 60', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.pokedex.detail.combo-filter', sampleIndex);

    const comboSearch = openComboSection.getByRole('searchbox', { name: /Search combinations/i });
    await comboSearch.fill('female');
    await expect(openComboSection.getByText('Showing 10 of 60', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.pokedex.detail.combo-query', sampleIndex);
    await openComboSection.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(openComboSection.getByText('Showing 60 of 60', { exact: true })).toBeVisible();
    await captureWorkflowScreenshot(page, sampleIndex, 'pokedex-detail-more', openComboSection);

    await openComboSection.getByLabel('Shown combination actions').getByRole('button', { name: 'Register all', exact: true }).click();
    await page.getByRole('dialog', { name: 'Confirm action' }).waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pokedex.detail.bulk-dialog', sampleIndex + repetitions);
    await page.getByRole('dialog', { name: 'Confirm action' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  } finally {
    await closeMeasuredPage(page);
  }
};

const collectRaidInteractions = async (
  context: BrowserContext,
  sampleIndex: number,
) => {
  const page = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    await page.goto(`${webBaseUrl}/raid`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(page);
    await expect(page.getByRole('heading', { name: /top raid attackers/i })).toBeVisible();

    await page.getByRole('button', { name: 'All Pokémon', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Top raid attackers', exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.raid.roster-result', sampleIndex);
    await page.getByRole('button', { name: 'My Pokémon', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your top raid attackers', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Electric', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Electric raid attackers/i })).toBeVisible();
    await recordInteraction(page, 'interaction.raid.type-result', sampleIndex);

    await page.getByRole('button', { name: 'All types', exact: true }).click();
    await expect(page.getByRole('heading', { name: /top raid attackers/i })).toBeVisible();
    const firstAttackerName = await page.locator('.raid-type-table-pokemon-copy strong').first().textContent();
    if (!firstAttackerName) throw new Error('Raid performance roster produced no searchable attacker.');
    const attackerSearch = page.getByLabel('Attacker search');
    await attackerSearch.fill(firstAttackerName);
    await expect(page.getByLabel(/raid attackers/i).getByText(firstAttackerName, { exact: true }).first()).toBeVisible();
    await recordInteraction(page, 'interaction.raid.search-result', sampleIndex);
    await attackerSearch.fill('');

    await page.getByRole('button', { name: 'All movesets', exact: true }).click();
    await expect(page.getByRole('button', { name: 'All movesets', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.raid.moveset-result', sampleIndex);

    await page.getByRole('button', { name: /Settings/i }).click();
    await page.getByLabel('Ranking settings').waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.raid.settings-open', sampleIndex);

    await page.getByLabel('Friendship').selectOption('best');
    await expect(page.getByLabel('Friendship')).toHaveValue('best');
    await recordInteraction(page, 'interaction.raid.modifier-result', sampleIndex);

    const dpsSort = page.getByRole('button', { name: 'Sort by DPS', exact: true });
    await dpsSort.click();
    await expect(page.locator('th.raid-sort-header').nth(1)).toHaveAttribute('aria-sort', 'descending');
    await recordInteraction(page, 'interaction.raid.sort-result', sampleIndex);

    const rowToggle = page.locator('.raid-ranking-mobile-details-toggle').first();
    await rowToggle.click();
    await expect(rowToggle).toHaveAttribute('aria-expanded', 'true');
    await recordInteraction(page, 'interaction.raid.row-detail', sampleIndex);

    await page.getByRole('button', { name: 'Boss counters', exact: true }).click();
    await page.getByLabel('Raid boss picker').waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.raid.mode-boss', sampleIndex);
    await expect(page.getByText('Modeling raid timelines…')).toBeHidden({ timeout: 30_000 });

    const bossSearch = page.getByLabel('Find boss');
    await bossSearch.fill('Ivysaur');
    const bossSuggestion = page.getByRole('button', { name: /Ivysaur/i }).first();
    await bossSuggestion.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.raid.boss-search', sampleIndex);
    await bossSuggestion.click();
    await expect(page.getByText('Modeling raid timelines…')).toBeHidden({ timeout: 30_000 });
    await page.getByLabel('Raid counters').locator('article').first().waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.raid.boss-selected', sampleIndex);

    await page.getByText('Raid setup', { exact: true }).click();
    await page.getByLabel('Raid summary').waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.raid.setup-open', sampleIndex);

    await page.getByText('Battle settings', { exact: true }).click();
    await page.getByLabel('Raid modifiers').waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.raid.battle-settings-open', sampleIndex);

    const party = page.getByLabel('Custom raid party');
    await party.getByRole('button', { name: /Custom raid party/i }).click();
    await party.getByLabel('Lobby controls').waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.raid.party-open', sampleIndex);

    await party.getByRole('button', { name: 'Simulate', exact: true }).click();
    await party.getByLabel('Raid party result').waitFor({ state: 'visible', timeout: 30_000 });
    await recordInteraction(page, 'interaction.raid.party-simulate', sampleIndex);

    await party.getByRole('button', { name: 'Optimize', exact: true }).click();
    await party.getByText('Lobby optimized').waitFor({ state: 'visible', timeout: 60_000 });
    await recordInteraction(page, 'interaction.raid.party-optimize', sampleIndex);

    const calibration = page.getByLabel('Observed raid calibration');
    await calibration.getByRole('button', { name: 'Log raid' }).click();
    await page.getByRole('dialog', { name: /Log .* raid/i }).waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.raid.calibration-open', sampleIndex);
  } finally {
    await closeMeasuredPage(page);
  }
};

const collectPvpInteractions = async (
  context: BrowserContext,
  sampleIndex: number,
) => {
  const page = await createMeasuredPage(context, 'signed-in', 'dark');
  try {
    await page.goto(`${webBaseUrl}/pvp`, { waitUntil: 'domcontentloaded' });
    await waitUntilVisuallyReady(page);
    await expect(page.getByRole('heading', { name: 'PvP Rankings', exact: true })).toBeVisible();

    const cup = page.getByRole('combobox', { name: 'Current PvP cup' });
    await cup.selectOption('jungle-cup');
    await expect(page.getByText('20 ranked', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.pvp.cup-result', sampleIndex);
    const rules = page.locator('.pvp-format-rules');
    await rules.locator('summary').click();
    await expect(rules).toContainText('Only Normal, Grass, Electric');
    await recordInteraction(page, 'interaction.pvp.rules-result', sampleIndex);

    await page.getByRole('button', { name: /Great/ }).click();
    await expect(page.getByText('60 ranked', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.pvp.league-result', sampleIndex);

    const myPokemon = page.getByRole('button', { name: /My Pokémon/ });
    await myPokemon.click();
    await expect(myPokemon).toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.pvp.scope-result', sampleIndex * 2);
    const allPokemon = page.getByRole('button', { name: 'All Pokémon', exact: true });
    await allPokemon.click();
    await expect(allPokemon).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('60 ranked', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.pvp.scope-result', sampleIndex * 2 + 1);

    await page.getByRole('button', { name: 'Lead', exact: true }).click();
    await expect(page.getByText('Lead rankings', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.pvp.role-result', sampleIndex);
    await page.getByRole('button', { name: 'Overall', exact: true }).click();
    await expect(page.getByText('Overall rankings', { exact: true })).toBeVisible();

    const rankingSearch = page.getByRole('searchbox', { name: 'Search PvP rankings' });
    await rankingSearch.fill('play rough');
    await expect(page.locator('.pvp-ranking-row').first()).toContainText('Azumarill');
    await recordInteraction(page, 'interaction.pvp.search-result', sampleIndex);
    await rankingSearch.fill('');

    const showMore = page.getByRole('button', { name: 'Show next 10', exact: true });
    await showMore.click();
    await expect(page.getByText('Meta Pokémon 60', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.pvp.more-result', sampleIndex);

    await page.getByRole('button', { name: 'Show details for Meta Pokémon 60', exact: true }).click();
    const strongMatchups = page.getByRole('heading', { name: 'Strong matchups', exact: true });
    await strongMatchups.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pvp.ranking-detail', sampleIndex);
    await captureWorkflowScreenshot(page, sampleIndex, 'pvp-ranking-detail', strongMatchups);

    await page.getByRole('button', { name: 'Team Builder', exact: true }).click();
    const teamBuilder = page.getByLabel('PvP Team Builder');
    await teamBuilder.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pvp.workspace-result', sampleIndex * 3);

    const teamSearch = page.getByRole('searchbox', { name: 'Search Team Builder Pokémon' });
    await teamSearch.fill('Azumarill');
    await page.getByRole('button', { name: 'Select Lead with Azumarill', exact: true })
      .waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pvp.team.search-result', sampleIndex);
    await teamSearch.fill('');

    await page.getByRole('button', { name: 'Select Lead with Clodsire', exact: true }).click();
    await expect(page.getByText('1 / 3', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.pvp.team.selection-result', sampleIndex * 3);
    await page.getByRole('button', { name: 'Select Safe Swap with Azumarill', exact: true }).click();
    await expect(page.getByText('2 / 3', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.pvp.team.selection-result', sampleIndex * 3 + 1);
    await page.getByRole('button', { name: 'Select Closer with Bulbasaur', exact: true }).click();
    await expect(page.getByText('3 / 3', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.pvp.team.selection-result', sampleIndex * 3 + 2);
    await expect(page.getByText(/handled$/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Field coverage', { exact: true })).toBeVisible();
    const roleResults = page.locator('.pvp-team-role-results');
    await expect(roleResults.locator(':scope > span').nth(0)).toContainText('Clodsire12-0');
    await expect(roleResults.locator(':scope > span').nth(1)).toContainText('Azumarill4-4');
    await expect(roleResults.locator(':scope > span').nth(2)).toContainText('Bulbasaur8-4');
    await recordInteraction(page, 'interaction.pvp.team.evaluation-result', sampleIndex);

    await page.getByText('Published matchup evidence', { exact: true }).click();
    await expect(page.getByText('Threatens 3 · Open', { exact: true })).toBeVisible();
    await recordInteraction(page, 'interaction.pvp.team.evidence-result', sampleIndex);
    await captureWorkflowScreenshot(page, sampleIndex, 'pvp-team-builder', teamBuilder);

    await page.getByRole('button', { name: 'Battle Lab', exact: true }).click();
    await expect(page.getByText(/focused 1v1/)).toBeVisible();
    await recordInteraction(page, 'interaction.pvp.workspace-result', sampleIndex * 3 + 1);

    const battlePickers = page.locator('.pvp-battle-picker');
    const sideA = battlePickers.nth(0);
    const opponent = battlePickers.nth(1);
    const sideASearch = sideA.getByRole('searchbox', { name: 'Find Side A Pokemon' });
    await sideASearch.fill('Azumarill');
    await sideA.getByRole('button', { name: /Azumarill/ }).waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pvp.battle.search-result', sampleIndex);
    await sideA.getByRole('button', { name: /Azumarill/ }).click();
    await expect(sideA.locator('header strong')).toContainText('Azumarill');
    await recordInteraction(page, 'interaction.pvp.battle.selection-result', sampleIndex * 3);
    await sideASearch.fill('');
    // Android Chrome can mis-hit this horizontally scrolled card after the
    // preceding picker collapses. Dispatching the same activation event keeps
    // the handler-to-paint measurement exact without accepting another card.
    await opponent.getByRole('button', { name: /Bulbasaur/ }).dispatchEvent('click');
    await expect(opponent.locator('header strong')).toContainText('Bulbasaur');
    await recordInteraction(page, 'interaction.pvp.battle.selection-result', sampleIndex * 3 + 1);
    await page.getByRole('button', { name: 'Swap battle sides', exact: true }).click();
    await expect(sideA.locator('header strong')).toContainText('Bulbasaur');
    await recordInteraction(page, 'interaction.pvp.battle.selection-result', sampleIndex * 3 + 2);

    const focusedConditions = page.locator('.pvp-battle-controls > div').first();
    await focusedConditions.getByRole('button', { name: '2', exact: true }).click();
    await expect(focusedConditions.getByRole('button', { name: '2', exact: true }))
      .toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.pvp.battle.condition-result', sampleIndex);
    await page.getByRole('button', { name: 'Run battle', exact: true }).click();
    const battleResult = page.locator('.pvp-battle-result');
    await battleResult.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(battleResult).toContainText('Bulbasaur wins');
    await expect(battleResult).toContainText('70.0s');
    await expect(battleResult).toContainText('804');
    await expect(battleResult).toContainText('195');
    await recordInteraction(page, 'interaction.pvp.battle.simulation-result', sampleIndex);
    await captureWorkflowScreenshot(page, sampleIndex, 'pvp-battle-focused', battleResult);

    await page.getByRole('button', { name: 'Team battle', exact: true }).click();
    const firstTeam = page.locator('.pvp-team-lineup-editor').first();
    await firstTeam.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pvp.battle.mode-result', sampleIndex);
    await firstTeam.getByRole('button', { name: /Edit Side A Safe Swap/ }).click();
    await firstTeam.getByRole('button', { name: /Meta Pokémon 4/ }).click();
    await expect(firstTeam.getByRole('button', { name: /Edit Side A Safe Swap/ }))
      .toContainText('Meta Pokémon 4');
    await recordInteraction(page, 'interaction.pvp.team-battle.selection-result', sampleIndex);
    const teamBattleSearch = firstTeam.getByRole('searchbox', { name: 'Find Choose Safe Swap Pokemon' });
    await teamBattleSearch.fill('Meta Pokémon 5');
    await firstTeam.getByRole('button', { name: /^Meta Pokémon 5 Level/ }).waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pvp.team-battle.search-result', sampleIndex);
    await teamBattleSearch.fill('');

    await page.getByRole('button', { name: /Fixed order/ }).click();
    await expect(page.getByRole('button', { name: /Fixed order/ }))
      .toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.pvp.team-battle.policy-result', sampleIndex);
    const teamConditions = page.locator('.pvp-team-battle-controls > div').first();
    await teamConditions.getByRole('button', { name: '1', exact: true }).click();
    await expect(teamConditions.getByRole('button', { name: '1', exact: true }))
      .toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.pvp.team-battle.condition-result', sampleIndex);
    await page.getByRole('button', { name: 'Run team battle', exact: true }).click();
    const teamResult = page.locator('.pvp-team-battle-result');
    await teamResult.waitFor({ state: 'visible', timeout: 30_000 });
    await recordInteraction(page, 'interaction.pvp.team-battle.simulation-result', sampleIndex);
    const fieldButton = page.getByRole('button', { name: /Test \d+ meta teams/ });
    await fieldButton.click();
    const fieldResult = page.locator('.pvp-meta-gauntlet-result');
    await fieldResult.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(fieldResult).toContainText('6-0-0');
    await recordInteraction(page, 'interaction.pvp.team-battle.field-result', sampleIndex);
    await captureWorkflowScreenshot(page, sampleIndex, 'pvp-battle-team', fieldResult);

    await page.getByRole('button', { name: 'IV Rank', exact: true }).click();
    const ivRank = page.getByLabel('PvP IV Rank');
    await ivRank.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pvp.workspace-result', sampleIndex * 3 + 2);
    const ivMyPokemon = ivRank.getByRole('button', { name: /My Pokémon/ });
    await ivMyPokemon.click();
    await expect(ivMyPokemon).toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.pvp.iv.scope-result', sampleIndex * 2);
    const ivAllPokemon = ivRank.getByRole('button', { name: 'All Pokémon', exact: true });
    await ivAllPokemon.click();
    await expect(ivAllPokemon).toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.pvp.iv.scope-result', sampleIndex * 2 + 1);
    const ivSearch = ivRank.getByRole('searchbox', { name: 'Search IV Rank Pokémon' });
    await ivSearch.fill('Bulbasaur');
    const bulbasaurOption = ivRank.getByRole('button', { name: 'Select #0001 Bulbasaur' });
    await bulbasaurOption.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pvp.iv.search-result', sampleIndex);
    await bulbasaurOption.click();
    const ivResult = ivRank.getByLabel('IV Rank result');
    await ivResult.waitFor({ state: 'visible' });
    await recordInteraction(page, 'interaction.pvp.iv.selection-result', sampleIndex);
    await ivRank.getByRole('button', { name: 'Increase Attack IV', exact: true }).click();
    await expect(ivRank.getByRole('spinbutton', { name: 'Attack IV' })).toHaveValue('1');
    await recordInteraction(page, 'interaction.pvp.iv.adjust-result', sampleIndex);
    const bestBuddyButton = ivRank.getByRole('button', { name: /Best Buddy 51/ });
    await bestBuddyButton.click();
    await expect(bestBuddyButton)
      .toHaveAttribute('aria-pressed', 'true');
    await recordInteraction(page, 'interaction.pvp.iv.level-result', sampleIndex);
    await captureWorkflowScreenshot(page, sampleIndex, 'pvp-iv-rank', ivResult);
    if (performanceProfile === 'physical-android') {
      await ivResult.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      collectAndroidFrameTimelineMetrics(sampleIndex);
      collectAndroidChromeMemoryMetric(sampleIndex);
    }
  } finally {
    await closeMeasuredPage(page);
  }
};

const waitForHttp = async (url: string, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
};

const closeUninitializedAndroidChromeTargets = async (timeoutMs = 10_000) => {
  const targetListUrl = `${androidCdpUrl}/json/list`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(targetListUrl);
    if (!response.ok) throw new Error(`${targetListUrl} returned ${response.status}`);
    const targets = await response.json() as Array<{
      id?: string;
      type?: string;
      url?: string;
    }>;
    const uninitializedTargets = targets.filter(
      (target) => target.type === 'page' && target.url === '' && target.id,
    );
    if (uninitializedTargets.length === 0) return;
    await Promise.all(uninitializedTargets.map(async (target) => {
      await fetch(`${androidCdpUrl}/json/close/${encodeURIComponent(target.id!)}`);
    }));
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error('Android Chrome retained uninitialized DevTools targets.');
};

const closeStaleAndroidPerformanceTargets = async () => {
  const response = await fetch(`${androidCdpUrl}/json/list`);
  if (!response.ok) throw new Error(`${androidCdpUrl}/json/list returned ${response.status}`);
  const targets = await response.json() as Array<{
    id?: string;
    type?: string;
    url?: string;
  }>;
  // Chrome keeps real user tabs across the force-stop used by the harness.
  // Preserve those tabs and the newest localhost test target, but close older
  // PokeGoNexus performance targets so they cannot retain IndexedDB handles or
  // confuse foreground-page selection on later physical runs.
  const performanceTargets = targets.filter((target) => (
    target.type === 'page'
    && target.id
    && target.url?.startsWith(`${webBaseUrl}/`)
  ));
  await Promise.all(performanceTargets.slice(1).map(async (target) => {
    await fetch(`${androidCdpUrl}/json/close/${encodeURIComponent(target.id!)}`);
  }));
};

const prepareAndroidChrome = async () => {
  if (!androidDeviceId) {
    throw new Error('POKEGONEXUS_ANDROID_DEVICE_ID is required for physical-android performance.');
  }
  const deviceType = execFileSync(adbPath, [
    '-s', androidDeviceId, 'shell', 'getprop', 'ro.kernel.qemu',
  ], { encoding: 'utf8' }).trim();
  if (deviceType === '1' || androidDeviceId.startsWith('emulator-')) {
    throw new Error(`Physical performance evidence cannot use emulator ${androidDeviceId}.`);
  }
  const port = Number(process.env.E2E_PORT ?? 3100);
  execFileSync(adbPath, ['-s', androidDeviceId, 'reverse', `tcp:${port}`, `tcp:${port}`]);
  execFileSync(adbPath, [
    '-s', androidDeviceId, 'forward', 'tcp:9222', 'localabstract:chrome_devtools_remote',
  ]);
  execFileSync(adbPath, ['-s', androidDeviceId, 'shell', 'am', 'force-stop', androidChromePackage]);
  execFileSync(adbPath, [
    '-s', androidDeviceId, 'shell', 'rm', '-f', '/data/local/tmp/chrome-command-line',
  ]);
  execFileSync(adbPath, [
    '-s', androidDeviceId, 'shell', 'am', 'start',
    '-a', 'android.intent.action.VIEW',
    '-d', `http://127.0.0.1:${port}/`,
    androidChromePackage,
  ]);
  await waitForHttp(`${androidCdpUrl}/json/version`);
  // Chrome 152 can expose empty page targets that never answer CDP initialization
  // commands. Playwright waits for every attached target, so remove only these
  // target-less tabs before connecting while preserving real user tabs.
  await closeUninitializedAndroidChromeTargets();
  await closeStaleAndroidPerformanceTargets();
};

const parseChromeProcessPssBytes = (text: string) => {
  const processSection = text.split('Total PSS by process:')[1]
    ?.split('Total PSS by OOM adjustment:')[0]
    ?? '';
  const totalKilobytes = processSection.split(/\r?\n/).reduce((total, line) => {
    const match = line.match(
      /^\s*([\d,]+)K:\s+com\.android\.chrome(?=\s|:|_zygote_native)/,
    );
    return total + (match ? Number(match[1].replaceAll(',', '')) : 0);
  }, 0);
  return totalKilobytes > 0 ? totalKilobytes * 1024 : null;
};

const collectAndroidFrameTimelineMetrics = (sampleIndex: number) => {
  const output = path.resolve(
    androidArtifactDirectory,
    `chrome-sample-${sampleIndex + 1}-frame-timeline.json`,
  );
  execFileSync(process.execPath, [
    path.resolve(frontendDirectory, 'scripts/performance-parity/capture-android-frame-timeline.mjs'),
    '--device', androidDeviceId,
    '--layer-match', androidChromePackage,
    '--output', output,
  ], { stdio: 'inherit' });
  const metrics = JSON.parse(readFileSync(output, 'utf8')) as {
    frameTimeP95Ms: number;
    jankyFramesPercent: number;
  };
  addMetric('global.runtime', 'frame_time_p95_ms', metrics.frameTimeP95Ms, sampleIndex, {
    direction: 'lower', unit: 'ms',
  });
  addMetric('global.runtime', 'janky_frames_percent', metrics.jankyFramesPercent, sampleIndex, {
    direction: 'lower', unit: 'percent',
  });
};

const collectAndroidChromeMemoryMetric = (sampleIndex: number) => {
  if (performanceProfile !== 'physical-android' || !androidDeviceId) return;
  const memoryText = execFileSync(adbPath, [
    '-s', androidDeviceId, 'shell', 'dumpsys', 'meminfo',
  ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  mkdirSync(androidArtifactDirectory, { recursive: true });
  writeFileSync(path.resolve(androidArtifactDirectory, `chrome-sample-${sampleIndex + 1}-meminfo.txt`), memoryText);
  const totalPssBytes = parseChromeProcessPssBytes(memoryText);
  if (totalPssBytes !== null) {
    addMetric(
      'global.runtime',
      'memory_pss_bytes',
      totalPssBytes,
      sampleIndex,
      { direction: 'lower', unit: 'bytes' },
    );
  }
  androidMemoryMetricSamples.add(sampleIndex);
};

const writeReport = () => {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify({
    schemaVersion: 1,
    implementation: 'vite',
    profile: performanceProfile,
    createdAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA ?? null,
    environment: {
      browser: 'chromium',
      project: 'mobile-chrome',
      viewport: '412x915',
      repetitions,
      androidDeviceId: androidDeviceId || null,
      deviceIdentity: androidDeviceId || null,
      source: performanceProfile === 'physical-android'
        ? 'adb-cdp-surfaceflinger-frametimeline-meminfo'
        : 'playwright-performance-api',
      workloadId: 'canonical-performance-fixtures-v1',
      frameWorkloadId: 'physical-scroll-v1',
      catalogEntries: performanceCatalogEntries,
      instanceEntries: Object.keys(performanceInstances).length,
      pvpEntries: performancePvpEntries,
    },
    samples,
  }, null, 2)}\n`);
};

test.describe('Vite performance parity report', () => {
  test.setTimeout(15 * 60_000);

  test('@parity-performance records every comparable route and shared interaction', async ({
    browserName: _browserName,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'The contract uses the Pixel Chromium viewport.');
    let ownedBrowser: Browser | null = null;
    let physicalContext: BrowserContext | null = null;
    if (performanceProfile === 'physical-android') {
      await prepareAndroidChrome();
      ownedBrowser = await chromium.connectOverCDP(androidCdpUrl);
      const [connectedContext] = ownedBrowser.contexts();
      if (!connectedContext) throw new Error('Android Chrome exposed no inspectable browser context.');
      physicalContext = connectedContext;
      physicalAutomationPage = connectedContext.pages().find((page) => (
        page.url().startsWith(webBaseUrl)
      )) ?? connectedContext.pages().at(-1) ?? null;
      if (!physicalAutomationPage) {
        throw new Error('Android Chrome exposed no foreground automation page.');
      }
    } else {
      ownedBrowser = await chromium.launch({
        headless: true,
        ...(process.env.E2E_CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.E2E_CHROMIUM_EXECUTABLE_PATH }
          : {}),
      });
    }
    const createContext = async (theme: 'dark' | 'light') => physicalContext
      ?? ownedBrowser!.newContext({
        colorScheme: theme,
        viewport: { height: 915, width: 412 },
      });
    try {
      for (let repetition = 0; repetition < repetitions; repetition += 1) {
        if (!workflowsOnly) {
          for (const [themeIndex, theme] of (['dark', 'light'] as const).entries()) {
            for (const auth of (['guest', 'signed-in'] as const)) {
              const routeContext = await createContext(theme);
              try {
                if (auth === 'signed-in') await seedPerformanceInstances(routeContext);
                for (const [routeIndex, route] of contract.routes.entries()) {
                  if (route.auth !== auth) continue;
                  if (!routeMatchesFilter(route.id, route.vite)) {
                    continue;
                  }
                  const page = await createMeasuredPage(routeContext, route.auth, theme);
                  try {
                    const warmPath = route.vite === '/about' ? '/faq' : '/about';
                    const response = await page.goto(new URL(warmPath, `${webBaseUrl}/`).href, {
                      timeout: 60_000,
                      waitUntil: 'domcontentloaded',
                    });
                    expect(response?.ok(), `${warmPath} warm document response`).toBe(true);
                    await waitUntilVisuallyReady(page);
                    await resetBrowserProbe(page);
                    await page.evaluate((destination) => {
                      window.history.pushState({}, '', destination);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }, route.vite);
                    await waitUntilVisuallyReady(page);
                    recordRouteSnapshot(
                      route,
                      await takeSnapshot(page),
                      repetition * contract.routes.length * 2 + themeIndex * contract.routes.length + routeIndex,
                    );
                  } finally {
                    await closeMeasuredPage(page);
                  }
                }
                if (!routeFilter && auth === 'signed-in' && theme === 'dark') {
                  await collectSharedInteractions(routeContext, repetition);
                }
              } finally {
                if (!physicalContext) await routeContext.close();
              }
            }
          }
        }
        if (workflowsOnly) {
          const interactionContext = await createContext('dark');
          try {
            await seedPerformanceInstances(interactionContext);
            await collectSharedInteractions(interactionContext, repetition);
          } finally {
            if (!physicalContext) await interactionContext.close();
          }
        }
        if (!androidMemoryMetricSamples.has(repetition)) {
          collectAndroidChromeMemoryMetric(repetition);
        }
      }
    } finally {
      writeReport();
      if (performanceProfile !== 'physical-android') {
        await ownedBrowser?.close();
      }
    }
    const measuredRouteCount = contract.routes.filter((route) => (
      routeMatchesFilter(route.id, route.vite)
    )).length;
    expect(samples.length).toBeGreaterThan(workflowsOnly
      ? repetitions
      : measuredRouteCount * repetitions * 2);
  });
});
