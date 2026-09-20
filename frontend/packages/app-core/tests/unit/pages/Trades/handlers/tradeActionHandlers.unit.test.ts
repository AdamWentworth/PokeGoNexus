import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAcceptTrade } from '@/pages/Trades/handlers/handleAcceptTrade';
import { handleDenyTrade } from '@/pages/Trades/handlers/handleDenyTrade';
import { handleReProposeTrade } from '@/pages/Trades/handlers/handleReProposeTrade';
import { handleThumbsUpTrade } from '@/pages/Trades/handlers/handleThumbsUpTrade';
import {
  acceptTrade,
  denyTrade,
  reproposeTrade,
  updateTradeSatisfaction,
} from '@/services/tradeService';

vi.mock('@/services/tradeService', () => ({
  acceptTrade: vi.fn(),
  denyTrade: vi.fn(),
  reproposeTrade: vi.fn(),
  updateTradeSatisfaction: vi.fn(),
}));

const baseTrade = {
  trade_id: 'trade-1',
  trade_status: 'proposed',
  last_update: 100,
  username_proposed: 'ash',
  username_accepting: 'misty',
  pokemon_instance_id_user_proposed: 'instance-1',
  pokemon_instance_id_user_accepting: 'instance-2',
  user_1_trade_satisfaction: false,
  user_2_trade_satisfaction: false,
};

describe('trade action handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      name: 'accept',
      service: vi.mocked(acceptTrade),
      handler: handleAcceptTrade,
      canonicalStatus: 'pending',
    },
    {
      name: 'deny',
      service: vi.mocked(denyTrade),
      handler: handleDenyTrade,
      canonicalStatus: 'denied',
    },
    {
      name: 're-propose',
      service: vi.mocked(reproposeTrade),
      handler: handleReProposeTrade,
      canonicalStatus: 'proposed',
    },
  ])('applies the canonical $name response before refreshing', async ({
    service,
    handler,
    canonicalStatus,
  }) => {
    const canonical = {
      ...baseTrade,
      trade_status: canonicalStatus,
      last_update: 200,
    };
    service.mockResolvedValue({ trade: canonical, affected_instances: {} });
    const setTradeData = vi.fn().mockResolvedValue(undefined);
    const periodicUpdates = vi.fn();

    await handler({
      trade: baseTrade,
      trades: { 'trade-1': baseTrade },
      setTradeData,
      periodicUpdates,
      currentUsername: 'ash',
    } as never);

    expect(setTradeData).toHaveBeenCalledWith({ 'trade-1': canonical });
    expect(setTradeData.mock.invocationCallOrder[0]).toBeLessThan(
      periodicUpdates.mock.invocationCallOrder[0],
    );
  });

  it('toggles satisfaction using the canonical server response', async () => {
    const canonical = {
      ...baseTrade,
      trade_status: 'completed',
      user_1_trade_satisfaction: true,
      last_update: 200,
    };
    vi.mocked(updateTradeSatisfaction).mockResolvedValue({
      trade: canonical,
      affected_instances: {},
    });
    const setTradeData = vi.fn().mockResolvedValue(undefined);

    await handleThumbsUpTrade({
      trade: { ...baseTrade, trade_status: 'completed' },
      trades: { 'trade-1': { ...baseTrade, trade_status: 'completed' } },
      setTradeData,
      periodicUpdates: vi.fn(),
      currentUsername: 'ash',
    });

    expect(updateTradeSatisfaction).toHaveBeenCalledWith('trade-1', true);
    expect(setTradeData).toHaveBeenCalledWith({ 'trade-1': canonical });
  });

  it('does not mutate local state when a command is rejected', async () => {
    vi.mocked(denyTrade).mockRejectedValue(new Error('trade state has changed'));
    const setTradeData = vi.fn();

    await expect(
      handleDenyTrade({
        trade: baseTrade,
        trades: { 'trade-1': baseTrade },
        setTradeData,
        periodicUpdates: vi.fn(),
      }),
    ).rejects.toThrow('trade state has changed');

    expect(setTradeData).not.toHaveBeenCalled();
  });
});
