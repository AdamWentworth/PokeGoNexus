import {
  mergeNativeTradeEnvelope,
  nativeTradeQueryKeys,
  removeNativeTradeFromEnvelope,
} from '../../../../src/features/trades/tradeQueries';

describe('native trade query keys', () => {
  it('isolates server-authoritative trade state by authenticated user', () => {
    expect(nativeTradeQueryKeys.list('user-1')).toEqual([
      'native',
      'trades',
      'user-1',
      'list',
    ]);
    expect(nativeTradeQueryKeys.list('user-1')).not.toEqual(
      nativeTradeQueryKeys.list('user-2'),
    );
  });

  it('applies a canonical command response immediately without losing other trades', () => {
    const current = {
      trades: [
        { trade_id: 'trade-1', trade_status: 'proposed' },
        { trade_id: 'trade-2', trade_status: 'completed' },
      ],
      related_instances: {
        'mine-1': { instance_id: 'mine-1', is_for_trade: true },
      },
    };

    expect(mergeNativeTradeEnvelope(current, {
      trade: { trade_id: 'trade-1', trade_status: 'pending' },
      affected_instances: {
        'theirs-1': { instance_id: 'theirs-1', is_for_trade: true },
      },
    })).toEqual({
      trades: [
        { trade_id: 'trade-1', trade_status: 'pending' },
        { trade_id: 'trade-2', trade_status: 'completed' },
      ],
      related_instances: {
        'mine-1': { instance_id: 'mine-1', is_for_trade: true },
        'theirs-1': { instance_id: 'theirs-1', is_for_trade: true },
      },
    });
  });

  it('removes a server-confirmed deletion from the visible list immediately', () => {
    expect(removeNativeTradeFromEnvelope({
      trades: [
        { trade_id: 'trade-1', trade_status: 'completed' },
        { trade_id: 'trade-2', trade_status: 'cancelled' },
      ],
      related_instances: {},
    }, 'trade-1')?.trades).toEqual([
      { trade_id: 'trade-2', trade_status: 'cancelled' },
    ]);
  });
});
