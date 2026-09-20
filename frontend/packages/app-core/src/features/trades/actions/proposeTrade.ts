// proposeTrade.ts

import { createTrade } from '@/services/tradeService';
import type {
  RelatedInstanceRecord,
  TradeProposalRequest,
  TradeRecord,
} from '@shared-contracts/trades';

type TradeData = TradeProposalRequest;

type TradeEntry = TradeRecord & {
  trade_id: string;
  username_proposed: string;
  username_accepting: string;
  pokemon_instance_id_user_proposed: string;
  pokemon_instance_id_user_accepting: string | null;
  is_special_trade: number;
  is_registered_trade: number;
  is_lucky_trade: number;
  trade_dust_cost: number;
  trade_friendship_level: string;
  trade_status: string;
  trade_proposal_date: string;
  last_update: number;
};

export async function proposeTrade(tradeData: TradeData): Promise<{
  tradeEntry: TradeEntry;
  relatedInstanceData: RelatedInstanceRecord;
}> {
  const {
    username_accepting,
    pokemon_instance_id_user_proposed,
    pokemon_instance_id_user_accepting = null,
    is_special_trade = false,
    is_registered_trade = false,
    trade_dust_cost = 0,
    is_lucky_trade = false,
    trade_friendship_level = 1,
  } = tradeData;

  if (!username_accepting || typeof username_accepting !== 'string') {
    throw new Error('Invalid or missing "username_accepting".');
  }

  if (!pokemon_instance_id_user_proposed || typeof pokemon_instance_id_user_proposed !== 'string') {
    throw new Error('Invalid or missing "pokemon_instance_id_user_proposed".');
  }

  if (pokemon_instance_id_user_accepting && typeof pokemon_instance_id_user_accepting !== 'string') {
    throw new Error('"pokemon_instance_id_user_accepting" must be a string or null.');
  }

  if (![1, 2, 3, 4, 5].includes(trade_friendship_level)) {
    throw new Error('"trade_friendship_level" must be an integer between 1 and 5.');
  }

  const response = await createTrade({
    username_accepting,
    pokemon_instance_id_user_proposed,
    pokemon_instance_id_user_accepting:
      pokemon_instance_id_user_accepting ?? '',
    is_special_trade,
    is_registered_trade,
    is_lucky_trade,
    trade_dust_cost,
    trade_friendship_level,
  });
  const tradeEntry = response.trade as TradeEntry;
  const relatedInstanceData =
    response.affected_instances[pokemon_instance_id_user_accepting ?? ''] ??
    response.affected_instances[pokemon_instance_id_user_proposed];
  if (!relatedInstanceData) {
    throw new Error('Trade was created without its Pokémon details.');
  }

  return {
    tradeEntry,
    relatedInstanceData
  };
}
