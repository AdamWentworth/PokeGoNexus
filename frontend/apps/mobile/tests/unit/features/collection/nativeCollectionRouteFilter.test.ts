import { nativeCollectionTagKeyForFilter } from '../../../../src/features/collection/nativeCollectionRouteFilter';

describe('nativeCollectionTagKeyForFilter', () => {
  it.each([
    ['caught', 'system:caught'],
    ['all_caught', 'system:caught'],
    ['trade', 'system:trade'],
    ['for-trade', 'system:trade'],
    ['wanted', 'system:wanted'],
    ['all_wanted', 'system:wanted'],
    ['most_wanted', 'system:most-wanted'],
    ['favorites', 'system:favorites'],
  ])('maps %s to %s', (filter, expected) => {
    expect(nativeCollectionTagKeyForFilter(filter)).toBe(expected);
  });

  it('leaves an absent or unsupported filter on the full catalog', () => {
    expect(nativeCollectionTagKeyForFilter(undefined)).toBeNull();
    expect(nativeCollectionTagKeyForFilter('unknown')).toBeNull();
  });
});
