import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleCancelTrade } from '@/pages/Trades/handlers/handleCancelTrade';
import { cancelTrade } from '@/services/tradeService';

vi.mock('@/services/tradeService', () => ({
  cancelTrade: vi.fn(),
}));

const cancelTradeMock = vi.mocked(cancelTrade);

describe('handleCancelTrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reconciles the canonical cancelled trade before refreshing instances', async () => {
    const originalTrade = {
      trade_id: 'trade-1',
      trade_status: 'proposed',
      last_update: 100,
    };
    const canonicalTrade = {
      ...originalTrade,
      trade_status: 'cancelled',
      trade_cancelled_by: 'ash',
      trade_cancelled_date: '2026-07-30T12:00:00Z',
      last_update: 200,
    };
    cancelTradeMock.mockResolvedValue({
      trade: canonicalTrade,
      affected_instances: {},
    });
    const setTradeData = vi.fn().mockResolvedValue(undefined);
    const periodicUpdates = vi.fn();

    await handleCancelTrade({
      trade: originalTrade,
      trades: { 'trade-1': originalTrade },
      setTradeData,
      periodicUpdates,
      currentUsername: 'ash',
    });

    expect(setTradeData).toHaveBeenCalledWith({
      'trade-1': canonicalTrade,
    });
    expect(setTradeData.mock.invocationCallOrder[0]).toBeLessThan(
      periodicUpdates.mock.invocationCallOrder[0],
    );
  });
});
