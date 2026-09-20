import { describe, expect, it } from 'vitest';

import {
  normalizeListsState,
  normalizeTradeTargetEntries,
  resolveTradeTargetsPanelCopy,
} from '@/pages/Pokemon/features/instances/components/Trade/tradeTargetsPanelState';

describe('tradeTargetsPanelState', () => {
  it('normalizes wanted entries to a record', () => {
    expect(normalizeTradeTargetEntries(null)).toEqual({});
    expect(normalizeTradeTargetEntries(undefined)).toEqual({});
    expect(normalizeTradeTargetEntries('bad')).toEqual({});
    expect(normalizeTradeTargetEntries({ target: true })).toEqual({ target: true });
  });

  it('normalizes list state while preserving non-wanted list data', () => {
    expect(
      normalizeListsState({
        wanted: undefined as unknown as Record<string, unknown>,
        caught: { one: true },
      }),
    ).toEqual({
      wanted: {},
      caught: { one: true },
    });
  });

  it('resolves display copy for target and mirror modes', () => {
    expect(resolveTradeTargetsPanelCopy(false)).toEqual({
      eyebrow: 'Desired Return',
      title: 'Wanted Pokémon',
      description:
        'Choose the Pokémon you want in return for this For Trade listing.',
      listTitle: 'Wanted Pokémon',
    });

    expect(resolveTradeTargetsPanelCopy(true)).toEqual({
      eyebrow: 'Mirror Trade',
      title: 'Mirror Match',
      description: 'Review the mirrored partner that matches this offer.',
      listTitle: 'Available Mirror',
    });
  });
});
