import type { RelatedInstanceRecord, TradeRecord } from '@shared-contracts/trades';
import {
  TRADE_ACTIVITY_FILTERS,
  type TradeActivityFilter,
} from '@pokemongonexus/shared-domain/trade-activity';

export const TRADE_STATUS_FILTERS = TRADE_ACTIVITY_FILTERS;

export type TradeStatusFilter = TradeActivityFilter;

export type TradeListTrade = TradeRecord;

export type TradeMap = Record<string, TradeListTrade>;
export type RelatedInstancesMap = Record<string, RelatedInstanceRecord>;
