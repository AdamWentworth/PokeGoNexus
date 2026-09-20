import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import EventSource, { type EventSourceListener } from 'react-native-sse';
import { eventsContract } from '@pokemongonexus/shared-contracts/events';
import type { TradesEnvelope } from '@pokemongonexus/shared-contracts/trades';
import { getOrCreateDeviceId } from '../../auth/deviceIdentity';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { runtimeConfig } from '../../config/runtimeConfig';
import { nativeCollectionQueryKeys } from '../collection/collectionQueries';
import { nativeCollectionCache, type NativeCachedCollectionSnapshot } from '../../storage/nativeCollectionCache';
import { runAfterNativeUiInteractions } from '../../interaction/nativeUiInteractionScheduler';
import { nativeSocialQueryKeys } from '../social/socialQueries';
import { nativeTradeQueryKeys } from '../trades/tradeQueries';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import { getNativeMissedUpdates, getNativeSseToken } from '../../services/nativeRealtimeApi';
import {
  applyNativeRealtimeCollectionUpdate,
  applyNativeRealtimeTradeUpdate,
  nativeRealtimeInvalidationScopes,
  parseNativeRealtimeEnvelope,
  type NativeRealtimeEnvelope,
} from './nativeRealtimeModel';

const LAST_EVENT_KEY_PREFIX = 'pokegonexus.native.events.last-update';
const RECONNECT_DELAY_MS = 5_000;
const TOKEN_REFRESH_SAFETY_MS = 30_000;

const buildSseUrl = (
  baseUrl: string,
  deviceId: string,
  streamToken: string,
): string => {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl.replace(/\/$/, '')}${eventsContract.endpoints.sse}${separator}`
    + `device_id=${encodeURIComponent(deviceId)}&stream_token=${encodeURIComponent(streamToken)}`;
};

export const NativeRealtimeProvider = ({ children }: PropsWithChildren) => {
  const session = useNativeSession();
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const onlineRef = useRef(true);
  const generationRef = useRef(0);

  const userId = session.user?.user_id ?? null;
  const timestampKey = userId ? `${LAST_EVENT_KEY_PREFIX}.${userId}` : null;

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (tokenRefreshTimerRef.current) clearTimeout(tokenRefreshTimerRef.current);
    reconnectTimerRef.current = null;
    tokenRefreshTimerRef.current = null;
  }, []);

  const close = useCallback(() => {
    generationRef.current += 1;
    clearTimers();
    sourceRef.current?.removeAllEventListeners();
    sourceRef.current?.close();
    sourceRef.current = null;
  }, [clearTimers]);

  const applyEnvelope = useCallback(async (envelope: NativeRealtimeEnvelope) => {
    if (!userId) return;
    let nextSnapshot: NativeCachedCollectionSnapshot | undefined;
    queryClient.setQueryData<NativeCachedCollectionSnapshot>(
      nativeCollectionQueryKeys.snapshot(userId),
      (current) => {
        nextSnapshot = applyNativeRealtimeCollectionUpdate(current, envelope);
        return nextSnapshot;
      },
    );
    if (nextSnapshot) {
      const snapshotToPersist = nextSnapshot;
      runAfterNativeUiInteractions(() => {
        void nativeCollectionCache.write(userId, snapshotToPersist).catch(() => undefined);
      });
      void queryClient.invalidateQueries({ queryKey: nativeCollectionQueryKeys.summary(userId) });
    }

    queryClient.setQueryData<TradesEnvelope>(
      nativeTradeQueryKeys.list(userId),
      (current) => applyNativeRealtimeTradeUpdate(current, envelope),
    );

    const scopes = nativeRealtimeInvalidationScopes(envelope);
    if (scopes.has('friends')) {
      void queryClient.invalidateQueries({ queryKey: nativeSocialQueryKeys.friends(userId) });
    }
    if (scopes.has('preferences')) {
      void queryClient.invalidateQueries({ queryKey: nativeSocialQueryKeys.preferences(userId) });
    }
    if (scopes.has('profile')) {
      void queryClient.invalidateQueries({ queryKey: nativeSocialQueryKeys.root });
    }

  }, [queryClient, userId]);

  const connectRef = useRef<() => Promise<void>>(async () => undefined);
  const scheduleReconnect = useCallback(() => {
    if (!userId || appStateRef.current !== 'active' || !onlineRef.current) return;
    if (reconnectTimerRef.current) return;
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      void connectRef.current();
    }, RECONNECT_DELAY_MS);
  }, [userId]);

  const connect = useCallback(async () => {
    if (!userId || appStateRef.current !== 'active' || !onlineRef.current) return;
    close();
    const generation = generationRef.current;

    try {
      const deviceId = await getOrCreateDeviceId();
      const savedTimestamp = timestampKey
        ? Number(await SecureStore.getItemAsync(timestampKey).catch(() => null))
        : Number.NaN;
      const since = Number.isFinite(savedTimestamp)
        ? savedTimestamp
        : Date.now() - 5 * 60_000;
      const missed = await getNativeMissedUpdates<NativeRealtimeEnvelope>(
        clients.events,
        deviceId,
        since,
      );
      if (generation !== generationRef.current) return;
      await applyEnvelope(missed);

      const token = await getNativeSseToken(clients.events, deviceId);
      if (generation !== generationRef.current) return;
      const preStreamWatermark = Date.now();
      const source = new EventSource(buildSseUrl(
        runtimeConfig.api.eventsApiUrl,
        deviceId,
        token.token,
      ), {
        pollingInterval: 0,
        timeout: 45_000,
      });
      sourceRef.current = source;

      const messageListener: EventSourceListener = (event) => {
        if (event.type !== 'message') return;
        const envelope = parseNativeRealtimeEnvelope(event.data);
        if (envelope) {
          void applyEnvelope(envelope).then(() => (
            timestampKey
              ? SecureStore.setItemAsync(timestampKey, String(Date.now())).catch(() => undefined)
              : undefined
          ));
        }
      };
      const openListener: EventSourceListener = () => {
        void getNativeMissedUpdates<NativeRealtimeEnvelope>(
          clients.events,
          deviceId,
          preStreamWatermark,
        ).then(applyEnvelope).then(() => (
          timestampKey
            ? SecureStore.setItemAsync(timestampKey, String(Date.now())).catch(() => undefined)
            : undefined
        )).catch(() => undefined);
      };
      const errorListener: EventSourceListener = (event) => {
        if (event.type !== 'error' && event.type !== 'exception' && event.type !== 'timeout') return;
        if (sourceRef.current === source) {
          source.removeAllEventListeners();
          source.close();
          sourceRef.current = null;
          scheduleReconnect();
        }
      };
      source.addEventListener('open', openListener);
      source.addEventListener('message', messageListener);
      source.addEventListener('error', errorListener);

      const refreshAfter = Math.max(
        30_000,
        (token.expires_in_seconds * 1_000) - TOKEN_REFRESH_SAFETY_MS,
      );
      tokenRefreshTimerRef.current = setTimeout(() => {
        tokenRefreshTimerRef.current = null;
        void connectRef.current();
      }, refreshAfter);
    } catch {
      if (generation === generationRef.current) scheduleReconnect();
    }
  }, [applyEnvelope, clients.events, close, scheduleReconnect, timestampKey, userId]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (session.status === 'signed-in') void connect();
    else close();
    return close;
  }, [close, connect, session.status]);

  useEffect(() => {
    const appState = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active') void connectRef.current();
      else close();
    });
    const network = NetInfo.addEventListener((state) => {
      onlineRef.current = state.isConnected !== false && state.isInternetReachable !== false;
      if (onlineRef.current && appStateRef.current === 'active') void connectRef.current();
      else if (!onlineRef.current) close();
    });
    return () => {
      appState.remove();
      network();
    };
  }, [close]);

  return children;
};
