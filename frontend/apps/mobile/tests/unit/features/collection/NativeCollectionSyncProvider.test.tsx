import {
  canAttemptNativeCollectionSync,
  summarizeNativeCollectionOutbox,
  shouldSyncForAppState,
} from '../../../../src/features/collection/NativeCollectionSyncProvider';

describe('NativeCollectionSyncProvider lifecycle rules', () => {
  it('attempts sync when connectivity is usable or not yet known', () => {
    expect(canAttemptNativeCollectionSync({
      isConnected: true, isInternetReachable: true,
    })).toBe(true);
    expect(canAttemptNativeCollectionSync({
      isConnected: null, isInternetReachable: null,
    })).toBe(true);
  });

  it('does not retry while the device is known to be offline', () => {
    expect(canAttemptNativeCollectionSync({
      isConnected: false, isInternetReachable: null,
    })).toBe(false);
    expect(canAttemptNativeCollectionSync({
      isConnected: true, isInternetReachable: false,
    })).toBe(false);
  });

  it('retries only when the application returns to the foreground', () => {
    expect(shouldSyncForAppState('active')).toBe(true);
    expect(shouldSyncForAppState('background')).toBe(false);
    expect(shouldSyncForAppState('inactive')).toBe(false);
  });

  it('reports pending, Receiver-accepted, and failed retained batches separately', () => {
    const entries = [
      { state: 'pending', lastError: null },
      { state: 'pending', lastError: 'Receiver unavailable' },
      { state: 'acknowledged', lastError: null },
    ] as never;

    expect(summarizeNativeCollectionOutbox(entries)).toEqual({
      pendingCount: 2,
      acceptedCount: 1,
      lastError: 'Receiver unavailable',
    });
  });
});
