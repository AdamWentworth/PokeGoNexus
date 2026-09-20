const INFORMATION_PATHS = new Set([
  'about',
  'data-deletion',
  'faq',
  'getting-started',
  'help',
  'privacy',
  'safety',
  'terms',
]);

const preserveQuery = (pathname: string, query: string): string => (
  query ? `${pathname}?${query}` : pathname
);

const preserveFaqAnswer = (pathname: string, query: string, fragment: string): string => {
  if (!fragment) return preserveQuery(pathname, query);
  const params = new URLSearchParams(query);
  params.set('question', fragment);
  return preserveQuery(pathname, params.toString());
};

const canonicalSegment = (value: string): string => {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
};

const pathFromIncomingUrl = (incoming: string): { fragment: string; pathname: string; query: string } => {
  const trimmed = incoming.trim();
  if (!trimmed) return { fragment: '', pathname: '/', query: '' };
  try {
    const parsed = new URL(trimmed, 'https://pokegonexus.invalid');
    const schemeUsesHostAsPath = parsed.protocol === 'pokegonexus:' && parsed.hostname;
    const rawPathname = schemeUsesHostAsPath
      ? `/${parsed.hostname}${parsed.pathname}`
      : parsed.pathname;
    const pathname = rawPathname.startsWith('/--/')
      ? rawPathname.slice(3)
      : rawPathname;
    return {
      fragment: decodeURIComponent(parsed.hash.replace(/^#/, '')),
      pathname: pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/',
      query: parsed.searchParams.toString(),
    };
  } catch {
    const [pathAndQuery = '/', fragment = ''] = trimmed.split('#');
    const [pathname = '/', query = ''] = pathAndQuery.split('?');
    return {
      fragment,
      pathname: pathname.startsWith('/') ? pathname : `/${pathname}`,
      query,
    };
  }
};

export const resolveNativeDeepLink = (incoming: string): string => {
  const { fragment, pathname, query } = pathFromIncomingUrl(incoming);
  if (pathname === '/native' || pathname.startsWith('/native/')) {
    if (pathname === '/native/info/faq') return preserveFaqAnswer(pathname, query, fragment);
    return preserveQuery(pathname, query);
  }
  if (pathname === '/device-smoke' || pathname.startsWith('/device-smoke/')) {
    return preserveQuery(pathname, query);
  }
  if (pathname === '/') return '/native';
  if (pathname === '/login') return preserveQuery('/native/login', query);
  if (pathname === '/register') return preserveQuery('/native/register', query);
  if (pathname === '/reset-password') return preserveQuery('/native/reset-password', query);
  if (pathname === '/verify-email-change') {
    return preserveQuery('/native/verify-email-change', query);
  }
  if (pathname === '/friends' || pathname === '/profile/friends') return '/native/friends';
  if (pathname === '/account' || pathname === '/settings/account') {
    return preserveQuery('/native/account', query);
  }
  if (pathname === '/settings') return '/native/settings';
  if (pathname === '/pokemon') {
    const instanceId = new URLSearchParams(query).get('instanceId')?.trim();
    return instanceId
      ? `/native/collection/${canonicalSegment(instanceId)}`
      : preserveQuery('/native/collection', query);
  }
  if (pathname === '/profile') return '/native/profile';
  if (pathname === '/pokedex') return preserveQuery('/native/pokedex', query);
  if (pathname === '/raid') return '/native/raid';
  if (pathname === '/raid/methodology') return '/native/raid-methodology';
  if (pathname === '/max') return preserveQuery('/native/max', query);
  if (pathname === '/pvp') return '/native/pvp';
  if (pathname === '/pvp/methodology') return '/native/pvp-methodology';
  if (pathname === '/rankings') return preserveQuery('/native/rankings', query);
  if (pathname === '/search') return preserveQuery('/native/search', query);
  if (pathname === '/trades') return preserveQuery('/native/trades', query);
  if (pathname === '/trade-board') return '/native/trade-board';
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 1 && INFORMATION_PATHS.has(parts[0] ?? '')) {
    if (parts[0] === 'faq') return preserveFaqAnswer('/native/info/faq', query, fragment);
    return `/native/info/${parts[0]}`;
  }
  if (parts.length === 2 && parts[0] === 'profile') {
    return `/native/profile/${canonicalSegment(parts[1] ?? '')}`;
  }
  if (parts.length === 2 && parts[0] === 'pokemon') {
    const instanceId = new URLSearchParams(query).get('instanceId')?.trim();
    if (instanceId) {
      return `/native/collection/trainer/${canonicalSegment(parts[1] ?? '')}/${canonicalSegment(instanceId)}`;
    }
    return preserveQuery(
      `/native/collection/trainer/${canonicalSegment(parts[1] ?? '')}`,
      query,
    );
  }
  if (parts.length === 2 && parts[0] === 'trade-board') {
    return `/native/trade-board/${canonicalSegment(parts[1] ?? '')}`;
  }
  return `/native/not-found?path=${encodeURIComponent(preserveQuery(pathname, query))}`;
};
