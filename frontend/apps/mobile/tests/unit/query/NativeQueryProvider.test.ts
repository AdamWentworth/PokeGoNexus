import { shouldClearNativeSessionCache } from '../../../src/query/NativeQueryProvider';

describe('native session query cache boundary', () => {
  it('clears private cached data on sign-out or account changes', () => {
    expect(shouldClearNativeSessionCache('user-1', null, 'signed-out')).toBe(true);
    expect(shouldClearNativeSessionCache('user-1', 'user-2', 'signed-in')).toBe(true);
    expect(shouldClearNativeSessionCache('user-1', 'user-1', 'signed-in')).toBe(false);
    expect(shouldClearNativeSessionCache(null, 'user-1', 'signed-in')).toBe(false);
    expect(shouldClearNativeSessionCache(null, null, 'signed-out')).toBe(false);
  });
});
