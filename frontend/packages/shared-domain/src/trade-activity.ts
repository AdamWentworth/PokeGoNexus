import type { TradeRecord } from '@pokemongonexus/shared-contracts/trades';

export const TRADE_ACTIVITY_FILTERS = [
  'Accepting',
  'Proposed',
  'Pending',
  'Completed',
  'Cancelled',
] as const;

export type TradeActivityFilter = (typeof TRADE_ACTIVITY_FILTERS)[number];

const normalizedStatus = (trade: TradeRecord): string =>
  String(trade.trade_status ?? '').trim().toLowerCase();

export const tradeMatchesActivityFilter = (
  trade: TradeRecord,
  filter: TradeActivityFilter,
  currentUsername: string,
): boolean => {
  const status = normalizedStatus(trade);
  switch (filter) {
    case 'Accepting':
      return status === 'proposed'
        && trade.username_accepting === currentUsername;
    case 'Proposed':
      return status === 'proposed'
        && trade.username_proposed === currentUsername;
    case 'Pending':
      return status === 'pending';
    case 'Completed':
      return status === 'completed';
    case 'Cancelled':
      return status === 'cancelled' || status === 'denied';
  }
};

export const countTradeActivity = (
  trades: Iterable<TradeRecord>,
  currentUsername: string,
): Record<TradeActivityFilter, number> => {
  const counts: Record<TradeActivityFilter, number> = {
    Accepting: 0,
    Proposed: 0,
    Pending: 0,
    Completed: 0,
    Cancelled: 0,
  };

  for (const trade of trades) {
    for (const filter of TRADE_ACTIVITY_FILTERS) {
      if (tradeMatchesActivityFilter(trade, filter, currentUsername)) {
        counts[filter] += 1;
      }
    }
  }
  return counts;
};
