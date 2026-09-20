import {
  normalizeNativeInstance,
  normalizeNativeInstances,
  normalizeNativeTagIds,
} from '../../../../src/features/collection/nativeInstanceNormalization';

describe('native instance normalization', () => {
  it.each([
    [null, []],
    [{}, []],
    ['[]', []],
    ['custom-tag', ['custom-tag']],
    [['one', ' ', 'one', { tag_id: 'two' }, { id: 'three' }], ['one', 'two', 'three']],
  ])('normalizes legacy tag membership %p', (value, expected) => {
    expect(normalizeNativeTagIds(value)).toEqual(expected);
  });

  it('repairs all membership fields on production-shaped legacy instances', () => {
    const instance = normalizeNativeInstance({
      caught_tags: {} as never,
      trade_tags: '["trade-tag"]' as never,
      wanted_tags: [{ tag_id: 'wanted-tag' }] as never,
    } as never);

    expect(instance.caught_tags).toEqual([]);
    expect(instance.trade_tags).toEqual(['trade-tag']);
    expect(instance.wanted_tags).toEqual(['wanted-tag']);
  });

  it('drops invalid record members instead of letting them crash collection rendering', () => {
    expect(normalizeNativeInstances({
      valid: { instance_id: 'valid', caught_tags: {} },
      invalid: null,
    })).toEqual({
      valid: expect.objectContaining({ instance_id: 'valid', caught_tags: [] }),
    });
  });
});
