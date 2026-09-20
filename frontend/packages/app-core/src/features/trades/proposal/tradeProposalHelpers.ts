import type { PokemonVariant } from '@/types/pokemonVariants';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type {
  TradeProposalInstanceData,
  TradeProposalRequest,
} from '@shared-contracts/trades';

export type SanitizedInstanceData = TradeProposalInstanceData;

type BuildTradeProposalRequestArgs = {
  usernameProposed: string;
  usernameAccepting: string;
  proposedInstanceId: string;
  acceptingInstanceId: string;
  isSpecialTrade: boolean;
  isRegisteredTrade: boolean;
  isLuckyTrade: boolean;
  stardustCost: number;
  friendshipLevel: 1 | 2 | 3 | 4 | 5;
  variantId: string;
  passedInInstanceId?: string;
  sanitizedInstanceData: SanitizedInstanceData;
  nowIso?: string;
  nowMs?: number;
};

type BuildTradeProposalPreflightArgs = {
  selectedMatchedInstance: PokemonVariant | null;
  friendshipLevel: number;
  usernameProposed: string | null;
};

export type TradeProposalPreflightResult =
  | {
      ok: true;
      proposedInstanceId: string;
      usernameProposed: string;
    }
  | {
      ok: false;
      error: string;
    };

export const hasInstanceData = (
  pokemon: PokemonVariant | null | undefined,
): pokemon is PokemonVariant & { instanceData: PokemonInstance } =>
  !!pokemon && !!pokemon.instanceData;

export const findMatchedInstanceById = (
  matchedInstances: PokemonVariant[],
  instanceId: string,
): PokemonVariant | null =>
  matchedInstances.find((instance) => instance.instanceData?.instance_id === instanceId) ??
  null;

export const parseUsernameFromStoredUser = (rawUser: string | null): string | null => {
  if (!rawUser) return null;
  try {
    const parsed = JSON.parse(rawUser) as { username?: unknown };
    return typeof parsed.username === 'string' && parsed.username.length > 0
      ? parsed.username
      : null;
  } catch {
    return null;
  }
};

export const sanitizeInstanceData = (
  instanceData: Partial<PokemonInstance> | undefined,
): SanitizedInstanceData =>
  Object.entries(instanceData ?? {}).reduce<SanitizedInstanceData>((acc, [key, value]) => {
    if (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      acc[key] = value;
    }
    return acc;
  }, {});

export const buildTradeProposalPreflight = ({
  selectedMatchedInstance,
  friendshipLevel,
  usernameProposed,
}: BuildTradeProposalPreflightArgs): TradeProposalPreflightResult => {
  if (!hasInstanceData(selectedMatchedInstance)) {
    return {
      ok: false,
      error: 'Please select which instance to trade.',
    };
  }

  if (
    !Number.isInteger(friendshipLevel) ||
    friendshipLevel < 1 ||
    friendshipLevel > 5
  ) {
    return {
      ok: false,
      error: 'Please select a valid friendship level (1-5).',
    };
  }

  if (!usernameProposed) {
    return {
      ok: false,
      error: 'Could not determine your username. Please sign in again.',
    };
  }

  const proposedInstanceId = selectedMatchedInstance.instanceData.instance_id ?? '';
  if (!proposedInstanceId) {
    return {
      ok: false,
      error: 'Selected trade instance is missing an instance id.',
    };
  }

  return {
    ok: true,
    proposedInstanceId,
    usernameProposed,
  };
};

export const tradeProposalErrorMessage = (error: string | undefined): string => {
  const normalized = error?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return 'The trade proposal could not be created. Please try again.';
  }
  if (normalized.includes('already exists')) {
    return 'This trade proposal already exists.';
  }
  if (normalized.includes('trade state has changed')) {
    return 'One of these Pokémon is already involved in an active trade. Refresh your trades and choose another copy.';
  }
  if (normalized.includes('no longer marked for trade')) {
    return 'One of these Pokémon is no longer marked For Trade. Refresh the listing and choose again.';
  }
  if (normalized.includes('lucky pokémon cannot be traded')) {
    return 'Lucky Pokémon cannot be traded again. Choose another copy.';
  }
  if (normalized.includes('invalid trade proposal')) {
    return 'The proposal contains invalid Pokémon or friendship details. Close this listing, reopen it, and choose the trade again.';
  }
  if (normalized.includes('trade partner not found')) {
    return 'This trainer is no longer available for trading.';
  }
  if (normalized.includes('trade unavailable')) {
    return 'This trade is unavailable because the trainer’s privacy or block settings changed.';
  }
  return error?.trim() || 'The trade proposal could not be created. Please try again.';
};

export const buildTradeProposalRequest = ({
  usernameProposed,
  usernameAccepting,
  proposedInstanceId,
  acceptingInstanceId,
  isSpecialTrade,
  isRegisteredTrade,
  isLuckyTrade,
  stardustCost,
  friendshipLevel,
  variantId,
  passedInInstanceId,
  sanitizedInstanceData,
  nowIso = new Date().toISOString(),
  nowMs = Date.now(),
}: BuildTradeProposalRequestArgs): TradeProposalRequest => ({
  username_proposed: usernameProposed,
  username_accepting: usernameAccepting,
  pokemon_instance_id_user_proposed: proposedInstanceId,
  pokemon_instance_id_user_accepting: acceptingInstanceId,
  is_special_trade: isSpecialTrade,
  is_registered_trade: isRegisteredTrade,
  is_lucky_trade: isLuckyTrade,
  trade_dust_cost: stardustCost,
  trade_friendship_level: friendshipLevel,
  user_1_trade_satisfaction: null,
  user_2_trade_satisfaction: null,
  pokemon: {
    variant_id: variantId,
    instance_id: passedInInstanceId,
    instanceData: sanitizedInstanceData,
  },
  trade_accepted_date: null,
  trade_cancelled_by: null,
  trade_cancelled_date: null,
  trade_completed_date: null,
  trade_proposal_date: nowIso,
  trade_status: 'proposed',
  last_update: nowMs,
});
