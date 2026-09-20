import {
  nativePathSurface,
  nativeRouteNameFromPath,
  nativeRouteSurface,
} from '../../../src/navigation/nativeRouteSurface';

describe('nativeRouteSurface', () => {
  it('matches the physical system regions to each dark route surface', () => {
    expect(nativeRouteSurface('collection', false)).toBe('#111111');
    expect(nativeRouteSurface('trades', false)).toBe('#071012');
    expect(nativeRouteSurface('pokedex/index', false)).toBe('#090d12');
    expect(nativeRouteSurface('collection/[instanceId]', false)).toBe('#0f2b2b');
  });

  it('preserves route-specific light surfaces', () => {
    expect(nativeRouteSurface('rankings', true)).toBe('#f5f2e9');
    expect(nativeRouteSurface('collection', true)).toBe('#f8fff9');
  });

  it('uses a non-black full-window fallback for future routes', () => {
    expect(nativeRouteSurface('future-route', false)).toBe('#101a19');
  });

  it('uses the actual compact registration surface on phones', () => {
    expect(nativeRouteSurface('register', false, true)).toBe('#202224');
    expect(nativeRouteSurface('register', true, true)).toBe('#eaf7f1');
    expect(nativeRouteSurface('register', false, false)).toBe('#07111e');
  });

  it.each([
    ['/device-smoke/collection', 'collection'],
    ['/native', 'index'],
    ['/native/pokedex', 'pokedex/index'],
    ['/native/pokedex/0001-default', 'pokedex/[variantId]'],
    ['/native/info/help', 'info/[slug]'],
    ['/native/profile', 'profile/index'],
    ['/native/profile/Misty', 'profile/[username]'],
    ['/native/trade-board/Misty', 'trade-board/[username]'],
    ['/native/collection/catalog/0001-default', 'collection/catalog/[variantId]'],
    ['/native/collection/trainer/Misty', 'collection/trainer/[username]/index'],
    ['/native/collection/trainer/Misty/instance-1', 'collection/trainer/[username]/[instanceId]'],
    ['/native/collection/instance-1', 'collection/[instanceId]'],
    ['/native/trades', 'trades'],
  ])('maps the physical window pathname %s to %s', (pathname, routeName) => {
    expect(nativeRouteNameFromPath(pathname)).toBe(routeName);
  });

  it('gives the root navigator the same surface as the nested route', () => {
    expect(nativePathSurface('/native/collection', false)).toBe('#111111');
    expect(nativePathSurface('/native/rankings', true)).toBe('#f5f2e9');
    expect(nativePathSurface('/native/register', false, true)).toBe('#202224');
  });
});
