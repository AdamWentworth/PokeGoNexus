import {
  buildMatchedTradeCandidates,
  canMarkInstanceForTrade,
  findAvailableTradeInstances,
  findCaughtInstancesForBaseKey,
  findTradeableInstances,
  prepareTradeCandidateSets,
  resolveSelectedVariantId,
  resolveTradeCandidateDecision,
  toInstanceMap,
  type TradeCandidateDecision,
  type TradeCandidatePokemon,
  type TradeCandidateSets,
} from '@pokemongonexus/shared-domain/trade-proposal-candidates';

import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';

export type SelectedPokemon = TradeCandidatePokemon;

export type MatchedInstancePokemon = PokemonVariant & {
  instanceData: PokemonInstance;
};

export interface TradeProposalPayload {
  matchedInstances: MatchedInstancePokemon[];
  [key: string]: unknown;
}

export type TradeProposalDecision =
  | Exclude<TradeCandidateDecision, { kind: 'proposalReady' }>
  | { kind: 'proposalReady'; payload: TradeProposalPayload };

export type { TradeCandidateSets };

export {
  canMarkInstanceForTrade,
  findAvailableTradeInstances,
  findCaughtInstancesForBaseKey,
  findTradeableInstances,
  prepareTradeCandidateSets,
  resolveSelectedVariantId,
  toInstanceMap,
};

export const buildMatchedInstancesPayload = (
  selectedPokemon: SelectedPokemon,
  availableInstances: PokemonInstance[],
): TradeProposalPayload =>
  buildMatchedTradeCandidates(
    selectedPokemon,
    availableInstances,
  ) as unknown as TradeProposalPayload;

export const resolveTradeProposalDecision = (
  selectedPokemon: SelectedPokemon,
  selectedBaseKey: string,
  caughtInstances: PokemonInstance[],
  tradeableInstances: PokemonInstance[],
  allTrades: unknown[],
): TradeProposalDecision => {
  const decision = resolveTradeCandidateDecision(
    selectedPokemon,
    selectedBaseKey,
    caughtInstances,
    tradeableInstances,
    allTrades,
  );

  if (decision.kind !== 'proposalReady') return decision;

  return {
    kind: 'proposalReady',
    payload: decision.payload as unknown as TradeProposalPayload,
  };
};
