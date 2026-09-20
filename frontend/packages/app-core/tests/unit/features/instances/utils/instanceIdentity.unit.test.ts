import { describe, expect, it } from 'vitest';

import {
  collectInstanceRefCandidates,
  findInstanceByRefs,
  normalizeInstanceToken,
  parseBackgroundId,
  resolveInstanceCollectionKey,
} from '@pokemongonexus/shared-domain/instances';

describe('instanceIdentity', () => {
  it('normalizes UUID suffixes and legacy variant-prefixed instance ids', () => {
    const uuid = '79094536-4eec-4736-bcc7-e440d188eee5';

    expect(normalizeInstanceToken(`0643-default_${uuid.toUpperCase()}`)).toBe(uuid);
    expect(collectInstanceRefCandidates(`0643-default_${uuid}`)).toEqual([
      `0643-default_${uuid}`,
      uuid,
    ]);
  });

  it('finds instances by collection key, legacy suffix, or row instance_id', () => {
    const rowByKey = { instance_id: 'row-key-id' };
    const rowByInstanceId = { instance_id: 'target-instance-id' };
    const collection = {
      '0643-default_legacy-key': rowByKey,
      storedElsewhere: rowByInstanceId,
    };

    expect(findInstanceByRefs(collection, ['legacy-key'])).toBe(rowByKey);
    expect(findInstanceByRefs(collection, ['target-instance-id'])).toBe(rowByInstanceId);
    expect(findInstanceByRefs(collection, ['missing'])).toBeNull();
  });

  it('resolves update keys without depending on the requested key format', () => {
    const uuid = '79094536-4eec-4736-bcc7-e440d188eee5';
    const collection = {
      storedElsewhere: { instance_id: uuid },
      legacyKey: { instance_id: 'legacy-instance-id' },
    };

    expect(resolveInstanceCollectionKey(collection, `0643-default_${uuid}`)).toBe(
      'storedElsewhere',
    );
    expect(resolveInstanceCollectionKey(collection, 'legacy-instance-id')).toBe(
      'legacyKey',
    );
    expect(resolveInstanceCollectionKey(collection, 'missing')).toBeNull();
  });

  it('parses background ids from numeric and legacy string values', () => {
    expect(parseBackgroundId(7)).toBe(7);
    expect(parseBackgroundId('7')).toBe(7);
    expect(parseBackgroundId('7-location')).toBe(7);
    expect(parseBackgroundId('')).toBeNull();
    expect(parseBackgroundId(Number.NaN)).toBeNull();
  });
});
