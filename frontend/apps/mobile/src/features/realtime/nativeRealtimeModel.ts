import type { IncomingUpdateEnvelope } from '@pokemongonexus/shared-contracts/events';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type {
  RelatedInstanceRecord,
  TradeRecord,
  TradesEnvelope,
} from '@pokemongonexus/shared-contracts/trades';
import type { NativeCachedCollectionSnapshot } from '../../storage/nativeCollectionCache';
import { normalizeNativeInstance } from '../collection/nativeInstanceNormalization';

type RecordLike = Record<string, unknown>;

export type NativeRealtimeEnvelope = IncomingUpdateEnvelope<
  Record<string, Partial<PokemonInstance>>,
  Record<string, Partial<TradeRecord>>,
  Record<string, PokemonInstance>,
  Record<string, Partial<PokemonInstance>>
>;

const isRecord = (value: unknown): value is RecordLike => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export const parseNativeRealtimeEnvelope = (
  source: string | null,
): NativeRealtimeEnvelope | null => {
  if (!source) return null;
  try {
    const parsed = JSON.parse(source) as unknown;
    return isRecord(parsed) ? parsed as NativeRealtimeEnvelope : null;
  } catch {
    return null;
  }
};

const normalizePatch = (
  instanceId: string,
  patch: Partial<PokemonInstance>,
  previous?: PokemonInstance,
): PokemonInstance => normalizeNativeInstance({
  ...(previous ?? {}),
  ...patch,
  instance_id: patch.instance_id || previous?.instance_id || instanceId,
} as PokemonInstance);

export const applyNativeRealtimeCollectionUpdate = (
  current: NativeCachedCollectionSnapshot | undefined,
  envelope: NativeRealtimeEnvelope,
): NativeCachedCollectionSnapshot | undefined => {
  if (!current) return current;
  const changes = {
    ...(envelope.pokemon ?? {}),
    ...(envelope.affectedInstances ?? {}),
  };
  if (Object.keys(changes).length === 0) return current;

  const instances = { ...current.instances };
  for (const [instanceId, patch] of Object.entries(changes)) {
    instances[instanceId] = normalizePatch(instanceId, patch, instances[instanceId]);
  }
  return { ...current, instances };
};

export const applyNativeRealtimeTradeUpdate = (
  current: TradesEnvelope | undefined,
  envelope: NativeRealtimeEnvelope,
): TradesEnvelope | undefined => {
  const tradeUpdates = envelope.trade ?? {};
  const relatedUpdates = envelope.relatedInstance ?? {};
  if (!current && Object.keys(tradeUpdates).length === 0) return current;

  const existing = current?.trades ?? [];
  const byId = new Map(existing.map((trade) => [trade.trade_id, trade]));
  for (const [tradeId, patch] of Object.entries(tradeUpdates)) {
    const previous = byId.get(tradeId);
    byId.set(tradeId, {
      ...(previous ?? {}),
      ...patch,
      trade_id: patch.trade_id || previous?.trade_id || tradeId,
    } as TradeRecord & { trade_id: string });
  }

  const orderedIds = [
    ...Object.keys(tradeUpdates),
    ...existing.map((trade) => trade.trade_id),
  ];
  const seen = new Set<string>();
  const trades = orderedIds.flatMap((tradeId) => {
    if (seen.has(tradeId)) return [];
    seen.add(tradeId);
    const trade = byId.get(tradeId);
    return trade ? [trade] : [];
  });

  return {
    ...(current ?? { trades: [], related_instances: {} }),
    trades,
    related_instances: {
      ...(current?.related_instances ?? {}),
      ...Object.fromEntries(Object.entries(relatedUpdates).map(([instanceId, instance]) => [
        instanceId,
        normalizePatch(instanceId, instance) as PokemonInstance & RelatedInstanceRecord,
      ])),
    },
  };
};

export const nativeRealtimeInvalidationScopes = (
  envelope: NativeRealtimeEnvelope,
): Set<'friends' | 'preferences' | 'profile'> => new Set(
  (envelope.invalidations ?? []).map((invalidation) => invalidation.type),
);
