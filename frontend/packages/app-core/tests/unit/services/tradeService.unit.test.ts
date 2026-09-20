import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acceptTrade,
  createTrade,
  fetchTrades,
  revealPartnerInfo,
} from '@/services/tradeService';

describe('tradeService.revealPartnerInfo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns partner info on 2xx response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sharingEnabled: true,
          trainerCode: '1234 5678 9012',
          pokemonGoName: 'AshKetchum',
          coordinationMethod: 'campfire',
          coordinationHandle: 'AshCampfire',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await revealPartnerInfo({ trade_id: 't1' });

    expect(result).toEqual({
      sharingEnabled: true,
      trainerCode: '1234 5678 9012',
      pokemonGoName: 'AshKetchum',
      coordinationMethod: 'campfire',
      coordinationHandle: 'AshCampfire',
    });
  });

  it('throws when backend returns non-2xx', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(revealPartnerInfo({ trade_id: 't1' })).rejects.toThrow(
      'denied',
    );
  });
});

describe('authoritative trade commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates trades through the users service without client-controlled state', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        trade: { trade_id: 'server-trade', trade_status: 'proposed' },
        affected_instances: {},
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await createTrade({
      username_accepting: 'misty',
      pokemon_instance_id_user_proposed: 'instance-1',
      pokemon_instance_id_user_accepting: 'instance-2',
      is_special_trade: false,
      is_registered_trade: true,
      is_lucky_trade: false,
      trade_dust_cost: 100,
      trade_friendship_level: 2,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/trades'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).not.toHaveProperty('trade_status');
    expect(JSON.parse(String(init.body))).not.toHaveProperty('username_proposed');
  });

  it('loads canonical trades and sends explicit transition commands', async () => {
    const fetchMock = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        trades: [],
        related_instances: {},
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        trade: { trade_id: 'server-trade', trade_status: 'pending' },
        affected_instances: {},
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

    await fetchTrades();
    await acceptTrade('server-trade');

    expect(fetchMock.mock.calls[1]?.[0]).toContain('/trades/server-trade/accept');
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});
