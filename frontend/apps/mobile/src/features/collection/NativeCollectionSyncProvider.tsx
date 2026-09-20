import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import {
  AppState,
  type AppStateStatus,
} from 'react-native';
import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import { nativeCollectionOutbox } from '../../storage/nativeCollectionOutbox';
import { logWarn } from '../../observability/logger';
import { nativeCollectionQueryKeys } from './collectionQueries';
import { sendPendingNativeCollectionBatches } from './collectionSyncCoordinator';
import type { NativeCollectionOutboxEntry } from '../../storage/nativeCollectionOutbox';

export type NativeCollectionSyncStatus = {
  pendingCount: number;
  acceptedCount: number;
  isSyncing: boolean;
  isOffline: boolean;
  lastError: string | null;
};

type NativeCollectionSyncContextValue = NativeCollectionSyncStatus & {
  retry: () => Promise<void>;
  refreshStatus: () => Promise<void>;
};

const idleStatus: NativeCollectionSyncStatus = {
  pendingCount: 0,
  acceptedCount: 0,
  isSyncing: false,
  isOffline: false,
  lastError: null,
};

const NativeCollectionSyncContext = createContext<NativeCollectionSyncContextValue | null>(null);

export const summarizeNativeCollectionOutbox = (
  entries: NativeCollectionOutboxEntry[],
): Pick<NativeCollectionSyncStatus, 'pendingCount' | 'acceptedCount' | 'lastError'> => {
  const pending = entries.filter((entry) => entry.state === 'pending');
  return {
    pendingCount: pending.length,
    acceptedCount: entries.length - pending.length,
    lastError: [...pending].reverse().find((entry) => entry.lastError)?.lastError ?? null,
  };
};

export const useNativeCollectionSync = (): NativeCollectionSyncContextValue => {
  const context = useContext(NativeCollectionSyncContext);
  if (!context) {
    throw new Error('Native collection synchronization requires its provider.');
  }
  return context;
};

export const canAttemptNativeCollectionSync = (
  network: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>,
): boolean => network.isConnected !== false && network.isInternetReachable !== false;

export const shouldSyncForAppState = (state: AppStateStatus): boolean =>
  state === 'active';

export const NativeCollectionSyncProvider = ({ children }: PropsWithChildren) => {
  const session = useNativeSession();
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();
  const inFlight = useRef<Promise<void> | null>(null);
  const [status, setStatus] = useState<NativeCollectionSyncStatus>(idleStatus);

  const refreshStatus = useCallback(async (): Promise<void> => {
    if (session.status !== 'signed-in' || !session.user) {
      setStatus(idleStatus);
      return;
    }
    const summary = summarizeNativeCollectionOutbox(
      await nativeCollectionOutbox.list(session.user.user_id),
    );
    setStatus((current) => ({ ...current, ...summary }));
  }, [session.status, session.user]);

  const flush = useCallback((): Promise<void> => {
    if (session.status !== 'signed-in' || !session.user) return Promise.resolve();
    if (inFlight.current) return inFlight.current;
    const userId = session.user.user_id;
    const operation = (async () => {
      setStatus((current) => ({ ...current, isSyncing: true }));
      const result = await sendPendingNativeCollectionBatches({
        userId,
        outbox: nativeCollectionOutbox,
        receiverClient: clients.receiver,
      });
      const retained = await nativeCollectionOutbox.list(userId);
      const hasAcceptedBatches = retained.some((entry) => entry.state === 'acknowledged');
      if (result.acknowledgedBatchIds.length > 0 || hasAcceptedBatches) {
        await queryClient.invalidateQueries({
          queryKey: nativeCollectionQueryKeys.snapshot(userId),
        });
      }
      await refreshStatus();
    })().catch((error: unknown) => {
      logWarn('collection-sync', 'Automatic collection sync failed', error);
      setStatus((current) => ({
        ...current,
        lastError: error instanceof Error ? error.message : 'Collection synchronization failed.',
      }));
    }).finally(() => {
      setStatus((current) => ({ ...current, isSyncing: false }));
      if (inFlight.current === operation) inFlight.current = null;
    });
    inFlight.current = operation;
    return operation;
  }, [clients.receiver, queryClient, refreshStatus, session.status, session.user]);

  const retry = useCallback(async (): Promise<void> => {
    try {
      const network = await NetInfo.fetch();
      const canAttempt = canAttemptNativeCollectionSync(network);
      setStatus((current) => ({ ...current, isOffline: !canAttempt }));
      if (canAttempt) await flush();
    } catch (error) {
      setStatus((current) => ({
        ...current,
        lastError: error instanceof Error ? error.message : 'Unable to check network status.',
      }));
    }
  }, [flush]);

  useEffect(() => {
    if (session.status !== 'signed-in' || !session.user) {
      setStatus(idleStatus);
      return undefined;
    }
    void flush();
    const networkSubscription = NetInfo.addEventListener((network) => {
      const canAttempt = canAttemptNativeCollectionSync(network);
      setStatus((current) => ({ ...current, isOffline: !canAttempt }));
      if (canAttempt) void flush();
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (shouldSyncForAppState(state)) void flush();
    });
    return () => {
      networkSubscription();
      appStateSubscription.remove();
    };
  }, [flush, session.status, session.user]);

  const value = useMemo<NativeCollectionSyncContextValue>(() => ({
    ...status,
    retry,
    refreshStatus,
  }), [refreshStatus, retry, status]);

  return (
    <NativeCollectionSyncContext.Provider value={value}>
      {children}
    </NativeCollectionSyncContext.Provider>
  );
};
