import { createScopedLogger } from '@/utils/logger';
import {
  buildUrl,
  parseJsonSafe,
  requestWithPolicy,
  toHttpError,
} from './httpClient';
import {
  tradesContract,
  type AuthoritativeTradeProposalRequest,
  type PartnerInfo,
  type TradeEnvelope,
  type TradeReference,
  type TradesEnvelope,
} from '@shared-contracts/trades';

export type { PartnerInfo } from '@shared-contracts/trades';

const log = createScopedLogger('tradeService');
const endpoint = (path: string) =>
  buildUrl(import.meta.env.VITE_USERS_API_URL, path);

async function tradeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await requestWithPolicy(endpoint(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = await parseJsonSafe<T & { message?: string }>(response);
  if (!response.ok || !body) {
    throw toHttpError(response.status, body);
  }
  return body;
}

export const fetchTrades = () =>
  tradeRequest<TradesEnvelope>(tradesContract.endpoints.list);

export const createTrade = (proposal: AuthoritativeTradeProposalRequest) =>
  tradeRequest<TradeEnvelope>(tradesContract.endpoints.create, {
    method: 'POST',
    body: JSON.stringify(proposal),
  });

const command = (path: string) =>
  tradeRequest<TradeEnvelope>(path, { method: 'POST' });

export const acceptTrade = (tradeId: string) =>
  command(tradesContract.endpoints.accept(tradeId));
export const denyTrade = (tradeId: string) =>
  command(tradesContract.endpoints.deny(tradeId));
export const cancelTrade = (tradeId: string) =>
  command(tradesContract.endpoints.cancel(tradeId));
export const confirmTradeComplete = (tradeId: string) =>
  command(tradesContract.endpoints.complete(tradeId));
export const reproposeTrade = (tradeId: string) =>
  command(tradesContract.endpoints.repropose(tradeId));

export const updateTradeSatisfaction = (
  tradeId: string,
  satisfied: boolean,
) =>
  tradeRequest<TradeEnvelope>(tradesContract.endpoints.satisfaction(tradeId), {
    method: 'PUT',
    body: JSON.stringify({ satisfied }),
  });

export async function revealPartnerInfo(
  trade: TradeReference,
): Promise<PartnerInfo> {
  try {
    if (!trade.trade_id) throw new Error('Trade ID is required');
    return await tradeRequest<PartnerInfo>(
      tradesContract.endpoints.revealPartnerInfo(trade.trade_id),
    );
  } catch (error) {
    log.error('[revealPartnerInfo] error:', error);
    throw error;
  }
}
