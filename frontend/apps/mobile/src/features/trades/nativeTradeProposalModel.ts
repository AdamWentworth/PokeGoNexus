import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import {
  prepareTradeCandidateSets,
  resolveTradeCandidateDecision,
  type TradeCandidateDecision,
} from '@pokemongonexus/shared-domain/trade-proposal-candidates';
import type { NativeInstanceDetail } from '../collection/collectionModel';

export type NativeTradeProposalContext = {
  acceptingInstanceId: string;
  candidateVariantId: string;
  friendshipLevel: number;
  luckyRequested: boolean;
  partnerPokemon: NativeInstanceDetail;
};

export type NativeTradeProposalSelection =
  | { kind: 'invalid'; message: string }
  | ({ kind: 'noCaught' } & NativeTradeProposalContext)
  | ({ kind: 'onlyTradeLocked' } & NativeTradeProposalContext)
  | ({
      kind: 'needsTradeSelection';
      caughtInstances: PokemonInstance[];
    } & NativeTradeProposalContext)
  | ({ kind: 'noAvailableTradeable' } & NativeTradeProposalContext)
  | ({
      kind: 'proposalReady';
      offeredInstances: PokemonInstance[];
    } & NativeTradeProposalContext);

const normalizedFriendshipLevel = (instance: PokemonInstance): number => {
  const value = Number(instance.friendship_level);
  if (!Number.isInteger(value) || value < 1 || value > 5) return 0;
  return value;
};

const proposalContext = (
  partnerPokemon: NativeInstanceDetail,
  candidatePokemon: NativeInstanceDetail,
  preferenceInstance: PokemonInstance,
): NativeTradeProposalContext | null => {
  const acceptingInstanceId = partnerPokemon.instance?.instance_id?.trim();
  const candidateVariantId = candidatePokemon.instance?.variant_id?.trim();
  if (!acceptingInstanceId || !candidateVariantId) return null;

  return {
    acceptingInstanceId,
    candidateVariantId,
    friendshipLevel: normalizedFriendshipLevel(preferenceInstance),
    luckyRequested: Boolean(preferenceInstance.pref_lucky),
    partnerPokemon,
  };
};

const withContext = (
  context: NativeTradeProposalContext,
  decision: TradeCandidateDecision,
): NativeTradeProposalSelection => {
  switch (decision.kind) {
    case 'noCaught':
    case 'onlyTradeLocked':
    case 'noAvailableTradeable':
      return { ...context, kind: decision.kind };
    case 'needsTradeSelection':
      return {
        ...context,
        kind: decision.kind,
        caughtInstances: decision.caughtInstances,
      };
    case 'proposalReady':
      return {
        ...context,
        kind: decision.kind,
        offeredInstances: decision.payload.matchedInstances.map(
          (candidate) => candidate.instanceData,
        ),
      };
  }
};

export const buildNativeTradeProposalSelection = ({
  listing,
  selectedTarget,
  ownedInstances,
  activeTrades,
  parseVariantId,
}: {
  listing: NativeInstanceDetail;
  selectedTarget: NativeInstanceDetail;
  ownedInstances: Record<string, PokemonInstance>;
  activeTrades: unknown[];
  parseVariantId: (input: string) => { baseKey: string };
}): NativeTradeProposalSelection => {
  const listingInstance = listing.instance;
  const targetInstance = selectedTarget.instance;
  if (!listingInstance || !targetInstance) {
    return {
      kind: 'invalid',
      message: 'This trade listing is missing its Pokémon details.',
    };
  }

  const listingIsTrade = listing.row.status === 'trade';
  const listingIsWanted = listing.row.status === 'wanted';
  if (!listingIsTrade && !listingIsWanted) {
    return {
      kind: 'invalid',
      message: 'Only For Trade or Wanted listings can start a proposal.',
    };
  }

  if (listingIsTrade && selectedTarget.row.status !== 'wanted') {
    return {
      kind: 'invalid',
      message: 'Choose one of this trainer’s Wanted targets.',
    };
  }
  if (listingIsWanted && selectedTarget.row.status !== 'trade') {
    return {
      kind: 'invalid',
      message: 'Choose one of this trainer’s For Trade Pokémon.',
    };
  }

  const partnerPokemon = listingIsTrade ? listing : selectedTarget;
  const candidatePokemon = listingIsTrade ? selectedTarget : listing;
  const preferenceInstance = listingIsTrade ? targetInstance : listingInstance;
  if (!partnerPokemon.instance?.is_for_trade) {
    return {
      kind: 'invalid',
      message: 'The trainer’s Pokémon is no longer marked For Trade.',
    };
  }

  const context = proposalContext(
    partnerPokemon,
    candidatePokemon,
    preferenceInstance,
  );
  if (!context) {
    return {
      kind: 'invalid',
      message: 'This trade listing is missing a required instance or variant id.',
    };
  }

  const selectedPokemon = {
    key: context.candidateVariantId,
    variant_id: context.candidateVariantId,
    name: candidatePokemon.row.name,
  };
  const candidateSets = prepareTradeCandidateSets(
    selectedPokemon,
    Object.values(ownedInstances),
    parseVariantId,
  );
  const decision = resolveTradeCandidateDecision(
    selectedPokemon,
    candidateSets.selectedBaseKey,
    candidateSets.caughtInstances,
    candidateSets.tradeableInstances,
    activeTrades,
  );

  return withContext(context, decision);
};
