import { useState } from 'react';

import { getAllInstances } from '@/db/instancesDB';
import { fetchTrades } from '@/services/tradeService';
import type { Instances } from '@/types/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';
import { parseVariantId } from '@/utils/PokemonIDUtils';
import { createScopedLogger } from '@/utils/logger';

import {
  prepareTradeCandidateSets,
  resolveTradeProposalDecision,
  type TradeProposalPayload,
  type SelectedPokemon,
} from './proposalCandidateHelpers';

const log = createScopedLogger('useTradeProposalFlow');

type AlertFn = (message: string) => void | Promise<void>;

export interface UseTradeProposalFlowParams {
  selectedPokemon: SelectedPokemon | null;
  closeOverlay: () => void;
  alert: AlertFn;
  fetchInstances?: () => Promise<PokemonInstance[]>;
  fetchTrades?: () => Promise<unknown[]>;
}

export interface UseTradeProposalFlowResult {
  myInstances: Instances | undefined;
  isTradeProposalOpen: boolean;
  tradeClickedPokemon: TradeProposalPayload | null;
  isUpdateForTradeModalOpen: boolean;
  caughtInstancesToTrade: PokemonInstance[];
  currentBaseKey: string | null;
  proposeTrade: (pokemonOverride?: SelectedPokemon) => Promise<void>;
  closeTradeProposal: () => void;
  closeTradeSelectionModal: () => void;
}

const defaultFetchTrades = async (): Promise<unknown[]> =>
  (await fetchTrades()).trades;

const useTradeProposalFlow = ({
  selectedPokemon,
  closeOverlay,
  alert,
  fetchInstances = getAllInstances,
  fetchTrades = defaultFetchTrades,
}: UseTradeProposalFlowParams): UseTradeProposalFlowResult => {
  const [myInstances, setMyInstances] = useState<Instances | undefined>();
  const [isTradeProposalOpen, setIsTradeProposalOpen] = useState(false);
  const [tradeClickedPokemon, setTradeClickedPokemon] = useState<TradeProposalPayload | null>(
    null,
  );
  const [isUpdateForTradeModalOpen, setIsUpdateForTradeModalOpen] = useState(false);
  const [caughtInstancesToTrade, setCaughtInstancesToTrade] = useState<PokemonInstance[]>([]);
  const [currentBaseKey, setCurrentBaseKey] = useState<string | null>(null);

  const proposeTrade = async (pokemonOverride?: SelectedPokemon) => {
    const proposalPokemon = pokemonOverride ?? selectedPokemon;
    if (!proposalPokemon) {
      log.debug('No selectedPokemon. Aborting trade proposal.');
      return;
    }

    let userInstances: PokemonInstance[] = [];
    try {
      userInstances = await fetchInstances();
    } catch (error) {
      log.error('Failed to fetch user instances from IndexedDB:', error);
      await alert('Could not fetch your instances. Aborting trade proposal.');
      return;
    }

    const { selectedBaseKey, hashedInstances, caughtInstances, tradeableInstances } =
      prepareTradeCandidateSets(proposalPokemon, userInstances, parseVariantId);

    log.debug('Hashed ownership data prepared.', {
      count: Object.keys(hashedInstances).length,
    });
    log.debug('Caught instances after filter.', { count: caughtInstances.length });

    setMyInstances(hashedInstances);

    let decision: ReturnType<typeof resolveTradeProposalDecision>;
    if (tradeableInstances.length > 0) {
      try {
        const allTrades = await fetchTrades();
        decision = resolveTradeProposalDecision(
          proposalPokemon,
          selectedBaseKey,
          caughtInstances,
          tradeableInstances,
          allTrades,
        );
      } catch (error) {
        log.error('Failed to fetch or process trades data:', error);
        await alert('Could not verify trade availability. Please try again.');
        return;
      }
    } else {
      decision = resolveTradeProposalDecision(
        proposalPokemon,
        selectedBaseKey,
        caughtInstances,
        tradeableInstances,
        [],
      );
    }

    switch (decision.kind) {
      case 'noCaught':
        await alert('You do not have this Pokemon caught, so you cannot propose a trade.');
        return;
      case 'onlyTradeLocked':
        await alert(
          'You have this Pokemon, but your caught copies are Lucky and cannot be traded again.',
        );
        return;
      case 'noAvailableTradeable':
        await alert(
          'All For Trade copies of this Pokemon are already involved in active trade proposals. Choose another Pokemon or cancel the existing proposal first.',
        );
        return;
      case 'needsTradeSelection':
        setCaughtInstancesToTrade(decision.caughtInstances);
        setCurrentBaseKey(decision.selectedBaseKey);
        setIsUpdateForTradeModalOpen(true);
        return;
      case 'proposalReady':
        setTradeClickedPokemon(decision.payload);
        closeOverlay();
        setIsTradeProposalOpen(true);
        return;
    }
  };

  const closeTradeProposal = () => {
    setIsTradeProposalOpen(false);
    setTradeClickedPokemon(null);
  };

  const closeTradeSelectionModal = () => {
    setIsUpdateForTradeModalOpen(false);
  };

  return {
    myInstances,
    isTradeProposalOpen,
    tradeClickedPokemon,
    isUpdateForTradeModalOpen,
    caughtInstancesToTrade,
    currentBaseKey,
    proposeTrade,
    closeTradeProposal,
    closeTradeSelectionModal,
  };
};

export default useTradeProposalFlow;
