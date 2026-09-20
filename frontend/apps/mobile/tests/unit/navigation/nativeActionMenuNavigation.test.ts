import {
  resolveNativeActionMenuDestination,
  resolveNativeLoginReturnTo,
} from '../../../src/navigation/nativeActionMenuNavigation';

describe('resolveNativeActionMenuDestination', () => {
  test.each([
    ['/', '/native'],
    ['/pokemon', '/native/collection'],
    ['/pokedex', '/native/pokedex'],
    ['/max', '/native/max'],
    ['/profile', '/native/profile'],
    ['/profile/friends', '/native/friends'],
    ['/login', '/native/login'],
    ['/pvp', '/native/pvp'],
    ['/pvp/methodology', '/native/pvp-methodology'],
    ['/raid', '/native/raid'],
    ['/raid/methodology', '/native/raid-methodology'],
    ['/rankings', '/native/rankings'],
    ['/register', '/native/register'],
    ['/search', '/native/search'],
    ['/settings', '/native/settings'],
    ['/trade-board', '/native/trade-board'],
    ['/trades', '/native/trades'],
    ['/getting-started', '/native/info/getting-started'],
    ['/faq', '/native/info/faq'],
    ['/about', '/native/info/about'],
    ['/safety', '/native/info/safety'],
    ['/help', '/native/info/help'],
    ['/privacy', '/native/info/privacy'],
    ['/terms', '/native/info/terms'],
    ['/data-deletion', '/native/info/data-deletion'],
  ] as const)('keeps %s inside the ready native experience', (path, pathname) => {
    expect(resolveNativeActionMenuDestination(path)).toEqual({ kind: 'native', pathname });
  });

  test('does not reopen the route that is already visible', () => {
    expect(resolveNativeActionMenuDestination('/search', '/search')).toEqual({ kind: 'current' });
    expect(resolveNativeActionMenuDestination('/login', '/login')).toEqual({ kind: 'current' });
    expect(resolveNativeActionMenuDestination('/register', '/register')).toEqual({ kind: 'current' });
  });

  test('keeps unknown destinations in the canonical web app', () => {
    expect(resolveNativeActionMenuDestination('/not-native')).toEqual({
      kind: 'web',
      path: '/not-native',
    });
  });

  test.each([
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
    '/native/pokedex',
    '/native/pvp',
    '/native/pvp-methodology',
    '/native/max',
    '/native/raid',
    '/native/raid-methodology',
    '/native/rankings',
    '/native/search',
    '/native/settings',
    '/native/trade-board',
    '/native/trades',
    '/native/profile',
    '/native/profile/OtherTrainer',
    '/native/collection/instance-1',
    '/native/collection/catalog/variant-1',
    '/native/collection/trainer/OtherTrainer',
    '/native/collection/trainer/OtherTrainer/instance-1',
    '/native/pokedex/variant-1',
    '/native/trade-board/OtherTrainer',
  ] as const)('returns a signed-in user to ready native route %s', (path) => {
    expect(resolveNativeLoginReturnTo(path)).toBe(path);
  });

  test.each([
    ['/pokemon', '/native/collection'],
    ['/pokemon?filter=wanted&search=Pikachu', '/native/collection?filter=wanted&search=Pikachu'],
    ['/pokemon/Misty?filter=trade', '/native/collection/trainer/Misty?filter=trade'],
    ['/pokemon/Misty?instanceId=trade%3A1', '/native/collection/trainer/Misty/trade%3A1'],
    ['/trades?section=activity', '/native/trades?section=activity'],
    ['/search?mode=trainers', '/native/search?mode=trainers'],
    ['/native/collection?filter=favorites', '/native/collection?filter=favorites'],
    ['https://pokegonexus.com/settings/account?oauth=linked', '/native/account?oauth=linked'],
  ] as const)('normalizes canonical and filtered post-login destination %s', (path, expected) => {
    expect(resolveNativeLoginReturnTo(path)).toBe(expected);
  });

  test('rejects arbitrary login return paths', () => {
    expect(resolveNativeLoginReturnTo('/native/not-ready')).toBe('/native');
    expect(resolveNativeLoginReturnTo('/native/profile/name/extra')).toBe('/native');
    expect(resolveNativeLoginReturnTo('/native/trade-board/name/extra')).toBe('/native');
    expect(resolveNativeLoginReturnTo()).toBe('/native');
  });
});
