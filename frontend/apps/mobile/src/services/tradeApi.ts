import type {
  AuthoritativeTradeProposalRequest,
  PartnerInfo,
  TradeEnvelope,
  TradesEnvelope,
} from '@pokemongonexus/shared-contracts/trades';
import { tradesContract } from '@pokemongonexus/shared-contracts/trades';
import type { NativeUsersApiClient } from './nativeApiClients';

type NativeTradeClient = Pick<
  NativeUsersApiClient,
  'delete' | 'get' | 'post' | 'put'
>;

export type NativeTradeCommand =
  | 'accept'
  | 'deny'
  | 'cancel'
  | 'complete'
  | 'repropose';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const validateTradesEnvelope = (value: TradesEnvelope): TradesEnvelope => {
  if (!isRecord(value) || !Array.isArray(value.trades)) {
    throw new Error('The trades response is invalid.');
  }
  if (!isRecord(value.related_instances)) {
    throw new Error('The trades response contains invalid Pokémon data.');
  }
  if (value.trades.some((trade) => !isRecord(trade) || !trade.trade_id)) {
    throw new Error('The trades response contains an invalid trade.');
  }
  return value;
};

const validateTradeEnvelope = (value: TradeEnvelope): TradeEnvelope => {
  if (!isRecord(value) || !isRecord(value.trade) || !value.trade.trade_id) {
    throw new Error('The trade proposal response is invalid.');
  }
  if (!isRecord(value.affected_instances)) {
    throw new Error('The trade proposal response contains invalid Pokémon data.');
  }
  return value;
};

const requireTradeId = (tradeId: string): string => {
  const normalized = tradeId.trim();
  if (!normalized) throw new Error('Trade ID is required.');
  return normalized;
};

const validatePartnerInfo = (value: PartnerInfo): PartnerInfo => {
  if (!isRecord(value) || typeof value.sharingEnabled !== 'boolean') {
    throw new Error('The partner information response is invalid.');
  }
  if (!['campfire', 'discord', 'other', 'none'].includes(value.coordinationMethod)) {
    throw new Error('The partner information response has an invalid coordination method.');
  }
  return value;
};

export const getNativeTrades = async (
  usersClient: Pick<NativeTradeClient, 'get'>,
): Promise<TradesEnvelope> => validateTradesEnvelope(
  await usersClient.get<TradesEnvelope>(tradesContract.endpoints.list),
);

export const createNativeTradeProposal = async (
  usersClient: Pick<NativeTradeClient, 'post'>,
  proposal: AuthoritativeTradeProposalRequest,
): Promise<TradeEnvelope> => validateTradeEnvelope(
  await usersClient.post<TradeEnvelope>(
    tradesContract.endpoints.create,
    proposal,
  ),
);

const commandEndpoint = (
  command: NativeTradeCommand,
  tradeId: string,
): string => {
  const id = requireTradeId(tradeId);
  switch (command) {
    case 'accept': return tradesContract.endpoints.accept(id);
    case 'deny': return tradesContract.endpoints.deny(id);
    case 'cancel': return tradesContract.endpoints.cancel(id);
    case 'complete': return tradesContract.endpoints.complete(id);
    case 'repropose': return tradesContract.endpoints.repropose(id);
  }
};

export const runNativeTradeCommand = async (
  usersClient: Pick<NativeTradeClient, 'post'>,
  command: NativeTradeCommand,
  tradeId: string,
): Promise<TradeEnvelope> => validateTradeEnvelope(
  await usersClient.post<TradeEnvelope>(commandEndpoint(command, tradeId)),
);

export const updateNativeTradeSatisfaction = async (
  usersClient: Pick<NativeTradeClient, 'put'>,
  tradeId: string,
  satisfied: boolean,
): Promise<TradeEnvelope> => validateTradeEnvelope(
  await usersClient.put<TradeEnvelope>(
    tradesContract.endpoints.satisfaction(requireTradeId(tradeId)),
    { satisfied },
  ),
);

export const deleteNativeTrade = async (
  usersClient: Pick<NativeTradeClient, 'delete'>,
  tradeId: string,
): Promise<void> => {
  await usersClient.delete<void>(
    tradesContract.endpoints.remove(requireTradeId(tradeId)),
  );
};

export const getNativeTradePartnerInfo = async (
  usersClient: Pick<NativeTradeClient, 'get'>,
  tradeId: string,
): Promise<PartnerInfo> => validatePartnerInfo(
  await usersClient.get<PartnerInfo>(
    tradesContract.endpoints.revealPartnerInfo(requireTradeId(tradeId)),
  ),
);
