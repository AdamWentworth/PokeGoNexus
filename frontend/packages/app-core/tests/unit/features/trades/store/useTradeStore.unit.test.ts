import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  setTradesinDB: vi.fn(),
  deleteFromTradesDB: vi.fn(),
  getAllFromTradesDB: vi.fn(),
  fetchTrades: vi.fn(),
}));

vi.mock('@/db/indexedDB', () => ({
  POKEMON_TRADES_STORE: 'pokemonTrades',
  RELATED_INSTANCES_STORE: 'relatedInstances',
  setTradesinDB: dbMocks.setTradesinDB,
  deleteFromTradesDB: dbMocks.deleteFromTradesDB,
  getAllFromTradesDB: dbMocks.getAllFromTradesDB,
}));

vi.mock('@/services/tradeService', () => ({
  fetchTrades: dbMocks.fetchTrades,
}));

vi.mock('@/features/trades/actions/proposeTrade', () => ({
  proposeTrade: vi.fn(),
}));

import { useTradeStore } from '@/features/trades/store/useTradeStore';

describe('useTradeStore authoritative reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.setTradesinDB.mockResolvedValue(undefined);
    dbMocks.deleteFromTradesDB.mockResolvedValue(undefined);
    dbMocks.getAllFromTradesDB.mockResolvedValue([]);
    dbMocks.fetchTrades.mockResolvedValue({ trades: [], related_instances: {} });
    useTradeStore.getState().resetTradeData();
  });

  it('updates visible state immediately from a canonical command response', async () => {
    const pendingWrite = new Promise<void>(() => {});
    dbMocks.setTradesinDB.mockReturnValue(pendingWrite);

    const update = useTradeStore.getState().setTradeData({
      'trade-1': { trade_id: 'trade-1', trade_status: 'cancelled' },
    });

    expect(useTradeStore.getState().trades['trade-1']?.trade_status).toBe('cancelled');
    void update;
  });

  it('keeps canonical memory state when IndexedDB persistence fails', async () => {
    dbMocks.setTradesinDB.mockRejectedValue(new Error('IndexedDB unavailable'));

    await expect(
      useTradeStore.getState().setTradeData({
        'trade-1': { trade_id: 'trade-1', trade_status: 'pending' },
      }),
    ).resolves.toBeDefined();

    expect(useTradeStore.getState().trades['trade-1']?.trade_status).toBe('pending');
  });

  it('does not let an older response overwrite a newer live trade', async () => {
    await useTradeStore.getState().setTradeData({
      'trade-1': { trade_id: 'trade-1', trade_status: 'pending', last_update: 200 },
    });
    await useTradeStore.getState().setTradeData({
      'trade-1': { trade_id: 'trade-1', trade_status: 'proposed', last_update: 100 },
    });

    expect(useTradeStore.getState().trades['trade-1']?.trade_status).toBe('pending');
  });

  it('keeps a live update that arrives while hydration is in flight', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    dbMocks.fetchTrades.mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve;
    }));

    const hydration = useTradeStore.getState().hydrateFromDB();
    await vi.waitFor(() => expect(dbMocks.fetchTrades).toHaveBeenCalledOnce());
    await useTradeStore.getState().setTradeData({
      'trade-1': { trade_id: 'trade-1', trade_status: 'pending', last_update: 200 },
    });
    resolveFetch?.({
      trades: [{ trade_id: 'trade-1', trade_status: 'proposed', last_update: 100 }],
      related_instances: {},
    });
    await hydration;

    expect(useTradeStore.getState().trades['trade-1']?.trade_status).toBe('pending');
  });

  it('removes server-deleted trades from memory even when cache deletion fails', async () => {
    await useTradeStore.getState().setTradeData({
      'trade-1': { trade_id: 'trade-1', trade_status: 'proposed' },
    });
    dbMocks.deleteFromTradesDB.mockRejectedValue(new Error('IndexedDB unavailable'));

    await useTradeStore.getState().setTradeData({
      'trade-1': { trade_id: 'trade-1', trade_status: 'deleted' },
    });

    expect(useTradeStore.getState().trades).not.toHaveProperty('trade-1');
  });

  it('shows canonical related Pokemon immediately without waiting for IndexedDB', async () => {
    const pendingWrite = new Promise<void>(() => {});
    dbMocks.setTradesinDB.mockReturnValue(pendingWrite);

    const update = useTradeStore.getState().setRelatedInstances({
      'instance-1': { instance_id: 'instance-1', pokemon_id: 25 },
    });

    expect(useTradeStore.getState().relatedInstances['instance-1']?.pokemon_id).toBe(25);
    void update;
  });

  it('keeps canonical related Pokemon when IndexedDB persistence fails', async () => {
    dbMocks.setTradesinDB.mockRejectedValue(new Error('IndexedDB unavailable'));

    await expect(
      useTradeStore.getState().setRelatedInstances({
        'instance-2': { instance_id: 'instance-2', pokemon_id: 133 },
      }),
    ).resolves.toBeDefined();

    expect(useTradeStore.getState().relatedInstances['instance-2']?.pokemon_id).toBe(133);
  });
});
