export const tradesContract = {
  endpoints: {
    list: '/trades',
    create: '/trades',
    accept: (tradeId: string) => `/trades/${encodeURIComponent(tradeId)}/accept`,
    deny: (tradeId: string) => `/trades/${encodeURIComponent(tradeId)}/deny`,
    cancel: (tradeId: string) => `/trades/${encodeURIComponent(tradeId)}/cancel`,
    complete: (tradeId: string) =>
      `/trades/${encodeURIComponent(tradeId)}/complete-confirmation`,
    repropose: (tradeId: string) =>
      `/trades/${encodeURIComponent(tradeId)}/repropose`,
    satisfaction: (tradeId: string) =>
      `/trades/${encodeURIComponent(tradeId)}/satisfaction`,
    remove: (tradeId: string) => `/trades/${encodeURIComponent(tradeId)}`,
    revealPartnerInfo: (tradeId: string) =>
      `/trades/${encodeURIComponent(tradeId)}/partner`,
  },
} as const;

export interface TradeRecord {
  trade_id?: string;
  trade_status: string;
  username_proposed?: string | null;
  username_accepting?: string | null;
  pokemon_instance_id_user_proposed?: string | null;
  pokemon_instance_id_user_accepting?: string | null;
  user_proposed_completion_confirmed?: boolean | null;
  user_accepting_completion_confirmed?: boolean | null;
  trade_proposal_date?: string | null;
  trade_accepted_date?: string | null;
  trade_completed_date?: string | null;
  trade_cancelled_date?: string | null;
  trade_cancelled_by?: string | null;
  trade_friendship_level?: string | null;
  trade_dust_cost?: number | null;
  is_lucky_trade?: boolean | number | null;
  trade_deleted_date?: string | null;
  user_1_trade_satisfaction?: boolean | null;
  user_2_trade_satisfaction?: boolean | null;
  last_update?: number | string | null;
  [key: string]: unknown;
}

export interface RelatedInstanceRecord {
  instance_id: string;
  [key: string]: unknown;
}

export interface TradeEnvelope {
  trade: TradeRecord & { trade_id: string };
  affected_instances: Record<string, RelatedInstanceRecord>;
}

export interface TradesEnvelope {
  trades: Array<TradeRecord & { trade_id: string }>;
  related_instances: Record<string, RelatedInstanceRecord>;
}

export interface TradeReference {
  trade_id?: string;
  usernames?: string[];
  [key: string]: unknown;
}

export interface PartnerInfo {
  sharingEnabled: boolean;
  trainerCode?: string | null;
  pokemonGoName?: string | null;
  coordinationMethod: 'campfire' | 'discord' | 'other' | 'none';
  coordinationHandle?: string | null;
  location?: string | null;
}

export interface RevealPartnerInfoRequest {
  trade: TradeReference;
}

export type TradeProposalPrimitive =
  | string
  | number
  | boolean
  | null
  | undefined;

export type TradeProposalInstanceData = Record<
  string,
  TradeProposalPrimitive
>;

export interface TradeProposalPokemonPayload {
  variant_id: string;
  instance_id?: string;
  instanceData: TradeProposalInstanceData;
}

export interface TradeProposalRequest {
  username_proposed: string;
  username_accepting: string;
  pokemon_instance_id_user_proposed: string;
  pokemon_instance_id_user_accepting: string;
  is_special_trade: boolean;
  is_registered_trade: boolean;
  is_lucky_trade: boolean;
  trade_dust_cost: number;
  trade_friendship_level: 1 | 2 | 3 | 4 | 5;
  user_1_trade_satisfaction: null;
  user_2_trade_satisfaction: null;
  pokemon: TradeProposalPokemonPayload;
  trade_accepted_date: null;
  trade_cancelled_by: null;
  trade_cancelled_date: null;
  trade_completed_date: null;
  trade_proposal_date: string;
  trade_status: 'proposed';
  last_update: number;
}

export interface AuthoritativeTradeProposalRequest {
  username_accepting: string;
  pokemon_instance_id_user_proposed: string;
  pokemon_instance_id_user_accepting: string;
  is_special_trade: boolean;
  is_registered_trade: boolean;
  is_lucky_trade: boolean;
  trade_dust_cost: number;
  trade_friendship_level: 1 | 2 | 3 | 4 | 5;
}
