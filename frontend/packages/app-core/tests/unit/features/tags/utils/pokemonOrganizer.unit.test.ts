import { describe, expect, it } from 'vitest';

import {
  applyCustomTagChanges,
  getBulkToggleState,
  summarizeOrganizerSelection,
} from '@/features/tags/utils/pokemonOrganizer';
import type { Instances } from '@/types/instances';

const caught = (overrides: Record<string, unknown> = {}) => ({
  instance_id: 'caught-1',
  variant_id: '0001-default',
  is_caught: true,
  is_for_trade: false,
  is_wanted: false,
  registered: true,
  favorite: false,
  disabled: false,
  caught_tags: [],
  wanted_tags: [],
  ...overrides,
}) as any;

describe('pokemonOrganizer selection helpers', () => {
  it('separates catalog blueprints, caught instances, wanted entries, and unavailable fusion parts', () => {
    const instances = {
      'caught-1': caught(),
      'wanted-1': caught({
        instance_id: 'wanted-1',
        variant_id: '0002-default',
        is_caught: false,
        is_wanted: true,
      }),
      'disabled-1': caught({ instance_id: 'disabled-1', disabled: true }),
    } as Instances;

    expect(summarizeOrganizerSelection(
      ['0004-default', 'caught-1', 'wanted-1', 'disabled-1'],
      instances,
    )).toEqual({
      kind: 'mixed',
      catalogKeys: ['0004-default'],
      caughtInstanceIds: ['caught-1'],
      wantedInstanceIds: ['wanted-1'],
      unavailableKeys: ['disabled-1'],
      selectedCount: 4,
    });
  });

  it('treats an unregistered baseline row as a catalog blueprint', () => {
    const instances = {
      baseline: caught({
        instance_id: 'baseline',
        variant_id: '0025-default',
        is_caught: false,
        registered: false,
      }),
    } as Instances;

    expect(summarizeOrganizerSelection(['baseline'], instances)).toMatchObject({
      kind: 'catalog',
      catalogKeys: ['0025-default'],
      caughtInstanceIds: [],
      wantedInstanceIds: [],
    });
  });

  it('classifies For Trade as a caught child state', () => {
    const instances = {
      trade: caught({ instance_id: 'trade', is_for_trade: true }),
    } as Instances;

    expect(summarizeOrganizerSelection(['trade'], instances)).toMatchObject({
      kind: 'caught',
      caughtInstanceIds: ['trade'],
    });
  });

  it('reports checked, mixed, and unchecked bulk label state', () => {
    const instances = {
      first: caught({ instance_id: 'first', favorite: true }),
      second: caught({ instance_id: 'second', favorite: false }),
    } as Instances;
    const predicate = (instance: Instances[string]) => Boolean(instance.favorite);

    expect(getBulkToggleState(['first'], instances, predicate)).toBe('checked');
    expect(getBulkToggleState(['first', 'second'], instances, predicate)).toBe('mixed');
    expect(getBulkToggleState(['second'], instances, predicate)).toBe('unchecked');
  });

  it('adds and removes custom tags without duplicates', () => {
    expect(applyCustomTagChanges(
      ['keep', 'remove', 'keep'],
      { remove: false, add: true },
    )).toEqual(['keep', 'add']);
  });
});
