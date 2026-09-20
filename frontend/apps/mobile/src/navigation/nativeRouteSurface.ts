type NativeRouteSurface = {
  dark: string;
  light: string;
  compactDark?: string;
  compactLight?: string;
};

const DEFAULT_SURFACE: NativeRouteSurface = { dark: '#101a19', light: '#f8fff9' };

// The native Stack owns the physical status- and navigation-bar regions while
// each route owns its inset content. Matching both surfaces prevents a route
// from looking like a shorter rectangle floating between two system bands.
const ROUTE_SURFACES: Record<string, NativeRouteSurface> = {
  index: { dark: '#071012', light: '#f8fff9' },
  login: { dark: '#0f0f0f', light: '#f8fff9' },
  register: {
    dark: '#07111e',
    light: '#f8fff9',
    compactDark: '#202224',
    compactLight: '#eaf7f1',
  },
  'reset-password': { dark: '#0f0f0f', light: '#f8fff9' },
  'verify-email-change': { dark: '#06162f', light: '#f8fff9' },
  'not-found': { dark: '#06131d', light: '#f8fff9' },
  'info/[slug]': { dark: '#090d12', light: '#f8fff9' },
  'pokedex/index': { dark: '#090d12', light: '#f8fff9' },
  'pokedex/[variantId]': { dark: '#090d12', light: '#f8fff9' },
  rankings: { dark: '#0c1112', light: '#f5f2e9' },
  raid: { dark: '#071011', light: '#f8fff9' },
  'raid-methodology': { dark: '#0b1012', light: '#f8fff9' },
  max: { dark: '#090d0d', light: '#f8fff9' },
  pvp: { dark: '#0d1112', light: '#f8fff9' },
  'pvp-methodology': { dark: '#0b1012', light: '#f8fff9' },
  collection: { dark: '#111111', light: '#f8fff9' },
  'collection/[instanceId]': { dark: '#0f2b2b', light: '#f8fff9' },
  'collection/catalog/[variantId]': { dark: '#07110f', light: '#f8fff9' },
  'collection/trainer/[username]/index': { dark: '#111111', light: '#f8fff9' },
  'collection/trainer/[username]/[instanceId]': { dark: '#0f2b2b', light: '#f8fff9' },
  search: { dark: '#080d0f', light: '#f8fff9' },
  trades: { dark: '#071012', light: '#f8fff9' },
  'trade-board': { dark: '#071014', light: '#f8fff9' },
  'trade-board/[username]': { dark: '#071014', light: '#f8fff9' },
  settings: { dark: '#081012', light: '#f8fff9' },
  account: { dark: '#081012', light: '#f8fff9' },
  friends: { dark: '#080d0f', light: '#f8fff9' },
  'profile/index': { dark: '#081012', light: '#f8fff9' },
  'profile/[username]': { dark: '#081012', light: '#f8fff9' },
};

export const nativeRouteSurface = (
  routeName: string,
  light: boolean,
  compact = false,
): string => {
  const surface = ROUTE_SURFACES[routeName] ?? DEFAULT_SURFACE;
  if (compact) {
    if (light && surface.compactLight) return surface.compactLight;
    if (!light && surface.compactDark) return surface.compactDark;
  }
  return light ? surface.light : surface.dark;
};

const NATIVE_PATH_ROUTES: readonly (readonly [RegExp, string])[] = [
  // Device fixtures render the same production screens and provide a signed-in
  // collection without mutating a real account. Keep their outer window surface
  // identical so Android smoke tests exercise the production geometry.
  [/^\/device-smoke\/collection\/?$/, 'collection'],
  [/^\/native\/?$/, 'index'],
  [/^\/native\/info\/[^/]+\/?$/, 'info/[slug]'],
  [/^\/native\/pokedex\/?$/, 'pokedex/index'],
  [/^\/native\/pokedex\/[^/]+\/?$/, 'pokedex/[variantId]'],
  [/^\/native\/profile\/?$/, 'profile/index'],
  [/^\/native\/profile\/[^/]+\/?$/, 'profile/[username]'],
  [/^\/native\/trade-board\/[^/]+\/?$/, 'trade-board/[username]'],
  [/^\/native\/collection\/catalog\/[^/]+\/?$/, 'collection/catalog/[variantId]'],
  [/^\/native\/collection\/trainer\/[^/]+\/[^/]+\/?$/, 'collection/trainer/[username]/[instanceId]'],
  [/^\/native\/collection\/trainer\/[^/]+\/?$/, 'collection/trainer/[username]/index'],
  [/^\/native\/collection\/[^/]+\/?$/, 'collection/[instanceId]'],
  [/^\/native\/([^/]+)\/?$/, '$1'],
];

export const nativeRouteNameFromPath = (pathname: string): string | null => {
  for (const [pattern, routeName] of NATIVE_PATH_ROUTES) {
    const match = pathname.match(pattern);
    if (!match) continue;
    return routeName === '$1' ? match[1] ?? null : routeName;
  }
  return null;
};

/**
 * The root navigator, not the nested native navigator, owns Android's physical
 * status- and navigation-bar regions. Resolve the active pathname here so that
 * those regions always use the exact same surface as the visible native page.
 */
export const nativePathSurface = (
  pathname: string,
  light: boolean,
  compact = false,
): string => nativeRouteSurface(
  nativeRouteNameFromPath(pathname) ?? '__non-native__',
  light,
  compact,
);
