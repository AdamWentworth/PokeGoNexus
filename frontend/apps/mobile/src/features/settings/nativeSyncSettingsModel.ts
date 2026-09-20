import type { NativeCollectionSyncStatus } from '../collection/NativeCollectionSyncProvider';

export type NativeSyncSettingsSummary = {
  canRetry: boolean;
  detail: string;
  title: string;
};

export const summarizeNativeSyncSettings = (
  sync: NativeCollectionSyncStatus,
): NativeSyncSettingsSummary => {
  const retainedCount = sync.pendingCount + sync.acceptedCount;
  if (sync.lastError) {
    return { canRetry: !sync.isSyncing, detail: sync.lastError, title: 'Needs attention' };
  }
  if (sync.isOffline) {
    return {
      canRetry: false,
      detail: retainedCount > 0
        ? `${retainedCount} ${retainedCount === 1 ? 'change is' : 'changes are'} safely retained on this device.`
        : 'Your saved collection copy remains available on this device.',
      title: 'Offline',
    };
  }
  if (sync.isSyncing) {
    return {
      canRetry: false,
      detail: retainedCount > 0
        ? `Checking ${retainedCount} retained ${retainedCount === 1 ? 'change' : 'changes'}…`
        : 'Checking Receiver and server reconciliation…',
      title: 'Synchronizing',
    };
  }
  if (sync.pendingCount > 0) {
    return {
      canRetry: true,
      detail: `${sync.pendingCount} local ${sync.pendingCount === 1 ? 'change is' : 'changes are'} waiting to sync.`,
      title: 'Waiting to send',
    };
  }
  if (sync.acceptedCount > 0) {
    return {
      canRetry: true,
      detail: `${sync.acceptedCount} ${sync.acceptedCount === 1 ? 'change was' : 'changes were'} accepted and await server confirmation.`,
      title: 'Accepted by Receiver',
    };
  }
  return {
    canRetry: true,
    detail: 'No collection changes are waiting on this device.',
    title: 'Up to date',
  };
};

