import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuthoritativeTradeProposalRequest,
  TradeEnvelope,
  TradesEnvelope,
} from '@pokemongonexus/shared-contracts/trades';
import { nativeCollectionQueryKeys } from '../collection/collectionQueries';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import {
  createNativeTradeProposal,
  deleteNativeTrade,
  getNativeTradePartnerInfo,
  getNativeTrades,
  runNativeTradeCommand,
  type NativeTradeCommand,
  updateNativeTradeSatisfaction,
} from '../../services/tradeApi';

export const nativeTradeQueryKeys = {
  root: ['native', 'trades'] as const,
  list: (userId: string) => ['native', 'trades', userId, 'list'] as const,
  partner: (userId: string, tradeId: string) => [
    'native',
    'trades',
    userId,
    tradeId,
    'partner',
  ] as const,
};

export const mergeNativeTradeEnvelope = (
  current: TradesEnvelope | undefined,
  envelope: TradeEnvelope,
): TradesEnvelope => {
  const existing = current?.trades ?? [];
  const incomingId = envelope.trade.trade_id;
  const found = existing.some((trade) => trade.trade_id === incomingId);
  const trades = found
    ? existing.map((trade) => trade.trade_id === incomingId ? envelope.trade : trade)
    : [envelope.trade, ...existing];

  return {
    ...current,
    trades,
    related_instances: {
      ...(current?.related_instances ?? {}),
      ...envelope.affected_instances,
    },
  };
};

export const removeNativeTradeFromEnvelope = (
  current: TradesEnvelope | undefined,
  tradeId: string,
): TradesEnvelope | undefined => current ? ({
  ...current,
  trades: current.trades.filter((trade) => trade.trade_id !== tradeId),
}) : current;

export const useNativeTradesQuery = (userId: string | null) => {
  const clients = useNativeApiClients();
  return useQuery({
    queryKey: nativeTradeQueryKeys.list(userId ?? 'signed-out'),
    queryFn: () => getNativeTrades(clients.users),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
};

export const useNativeCreateTradeProposal = (userId: string) => {
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (proposal: AuthoritativeTradeProposalRequest) => (
      createNativeTradeProposal(clients.users, proposal)
    ),
    onSuccess: (envelope) => {
      queryClient.setQueryData<TradesEnvelope>(
        nativeTradeQueryKeys.list(userId),
        (current) => mergeNativeTradeEnvelope(current, envelope),
      );
      void queryClient.invalidateQueries({ queryKey: nativeTradeQueryKeys.list(userId) });
      void queryClient.invalidateQueries({ queryKey: nativeCollectionQueryKeys.snapshot(userId) });
    },
  });
};

export const useNativeTradeCommand = (
  userId: string,
  command: NativeTradeCommand,
) => {
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tradeId: string) => runNativeTradeCommand(
      clients.users,
      command,
      tradeId,
    ),
    onSuccess: (envelope) => {
      queryClient.setQueryData<TradesEnvelope>(
        nativeTradeQueryKeys.list(userId),
        (current) => mergeNativeTradeEnvelope(current, envelope),
      );
      void queryClient.invalidateQueries({ queryKey: nativeTradeQueryKeys.list(userId) });
      if (Object.keys(envelope.affected_instances).length > 0) {
        void queryClient.invalidateQueries({ queryKey: nativeCollectionQueryKeys.snapshot(userId) });
      }
    },
  });
};

export const useNativeTradeSatisfactionMutation = (userId: string) => {
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tradeId, satisfied }: { tradeId: string; satisfied: boolean }) => (
      updateNativeTradeSatisfaction(clients.users, tradeId, satisfied)
    ),
    onSuccess: (envelope) => {
      queryClient.setQueryData<TradesEnvelope>(
        nativeTradeQueryKeys.list(userId),
        (current) => mergeNativeTradeEnvelope(current, envelope),
      );
      void queryClient.invalidateQueries({ queryKey: nativeTradeQueryKeys.list(userId) });
    },
  });
};

export const useNativeDeleteTradeMutation = (userId: string) => {
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tradeId: string) => {
      await deleteNativeTrade(clients.users, tradeId);
      return tradeId;
    },
    onSuccess: (tradeId) => {
      queryClient.setQueryData<TradesEnvelope>(
        nativeTradeQueryKeys.list(userId),
        (current) => removeNativeTradeFromEnvelope(current, tradeId),
      );
      void queryClient.invalidateQueries({ queryKey: nativeTradeQueryKeys.list(userId) });
    },
  });
};

export const useNativeTradePartnerQuery = (
  userId: string | null,
  tradeId: string | null,
  enabled = true,
) => {
  const clients = useNativeApiClients();
  return useQuery({
    queryKey: nativeTradeQueryKeys.partner(userId ?? 'signed-out', tradeId ?? 'closed'),
    queryFn: () => getNativeTradePartnerInfo(clients.users, tradeId ?? ''),
    enabled: Boolean(userId && tradeId && enabled),
    staleTime: 60_000,
  });
};
