import { beforeEach, describe, expect, it } from 'vitest';

import {
  readCachedTagOrders,
  writeCachedTagOrders,
} from '@/features/tags/utils/tagOrderCache';

describe('tagOrderCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps cached orders isolated by account', () => {
    const adamOrder = {
      caught: ['system:favorites', 'system:caught', 'system:trade'] as const,
      wanted: ['system:most-wanted', 'system:wanted'] as const,
    };

    writeCachedTagOrders('adam', {
      caught: [...adamOrder.caught],
      wanted: [...adamOrder.wanted],
    });

    expect(readCachedTagOrders('adam')).toEqual(adamOrder);
    expect(readCachedTagOrders('another-user')).toBeNull();
  });

  it('ignores malformed cached values', () => {
    localStorage.setItem(
      'pokegonexus:tag-orders:v1:adam',
      JSON.stringify({ caught: ['not-a-tag-key'], wanted: [] }),
    );

    expect(readCachedTagOrders('adam')).toBeNull();
  });
});

