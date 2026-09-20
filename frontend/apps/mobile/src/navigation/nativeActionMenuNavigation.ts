import { resolveNativeDeepLink } from './nativeDeepLink';

export type NativeActionMenuPath = '/' | '/about' | '/data-deletion' | '/faq' | '/getting-started' | '/help' | '/login' | '/max' | '/pokedex' | '/pokemon' | '/privacy' | '/profile' | '/profile/friends' | '/pvp' | '/pvp/methodology' | '/raid' | '/raid/methodology' | '/rankings' | '/register' | '/safety' | '/search' | '/settings' | '/terms' | '/trade-board' | '/trades';
export type ReadyNativePath = '/native' | '/native/account' | '/native/collection' | '/native/friends' | '/native/info/about' | '/native/info/data-deletion' | '/native/info/faq' | '/native/info/getting-started' | '/native/info/help' | '/native/info/privacy' | '/native/info/safety' | '/native/info/terms' | '/native/login' | '/native/max' | '/native/pokedex' | '/native/profile' | '/native/pvp' | '/native/pvp-methodology' | '/native/raid' | '/native/raid-methodology' | '/native/rankings' | '/native/register' | '/native/search' | '/native/settings' | '/native/trade-board' | '/native/trades';
export type NativeLoginReturnPath = ReadyNativePath
  | `${ReadyNativePath}?${string}`
  | `/native/profile/${string}`
  | `/native/collection/${string}`
  | `/native/collection/catalog/${string}`
  | `/native/collection/trainer/${string}`
  | `/native/collection/trainer/${string}/${string}`
  | `/native/pokedex/${string}`
  | `/native/trade-board/${string}`;

const POST_LOGIN_STATIC_PATHS = new Set<ReadyNativePath>([
  '/native',
  '/native/account',
  '/native/collection',
  '/native/friends',
  '/native/info/about',
  '/native/info/data-deletion',
  '/native/info/faq',
  '/native/info/getting-started',
  '/native/info/help',
  '/native/info/privacy',
  '/native/info/safety',
  '/native/info/terms',
  '/native/max',
  '/native/pokedex',
  '/native/profile',
  '/native/pvp',
  '/native/pvp-methodology',
  '/native/raid',
  '/native/raid-methodology',
  '/native/rankings',
  '/native/search',
  '/native/settings',
  '/native/trade-board',
  '/native/trades',
]);

export type NativeActionMenuDestination =
  | { kind: 'current' }
  | { kind: 'native'; pathname: ReadyNativePath }
  | { kind: 'web'; path: string };

const NATIVE_DESTINATIONS: Record<NativeActionMenuPath, NativeActionMenuDestination> = {
  '/': { kind: 'native', pathname: '/native' },
  '/about': { kind: 'native', pathname: '/native/info/about' },
  '/data-deletion': { kind: 'native', pathname: '/native/info/data-deletion' },
  '/faq': { kind: 'native', pathname: '/native/info/faq' },
  '/getting-started': { kind: 'native', pathname: '/native/info/getting-started' },
  '/help': { kind: 'native', pathname: '/native/info/help' },
  '/login': { kind: 'native', pathname: '/native/login' },
  '/max': { kind: 'native', pathname: '/native/max' },
  '/pokedex': { kind: 'native', pathname: '/native/pokedex' },
  '/pokemon': { kind: 'native', pathname: '/native/collection' },
  '/privacy': { kind: 'native', pathname: '/native/info/privacy' },
  '/profile': { kind: 'native', pathname: '/native/profile' },
  '/profile/friends': { kind: 'native', pathname: '/native/friends' },
  '/pvp': { kind: 'native', pathname: '/native/pvp' },
  '/pvp/methodology': { kind: 'native', pathname: '/native/pvp-methodology' },
  '/raid': { kind: 'native', pathname: '/native/raid' },
  '/raid/methodology': { kind: 'native', pathname: '/native/raid-methodology' },
  '/rankings': { kind: 'native', pathname: '/native/rankings' },
  '/register': { kind: 'native', pathname: '/native/register' },
  '/safety': { kind: 'native', pathname: '/native/info/safety' },
  '/search': { kind: 'native', pathname: '/native/search' },
  '/settings': { kind: 'native', pathname: '/native/settings' },
  '/terms': { kind: 'native', pathname: '/native/info/terms' },
  '/trade-board': { kind: 'native', pathname: '/native/trade-board' },
  '/trades': { kind: 'native', pathname: '/native/trades' },
};

const isNativeActionMenuPath = (path: string): path is NativeActionMenuPath => (
  Object.prototype.hasOwnProperty.call(NATIVE_DESTINATIONS, path)
);

export const resolveNativeActionMenuDestination = (
  path: string,
  currentPath?: string,
): NativeActionMenuDestination => {
  if (path === currentPath) return { kind: 'current' };
  if (isNativeActionMenuPath(path)) return NATIVE_DESTINATIONS[path];
  return { kind: 'web', path };
};

export const resolveNativeLoginReturnTo = (
  requestedPath?: string,
): NativeLoginReturnPath => {
  if (!requestedPath?.trim()) return '/native';

  // Login links may originate in the canonical Vite app, a native route, or
  // an external deep link. Normalize all three through the same allowlisted
  // mapper before validating the post-authentication destination.
  const normalized = resolveNativeDeepLink(requestedPath);
  const [pathname = '/native'] = normalized.split('?');
  if (POST_LOGIN_STATIC_PATHS.has(pathname as ReadyNativePath)) {
    return normalized as NativeLoginReturnPath;
  }
  if (/^\/native\/profile\/[^/]+$/.test(pathname)) {
    return normalized as `/native/profile/${string}`;
  }
  if (/^\/native\/collection\/catalog\/[^/]+$/.test(pathname)) {
    return normalized as `/native/collection/catalog/${string}`;
  }
  if (/^\/native\/collection\/trainer\/[^/]+\/[^/]+$/.test(pathname)) {
    return normalized as `/native/collection/trainer/${string}/${string}`;
  }
  if (/^\/native\/collection\/trainer\/[^/]+$/.test(pathname)) {
    return normalized as `/native/collection/trainer/${string}`;
  }
  if (/^\/native\/collection\/[^/]+$/.test(pathname)) {
    return normalized as `/native/collection/${string}`;
  }
  if (/^\/native\/pokedex\/[^/]+$/.test(pathname)) {
    return normalized as `/native/pokedex/${string}`;
  }
  if (/^\/native\/trade-board\/[^/]+$/.test(pathname)) {
    return normalized as `/native/trade-board/${string}`;
  }
  return '/native';
};
