import { expect, type Page } from '@playwright/test';
import { installE2eRoutes } from './e2eRoutes';

type DemoInstance = Record<string, unknown> & {
  instance_id: string;
  variant_id: string;
  pokemon_id: number;
};

const captureLightTheme = process.env.DEMO_CAPTURE_THEME === 'light';
const captureDate = '2026-07-03T12:00:00.000Z';
const demoUser = {
  user_id: 'demo-user-001',
  username: 'NexusDemo',
  email: 'demo@pokegonexus.local',
  pokemonGoName: 'NexusDemo',
  trainerCode: '1234 5678 9012',
  allowLocation: true,
  coordinates: { latitude: 49.2827, longitude: -123.1207 },
  accessTokenExpiry: '2099-01-01T00:00:00.000Z',
  refreshTokenExpiry: '2099-01-02T00:00:00.000Z',
};

const baseInstance = (
  instanceId: string,
  variantId: string,
  pokemonId: number,
  overrides: Partial<DemoInstance> = {},
): DemoInstance => ({
  instance_id: instanceId,
  variant_id: variantId,
  user_id: demoUser.user_id,
  username: demoUser.username,
  pokemon_id: pokemonId,
  nickname: null,
  cp: null,
  level: null,
  attack_iv: null,
  defense_iv: null,
  stamina_iv: null,
  shiny: false,
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
  gigantamax: false,
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
  is_caught: true,
  is_for_trade: false,
  is_wanted: false,
  most_wanted: false,
  caught_tags: [],
  trade_tags: [],
  wanted_tags: [],
  not_trade_list: {},
  not_wanted_list: {},
  trade_filters: {},
  wanted_filters: {},
  mirror: false,
  pref_lucky: false,
  friendship_level: null,
  registered: true,
  favorite: false,
  disabled: false,
  trace_id: null,
  pokeball: null,
  location_card: null,
  location_caught: null,
  date_caught: null,
  date_added: captureDate,
  last_update: Date.parse(captureDate),
  ...overrides,
});

const charizard = baseInstance('0006-default_demo-charizard', '0006-default', 6, {
  nickname: 'League Ace',
  cp: 2844,
  level: 38,
  attack_iv: 15,
  defense_iv: 14,
  stamina_iv: 15,
  fast_move_id: 54,
  charged_move1_id: 186,
  charged_move2_id: 83,
  weight: 90.5,
  height: 1.7,
  gender: 'Male',
  favorite: true,
  caught_tags: ['Raid team', 'Kanto'],
  location_caught: 'Vancouver, BC',
  date_caught: '2026-06-15',
});

const pikachuTrade = baseInstance(
  '0025-party_hat_default_demo-trade',
  '0025-party_hat_default',
  25,
  {
    nickname: 'Festival spare',
    cp: 812,
    attack_iv: 11,
    defense_iv: 13,
    stamina_iv: 14,
    costume_id: 41,
    is_caught: true,
    is_for_trade: true,
    registered: true,
    trade_tags: ['Costume', 'Local trade'],
    location_caught: 'Seattle, WA',
    date_caught: '2026-05-28',
  },
);

const gengarWanted = baseInstance('0094-default_demo-wanted', '0094-default', 94, {
  nickname: 'Mirror target',
  is_caught: false,
  is_wanted: true,
  registered: false,
  most_wanted: true,
  pref_lucky: true,
  friendship_level: 4,
  wanted_tags: ['Lucky mirror', 'Ghost'],
});

const dragonite = baseInstance('0149-default_demo-dragonite', '0149-default', 149, {
  cp: 3472,
  level: 42,
  attack_iv: 14,
  defense_iv: 15,
  stamina_iv: 14,
  fast_move_id: 204,
  charged_move1_id: 191,
  charged_move2_id: 157,
  location_caught: 'Burnaby, BC',
  date_caught: '2026-06-02',
});

const venusaur = baseInstance('0003-default_demo-venusaur', '0003-default', 3, {
  nickname: 'Garden lead',
  cp: 2411,
  attack_iv: 13,
  defense_iv: 15,
  stamina_iv: 14,
  fast_move_id: 38,
  charged_move1_id: 116,
  location_caught: 'Queen Elizabeth Park',
  date_caught: '2026-05-12',
});

const blastoise = baseInstance('0009-default_demo-blastoise', '0009-default', 9, {
  cp: 2388,
  attack_iv: 12,
  defense_iv: 14,
  stamina_iv: 15,
  fast_move_id: 39,
  charged_move1_id: 107,
  lucky: true,
  location_caught: 'English Bay',
  date_caught: '2026-04-22',
});

const gengarCaught = baseInstance('0094-default_demo-gengar', '0094-default', 94, {
  nickname: 'Night shift',
  cp: 2567,
  attack_iv: 15,
  defense_iv: 12,
  stamina_iv: 13,
  fast_move_id: 212,
  charged_move1_id: 117,
  favorite: true,
  location_caught: 'Gastown',
  date_caught: '2026-06-08',
});

const eevee = baseInstance(
  '0133-flower_crown_default_demo-eevee',
  '0133-flower_crown_default',
  133,
  {
    nickname: 'Flower trade',
    cp: 742,
    costume_id: 122,
    attack_iv: 10,
    defense_iv: 15,
    stamina_iv: 15,
    location_caught: 'Stanley Park',
    date_caught: '2026-05-19',
  },
);

const mewtwoCaught = baseInstance('0150-default_demo-mewtwo', '0150-default', 150, {
  cp: 4188,
  attack_iv: 15,
  defense_iv: 15,
  stamina_iv: 14,
  fast_move_id: 235,
  charged_move1_id: 148,
  charged_move2_id: 93,
  favorite: true,
  location_caught: 'Downtown Vancouver',
  date_caught: '2026-06-21',
});

const mewtwoPartner = baseInstance('0150-default_demo-partner', '0150-default', 150, {
  username: 'HarbourMew',
  user_id: 'partner-user-001',
  cp: 4120,
  attack_iv: 15,
  defense_iv: 15,
  stamina_iv: 13,
  fast_move_id: 235,
  charged_move1_id: 148,
  charged_move2_id: 93,
  location_caught: 'Coal Harbour',
  date_caught: '2026-06-20',
});

const demoInstances = {
  [venusaur.instance_id]: venusaur,
  [charizard.instance_id]: charizard,
  [blastoise.instance_id]: blastoise,
  [gengarCaught.instance_id]: gengarCaught,
  [eevee.instance_id]: eevee,
  [pikachuTrade.instance_id]: pikachuTrade,
  [gengarWanted.instance_id]: gengarWanted,
  [dragonite.instance_id]: dragonite,
  [mewtwoCaught.instance_id]: mewtwoCaught,
};

const demoRelatedInstances = {
  [mewtwoPartner.instance_id]: mewtwoPartner,
};

const demoTrades = {
  'trade-demo-pending': {
    trade_id: 'trade-demo-pending',
    trade_status: 'pending',
    username_proposed: 'HarbourMew',
    username_accepting: demoUser.username,
    pokemon_instance_id_user_proposed: mewtwoPartner.instance_id,
    pokemon_instance_id_user_accepting: pikachuTrade.instance_id,
    user_proposed_completion_confirmed: false,
    user_accepting_completion_confirmed: false,
    trade_accepted_date: '2026-06-29T18:00:00.000Z',
    trade_completed_date: null,
    trade_cancelled_date: null,
    trade_cancelled_by: null,
    trade_deleted_date: null,
    trade_proposal_date: '2026-06-28T18:00:00.000Z',
    trade_friendship_level: 'Best',
    trade_dust_cost: 800,
    is_lucky_trade: true,
    user_1_trade_satisfaction: false,
    user_2_trade_satisfaction: false,
    last_update: Date.parse(captureDate),
  },
};

const searchResults = [
  {
    pokemon_id: 25,
    instance_id: 'search-trade-pikachu',
    username: 'HarbourMew',
    distance: 2.8,
    latitude: 49.289,
    longitude: -123.119,
    cp: 821,
    costume_id: 41,
    shiny: true,
    gender: 'Female',
    location_caught: 'Coal Harbour',
    date_caught: '2026-06-18',
    wanted_list: {
      [gengarWanted.instance_id]: { name: 'Gengar', match: true, form: null },
    },
  },
  {
    pokemon_id: 25,
    instance_id: 'search-trade-pikachu-2',
    username: 'GranvilleDex',
    distance: 5.4,
    latitude: 49.276,
    longitude: -123.13,
    cp: 744,
    costume_id: 122,
    shiny: false,
    gender: 'Male',
    location_caught: 'Granville Island',
    date_caught: '2026-06-10',
    wanted_list: {
      [charizard.instance_id]: { name: 'Charizard', match: false, form: null },
    },
  },
  {
    pokemon_id: 25,
    instance_id: 'search-trade-pikachu-3',
    username: 'KitsCollector',
    distance: 7.1,
    latitude: 49.268,
    longitude: -123.155,
    cp: 903,
    shiny: false,
    gender: 'Female',
    location_caught: 'Kitsilano',
    date_caught: '2026-06-12',
  },
];

const locationSuggestions = [
  {
    displayName: 'Vancouver, British Columbia, Canada',
    latitude: 49.2827,
    longitude: -123.1207,
    boundary: 'POLYGON((-123.21 49.20,-123.02 49.20,-123.02 49.33,-123.21 49.33,-123.21 49.20))',
  },
];

const userOverview = {
  user: demoUser,
  pokemon_instances: demoInstances,
  trades: demoTrades,
  related_instances: demoRelatedInstances,
  registrations: {},
};

export async function installDemoRoutes(page: Page) {
  await installE2eRoutes(page, {
    mockImages: false,
    searchResults,
    communityRankings: {
      privacy_threshold: 5,
      snapshot: { collector_users: 18, wishlist_users: 15, updated_at: captureDate },
      most_wanted: [
        { variant_id: '0001-default', wanted_users: 12, most_wanted_users: 4, caught_users: 9 },
        { variant_id: '0004-default', wanted_users: 8, most_wanted_users: 2, caught_users: 11 },
      ],
      rarest: [
        { variant_id: '0004-default', wanted_users: 8, most_wanted_users: null, caught_users: 2 },
        { variant_id: '0001-default', wanted_users: 12, most_wanted_users: 4, caught_users: 9 },
      ],
    },
    locationSuggestions,
    trainerSuggestions: [
      { username: 'HarbourMew', user_id: 'partner-user-001' },
      { username: 'GranvilleDex', user_id: 'partner-user-002' },
    ],
    userInstances: { username: demoUser.username, instances: demoInstances },
    publicUser: { user: demoUser, instances: demoInstances },
    userOverview,
    trainerProfile: {
      user: {
        ...demoUser,
        app_joined_at: '2026-01-01T00:00:00.000Z',
        bio: 'Collector, battler, and local trade coordinator.',
        trainer_level: 50,
        team: 'mystic',
      },
      trainer_titles: ['Lucky Trader', 'Kanto Collector'],
      location: 'Vancouver, British Columbia, Canada',
      trainer_code: demoUser.trainerCode,
      stats: {
        caught: 2255,
        for_trade: 208,
        wanted: 168,
        favorites: 77,
        registered: 846,
      },
      highlights: [charizard, gengarCaught, mewtwoCaught],
      viewer: {
        relationship: 'self',
        can_view_profile: true,
        can_view_collection: true,
      },
    },
    friendsOverview: {
      friends: [
        {
          user_id: 'partner-user-001',
          username: 'HarbourMew',
          pokemon_go_name: 'HarbourMewGO',
        },
      ],
      incoming: [
        {
          user_id: 'partner-user-002',
          username: 'GranvilleDex',
          pokemon_go_name: 'GranvilleDexGO',
        },
      ],
      outgoing: [],
      blocked: [],
    },
  });

  for (const pattern of ['**/api/auth/account/security', '**/__e2e/auth/account/security']) {
    await page.route(pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          email: demoUser.email,
          hasPassword: true,
          providers: [
            {
              provider: 'google',
              email: demoUser.email,
              emailVerified: true,
              linkedAt: '2026-07-01T00:00:00.000Z',
            },
            {
              provider: 'discord',
              email: demoUser.email,
              emailVerified: true,
              linkedAt: '2026-07-02T00:00:00.000Z',
            },
          ],
          activeSessions: 2,
        }),
      });
    });
  }
}

export async function seedDemoBrowserState(page: Page, lightTheme = captureLightTheme) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ user, instances, trades, relatedInstances, lightTheme }) =>
      new Promise<void>((resolve, reject) => {
        window.localStorage.clear();
        window.localStorage.setItem('isLightMode', JSON.stringify(lightTheme));
        window.localStorage.setItem('user', JSON.stringify(user));
        window.localStorage.setItem(
          'location',
          JSON.stringify({ latitude: 49.2827, longitude: -123.1207 }),
        );
        window.localStorage.setItem('ownershipTimestamp', String(Date.now()));

        const deleteDatabase = (dbName: string) =>
          new Promise<void>((deleteResolve, deleteReject) => {
            const request = indexedDB.deleteDatabase(dbName);
            request.onsuccess = () => deleteResolve();
            request.onerror = () => deleteReject(request.error);
            request.onblocked = () => deleteResolve();
          });

        const seedDatabase = (
          dbName: string,
          stores: Array<{
            name: string;
            keyPath: string;
            rows: Record<string, unknown>[];
          }>,
        ) =>
          new Promise<void>((storeResolve, storeReject) => {
            const request = indexedDB.open(dbName, 2);
            request.onupgradeneeded = () => {
              const db = request.result;
              for (const storeDefinition of stores) {
                if (!db.objectStoreNames.contains(storeDefinition.name)) {
                  db.createObjectStore(storeDefinition.name, {
                    keyPath: storeDefinition.keyPath,
                  });
                }
              }
            };
            request.onerror = () => storeReject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const tx = db.transaction(
                stores.map((storeDefinition) => storeDefinition.name),
                'readwrite',
              );
              for (const storeDefinition of stores) {
                const store = tx.objectStore(storeDefinition.name);
                store.clear();
                for (const row of storeDefinition.rows) {
                  store.put(row);
                }
              }
              tx.oncomplete = () => {
                db.close();
                storeResolve();
              };
              tx.onerror = () => {
                db.close();
                storeReject(tx.error);
              };
            };
          });

        Promise.all([deleteDatabase('instancesDB'), deleteDatabase('tradesDB')])
          .then(() =>
            Promise.all([
              seedDatabase('instancesDB', [
                {
                  name: 'instances',
                  keyPath: 'instance_id',
                  rows: Object.values(instances),
                },
              ]),
              seedDatabase('tradesDB', [
                {
                  name: 'trades',
                  keyPath: 'trade_id',
                  rows: Object.values(trades),
                },
                {
                  name: 'relatedInstances',
                  keyPath: 'instance_id',
                  rows: Object.values(relatedInstances),
                },
              ]),
            ]),
          )
          .then(() => resolve())
          .catch(reject);
      }),
    {
      user: demoUser,
      instances: demoInstances,
      trades: demoTrades,
      relatedInstances: demoRelatedInstances,
      lightTheme,
    },
  );
}

export async function installPublicCaptureTheme(page: Page, lightTheme = captureLightTheme) {
  await page.addInitScript((lightTheme) => {
    window.localStorage.setItem('isLightMode', JSON.stringify(lightTheme));
  }, lightTheme);
}

export async function chooseCapturePokemon(page: Page, name: string) {
  await page.getByPlaceholder('Enter Pokemon name').fill(name);
  const suggestion = page.getByRole('option', { name: new RegExp(name, 'i') }).first();
  try {
    await suggestion.waitFor({ state: 'visible', timeout: 1_000 });
    await suggestion.click();
  } catch {
    // The Search control resolves an exact catalog name immediately once the
    // catalog is warm, in which case no suggestion list remains to click.
    await expect(page.locator('.selected-pokemon-preview__pokemon:visible').first()).toBeVisible({
      timeout: 5_000,
    });
  }
}
