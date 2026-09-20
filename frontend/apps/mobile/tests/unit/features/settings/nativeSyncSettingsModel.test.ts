import { summarizeNativeSyncSettings } from '../../../../src/features/settings/nativeSyncSettingsModel';

describe('summarizeNativeSyncSettings', () => {
  it('keeps the idle state visible and retryable', () => {
    expect(summarizeNativeSyncSettings({
      acceptedCount: 0,
      isOffline: false,
      isSyncing: false,
      lastError: null,
      pendingCount: 0,
    })).toEqual({
      canRetry: true,
      detail: 'No collection changes are waiting on this device.',
      title: 'Up to date',
    });
  });

  it('prioritizes errors and retained offline changes', () => {
    expect(summarizeNativeSyncSettings({
      acceptedCount: 1,
      isOffline: true,
      isSyncing: false,
      lastError: 'Receiver is unavailable.',
      pendingCount: 2,
    })).toEqual({
      canRetry: true,
      detail: 'Receiver is unavailable.',
      title: 'Needs attention',
    });
    expect(summarizeNativeSyncSettings({
      acceptedCount: 1,
      isOffline: true,
      isSyncing: false,
      lastError: null,
      pendingCount: 2,
    })).toEqual({
      canRetry: false,
      detail: '3 changes are safely retained on this device.',
      title: 'Offline',
    });
  });
});
