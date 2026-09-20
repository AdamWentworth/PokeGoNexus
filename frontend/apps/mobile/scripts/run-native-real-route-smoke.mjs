import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const mobileDirectory = resolve(scriptDirectory, '..');
const workspaceDirectory = resolve(mobileDirectory, '../..');
const repositoryDirectory = resolve(workspaceDirectory, '..');
const fixtureDirectory = resolve(workspaceDirectory, 'packages/app-core/tests/__helpers__/fixtures');
const artifactDirectory = resolve(mobileDirectory, '.artifacts/native-real-routes');
const expoPort = Number(process.env.POKEGONEXUS_NATIVE_ROUTE_PORT || (31_000 + (process.pid % 8_000)));
const baseUrl = `http://127.0.0.1:${expoPort}`;
const refreshTokenKey = 'pokegonexus.mobile.refresh-token';
const routeFilter = process.env.POKEGONEXUS_REAL_ROUTE_FILTER?.trim() ?? '';
const routeFilters = routeFilter.split(',').map((value) => value.trim()).filter(Boolean);
const routeMatchesFilter = (path, scenarioId) => (
  routeFilters.length === 0
  || routeFilters.some((filter) => path.includes(filter) || scenarioId?.includes(filter))
);
const workflowsOnly = process.env.POKEGONEXUS_REAL_WORKFLOWS_ONLY === 'true';
const workflowFilter = process.env.POKEGONEXUS_REAL_WORKFLOW_FILTER?.trim() ?? '';
const performanceMode = process.env.POKEGONEXUS_REAL_ROUTE_PERFORMANCE === 'true';
const performanceRepetitions = performanceMode
  ? Math.max(1, Number(process.env.POKEGONEXUS_PERFORMANCE_SAMPLES ?? 3))
  : 1;
const performanceReportPath = resolve(
  process.env.POKEGONEXUS_PERFORMANCE_REPORT
    ?? join(artifactDirectory, 'native-web-browser-proxy.json'),
);
const performanceContract = JSON.parse(readFileSync(
  resolve(workspaceDirectory, 'performance-parity/contract.json'),
  'utf8',
));
const performanceSamples = [];
const performanceSampleIndexes = new Map();

const nextPerformanceSampleIndex = (scenarioId, metric) => {
  const key = `${scenarioId}\u0000${metric}`;
  const current = performanceSampleIndexes.get(key) ?? 0;
  performanceSampleIndexes.set(key, current + 1);
  return current;
};

const addPerformanceMetric = (
  scenarioId,
  metric,
  value,
  { diagnostic = false, direction = 'lower', unit = 'ms' } = {},
) => {
  if (!performanceMode || value == null || !Number.isFinite(value) || value < 0) return;
  performanceSamples.push({
    scenarioId,
    metric,
    value,
    sampleIndex: nextPerformanceSampleIndex(scenarioId, metric),
    direction,
    unit,
    ...(diagnostic ? { diagnostic: true } : {}),
  });
};

const routeScenarioId = (path, authState) => performanceContract.routes.find(
  (route) => route.native === path && route.auth === authState,
)?.id ?? null;

const readJson = (name) => JSON.parse(
  readFileSync(resolve(fixtureDirectory, name), 'utf8').replace(/^\uFEFF/, ''),
);

const rawCatalog = readJson('pokemons.json');
const asRecords = (value) => Array.isArray(value)
  ? value.filter((entry) => entry && typeof entry === 'object')
  : [];
const stripMovePools = (value) => asRecords(value).map((entry) => ({
  ...entry,
  moves: [],
}));
// Match the production API split and the Vite parity fixture exactly. Sending
// the complete source catalog from every endpoint made the native proxy parse
// and hydrate moves, raids, and Max data several times while Vite received the
// real endpoint-specific projections.
const catalog = rawCatalog.map((pokemon) => ({
  ...pokemon,
  crownForms: stripMovePools(pokemon.crownForms),
  fusion: stripMovePools(pokemon.fusion),
  moves: [],
  raid_boss: [],
}));
const maxData = rawCatalog.filter((pokemon) => (
  asRecords(pokemon.max).length > 0 || [888, 889, 890].includes(Number(pokemon.pokemon_id))
));
const allInstances = readJson('instances.json');
const instanceEntries = Object.entries(allInstances).slice(0, 180);
const instances = Object.fromEntries(instanceEntries.map(([instanceId, instance], index) => {
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
}));
const firstInstanceId = instanceEntries[0]?.[0] ?? '';
const firstVariantId = catalog[0]?.variants?.[0]?.variant_id ?? '0001-default';
const foreignInstances = {
  ...instances,
  [firstInstanceId]: {
    ...instances[firstInstanceId],
    is_caught: true,
    is_for_trade: true,
    is_wanted: false,
  },
};
const [routeTradeProposedInstanceId, routeTradeAcceptingInstanceId] = Object.keys(foreignInstances);
const initialRouteTrade = {
  is_lucky_trade: false,
  pokemon_instance_id_user_accepting: routeTradeAcceptingInstanceId,
  pokemon_instance_id_user_proposed: routeTradeProposedInstanceId,
  trade_dust_cost: 40_000,
  trade_friendship_level: '5',
  trade_id: 'native-route-trade',
  trade_proposal_date: '2026-08-28T12:00:00.000Z',
  trade_status: 'proposed',
  user_accepting_completion_confirmed: false,
  user_proposed_completion_confirmed: false,
  username_accepting: 'NexusFriend',
  username_proposed: 'NexusRoute',
};
let routeTrade = { ...initialRouteTrade };
let homePerformanceEmptyState = false;
const routeTradesEnvelope = () => ({
  related_instances: Object.fromEntries(
    Object.entries(foreignInstances).slice(0, 2).map(([instanceId, instance]) => [
      instanceId,
      { ...instance, instance_id: instanceId },
    ]),
  ),
  trades: [routeTrade],
});

const session = {
  accessToken: 'native-real-route-access-token',
  accessTokenExpiry: '2099-01-01T00:00:00.000Z',
  refreshToken: 'native-real-route-refresh-token',
  refreshTokenExpiry: '2099-02-01T00:00:00.000Z',
  user: {
    allowLocation: true,
    coordinates: { latitude: 49.2488, longitude: -122.9805 },
    email: 'route-fixture@pokegonexus.test',
    location: 'Burnaby, British Columbia, Canada',
    pokemonGoName: 'NexusRoute',
    trainerCode: '1234 5678 9012',
    user_id: 'native-route-user',
    username: 'NexusRoute',
  },
};

const preferences = {
  collection_visibility: 'public',
  coordination_handle: 'NexusRoute',
  coordination_method: 'campfire',
  friend_request_permission: 'everyone',
  profile_visibility: 'public',
  share_trade_contact: true,
  show_location: true,
  show_pokemon_go_name: true,
  trainer_code_visibility: 'friends',
  user_id: session.user.user_id,
};

let ownProfileUpdate = {};
const trainerProfile = (username = session.user.username) => ({
  highlights: [],
  location: 'Burnaby, British Columbia, Canada',
  preferences,
  stats: {
    caught: 142,
    favorites: 12,
    for_trade: 18,
    registered: 164,
    wanted: 24,
  },
  trainer_code: username === session.user.username ? session.user.trainerCode : null,
  trainer_titles: ['shiny-hunter', 'lucky-trader'],
  user: {
    app_joined_at: '2025-01-15T12:00:00.000Z',
    pokemonGoName: username === session.user.username ? `${username}GO` : username,
    pogo_started_on: '2016-07-06',
    team: 'Mystic',
    total_xp: 125_000_000,
    trainer_level: 50,
    user_id: username === session.user.username ? session.user.user_id : 'native-route-friend',
    username,
    ...(username === session.user.username ? ownProfileUpdate : {}),
  },
  viewer: {
    can_view_collection: true,
    can_view_profile: true,
    friendship_id: username === session.user.username ? null : 'friendship-route-1',
    relationship: username === session.user.username ? 'self' : 'friend',
  },
});

const friends = {
  blocked: [],
  friends: [{
    direction: 'accepted',
    friendship_id: 'friendship-route-1',
    pokemonGoName: 'NexusFriend',
    team: 'Valor',
    trainer_level: 48,
    user_id: 'native-route-friend',
    username: 'NexusFriend',
  }],
  incoming: [],
  outgoing: [],
};

const tags = {
  orders: {
    caught: ['system:caught', 'system:favorites', 'custom:route-shinies', 'system:trade'],
    wanted: ['system:wanted', 'system:most-wanted'],
  },
  tags: [{
    color: '#7c3aed',
    created_at: '2026-01-01T00:00:00.000Z',
    name: 'Route Shinies',
    parent: 'caught',
    sort: 2,
    tag_id: 'route-shinies',
    updated_at: null,
  }],
};

const moves = rawCatalog.map((pokemon) => ({
  crownForms: (pokemon.crownForms ?? []).map(({ id, moves: formMoves }) => ({ id, moves: formMoves })),
  fusion: (pokemon.fusion ?? []).map(({ fusion_id: fusionId, moves: fusionMoves }) => ({ fusion_id: fusionId, moves: fusionMoves })),
  moves: pokemon.moves ?? [],
  pokemon_id: pokemon.pokemon_id,
}));

const raidData = rawCatalog.map((pokemon) => ({
  pokemon_id: pokemon.pokemon_id,
  raid_boss: pokemon.raid_boss ?? [],
}));

const makePvpEntry = (rank, speciesId, name, type, moveName, pokemonId = rank) => ({
  attackIv: 0,
  battleAttack: 100 + rank,
  battleDefense: 130 - rank,
  battleHp: 140 + rank,
  categoryScores: rank === 1
    ? [70, 72, 74, 76, 78, 80]
    : [90, 88, 86, 84, 82, 81],
  counters: [{ rating: 310 + rank, speciesId: 'lanturn' }],
  defenseIv: 15,
  imageUrl: `/images/default/pokemon_${pokemonId}.png`,
  matchups: [{ rating: 740 - rank, speciesId: 'talonflame' }],
  moveset: [
    {
      buff: {
        attackerAttack: 0,
        attackerDefense: 0,
        chance: 0,
        targetAttack: 0,
        targetDefense: 0,
      },
      energyCost: 0,
      energyGain: 8,
      id: `${speciesId}-fast`,
      kind: 'fast',
      name: 'Quick Attack',
      power: 5,
      turns: 2,
      type: 'normal',
    },
    {
      buff: {
        attackerAttack: 0,
        attackerDefense: 0,
        chance: 0,
        targetAttack: 0,
        targetDefense: 0,
      },
      energyCost: 50,
      energyGain: 0,
      id: `${speciesId}-charged`,
      kind: 'charged',
      name: moveName,
      power: 80,
      turns: 1,
      type,
    },
  ],
  moveUsage: [{
    id: `${speciesId}-fast`,
    kind: 'fast',
    name: 'Quick Attack',
    type: 'normal',
    uses: 120,
  }],
  name,
  pokemonId,
  rank,
  rating: 700,
  recommendedLevel: 20 + rank / 2,
  score: 96 - rank,
  sourceRank: rank,
  speciesId,
  staminaIv: 15,
  statProduct: (100 + rank) * (130 - rank) * (140 + rank),
  types: [type],
  variantKind: 'pokemon',
});

const pvpGreatBaseEntries = [
  makePvpEntry(1, 'clodsire', 'Clodsire', 'poison', 'Earthquake', 980),
  makePvpEntry(2, 'azumarill', 'Azumarill', 'water', 'Play Rough', 184),
  makePvpEntry(3, 'bulbasaur', 'Bulbasaur', 'grass', 'Seed Bomb', 1),
];
const pvpGreatEntries = [
  ...pvpGreatBaseEntries,
  ...Array.from({ length: 57 }, (_, offset) => {
    const rank = offset + 4;
    const template = pvpGreatBaseEntries[offset % pvpGreatBaseEntries.length];
    return {
      ...template,
      categoryScores: template.categoryScores.map(
        (score) => Math.max(25, score - rank / 4),
      ),
      name: `Meta Pokémon ${rank}`,
      rank,
      rating: Math.max(300, 700 - rank * 3),
      score: Math.max(35, 96 - rank * 0.75),
      sourceRank: rank,
      speciesId: `meta-pokemon-${rank}`,
    };
  }),
];

const pvpPayload = {
  leagues: {
    great: {
      cpLimit: 1_500,
      entries: pvpGreatEntries,
      key: 'great',
      label: 'Great League',
    },
    master: {
      cpLimit: null,
      entries: [makePvpEntry(
        1,
        'zacian_crowned_sword',
        'Zacian Crowned Sword',
        'steel',
        'Behemoth Blade',
      )],
      key: 'master',
      label: 'Master League',
    },
    ultra: {
      cpLimit: 2_500,
      entries: [makePvpEntry(1, 'feraligatr', 'Feraligatr', 'water', 'Hydro Cannon')],
      key: 'ultra',
      label: 'Ultra League',
    },
  },
  source: {
    importedAt: '2026-07-23T00:00:00Z',
    license: 'MIT',
    metadata: {},
    name: 'PvPoke',
    url: 'https://github.com/pvpoke/pvpoke',
    version: 'e2e-pvpoke',
  },
};

const rankings = {
  most_wanted: [],
  privacy_threshold: 3,
  rarest: [],
  snapshot: {
    collector_users: 10,
    updated_at: '2026-08-28T12:00:00.000Z',
    wishlist_users: 8,
  },
};

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XlLJAAAAAElFTkSuQmCC',
  'base64',
);

const guestRoutes = [
  ['/native', 'native-guest-home-screen', true],
  ['/native/login', 'native-login-screen', true],
  ['/native/register', 'native-register-screen', true],
  ['/native/reset-password', 'native-password-reset-screen', true],
  ['/native/verify-email-change', 'native-verify-email-change-screen', true],
  ['/native/info/getting-started', 'native-information-getting-started', true],
  ['/native/info/help', 'native-information-help', true],
  ['/native/info/faq', 'native-information-faq', true],
  ['/native/info/about', 'native-information-about', true],
  ['/native/info/safety', 'native-information-safety', true],
  ['/native/info/privacy', 'native-information-privacy', false],
  ['/native/info/terms', 'native-information-terms', false],
  ['/native/info/data-deletion', 'native-information-data-deletion', false],
  ['/native/pokedex', 'native-pokedex-screen', true],
  ['/native/pokedex/0001-default', 'native-pokedex-detail-screen', true],
  ['/native/raid', 'native-raid-screen', true],
  ['/native/max', 'native-max-screen', true],
  ['/native/pvp', 'native-pvp-screen', true],
  ['/native/pvp-methodology', 'native-methodology-screen', true],
  ['/native/raid-methodology', 'native-methodology-screen', true],
  ['/native/rankings', 'native-rankings-screen', true],
  ['/native/profile/NexusFriend', 'native-trainer-profile', true],
  ['/native/collection/trainer/NexusFriend?filter=trade', 'native-collection-hub', true],
  [`/native/collection/trainer/NexusFriend/${encodeURIComponent(firstInstanceId)}`, 'native-instance-overlay', false],
  ['/native/trade-board/NexusFriend', 'native-trade-board-screen', false],
  ['/native/not-found?path=%2Fnative%2Fmissing', 'native-not-found-screen', true],
];

const signedInRoutes = [
  ['/native', 'native-home-screen', true],
  ['/native/collection', 'native-collection-hub', true],
  [`/native/collection/${encodeURIComponent(firstInstanceId)}`, 'native-instance-overlay', false],
  [`/native/collection/catalog/${encodeURIComponent(firstVariantId)}`, 'native-catalog-detail-screen', false],
  ['/native/search', 'native-search-route', true],
  ['/native/trades', 'native-trades-hub', true],
  ['/native/profile', 'native-trainer-profile', true],
  ['/native/profile/NexusFriend', 'native-trainer-profile', true],
  ['/native/friends', 'native-friends-route', true],
  ['/native/settings', 'native-trainer-settings-screen', true],
  ['/native/account', 'native-account-security-screen', true],
  ['/native/trade-board', 'native-trade-board-screen', true],
  ['/native/collection/trainer/NexusFriend?filter=trade', 'native-collection-hub', true],
  ['/native/collection/trainer/NexusFriend?filter=wanted', 'native-collection-hub', true],
  [`/native/collection/trainer/NexusFriend/${encodeURIComponent(firstInstanceId)}`, 'native-instance-overlay', false],
  ['/native/pokedex', 'native-pokedex-screen', true],
  ['/native/pokedex/0001-default', 'native-pokedex-detail-screen', true],
  ['/native/raid', 'native-raid-screen', true],
  ['/native/max', 'native-max-screen', true],
  ['/native/pvp', 'native-pvp-screen', true],
  ['/native/pvp-methodology', 'native-methodology-screen', true],
  ['/native/raid-methodology', 'native-methodology-screen', true],
  ['/native/rankings', 'native-rankings-screen', true],
];

const waitFor = async (url, timeoutMs = 180_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
};

const startExpo = async () => {
  const command = join(workspaceDirectory, 'node_modules/.bin/expo');
  const args = ['start', '--web', '--port', String(expoPort), '--clear'];
  if (performanceMode) args.push('--no-dev', '--minify');
  const child = spawn(command, args, {
    cwd: mobileDirectory,
    env: {
      ...process.env,
      CI: '1',
      EXPO_PUBLIC_DEVICE_SMOKE_MODE: 'false',
      EXPO_PUBLIC_MOBILE_EXPERIENCE: 'native-preview',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output = `${output}${chunk}`.slice(-16_000); });
  child.stderr.on('data', (chunk) => { output = `${output}${chunk}`.slice(-16_000); });
  try {
    await waitFor(`${baseUrl}/native`);
  } catch (error) {
    child.kill('SIGTERM');
    throw new Error(`${error instanceof Error ? error.message : error}\n${output}`);
  }
  return child;
};

const apiResponse = (url, method = 'GET', body = null) => {
  const parsedUrl = new URL(url);
  const { pathname, searchParams } = parsedUrl;
  if (pathname === '/api/auth/mobile/refresh') return session;
  if (pathname === `/api/auth/update/${session.user.user_id}` && method === 'PUT') {
    session.user = { ...session.user, ...body };
    return { success: true, data: session.user };
  }
  if (pathname === '/api/auth/account/security') {
    return {
      activeSessions: 2,
      email: session.user.email,
      hasPassword: true,
      providers: [
        { email: session.user.email, emailVerified: true, linkedAt: '2026-01-01T00:00:00.000Z', provider: 'google' },
        { email: session.user.email, emailVerified: true, linkedAt: '2026-01-02T00:00:00.000Z', provider: 'discord' },
        { email: session.user.email, emailVerified: true, linkedAt: '2026-01-03T00:00:00.000Z', provider: 'facebook' },
      ],
    };
  }
  if (pathname === '/api/users/instances/sync' && homePerformanceEmptyState) {
    return { checkpoint: 'native-home-empty-checkpoint', instances: {}, not_modified: false };
  }
  if (pathname === '/api/users/instances/sync') {
    return { checkpoint: 'native-route-checkpoint', instances, not_modified: false };
  }
  if (pathname === '/api/users/tags') return tags;
  if (pathname === '/api/users/collection/summary') {
    return { caught: 142, collection_total: 180, favorite: 12, for_trade: 18, most_wanted: 3, wanted: 24 };
  }
  if (pathname === '/api/users/trades' && method === 'GET' && homePerformanceEmptyState) {
    return { related_instances: {}, trades: [] };
  }
  if (pathname === '/api/users/trades' && method === 'GET') return routeTradesEnvelope();
  if (pathname === '/api/users/trades/native-route-trade/cancel' && method === 'POST') {
    routeTrade = {
      ...routeTrade,
      trade_cancelled_by: session.user.username,
      trade_cancelled_date: '2026-08-28T12:05:00.000Z',
      trade_status: 'cancelled',
    };
    return { affected_instances: {}, trade: routeTrade };
  }
  if (pathname === '/api/users/friends' && homePerformanceEmptyState) {
    return { blocked: [], friends: [], incoming: [], outgoing: [] };
  }
  if (pathname === '/api/users/friends') return friends;
  if (pathname === '/api/users/preferences') return preferences;
  if (pathname === '/api/users/profile' && method === 'PUT') {
    ownProfileUpdate = { ...ownProfileUpdate, ...body };
    return { success: true };
  }
  if (pathname === '/api/users/profile') return trainerProfile();
  if (pathname.startsWith('/api/users/profiles/')) {
    return trainerProfile(decodeURIComponent(pathname.split('/').at(-1) ?? 'NexusFriend'));
  }
  if (pathname.startsWith('/api/users/instances/by-username/')
      || pathname.startsWith('/api/users/public/users/')) {
    return { instances: foreignInstances, username: decodeURIComponent(pathname.split('/').at(-1) ?? 'NexusFriend') };
  }
  if (pathname.startsWith('/api/users/autocomplete-trainers')) {
    return [{ pokemonGoName: 'Nexus Friend', team: 'Valor', trainer_level: 48, username: 'NexusFriend' }];
  }
  if (pathname === '/api/pokemon/catalog') return catalog;
  if (pathname === '/api/pokemon/moves') return moves;
  if (pathname === '/api/pokemon/raid-data') return raidData;
  if (pathname === '/api/pokemon/max-data') return maxData;
  if (pathname === '/api/pokemon/pvp-data') return pvpPayload;
  if (pathname === '/api/pokemon/pokedex') {
    return catalog.map(({ female_unique: femaleUnique, form, gender_rate: genderRate, generation, image_url: imageUrl, name, pokedex_number: pokedexNumber, pokemon_id: pokemonId }) => ({
      female_unique: femaleUnique,
      form,
      gender_rate: genderRate,
      generation,
      image_url: imageUrl,
      name,
      pokedex_number: pokedexNumber,
      pokemon_id: pokemonId,
    }));
  }
  if (pathname === '/api/search/rankings') return rankings;
  if (pathname === '/api/search/searchPokemon') {
    const pokemonId = Number(searchParams.get('pokemon_id') ?? 1);
    const ownership = searchParams.get('ownership') ?? 'caught';
    const sourceEntry = Object.entries(foreignInstances).find(([, instance]) => (
      Number(instance.pokemon_id) === pokemonId
    )) ?? Object.entries(foreignInstances)[0];
    if (!sourceEntry) return [];
    const [instanceId, instance] = sourceEntry;
    const relatedEntry = Object.entries(foreignInstances).find(([candidateId, candidate]) => (
      candidateId !== instanceId && Number(candidate.pokemon_id) !== pokemonId
    ));
    const related = relatedEntry ? {
      [relatedEntry[0]]: {
        ...relatedEntry[1],
        instance_id: relatedEntry[0],
        match: true,
      },
    } : {};
    return [{
      ...instance,
      distance: 1.2,
      instance_id: instanceId,
      is_caught: ownership !== 'wanted',
      is_for_trade: ownership === 'trade',
      is_wanted: ownership === 'wanted',
      latitude: 49.2488,
      longitude: -122.9805,
      pokemon_id: pokemonId,
      trade_list: ownership === 'wanted' ? related : {},
      username: 'NexusFriend',
      wanted_list: ownership === 'trade' ? related : {},
    }];
  }
  if (pathname === '/api/events/getUpdates') return {};
  if (pathname === '/api/events/sse-token') return { expires_in_seconds: 3600, token: 'native-route-stream-token' };
  if (pathname === '/api/events/sse') return {};
  return null;
};

const installRoutes = async (context, unhandledApis) => {
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const response = apiResponse(request.url(), request.method(), request.postDataJSON());
    if (response === null) {
      unhandledApis.add(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      await route.fulfill({ contentType: 'application/json', json: {} });
      return;
    }
    await route.fulfill({ contentType: 'application/json', json: response });
  });
  await context.route(/\/(?:favicons|icons|images|media)\//, async (route) => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const localPath = resolve(repositoryDirectory, `assets${pathname}`);
    if (localPath.startsWith(`${resolve(repositoryDirectory, 'assets')}/`) && existsSync(localPath)) {
      const contentTypes = { '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
      await route.fulfill({
        body: readFileSync(localPath),
        contentType: contentTypes[extname(localPath).toLocaleLowerCase()] ?? 'application/octet-stream',
      });
      return;
    }
    await route.fulfill({ body: transparentPng, contentType: 'image/png' });
  });
};

const trackRuntimeErrors = (page, errors) => {
  const trackedResourceTypes = ['fetch', 'font', 'image', 'script', 'stylesheet', 'xhr'];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    const resourceType = response.request().resourceType();
    if (response.status() >= 400 && trackedResourceTypes.includes(resourceType)) {
      errors.push(`${resourceType}: ${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    const resourceType = request.resourceType();
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    if (trackedResourceTypes.includes(resourceType)) {
      errors.push(`${resourceType}: ${request.failure()?.errorText ?? 'request failed'} ${request.url()}`);
    }
  });
};

const routeLoadingLabels = [
  'Opening Pokémon Go Nexus…',
  'Preparing your trainer dashboard…',
  'Loading your collection…',
  'Loading your tags…',
  'Loading Pokémon search',
  'Loading trade preferences',
  'Loading trades',
  'Loading trainer profile',
  'Loading friends',
  'Loading settings…',
  'Loading account security…',
  'Opening Pokédex…',
  'Loading battle data…',
  'Preparing Max rankings…',
  'Loading PvP snapshot…',
  'Loading community rankings…',
  'Preparing your Trade Board…',
  'Syncing collection changes',
];

const waitForRouteToSettle = async (page) => {
  // Native route shells mount before their React Query payloads. Requiring
  // deterministic fixture traffic to settle prevents a fast empty shell from
  // being compared with Vite's fully populated destination (or vice versa).
  await page.waitForLoadState('networkidle', { timeout: 30_000 });
  // Keep the observer itself out of the measurement. Sequential locator
  // round trips added latency even when none of these labels existed.
  await page.waitForFunction((labels) => {
    const normalizedLabels = new Set(labels);
    return !Array.from(document.querySelectorAll('body *')).some((element) => {
      if (element.children.length > 0) return false;
      const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (!normalizedLabels.has(text)) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) !== 0;
    });
  }, routeLoadingLabels, { timeout: 25_000 });
  await page.evaluate(() => new Promise((resolvePaint) => {
    requestAnimationFrame(() => requestAnimationFrame(resolvePaint));
  }));
};

const waitForScreenshotSettle = async (page) => {
  // Allow the final query-cache render and route animation to paint before
  // layout, chrome, and screenshots are inspected.
  await page.waitForTimeout(250);
};

const resetBrowserPerformanceProbe = async (page) => page.evaluate(() => {
  const probe = window.__performanceParityProbe;
  if (!probe) return;
  probe.frameTimes = [];
  probe.longTasks = [];
  probe.largestContentfulPaint = null;
  probe.measurementStartedAt = performance.now();
});

const takeBrowserPerformanceSnapshot = async (page) => page.evaluate(() => {
  const probe = window.__performanceParityProbe;
  const measurementStartedAt = probe?.measurementStartedAt ?? 0;
  const frameGaps = (probe?.frameTimes ?? []).slice(1).map(
    (timestamp, index) => timestamp - (probe?.frameTimes[index] ?? timestamp),
  );
  const firstContentfulPaint = performance.getEntriesByName('first-contentful-paint').at(-1);
  const memory = performance.memory;
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
      (total, entry) => total + (entry.startTime >= measurementStartedAt ? entry.transferSize || 0 : 0),
      0,
    ),
    domNodeCount: document.getElementsByTagName('*').length,
    jsHeapBytes: memory?.usedJSHeapSize ?? null,
  };
});

const recordRoutePerformance = async (page, path, authState) => {
  const scenarioId = routeScenarioId(path, authState);
  if (!scenarioId) return;
  const snapshot = await takeBrowserPerformanceSnapshot(page);
  addPerformanceMetric(scenarioId, 'route_ready_ms', snapshot.routeReadyMs);
  addPerformanceMetric(scenarioId, 'main_thread_blocking_ms', snapshot.mainThreadBlockingMs);
  addPerformanceMetric(scenarioId, 'max_frame_gap_ms', snapshot.maxFrameGapMs);
  addPerformanceMetric(scenarioId, 'first_contentful_paint_ms', snapshot.firstContentfulPaintMs, {
    diagnostic: true,
  });
  addPerformanceMetric(scenarioId, 'largest_contentful_paint_ms', snapshot.largestContentfulPaintMs, {
    diagnostic: true,
  });
  addPerformanceMetric(scenarioId, 'transfer_size_bytes', snapshot.transferSizeBytes, {
    diagnostic: true,
    unit: 'bytes',
  });
  addPerformanceMetric(scenarioId, 'dom_node_count', snapshot.domNodeCount, {
    diagnostic: true,
    unit: 'count',
  });
  addPerformanceMetric(scenarioId, 'js_heap_bytes', snapshot.jsHeapBytes, {
    diagnostic: true,
    unit: 'bytes',
  });
};

const inputLatency = async (page) => page.evaluate(() => {
  const inputAt = window.__performanceParityProbe?.lastInputAt;
  return inputAt == null ? null : performance.now() - inputAt;
});

const recordInteractionPerformance = async (page, scenarioId) => {
  addPerformanceMetric(scenarioId, 'interaction_ready_ms', await inputLatency(page));
};

const assertRoute = async (page, routeCase, theme, authState) => {
  const [path, testId, expectsActionMenu] = routeCase;
  const errors = [];
  trackRuntimeErrors(page, errors);
  if (performanceMode) {
    const warmPath = path === '/native/info/about'
      ? '/native/info/faq'
      : '/native/info/about';
    await page.goto(`${baseUrl}${warmPath}`, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    await waitForRouteToSettle(page);
    await resetBrowserPerformanceProbe(page);
    await page.evaluate((destination) => {
      window.history.pushState({}, '', destination);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, path);
  } else {
    await page.goto(`${baseUrl}${path}`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
  }
  const root = page.getByTestId(testId);
  await root.waitFor({ state: 'visible', timeout: 25_000 });
  await waitForRouteToSettle(page);
  await recordRoutePerformance(page, path, authState);
  await waitForScreenshotSettle(page);
  const actionMenuCount = await page.getByTestId('native-action-menu-anchor').count();
  if (expectsActionMenu && actionMenuCount !== 1) {
    throw new Error(`${path} rendered ${actionMenuCount} action-menu anchors; expected exactly one.`);
  }
  if (!expectsActionMenu && actionMenuCount !== 0) {
    throw new Error(`${path} rendered an action-menu anchor where the canonical route omits it.`);
  }
  if (expectsActionMenu) {
    await page.locator('[data-testid="native-action-menu-anchor"]:visible').last().click();
    // The home route keeps its menu mounted at opacity zero so its first tap
    // never pays mount cost. `:visible` therefore cannot distinguish the open
    // accessibility surface from that warm hidden tree.
    await page.waitForFunction(() => Array.from(
      document.querySelectorAll('[data-testid="native-action-menu"]'),
    ).some((element) => getComputedStyle(element).pointerEvents !== 'none'), null, { timeout: 10_000 });
    if (performanceMode && path === '/native' && authState === 'signed-in' && theme === 'dark') {
      // Record exactly one matched action-menu sample per repetition. Other
      // route checks also open this menu to validate its global availability,
      // but folding those functional checks into one performance scenario
      // would bias the native median with dozens of unrelated samples.
      await recordInteractionPerformance(page, 'interaction.action-menu.open');
    }
    if (path === '/native') {
      await page.screenshot({
        fullPage: true,
        path: join(artifactDirectory, `${theme}-${authState}-native-action-menu.png`),
      });
    }
    if (performanceMode && path === '/native' && authState === 'signed-in' && theme === 'dark') {
      const themeSwitch = visibleTestId(page, 'native-theme-switch');
      const priorLabel = await themeSwitch.getAttribute('aria-label');
      await themeSwitch.click();
      await page.waitForFunction((label) => {
        const control = document.querySelector('[data-testid="native-theme-switch"]');
        return control?.getAttribute('aria-label') !== label;
      }, priorLabel, { timeout: 5_000 });
      await recordInteractionPerformance(page, 'interaction.theme.toggle');
      await themeSwitch.click();
      await page.waitForFunction((label) => {
        const control = document.querySelector('[data-testid="native-theme-switch"]');
        return control?.getAttribute('aria-label') === label;
      }, priorLabel, { timeout: 5_000 });
    }
    await page.locator('[data-testid="native-action-menu-close"]:visible').last().click();
    await page.waitForFunction(() => Array.from(
      document.querySelectorAll('[data-testid="native-action-menu"]'),
    ).every((element) => getComputedStyle(element).pointerEvents === 'none'), null, { timeout: 10_000 });
  }
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth,
    document.body?.scrollWidth ?? 0,
  ) - window.innerWidth);
  if (overflow > 2) throw new Error(`${path} overflows the 412px viewport by ${overflow}px.`);
  if (errors.length > 0) throw new Error(`${path} emitted runtime errors:\n${errors.join('\n')}`);
  const safeName = path.replace(/^\//, '').replace(/[/?=&]/g, '-');
  await page.screenshot({
    fullPage: true,
    path: join(artifactDirectory, `${theme}-${authState}-${safeName}.png`),
  });
};

const signedInActionMenuDestinations = [
  ['raid', '/native/raid', 'native-raid-screen'],
  ['pokedex', '/native/pokedex', 'native-pokedex-screen'],
  ['pvp', '/native/pvp', 'native-pvp-screen'],
  ['search', '/native/search', 'native-search-route'],
  ['trades', '/native/trades', 'native-trades-hub'],
  ['pokemon', '/native/collection', 'native-collection-hub'],
  ['max', '/native/max', 'native-max-screen'],
  ['rankings', '/native/rankings', 'native-rankings-screen'],
];

const visibleTestId = (page, testId) => (
  page.getByTestId(testId).filter({ visible: true }).last()
);

const releaseEmptyExpoErrorToast = async (page) => {
  const errorToast = page.locator('#error-toast');
  if (!(await errorToast.count())) return;
  const errorText = await errorToast.evaluate((host) => {
    const visibleToast = host.shadowRoot?.querySelector('[role="button"]');
    if (visibleToast) return visibleToast.textContent?.trim() || 'Unknown Expo development error';
    host.style.pointerEvents = 'none';
    return '';
  });
  if (errorText) throw new Error(`Expo development overlay reported: ${errorText}`);
};

const openActionMenu = async (page) => {
  await visibleTestId(page, 'native-action-menu-anchor').click();
  await page.waitForFunction(() => Array.from(
    document.querySelectorAll('[data-testid="native-action-menu"]'),
  ).some((element) => getComputedStyle(element).pointerEvents !== 'none'), null, { timeout: 10_000 });
  await page.waitForTimeout(425);
  await releaseEmptyExpoErrorToast(page);
};

const assertNativeDestination = async (page, expectedPath, expectedTestId) => {
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 25_000 });
  await visibleTestId(page, expectedTestId).waitFor({ state: 'visible', timeout: 25_000 });
  await waitForRouteToSettle(page);
  const pathname = await page.evaluate(() => window.location.pathname);
  if (pathname !== expectedPath) {
    throw new Error(`Expected ${expectedPath}, but navigation resolved to ${pathname}.`);
  }
  if (await page.getByTestId('web-replica-webview').count()) {
    throw new Error(`${expectedPath} fell back to the canonical WebView.`);
  }
};

const assertGuestHomePerformanceWorkflow = async (context) => {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/native`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-guest-home-screen').waitFor({
      state: 'visible',
      timeout: 25_000,
    });
    await waitForRouteToSettle(page);
    await page.getByLabel('Dismiss action menu tip', { exact: true }).click();
    await page.getByLabel('Action menu tip', { exact: true }).waitFor({ state: 'hidden' });
    await recordInteractionPerformance(page, 'interaction.home.hint-dismiss');

    await page.getByRole('link', { name: 'Explore the app ↓', exact: true }).click();
    const directory = page.getByTestId('native-home-feature-directory');
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="native-home-feature-directory"]');
      return element ? Math.abs(element.getBoundingClientRect().top) < 40 : false;
    }, null, { timeout: 10_000 });
    await recordInteractionPerformance(page, 'interaction.home.guest-explore');
    await directory.screenshot({
      path: join(artifactDirectory, 'performance-home-guest-directory.png'),
    });
  } finally {
    await page.close();
  }
};

const assertGuestInformationPerformanceWorkflow = async (context) => {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/native/info/faq`, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('native-information-faq').waitFor({
      state: 'visible',
      timeout: 25_000,
    });
    await waitForRouteToSettle(page);

    await page.getByRole('button', { name: 'Browse Trading questions', exact: true }).click();
    await page.getByText('7 questions', { exact: true }).waitFor({ state: 'visible' });
    await recordInteractionPerformance(page, 'interaction.information.faq.category-result');

    await page.getByRole('button', { name: 'Expand answers', exact: true }).click();
    await page.getByRole('button', { name: 'Collapse answers', exact: true })
      .waitFor({ state: 'visible' });
    await recordInteractionPerformance(page, 'interaction.information.faq.answer-result');

    await page.getByLabel('Search questions and answers', { exact: true }).fill('Forever Friends');
    await page.getByText('1 question matching “Forever Friends”', { exact: true })
      .waitFor({ state: 'visible' });
    await recordInteractionPerformance(page, 'interaction.information.faq.search-result');

    await page.getByRole('button', { name: 'Clear FAQ search', exact: true }).click();
    await page.getByText('Common questions', { exact: true }).waitFor({ state: 'visible' });
    await recordInteractionPerformance(page, 'interaction.information.faq.clear-result');
  } finally {
    await page.close();
  }
};

const assertSignedInHomePerformanceWorkflow = async (context) => {
  const page = await context.newPage();
  homePerformanceEmptyState = true;
  try {
    await page.goto(`${baseUrl}/native`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-home-onboarding').waitFor({
      state: 'visible',
      timeout: 25_000,
    });
    const hintDismiss = page.getByLabel('Dismiss action menu tip', { exact: true });
    if (await hintDismiss.isVisible().catch(() => false)) {
      await hintDismiss.click();
      await page.getByLabel('Action menu tip', { exact: true })
        .waitFor({ state: 'hidden', timeout: 10_000 });
    }
    await page.getByRole('button', { name: 'Open trainer dashboard', exact: true }).click();
    await page.getByRole('heading', { name: /Welcome back, NexusRoute/ })
      .waitFor({ state: 'visible', timeout: 10_000 });
    await recordInteractionPerformance(page, 'interaction.home.onboarding-dismiss');
    await page.screenshot({
      fullPage: true,
      path: join(artifactDirectory, 'performance-home-signed-in-dashboard.png'),
    });
  } finally {
    homePerformanceEmptyState = false;
    await page.close();
  }
};

const assertSignedInActionMenuNavigation = async (context) => {
  for (const [destinationId, expectedPath, expectedTestId] of signedInActionMenuDestinations) {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/native`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
      await page.getByTestId('native-home-screen').waitFor({ state: 'visible', timeout: 25_000 });
      await waitForRouteToSettle(page);
      await openActionMenu(page);
      await visibleTestId(page, `native-action-menu-destination-${destinationId}`).click();
      await assertNativeDestination(page, expectedPath, expectedTestId);
    } catch (error) {
      await page.screenshot({
        fullPage: true,
        path: join(artifactDirectory, `dark-signed-in-action-menu-${destinationId}-failure.png`),
      }).catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[action menu/${destinationId}] ${message}`);
    } finally {
      await page.close();
    }
  }

  const utilityDestinations = [
    ['Share Trade Board', '/native/trade-board', 'native-trade-board-screen'],
    ['Settings', '/native/settings', 'native-trainer-settings-screen'],
  ];
  for (const [label, expectedPath, expectedTestId] of utilityDestinations) {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/native`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
      await page.getByTestId('native-home-screen').waitFor({ state: 'visible', timeout: 25_000 });
      await waitForRouteToSettle(page);
      await openActionMenu(page);
      await page.getByLabel(label, { exact: true }).filter({ visible: true }).last().click();
      await assertNativeDestination(page, expectedPath, expectedTestId);
    } finally {
      await page.close();
    }
  }

  const profilePage = await context.newPage();
  try {
    await profilePage.goto(`${baseUrl}/native`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
    await profilePage.getByTestId('native-home-screen').waitFor({ state: 'visible', timeout: 25_000 });
    await waitForRouteToSettle(profilePage);
    await openActionMenu(profilePage);
    await visibleTestId(profilePage, 'native-action-menu-profile').click();
    await assertNativeDestination(profilePage, '/native/profile', 'native-trainer-profile');
  } finally {
    await profilePage.close();
  }

  const supportPage = await context.newPage();
  try {
    await supportPage.goto(`${baseUrl}/native`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
    await supportPage.getByTestId('native-home-screen').waitFor({ state: 'visible', timeout: 25_000 });
    await waitForRouteToSettle(supportPage);
    await openActionMenu(supportPage);
    await supportPage.getByLabel('Learn and support', { exact: true })
      .filter({ visible: true }).last().click();
    await supportPage.getByText('Getting Started', { exact: true })
      .filter({ visible: true }).last().click();
    await assertNativeDestination(
      supportPage,
      '/native/info/getting-started',
      'native-information-getting-started',
    );
  } finally {
    await supportPage.close();
  }
};

const assertSignedInHomeCollectionWorkflow = async (context) => {
  const page = await context.newPage();
  const summaryCases = [
    ['Caught', 'Caught'],
    ['Favorites', 'Favorites'],
    ['For Trade', 'Trade'],
    ['Wanted', 'Wanted'],
  ];
  try {
    await page.goto(`${baseUrl}/native`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-home-screen').waitFor({ state: 'visible', timeout: 25_000 });
    await waitForRouteToSettle(page);
    if (await page.getByTestId('native-home-screen').count() !== 1
        || await page.getByTestId('native-collection-hub').count() !== 0
        || await page.getByTestId('native-pokedex-screen').count() !== 0) {
      throw new Error('Home mounted duplicate or prefetched primary route trees.');
    }

    for (const [homeLabel, activeTagLabel] of summaryCases) {
      const startedAt = Date.now();
      await page.getByRole('link', { name: new RegExp(homeLabel) }).first().click();
      await page.waitForURL((url) => url.pathname === '/native/collection', { timeout: 10_000 });
      await page.getByTestId('native-collection-hub').waitFor({
        state: 'visible',
        timeout: 10_000,
      });
      const collectionScreenCount = await page.getByTestId('native-collection-hub').count();
      if (collectionScreenCount !== 1) {
        throw new Error(
          `${homeLabel} retained ${collectionScreenCount} collection route trees instead of one.`,
        );
      }
      const clearTag = page.getByRole('button', {
        name: `Clear ${activeTagLabel} tag filter`,
        exact: true,
      });
      await clearTag.waitFor({ state: 'visible', timeout: 10_000 });
      await page.getByTestId('native-app-loading-overlay').waitFor({
        state: 'hidden',
        timeout: 2_000,
      });

      const firstCard = page.getByTestId(/^parity-card-/).first();
      await firstCard.waitFor({ state: 'visible', timeout: 10_000 });
      const imageReady = await firstCard.locator('img').first().evaluate(async (image) => {
        if (!(image instanceof HTMLImageElement)) return false;
        if (!image.complete) {
          await new Promise((resolveImage) => {
            image.addEventListener('load', resolveImage, { once: true });
            image.addEventListener('error', resolveImage, { once: true });
          });
        }
        return image.naturalWidth > 0;
      });
      if (!imageReady) throw new Error(`${homeLabel} rendered a collection card without its image.`);
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs > 2_000) {
        throw new Error(
          `${homeLabel} took ${elapsedMs} ms to render an interactive card and image; the parity budget is 2000 ms.`,
        );
      }

      if (homeLabel === 'Caught') {
        await clearTag.click();
        const confirmation = page.getByTestId('native-confirmation-dialog');
        await confirmation.waitFor({ state: 'visible', timeout: 5_000 });
        await recordInteractionPerformance(
          page,
          'interaction.collection.clear-tag-dialog',
        );
        await confirmation.getByText(
          'Clear the Caught tag? This returns you to browsing all available Pokémon and forms in Pokémon GO, without using your personal tag lists.',
          { exact: true },
        ).waitFor({ state: 'visible' });
        await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
        await clearTag.waitFor({ state: 'visible' });
      }

      await openActionMenu(page);
      await visibleTestId(page, 'native-action-menu-destination-home').click();
      await assertNativeDestination(page, '/native', 'native-home-screen');
      const homeScreenCount = await page.getByTestId('native-home-screen').count();
      if (homeScreenCount !== 1) {
        throw new Error(`${homeLabel} retained ${homeScreenCount} Home route trees instead of one.`);
      }
    }
  } catch (error) {
    await page.screenshot({
      fullPage: true,
      path: join(artifactDirectory, 'dark-signed-in-home-collection-workflow-failure.png'),
    }).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[home/collection workflow] ${message}`);
  } finally {
    await page.close();
  }
};

const assertSignedInCollectionWorkflow = async (context) => {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/native/collection`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-collection-hub').waitFor({ state: 'visible', timeout: 25_000 });
    await waitForRouteToSettle(page);

    // The canonical default is the complete catalog, not an arbitrary mixture
    // of system tags. Selecting a blueprint enters the organizer workflow.
    await page.getByRole('tab', { name: /POKÉMON/ }).waitFor({ state: 'visible' });
    const firstCatalogCard = page.getByTestId(/^parity-card-0001-default$/).first();
    await firstCatalogCard.waitFor({ state: 'visible', timeout: 15_000 });
    await firstCatalogCard.click();
    await page.getByLabel('Add (1)', { exact: true }).waitFor({ state: 'visible' });
    await recordInteractionPerformance(page, 'interaction.collection.selection');
    await page.getByLabel('Add (1)', { exact: true }).click();
    await page.getByText('Add Pokémon', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
    await recordInteractionPerformance(page, 'interaction.collection.organizer');
    await page.getByLabel('Close Pokémon organizer', { exact: true }).click();
    await page.waitForFunction(() => {
      const organizer = document.querySelector('[data-testid="native-pokemon-organizer"]');
      return organizer && getComputedStyle(organizer).pointerEvents === 'none';
    }, null, { timeout: 10_000 });
    await page.getByRole('button', { name: 'X', exact: true }).click();

    // Vite keeps the controlled input urgent and runs the collection search
    // as a transition. Exercise that exact real route before tag navigation so
    // a future change cannot make typing block behind the 3,000-entry catalog.
    const collectionSearch = page.getByLabel('Search Pokémon', { exact: true });
    await collectionSearch.click();
    await page.getByLabel('Pokémon search filters', { exact: true })
      .waitFor({ state: 'visible', timeout: 5_000 });
    await recordInteractionPerformance(page, 'interaction.collection.search-open');
    const shinyFilter = visibleTestId(page, 'native-collection-filter-shiny');
    await shinyFilter.click();
    await page.locator('[data-testid="parity-card-0001-shiny"]:visible').first()
      .waitFor({ state: 'visible', timeout: 5_000 });
    await recordInteractionPerformance(page, 'interaction.collection.filter');
    await recordInteractionPerformance(page, 'interaction.collection.query-result');
    await page.getByLabel('Clear Pokémon search', { exact: true }).click();
    await firstCatalogCard.waitFor({ state: 'visible', timeout: 5_000 });
    if (performanceMode) {
      await page.evaluate(() => {
        window.__nativeCollectionSearchProbe = { inputAt: null };
        document.addEventListener('input', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLInputElement)
              || target.getAttribute('aria-label') !== 'Search Pokémon') return;
          window.__nativeCollectionSearchProbe.inputAt = performance.now();
        }, { capture: true });
      });
    }
    await collectionSearch.pressSequentially('Ivysaur');
    const ivysaurResult = page.getByRole('button', { name: /Select Ivysaur/ }).first();
    await ivysaurResult.waitFor({ state: 'visible', timeout: 5_000 });
    await recordInteractionPerformance(page, 'interaction.collection.typed-query');
    if (performanceMode) {
      const searchResultMs = await page.evaluate(() => {
        const inputAt = window.__nativeCollectionSearchProbe?.inputAt;
        return inputAt == null ? null : performance.now() - inputAt;
      });
      console.log(
        `[collection workflow] dispatched search painted Ivysaur in ${searchResultMs} ms.`,
      );
      if (searchResultMs == null || searchResultMs > 150) {
        throw new Error(`Collection search did not react within 150 ms: ${searchResultMs}.`);
      }
    }
    await page.getByText('SHOW EVOLUTIONARY LINE', { exact: true }).click();
    await page.locator('[data-testid="parity-card-0001-default"]:visible').first()
      .waitFor({ state: 'visible', timeout: 5_000 });
    await recordInteractionPerformance(page, 'interaction.collection.evolution-result');
    await page.getByLabel('Clear Pokémon search', { exact: true }).click();
    await page.getByLabel('Close Pokémon search', { exact: true }).click();
    await firstCatalogCard.waitFor({ state: 'visible', timeout: 5_000 });

    await page.getByLabel(/^Sort by /).click();
    await page.getByTestId('native-collection-sort-menu')
      .waitFor({ state: 'visible', timeout: 5_000 });
    await recordInteractionPerformance(page, 'interaction.collection.sort-open');
    await page.getByText('NAME', { exact: true }).click();
    await page.getByRole('button', { name: /Select Abomasnow/ }).first()
      .waitFor({ state: 'visible', timeout: 5_000 });
    await recordInteractionPerformance(page, 'interaction.collection.sort-result');

    // System-tag selection must carry its context into the catalog header and
    // survive an instance-overlay push/back cycle.
    await page.getByRole('tab', { name: 'TAGS', exact: true }).click();
    await page.getByLabel(/^Open All Caught, \d+ Pokémon$/).waitFor({ state: 'visible', timeout: 10_000 });
    const tradeTag = page.getByLabel(/^Open For Trade, \d+ Pokémon$/).first();
    await tradeTag.waitFor({ state: 'visible', timeout: 10_000 });
    if (performanceMode) {
      await page.evaluate(() => {
        const track = document.querySelector('[data-testid="native-horizontal-page-track"]');
        if (!(track instanceof HTMLElement)) return;
        const probe = {
          baseline: getComputedStyle(track).transform,
          pressAt: null,
          samples: [],
        };
        window.__nativeCollectionMotionProbe = probe;
        document.addEventListener('pointerdown', (event) => {
          const target = event.target instanceof Element
            ? event.target.closest('[aria-label^="Open For Trade"]')
            : null;
          if (target) probe.pressAt = performance.now();
        }, { capture: true, once: true });
        const sample = (timestamp) => {
          if (probe.pressAt != null) {
            probe.samples.push({
              timestamp,
              transform: getComputedStyle(track).transform,
            });
          }
          if (probe.pressAt == null || timestamp - probe.pressAt < 500) {
            requestAnimationFrame(sample);
          }
        };
        requestAnimationFrame(sample);
      });
    }
    const tagStartedAt = Date.now();
    await tradeTag.click();
    const firstTradeCard = page.getByTestId(/^parity-card-/).first();
    await firstTradeCard.waitFor({ state: 'visible', timeout: 10_000 });
    const tagElapsedMs = Date.now() - tagStartedAt;
    console.log(`[collection workflow] For Trade tag painted an interactive result in ${tagElapsedMs} ms.`);
    await recordInteractionPerformance(page, 'interaction.collection.tag-result');
    if (tagElapsedMs > 750) {
      throw new Error(
        `For Trade tag took ${tagElapsedMs} ms to paint an interactive result; the parity budget is 750 ms.`,
      );
    }
    if (performanceMode) {
      const dispatchedResultMs = await page.evaluate(() => {
        const pressAt = window.__nativeCollectionMotionProbe?.pressAt;
        return pressAt == null ? null : performance.now() - pressAt;
      });
      console.log(
        `[collection workflow] dispatched tap painted the first result in ${dispatchedResultMs} ms.`,
      );
      if (dispatchedResultMs == null || dispatchedResultMs > 150) {
        throw new Error(`For Trade result did not react within 150 ms: ${dispatchedResultMs}.`);
      }
      // The first destination pixel is enough for Playwright's visibility
      // check. Let the canonical 300 ms transition finish before judging its
      // frame cadence.
      await page.waitForTimeout(450);
      const motion = await page.evaluate(() => {
        const probe = window.__nativeCollectionMotionProbe;
        if (!probe?.samples.length || probe.pressAt == null) return null;
        const firstMotionIndex = probe.samples.findIndex(
          (sample) => sample.transform !== probe.baseline,
        );
        const motionSamples = firstMotionIndex < 0
          ? []
          : probe.samples.slice(firstMotionIndex);
        const frameGaps = motionSamples.slice(1).map(
          (sample, index) => sample.timestamp - motionSamples[index].timestamp,
        );
        return {
          distinctPositions: new Set(motionSamples.map((sample) => sample.transform)).size,
          durationMs: motionSamples.length > 1
            ? motionSamples.at(-1).timestamp - motionSamples[0].timestamp
            : 0,
          firstMotionMs: firstMotionIndex < 0
            ? null
            : motionSamples[0].timestamp - probe.pressAt,
          maxFrameGapMs: frameGaps.length ? Math.max(...frameGaps) : null,
          sampleCount: motionSamples.length,
        };
      });
      console.log('[collection workflow] production motion profile', motion);
      if (!motion || motion.firstMotionMs == null || motion.firstMotionMs > 150) {
        throw new Error(`For Trade motion did not begin within 150 ms: ${JSON.stringify(motion)}.`);
      }
      if (motion.distinctPositions < 12) {
        throw new Error(`For Trade motion produced too few visual steps: ${JSON.stringify(motion)}.`);
      }
      if (motion.maxFrameGapMs == null || motion.maxFrameGapMs > 80) {
        throw new Error(`For Trade motion dropped an excessive frame gap: ${JSON.stringify(motion)}.`);
      }
      addPerformanceMetric(
        'interaction.collection.tag-slide',
        'interaction_ready_ms',
        motion.firstMotionMs,
      );
    }
    // Vite intentionally delays only the side-panel/header tag identity until
    // its 300 ms track transition is complete. Keep that parity assertion, but
    // do not mislabel the deliberate header delay as result-paint latency.
    await page.getByText('(TRADE)', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
    await firstTradeCard.click();
    await page.getByTestId('native-instance-overlay').waitFor({ state: 'visible', timeout: 25_000 });
    const instanceSurface = page.getByTestId('native-instance-swipe-surface');
    const initialInstanceText = await instanceSurface.evaluate(
      (surface) => surface.textContent ?? '',
    );
    await page.getByTestId('native-instance-next').click();
    await page.waitForFunction((before) => {
      const surface = document.querySelector('[data-testid="native-instance-swipe-surface"]');
      return Boolean(surface?.textContent && surface.textContent !== before);
    }, initialInstanceText, { timeout: 10_000 });
    await recordInteractionPerformance(page, 'interaction.instance.navigate');
    await page.getByTestId('native-instance-previous').click();
    await page.waitForFunction((before) => {
      const surface = document.querySelector('[data-testid="native-instance-swipe-surface"]');
      return surface?.textContent === before;
    }, initialInstanceText, { timeout: 10_000 });
    await recordInteractionPerformance(page, 'interaction.instance.navigate');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-collection-hub').waitFor({ state: 'visible', timeout: 25_000 });
    await page.getByText('(TRADE)', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });

    // The two adjacent side panels remain reachable through their canonical
    // tabs after a route round-trip.
    await page.getByRole('tab', { name: 'WISHLIST', exact: true }).click();
    await page.getByLabel(/^Open All Wanted, \d+ Pokémon$/).waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('tab', { name: /POKÉMON/ }).click();
    await page.getByText('(TRADE)', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });

    const overflow = await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    ) - window.innerWidth);
    if (overflow > 2) throw new Error(`Collection workflow overflows the viewport by ${overflow}px.`);
  } catch (error) {
    await page.screenshot({
      fullPage: true,
      path: join(artifactDirectory, 'dark-signed-in-collection-workflow-failure.png'),
    }).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[collection workflow] ${message}`);
  } finally {
    await page.close();
  }
};

const assertSignedInSearchWorkflow = async (context) => {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/native/search`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-search-route').waitFor({ state: 'visible', timeout: 25_000 });
    await waitForRouteToSettle(page);

    // Execute the real Pokémon search workflow and prove that opening a
    // listing preserves the submitted result set when browser Back returns.
    await page.getByLabel('Choose Pokémon', { exact: true }).click();
    await page.getByTestId('native-option-picker').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByLabel('Search Choose a Pokémon', { exact: true }).fill('Bulbasaur');
    await page.getByRole('radio').filter({ hasText: /^Bulbasaur/ }).first().click();
    await page.getByRole('button', { name: 'For Trade', exact: true }).click();
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByRole('tab', { name: 'Location', exact: true }).click();
    await page.getByRole('button', { name: 'Use saved location', exact: true }).click();
    await page.getByRole('button', { name: /^Apply & search/ }).click();
    await page.getByText('SEARCH COMPLETE', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByText('NexusFriend', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: /Open listing/ }).click();
    await page.getByTestId('native-instance-overlay').waitFor({ state: 'visible', timeout: 25_000 });
    await page.getByTestId('native-instance-swipe-surface')
      .getByText('FOR TRADE', { exact: true })
      .waitFor({ state: 'visible', timeout: 10_000 });
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-search-route').waitFor({ state: 'visible', timeout: 25_000 });
    await page.getByText('SEARCH COMPLETE', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });

    // Trainer discovery searches both app username and Pokémon GO name and
    // retains its query/results through a profile route round-trip.
    await page.getByRole('tab', { name: 'Trainer search', exact: true }).click();
    const trainerInput = page.getByLabel('Trainer name', { exact: true });
    await trainerInput.fill('Nexus');
    await page.getByText('Nexus · @NexusFriend', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /View profile/ }).click();
    await page.getByTestId('native-trainer-profile').waitFor({ state: 'visible', timeout: 20_000 });
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-search-route').waitFor({ state: 'visible', timeout: 25_000 });
    await page.getByRole('tab', { name: 'Trainer search', exact: true }).waitFor({ state: 'visible' });
    await page.getByText('Nexus · @NexusFriend', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });

    const overflow = await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    ) - window.innerWidth);
    if (overflow > 2) throw new Error(`Search workflow overflows the viewport by ${overflow}px.`);
  } catch (error) {
    await page.screenshot({
      fullPage: true,
      path: join(artifactDirectory, 'dark-signed-in-search-workflow-failure.png'),
    }).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[search workflow] ${message}`);
  } finally {
    await page.close();
  }
};

const assertSignedInTradesWorkflow = async (context) => {
  routeTrade = { ...initialRouteTrade };
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/native/trades`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-trades-hub').waitFor({ state: 'visible', timeout: 25_000 });
    await waitForRouteToSettle(page);

    // Preferences are the canonical first section. Entering and leaving edit
    // mode must be possible without changing the active listing.
    await page.getByTestId('native-trade-preferences-screen').waitFor({ state: 'visible', timeout: 15_000 });
    const editPreferences = page.getByRole('button', { name: 'Edit preferences', exact: true }).first();
    await editPreferences.waitFor({ state: 'visible', timeout: 10_000 });
    await editPreferences.click();
    await page.getByTestId('trade-preferences-save').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByTestId('trade-preferences-save').waitFor({ state: 'hidden', timeout: 10_000 });

    // A server-authoritative cancellation must immediately leave Sent and
    // enter Closed, with explicit confirmation and success feedback.
    await page.getByRole('tab', { name: 'Trade Activity', exact: true }).click();
    await page.getByTestId('native-trade-activity-screen').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByTestId('trade-filter-Proposed').click();
    await page.getByTestId('trade-card-native-route-trade').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByLabel('5 of 5 friendship hearts, remote trade available', { exact: true })
      .waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: 'Cancel proposal', exact: true }).click();
    await page.getByTestId('trade-action-confirmation').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: 'Cancel trade', exact: true }).click();
    await page.getByTestId('trade-activity-feedback').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByText('Trade updated from the server response.', { exact: true })
      .waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByTestId('trade-card-native-route-trade').waitFor({ state: 'hidden', timeout: 10_000 });
    await page.getByTestId('trade-filter-Cancelled').click();
    await page.getByTestId('trade-card-native-route-trade').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByText('CLOSED', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });

    const overflow = await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    ) - window.innerWidth);
    if (overflow > 2) throw new Error(`Trades workflow overflows the viewport by ${overflow}px.`);
  } catch (error) {
    await page.screenshot({
      fullPage: true,
      path: join(artifactDirectory, 'dark-signed-in-trades-workflow-failure.png'),
    }).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[trades workflow] ${message}`);
  } finally {
    await page.close();
  }
};

const assertSignedInFriendsWorkflow = async (context) => {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/native/friends`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-friends-route').waitFor({ state: 'visible', timeout: 25_000 });
    await waitForRouteToSettle(page);
    await page.getByRole('button', { name: 'Open NexusFriend\'s profile', exact: true })
      .waitFor({ state: 'visible', timeout: 10_000 });

    await page.getByRole('tab', { name: 'Find view', exact: true }).click();
    await page.getByLabel('Trainer name', { exact: true }).fill('Nexus');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByLabel('Add NexusFriend', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: 'Open NexusFriend\'s profile', exact: true }).click();
    await page.getByTestId('native-trainer-profile').waitFor({ state: 'visible', timeout: 20_000 });
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-friends-route').waitFor({ state: 'visible', timeout: 25_000 });
    await page.getByRole('tab', { name: 'Find view', exact: true })
      .waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByLabel('Add NexusFriend', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });

    const overflow = await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    ) - window.innerWidth);
    if (overflow > 2) throw new Error(`Friends workflow overflows the viewport by ${overflow}px.`);
  } catch (error) {
    await page.screenshot({
      fullPage: true,
      path: join(artifactDirectory, 'dark-signed-in-friends-workflow-failure.png'),
    }).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[friends workflow] ${message}`);
  } finally {
    await page.close();
  }
};

const assertSignedInProfileWorkflow = async (context) => {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/native/profile`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-trainer-profile').waitFor({ state: 'visible', timeout: 25_000 });
    await waitForRouteToSettle(page);

    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByTestId('native-profile-editor').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByLabel('Trainer level', { exact: true }).fill('49');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await page.getByText('Profile updated.', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByTestId('native-profile-editor').waitFor({ state: 'hidden', timeout: 10_000 });
    await page.getByTestId('native-trainer-profile').getByText('49', { exact: true })
      .waitFor({ state: 'visible', timeout: 10_000 });

    await page.getByRole('tab', { name: 'Friends', exact: true }).click();
    await assertNativeDestination(page, '/native/friends', 'native-friends-route');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-trainer-profile').waitFor({ state: 'visible', timeout: 25_000 });

    const overflow = await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    ) - window.innerWidth);
    if (overflow > 2) throw new Error(`Profile workflow overflows the viewport by ${overflow}px.`);
  } catch (error) {
    await page.screenshot({
      fullPage: true,
      path: join(artifactDirectory, 'dark-signed-in-profile-workflow-failure.png'),
    }).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[profile workflow] ${message}`);
  } finally {
    await page.close();
  }
};

const assertSignedInSettingsAccountWorkflow = async (context) => {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/native/settings`, { timeout: 60_000, waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-trainer-settings-screen').waitFor({ state: 'visible', timeout: 25_000 });
    await waitForRouteToSettle(page);

    await page.getByRole('button', { name: 'Profile visibility, Everyone', exact: true }).click();
    await page.getByTestId('native-option-picker').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('radio', { name: 'Select Friends only', exact: true }).click();
    await page.getByRole('button', { name: 'Save privacy', exact: true }).click();
    await page.getByText('Privacy settings saved.', { exact: true })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('switch', { name: /Use (?:light|dark) theme/ }).click();

    await page.getByRole('tab', { name: 'Account', exact: true }).click();
    await assertNativeDestination(page, '/native/account', 'native-account-security-screen');
    await page.getByLabel('Current password', { exact: true }).first()
      .waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: 'Disconnect Google', exact: true }).click();
    const confirmation = page.getByTestId('native-confirmation-dialog');
    await confirmation.waitFor({ state: 'visible', timeout: 10_000 });
    await confirmation.getByLabel('Current password', { exact: true }).fill('route-password');
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await confirmation.waitFor({ state: 'hidden', timeout: 10_000 });

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-trainer-settings-screen').waitFor({ state: 'visible', timeout: 25_000 });

    const overflow = await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    ) - window.innerWidth);
    if (overflow > 2) throw new Error(`Settings/account workflow overflows the viewport by ${overflow}px.`);
  } catch (error) {
    await page.screenshot({
      fullPage: true,
      path: join(artifactDirectory, 'dark-signed-in-settings-account-workflow-failure.png'),
    }).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[settings/account workflow] ${message}`);
  } finally {
    await page.close();
  }
};

const assertSignedInTradeBoardWorkflow = async (context) => {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/native/trade-board`, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    const screen = page.getByTestId('native-trade-board-screen');
    await screen.waitFor({ state: 'visible', timeout: 25_000 });
    await page.getByText('Share your Trade Board', { exact: true }).waitFor({
      state: 'visible',
      timeout: 25_000,
    });

    const wanted = page.getByTestId('native-trade-board-section-wanted');
    await wanted.click();
    if (await wanted.getAttribute('aria-checked') !== 'false') {
      throw new Error('Trade Board did not hide the requested Looking For section.');
    }
    await recordInteractionPerformance(page, 'interaction.trade-board.section-result');

    const lightTheme = page.getByTestId('native-trade-board-theme-brand-light');
    await lightTheme.click();
    if (await lightTheme.getAttribute('aria-checked') !== 'true') {
      throw new Error('Trade Board did not commit the Nexus Light theme.');
    }
    await recordInteractionPerformance(page, 'interaction.trade-board.theme-result');

    const identity = page.getByTestId('native-trade-board-show-pokemon-go-name');
    await identity.click();
    if (await identity.getAttribute('aria-checked') !== 'false') {
      throw new Error('Trade Board did not hide the Pokémon GO name.');
    }
    await page.getByTestId('native-trade-board').getByText(/^Pokémon GO:/).first()
      .waitFor({ state: 'hidden', timeout: 10_000 });
    await recordInteractionPerformance(page, 'interaction.trade-board.identity-result');

    await page.getByRole('button', { name: 'Copy live link', exact: true }).click();
    await page.getByText('Live Trade Board link copied.', { exact: true }).waitFor({
      state: 'visible',
      timeout: 10_000,
    });
    await recordInteractionPerformance(page, 'interaction.trade-board.copy-result');
    await page.screenshot({
      fullPage: true,
      path: join(artifactDirectory, 'dark-signed-in-trade-board-workflow.png'),
    });
  } catch (error) {
    await page.screenshot({
      fullPage: true,
      path: join(artifactDirectory, 'dark-signed-in-trade-board-workflow-failure.png'),
    }).catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[trade-board workflow] ${message}`);
  } finally {
    await page.close();
  }
};

const runContext = async (browser, { authState, routes, theme }) => {
  const context = await browser.newContext({
    colorScheme: theme,
    viewport: { height: 915, width: 412 },
  });
  const unhandledApis = new Set();
  const runtimeErrors = [];
  context.on('page', (page) => trackRuntimeErrors(page, runtimeErrors));
  await installRoutes(context, unhandledApis);
  if (performanceMode) {
    await context.addInitScript(() => {
      const state = {
        frameTimes: [],
        longTasks: [],
        largestContentfulPaint: null,
        lastInputAt: null,
        lastPointerDownAt: null,
        measurementStartedAt: 0,
      };
      Object.defineProperty(window, '__performanceParityProbe', {
        configurable: true,
        value: state,
      });
      document.addEventListener('pointerdown', () => {
        state.lastPointerDownAt = performance.now();
      }, { capture: true });
      document.addEventListener('click', () => {
        state.lastInputAt = performance.now();
      }, { capture: true });
      document.addEventListener('input', () => {
        state.lastInputAt = performance.now();
      }, { capture: true });
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
        }).observe({ type: 'longtask', buffered: true });
      } catch {
        // React Native Web can run in browsers without the Long Task API.
      }
      try {
        new PerformanceObserver((list) => {
          const last = list.getEntries().at(-1);
          if (last) state.largestContentfulPaint = last.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // LCP is diagnostic and optional.
      }
      const frame = (timestamp) => {
        state.frameTimes.push(timestamp);
        if (state.frameTimes.length > 2_000) state.frameTimes.shift();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }
  await context.addInitScript(({ key, origin, signedIn }) => {
    // New pages begin at an opaque about:blank origin with no localStorage.
    // Seed only the app document, not that initial page or unrelated frames.
    if (window.location.origin !== origin) return;
    window.localStorage.clear();
    if (signedIn) window.localStorage.setItem(key, 'native-real-route-refresh-token');
  }, { key: refreshTokenKey, origin: baseUrl, signedIn: authState === 'signed-in' });
  try {
    for (const routeCase of routes.filter(([path]) => {
      const scenarioId = routeScenarioId(path, authState);
      return !workflowsOnly && routeMatchesFilter(path, scenarioId);
    })) {
      const page = await context.newPage();
      try {
        await assertRoute(page, routeCase, theme, authState);
      } catch (error) {
        const [path] = routeCase;
        const safeName = path.replace(/^\//, '').replace(/[/?=&]/g, '-');
        await page.screenshot({
          fullPage: true,
          path: join(artifactDirectory, `${theme}-${authState}-${safeName}-failure.png`),
        }).catch(() => undefined);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`[${theme}/${authState}] ${path}\n${message}`);
      } finally {
        await page.close();
      }
    }
    const shouldRunWorkflow = (name) => !workflowFilter || name === workflowFilter;
    if (!routeFilter && performanceMode && authState === 'guest' && theme === 'dark'
        && shouldRunWorkflow('home')) {
      await assertGuestHomePerformanceWorkflow(context);
    }
    if (!routeFilter && performanceMode && authState === 'guest' && theme === 'dark'
        && shouldRunWorkflow('information')) {
      await assertGuestInformationPerformanceWorkflow(context);
    }
    if (!routeFilter && authState === 'signed-in' && theme === 'dark') {
      if (performanceMode && shouldRunWorkflow('home')) {
        await assertSignedInHomePerformanceWorkflow(context);
      }
      if (shouldRunWorkflow('action-menu')) await assertSignedInActionMenuNavigation(context);
      if (shouldRunWorkflow('home-collection')) await assertSignedInHomeCollectionWorkflow(context);
      if (shouldRunWorkflow('collection')) await assertSignedInCollectionWorkflow(context);
      if (shouldRunWorkflow('search')) await assertSignedInSearchWorkflow(context);
      if (shouldRunWorkflow('trades')) await assertSignedInTradesWorkflow(context);
      if (shouldRunWorkflow('friends')) await assertSignedInFriendsWorkflow(context);
      if (shouldRunWorkflow('profile')) await assertSignedInProfileWorkflow(context);
      if (shouldRunWorkflow('trade-board')) await assertSignedInTradeBoardWorkflow(context);
      if (shouldRunWorkflow('settings-account')) {
        await assertSignedInSettingsAccountWorkflow(context);
      }
    }
    if (unhandledApis.size > 0) {
      throw new Error(`Real-route smoke encountered unhandled APIs:\n${[...unhandledApis].sort().join('\n')}`);
    }
    if (runtimeErrors.length > 0) {
      throw new Error(`Real-route smoke encountered runtime errors:\n${[...new Set(runtimeErrors)].join('\n')}`);
    }
  } finally {
    await context.close();
  }
};

const warmPerformanceBundle = async (browser) => {
  if (!performanceMode) return;
  const context = await browser.newContext({
    colorScheme: 'dark',
    viewport: { height: 915, width: 412 },
  });
  const unhandledApis = new Set();
  await installRoutes(context, unhandledApis);
  const page = await context.newPage();
  try {
    // Expo's production-mode development server compiles its web bundle on
    // the first browser request. That server compilation does not exist in an
    // installed native bundle, so complete it before opening any measured
    // context. Each recorded route still receives a fresh browser context and
    // pays its own JavaScript parse, application boot, data, and render work.
    await page.goto(`${baseUrl}/native`, { timeout: 180_000, waitUntil: 'domcontentloaded' });
    await page.getByTestId('native-guest-home-screen').waitFor({
      state: 'visible',
      timeout: 180_000,
    });
    await waitForRouteToSettle(page);
  } finally {
    await context.close();
  }
};

const run = async () => {
  mkdirSync(artifactDirectory, { recursive: true });
  if (!routeFilter && !workflowsOnly) {
    for (const filename of readdirSync(artifactDirectory)) {
      if (filename.endsWith('.png')) unlinkSync(join(artifactDirectory, filename));
    }
  }
  const expo = await startExpo();
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.E2E_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.E2E_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  try {
    await warmPerformanceBundle(browser);
    for (let repetition = 0; repetition < performanceRepetitions; repetition += 1) {
      for (const theme of workflowsOnly ? ['dark'] : ['dark', 'light']) {
        if (!workflowsOnly) {
          await runContext(browser, { authState: 'guest', routes: guestRoutes, theme });
        } else if (workflowFilter === 'home' || workflowFilter === 'information') {
          await runContext(browser, { authState: 'guest', routes: guestRoutes, theme });
        }
        await runContext(browser, { authState: 'signed-in', routes: signedInRoutes, theme });
      }
    }
  } finally {
    await browser.close();
    expo.kill('SIGTERM');
  }
  if (performanceMode) {
    mkdirSync(dirname(performanceReportPath), { recursive: true });
    writeFileSync(performanceReportPath, `${JSON.stringify({
      schemaVersion: 1,
      implementation: 'native-web',
      profile: 'browser-proxy',
      createdAt: new Date().toISOString(),
      commit: process.env.GITHUB_SHA ?? null,
      environment: {
        browser: 'chromium',
        project: 'react-native-web',
        viewport: '412x915',
        repetitions: performanceRepetitions,
        workloadId: 'canonical-performance-fixtures-v1',
        catalogEntries: catalog.length,
        instanceEntries: Object.keys(instances).length,
        pvpEntries: Object.values(pvpPayload.leagues).reduce(
          (total, league) => total + league.entries.length,
          0,
        ),
      },
      samples: performanceSamples,
    }, null, 2)}\n`);
    process.stdout.write(`Performance report: ${performanceReportPath}\n`);
  }
  const routeCount = [
    ...guestRoutes.map((route) => ({ authState: 'guest', route })),
    ...signedInRoutes.map((route) => ({ authState: 'signed-in', route })),
  ].filter(({ authState, route: [path] }) => {
    const scenarioId = routeScenarioId(path, authState);
    return routeMatchesFilter(path, scenarioId);
  }).length;
  process.stdout.write(workflowsOnly
    ? 'Native real-route workflow smoke passed.\n'
    : `Native real-route smoke passed ${2 * routeCount * performanceRepetitions} route/theme states.\n`);
};

await run();
