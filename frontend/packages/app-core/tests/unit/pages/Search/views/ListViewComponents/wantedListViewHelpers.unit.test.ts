import { describe, expect, it } from 'vitest';

import {
  formatDateOnlySafe,
  formatWantedDate,
  getWantedTradeEntries,
  hasWantedAdditionalDetails,
  toWantedGender,
  type WantedListItem,
} from '@/pages/Search/views/ListViewComponents/wantedListViewHelpers';

describe('wantedListViewHelpers', () => {
  it('formats safe ISO date-only strings with configurable fallback', () => {
    expect(formatDateOnlySafe('2026-02-17T12:34:56.000Z')).toBe('2026-02-17');
    expect(formatDateOnlySafe('bad-date')).toBe('Unknown');
    expect(formatDateOnlySafe('', 'N/A')).toBe('N/A');
  });

  it('formats valid dates and falls back to Unknown', () => {
    expect(formatWantedDate('2026-02-17T12:34:56.000Z')).toBe('2026-02-17');
    expect(formatWantedDate('bad-date')).toBe('Unknown');
    expect(formatWantedDate()).toBe('Unknown');
  });

  it('normalizes allowed gender values and rejects unknown values', () => {
    expect(toWantedGender('Male')).toBe('Male');
    expect(toWantedGender('Female')).toBe('Female');
    expect(toWantedGender('Unknown')).toBeNull();
    expect(toWantedGender(undefined)).toBeNull();
  });

  it('detects additional wanted details', () => {
    const empty: WantedListItem = {};
    expect(hasWantedAdditionalDetails(empty)).toBe(false);

    expect(hasWantedAdditionalDetails({ weight: 12.5 })).toBe(true);
    expect(hasWantedAdditionalDetails({ friendship_level: 5 })).toBe(true);
    expect(hasWantedAdditionalDetails({ pref_lucky: true })).toBe(true);
    expect(hasWantedAdditionalDetails({ date_caught: '2026-02-17' })).toBe(true);
    expect(hasWantedAdditionalDetails({ charged_move1_id: 14 })).toBe(true);
    expect(
      hasWantedAdditionalDetails({
        wanted_size_preferences: {
          weight: {
            category: 'XXL',
            min: 20,
            max: null,
            min_inclusive: false,
            max_inclusive: false,
          },
          height: null,
        },
      }),
    ).toBe(true);
  });

  it('returns stable trade-list entries for rendering', () => {
    expect(getWantedTradeEntries(null)).toEqual([]);
    expect(getWantedTradeEntries(undefined)).toEqual([]);

    expect(
      getWantedTradeEntries({
        'variant-1:abc': { match: true },
      }),
    ).toEqual([['variant-1:abc', { match: true }]]);
  });
});
