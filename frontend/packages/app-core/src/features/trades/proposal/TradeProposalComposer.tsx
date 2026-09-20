import React, { useEffect, useMemo, useState } from 'react';
import { FaComments } from 'react-icons/fa';
import { feedback } from '@/components/feedback';
import './TradeProposalComposer.css';

import FriendshipManager from '@/pages/Pokemon/features/instances/components/Wanted/FriendshipManager';
import useCalculateStardustCost from '@/pages/Pokemon/features/instances/hooks/useCalculateStardustCost';

import { useTradeStore } from '@/features/trades/store/useTradeStore';
import { useModal } from '@/contexts/ModalContext';
import { createScopedLogger } from '@/utils/logger';

import type { PokemonVariant } from '@/types/pokemonVariants';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { Instances } from '@/types/instances';
import type { TradeProposalPayload } from './proposalCandidateHelpers';
import {
  buildTradeProposalPreflight,
  buildTradeProposalRequest,
  findMatchedInstanceById,
  hasInstanceData,
  sanitizeInstanceData,
  tradeProposalErrorMessage,
} from './tradeProposalHelpers';
import { getStoredUsername } from '@/utils/storage';
import CloseButton from '@/components/CloseButton';
import OverlayPortal from '@/components/OverlayPortal';
import {
  TradeProposalActionRow,
  TradeProposalMatchedDetails,
  TradeProposalPokemonCard,
} from './TradeProposalSections';

const log = createScopedLogger('TradeProposal');

export interface TradeProposalContext {
  partnerUsername: string;
  requestedPokemon: PokemonVariant & { instanceData?: PokemonInstance };
  candidateOffers?: TradeProposalPayload | null;
  requestedPreferences?: {
    friendship_level?: number;
    pref_lucky?: boolean;
  } | null;
  ownedInstances?: Instances;
  relatedInstances: Instances;
}

export interface TradeProposalComposerProps {
  context: TradeProposalContext;
  onClose: () => void;
}

const TradeProposalComposer: React.FC<TradeProposalComposerProps> = ({
  context,
  onClose,
}) => {
  const {
    partnerUsername,
    requestedPokemon,
    candidateOffers,
    requestedPreferences,
    ownedInstances,
    relatedInstances,
  } = context;
  const proposeTrade = useTradeStore((s) => s.proposeTrade);
  const { alert } = useModal();

  const matchedInstances = useMemo(
    () =>
      Array.isArray(candidateOffers?.matchedInstances)
        ? candidateOffers.matchedInstances
        : [],
    [candidateOffers?.matchedInstances],
  );
  const [selectedMatchedInstance, setSelectedMatchedInstance] =
    useState<PokemonVariant | null>(matchedInstances[0] ?? null);

  const [friendship_level, setFriendshipLevel] = useState<number>(0);
  const [pref_lucky, setPrefLucky] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (requestedPreferences) {
      setFriendshipLevel(requestedPreferences.friendship_level ?? 0);
      setPrefLucky(requestedPreferences.pref_lucky ?? false);
    }
  }, [requestedPreferences]);

  useEffect(() => {
    if (matchedInstances.length) setSelectedMatchedInstance(matchedInstances[0]);
  }, [matchedInstances]);

  const { stardustCost, isSpecialTrade, isRegisteredTrade } = useCalculateStardustCost(
    friendship_level,
    requestedPokemon,
    selectedMatchedInstance?.instanceData ?? null,
    ownedInstances ?? {},
    relatedInstances,
  );

  const formattedStardustCost = stardustCost.toLocaleString();

  const handleInstanceChange = (instanceId: string): void => {
    setSelectedMatchedInstance(findMatchedInstanceById(matchedInstances, instanceId));
  };

  const handleProposeTrade = async (): Promise<void> => {
    const username_proposed = getStoredUsername();
    const preflight = buildTradeProposalPreflight({
      selectedMatchedInstance,
      friendshipLevel: friendship_level,
      usernameProposed: username_proposed,
    });
    if (!preflight.ok) {
      await alert(preflight.error);
      return;
    }
    const acceptingInstanceId = requestedPokemon.instanceData?.instance_id;
    if (
      typeof acceptingInstanceId !== 'string' ||
      acceptingInstanceId.trim() === ''
    ) {
      await alert(
        'This listing is missing its Pokémon instance. Close it, refresh the trainer’s catalog, and try again.',
      );
      return;
    }
    if (!Number.isFinite(stardustCost) || stardustCost < 0) {
      await alert(
        'The Stardust cost could not be calculated. Recheck the friendship level and try again.',
      );
      return;
    }
    const proposedInstanceId = preflight.proposedInstanceId;
    const normalizedFriendshipLevel = friendship_level as 1 | 2 | 3 | 4 | 5;
    const sanitizedInstanceData = sanitizeInstanceData(requestedPokemon.instanceData);
    const tradeData = buildTradeProposalRequest({
      usernameProposed: preflight.usernameProposed,
      usernameAccepting: partnerUsername,
      proposedInstanceId,
      acceptingInstanceId: acceptingInstanceId.trim(),
      isSpecialTrade,
      isRegisteredTrade,
      isLuckyTrade: pref_lucky,
      stardustCost,
      friendshipLevel: normalizedFriendshipLevel,
      variantId: requestedPokemon.variant_id,
      passedInInstanceId:
        typeof requestedPokemon.instanceData?.instance_id === 'string'
          ? requestedPokemon.instanceData.instance_id
          : undefined,
      sanitizedInstanceData,
    });

    log.debug('Submitting authoritative trade proposal', {
      partnerUsername,
      proposedInstanceId,
      acceptingInstanceId: acceptingInstanceId.trim(),
      friendshipLevel: normalizedFriendshipLevel,
      stardustCost,
    });

    setIsSubmitting(true);
    try {
      const result = await proposeTrade(tradeData);
      if (!result.success) {
        setIsSubmitting(false);
        await alert(tradeProposalErrorMessage(result.error));
        return;
      }
      onClose();
      feedback.success(`Trade proposal sent to ${partnerUsername}.`);
    } catch (err) {
      setIsSubmitting(false);
      log.error('Unexpected error while proposing trade:', err);
      await alert('An unexpected error occurred. Please try again.');
    }
  };

  if (!requestedPokemon) return <p>Missing Pokemon data.</p>;

  const wantPoke = hasInstanceData(requestedPokemon) ? requestedPokemon : undefined;
  const matchPoke = hasInstanceData(selectedMatchedInstance) ? selectedMatchedInstance : undefined;

  return (
    <OverlayPortal onClose={onClose} closeOnBackdrop>
      <div className="trade-proposal-overlay">
        <div className="trade-proposal-container">
        <CloseButton onClick={onClose} />

        <header className="trade-proposal-header">
          <span>Trade proposal</span>
          <h2>Review the exchange</h2>
          <p>Set your friendship details, confirm both Pokémon, then send the proposal.</p>
        </header>

        <section className="trade-proposal-friendship" aria-label="Friendship and trade access">
          <div>
            <span>Friendship</span>
            <strong>Trade conditions</strong>
          </div>
          <FriendshipManager
            friendship={friendship_level}
            setFriendship={setFriendshipLevel}
            isLucky={pref_lucky}
            setIsLucky={setPrefLucky}
            friendship_level={friendship_level}
            setFriendshipLevel={setFriendshipLevel}
            pref_lucky={pref_lucky}
            setPrefLucky={setPrefLucky}
            editMode
          />
        </section>

        <section className="trade-proposal-exchange" aria-label="Pokémon exchange">
          <div className="trade-proposal-party">
            <span>You offer</span>
            <TradeProposalPokemonCard
              pokemon={matchPoke}
              prefLucky={pref_lucky}
              fallbackAlt="Your Pokemon"
            />
            <TradeProposalMatchedDetails
              pokemon={matchPoke}
              matchedInstances={matchedInstances}
              onInstanceChange={handleInstanceChange}
            />
          </div>

          <div className="trade-proposal-arrow" aria-hidden="true">
            <img
              src="/images/pogo_trade_icon.png"
              alt=""
              className="trade-proposal-arrow-image"
            />
          </div>

          <div className="trade-proposal-party">
            <span>{partnerUsername} offers</span>
            <TradeProposalPokemonCard
              pokemon={wantPoke}
              prefLucky={pref_lucky}
              fallbackAlt="Wanted Pokemon"
            />
          </div>
        </section>

        <aside className="trade-proposal-coordination-note">
          <FaComments aria-hidden="true" />
          <p>
            Pokémon Go Nexus does not provide messaging. If this offer is accepted,
            use the trainer details they chose to share to coordinate externally.
          </p>
        </aside>

        <TradeProposalActionRow
          disabled={friendship_level === 0 || isSubmitting}
          isSubmitting={isSubmitting}
          formattedStardustCost={formattedStardustCost}
          isSpecialTrade={isSpecialTrade}
          isRemoteTrade={friendship_level === 5}
          onProposeTrade={handleProposeTrade}
        />
        </div>
      </div>
    </OverlayPortal>
  );
};

export default TradeProposalComposer;
