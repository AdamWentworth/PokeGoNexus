import { describe, expect, it } from 'vitest';

import {
  readRouteScrollPosition,
  withRouteScrollPosition,
} from '@/components/navigation/RouteScrollRestoration';

describe('RouteScrollRestoration history state', () => {
  it('adds a position without discarding router or context-back state', () => {
    const original = {
      idx: 4,
      key: 'route-key',
      usr: { source: 'search' },
      __pgnContextBackGuard: { token: 2, url: '/pokemon/trainer' },
    };

    const next = withRouteScrollPosition(original, { x: 12, y: 640 });

    expect(next).toMatchObject(original);
    expect(readRouteScrollPosition(next)).toEqual({ x: 12, y: 640 });
    expect(next).not.toBe(original);
  });

  it('treats malformed or unsafe coordinates as unrestorable', () => {
    expect(readRouteScrollPosition(null)).toBeNull();
    expect(readRouteScrollPosition({})).toBeNull();
    expect(
      readRouteScrollPosition({
        __pgnRouteScrollPosition: { x: 0, y: Number.NaN },
      }),
    ).toBeNull();
    expect(
      readRouteScrollPosition({
        __pgnRouteScrollPosition: { x: -1, y: 200 },
      }),
    ).toBeNull();
  });
});
