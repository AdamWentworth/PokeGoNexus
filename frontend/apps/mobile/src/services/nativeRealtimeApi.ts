import type {
  IncomingUpdateEnvelope,
  SseTokenResponse,
} from '@pokemongonexus/shared-contracts/events';
import { eventsContract } from '@pokemongonexus/shared-contracts/events';
import type { NativeEventsApiClient } from './nativeApiClients';

export const getNativeSseToken = (
  client: NativeEventsApiClient,
  deviceId: string,
): Promise<SseTokenResponse> => client.get<SseTokenResponse>(
  eventsContract.endpoints.sseToken,
  { query: { device_id: deviceId } },
);

export const getNativeMissedUpdates = <T extends IncomingUpdateEnvelope>(
  client: NativeEventsApiClient,
  deviceId: string,
  timestamp: number,
): Promise<T> => client.get<T>(eventsContract.endpoints.getUpdates, {
  query: {
    device_id: deviceId,
    timestamp: String(Math.max(0, Math.floor(timestamp))),
  },
});
