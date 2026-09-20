import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { TradesEnvelope } from '@pokemongonexus/shared-contracts/trades';
import {
  applyNativeRealtimeCollectionUpdate,
  applyNativeRealtimeTradeUpdate,
  nativeRealtimeInvalidationScopes,
  parseNativeRealtimeEnvelope,
} from '../../../src/features/realtime/nativeRealtimeModel';

const instance = (overrides: Partial<PokemonInstance> = {}): PokemonInstance => ({
  instance_id: 'instance-1',
  pokemon_id: 1,
  last_update: 1,
  caught_tags: [],
  trade_tags: [],
  wanted_tags: [],
  ...overrides,
} as PokemonInstance);

describe('native realtime model', () => {
  test('parses valid object messages and ignores invalid stream frames', () => {
    expect(parseNativeRealtimeEnvelope('{"pokemon":{}}')).toEqual({ pokemon: {} });
    expect(parseNativeRealtimeEnvelope('Connected to SSE stream')).toBeNull();
    expect(parseNativeRealtimeEnvelope('[]')).toBeNull();
    expect(parseNativeRealtimeEnvelope(null)).toBeNull();
  });

  test('patches authoritative collection instances without dropping local fields', () => {
    const snapshot = {
      catalog: [],
      instances: {
        'instance-1': instance({ nickname: 'Buddy', cp: 100 }),
      },
    };
    const next = applyNativeRealtimeCollectionUpdate(snapshot, {
      pokemon: { 'instance-1': { cp: 500, caught_tags: '["tag-1"]' } as never },
    });
    expect(next?.instances['instance-1']).toMatchObject({
      instance_id: 'instance-1',
      nickname: 'Buddy',
      cp: 500,
      caught_tags: ['tag-1'],
    });
  });

  test('merges trade and related instance updates into the canonical list', () => {
    const current: TradesEnvelope = {
      trades: [{ trade_id: 'trade-1', trade_status: 'proposed', trade_dust_cost: 800 }],
      related_instances: {},
    };
    const next = applyNativeRealtimeTradeUpdate(current, {
      trade: {
        'trade-1': { trade_status: 'accepted' },
        'trade-2': { trade_status: 'proposed', username_accepting: 'Misty' },
      },
      relatedInstance: {
        'partner-1': instance({ instance_id: 'partner-1', pokemon_id: 25 }),
      },
    });
    expect(next?.trades).toEqual([
      expect.objectContaining({ trade_id: 'trade-1', trade_status: 'accepted', trade_dust_cost: 800 }),
      expect.objectContaining({ trade_id: 'trade-2', trade_status: 'proposed' }),
    ]);
    expect(next?.related_instances['partner-1']).toMatchObject({
      instance_id: 'partner-1',
      pokemon_id: 25,
    });
  });

  test('deduplicates invalidation scopes', () => {
    expect([...nativeRealtimeInvalidationScopes({
      invalidations: [
        { type: 'friends' },
        { type: 'friends' },
        { type: 'profile', username: 'Misty' },
      ],
    })]).toEqual(['friends', 'profile']);
  });
});
