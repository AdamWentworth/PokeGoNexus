import { useModal } from '@/contexts/ModalContext';
import { useTradeStore } from '@/features/trades/store/useTradeStore';
import type { Instances } from '@/types/instances';
import type { PokemonVariant } from '@/types/pokemonVariants';
import CancelledTradeView from '@/pages/Trades/views/CancelledTradeView';
import CompletedTradeView from '@/pages/Trades/views/CompletedTradeView';
import OffersTradeView from '@/pages/Trades/views/OffersTradeView';
import PendingTradeView from '@/pages/Trades/views/PendingTradeView';
import ProposedTradeView from '@/pages/Trades/views/ProposedTradeView';
import { handleAcceptTrade } from '@/pages/Trades/handlers/handleAcceptTrade';
import { handleCancelTrade } from '@/pages/Trades/handlers/handleCancelTrade';
import { handleCompleteTrade } from '@/pages/Trades/handlers/handleCompleteTrade';
import { handleDenyTrade } from '@/pages/Trades/handlers/handleDenyTrade';
import { handleReProposeTrade } from '@/pages/Trades/handlers/handleReProposeTrade';
import { handleThumbsUpTrade } from '@/pages/Trades/handlers/handleThumbsUpTrade';
import { usePokemonDetails } from '@/pages/Trades/hooks/usePokemonDetails';
import type { RelatedInstancesMap, TradeStatusFilter } from '@/pages/Trades/types';
import { getStoredUsername } from '@/utils/storage';
import type { TradeRecord } from '@shared-contracts/trades';
import type { ReactNode } from 'react';

import './TradeCard.base.css';
import './TradeCard.responsive.css';

type TradeCardTrade = TradeRecord;

type CanonicalTrade = TradeCardTrade & {
  trade_id: string;
  trade_status: string;
  last_update: number;
  username_proposed: string;
  username_accepting: string;
  pokemon_instance_id_user_proposed: string;
  pokemon_instance_id_user_accepting: string;
  user_proposed_completion_confirmed: boolean;
  user_accepting_completion_confirmed: boolean;
  trade_accepted_date: string | null;
  trade_completed_date: string | null;
  trade_cancelled_date: string | null;
  trade_cancelled_by: string | null;
  trade_deleted_date: string | null;
  trade_proposal_date: string;
  user_1_trade_satisfaction: boolean;
  user_2_trade_satisfaction: boolean;
};

type AcceptArgs = Parameters<typeof handleAcceptTrade>[0];
type DenyArgs = Parameters<typeof handleDenyTrade>[0];
type CompleteArgs = Parameters<typeof handleCompleteTrade>[0];
type CancelArgs = Parameters<typeof handleCancelTrade>[0];
type ReProposeArgs = Parameters<typeof handleReProposeTrade>[0];
type ThumbsUpArgs = Parameters<typeof handleThumbsUpTrade>[0];

interface TradeCardProps {
  trade: TradeCardTrade;
  relatedInstances: RelatedInstancesMap;
  selectedStatus: TradeStatusFilter;
  setInstances: (updatedData: Instances) => void | Promise<void>;
  variants: PokemonVariant[];
  instances?: Instances | null;
  loading: boolean;
  periodicUpdates: () => void;
}

const normalizeString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const normalizeNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const normalizeBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const normalizeNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const DEFAULT_ISO_TIMESTAMP = new Date(0).toISOString();

const toCanonicalTrade = (input: TradeCardTrade): CanonicalTrade => {
  const now = Date.now();
  return {
    ...input,
    trade_id: normalizeString(input.trade_id),
    trade_status: normalizeString(input.trade_status, 'proposed'),
    last_update: normalizeNumber(input.last_update, now),
    username_proposed: normalizeString(input.username_proposed),
    username_accepting: normalizeString(input.username_accepting),
    pokemon_instance_id_user_proposed: normalizeString(input.pokemon_instance_id_user_proposed),
    pokemon_instance_id_user_accepting: normalizeString(input.pokemon_instance_id_user_accepting),
    user_proposed_completion_confirmed: normalizeBoolean(input.user_proposed_completion_confirmed),
    user_accepting_completion_confirmed: normalizeBoolean(input.user_accepting_completion_confirmed),
    trade_accepted_date: normalizeNullableString(input.trade_accepted_date),
    trade_completed_date: normalizeNullableString(input.trade_completed_date),
    trade_cancelled_date: normalizeNullableString(input.trade_cancelled_date),
    trade_cancelled_by: normalizeNullableString(input.trade_cancelled_by),
    trade_deleted_date: normalizeNullableString(input.trade_deleted_date),
    trade_proposal_date: normalizeString(input.trade_proposal_date, DEFAULT_ISO_TIMESTAMP),
    user_1_trade_satisfaction: normalizeBoolean(input.user_1_trade_satisfaction),
    user_2_trade_satisfaction: normalizeBoolean(input.user_2_trade_satisfaction),
  };
};

function TradeCard({
  trade,
  relatedInstances,
  selectedStatus,
  setInstances,
  variants,
  instances,
  loading,
  periodicUpdates,
}: TradeCardProps) {
  const setTradeData = useTradeStore((state) => state.setTradeData);
  const trades = useTradeStore((state) => state.trades) as Record<string, TradeCardTrade>;
  const { alert, confirm } = useModal();

  const runTradeAction = async (
    action: () => Promise<unknown>,
    failurePrefix?: string,
  ) => {
    try {
      await action();
    } catch (error) {
      const detail =
        error instanceof Error && error.message
          ? error.message
          : 'The trade could not be updated. Please try again.';
      await alert(failurePrefix ? `${failurePrefix} ${detail}` : detail);
    }
  };

  const canonicalTrade = toCanonicalTrade(trade);
  const canonicalTrades: Record<string, CanonicalTrade> = Object.fromEntries(
    Object.entries(trades).map(([tradeId, tradeEntry]) => [tradeId, toCanonicalTrade(tradeEntry)]),
  );

  const currentUsername = getStoredUsername() ?? '';
  const usernameProposed = canonicalTrade.username_proposed;
  const isCurrentUserProposer = usernameProposed === currentUsername;
  const resolvedInstances = (instances ?? {}) as Instances;

  const currentUserInstanceId =
    (isCurrentUserProposer
      ? canonicalTrade.pokemon_instance_id_user_proposed
      : canonicalTrade.pokemon_instance_id_user_accepting) ?? '';

  const partnerInstanceId =
    (isCurrentUserProposer
      ? canonicalTrade.pokemon_instance_id_user_accepting
      : canonicalTrade.pokemon_instance_id_user_proposed) ?? '';

  const currentUserDetails = usePokemonDetails(
    currentUserInstanceId,
    variants,
    relatedInstances,
    resolvedInstances,
  );

  const partnerDetails = usePokemonDetails(
    partnerInstanceId,
    variants,
    relatedInstances,
    resolvedInstances,
  );

  // Handlers expect a Promise<void> setter. Store setter returns Promise<Record|void>.
  const persistTradeData = async (updatedTrades: Record<string, unknown>): Promise<void> => {
    await setTradeData(updatedTrades as unknown as Record<string, { trade_id: string; trade_status: string }>);
  };

  const handleAccept = async () => {
    const isConfirmed = await confirm('Are you sure you want to accept this trade?');
    if (!isConfirmed) return;

    const args: AcceptArgs = {
      trade: canonicalTrade as unknown as AcceptArgs['trade'],
      trades: canonicalTrades as unknown as AcceptArgs['trades'],
      setTradeData: async (updatedTrades) => {
        await persistTradeData(updatedTrades as unknown as Record<string, unknown>);
      },
      periodicUpdates,
    };
    await runTradeAction(() => handleAcceptTrade(args));
  };

  const handleDeny = async () => {
    const isConfirmed = await confirm('Are you sure you want to deny this trade?');
    if (!isConfirmed) return;

    const args: DenyArgs = {
      trade: canonicalTrade as unknown as DenyArgs['trade'],
      trades: canonicalTrades as unknown as DenyArgs['trades'],
      setTradeData: async (updatedTrades) => {
        await persistTradeData(updatedTrades as unknown as Record<string, unknown>);
      },
      periodicUpdates,
    };
    await runTradeAction(() => handleDenyTrade(args));
  };

  const handleComplete = async () => {
    const isConfirmed = await confirm('Are you sure you want to complete this trade?');
    if (!isConfirmed) return;

    const applyInstanceUpdates: CompleteArgs['setInstances'] = (updatedData) => {
      void setInstances(updatedData as Instances);
    };

    const args: CompleteArgs = {
      trade: canonicalTrade as unknown as CompleteArgs['trade'],
      trades: canonicalTrades as unknown as CompleteArgs['trades'],
      setTradeData: async (updatedTrades) => {
        await persistTradeData(updatedTrades as unknown as Record<string, unknown>);
      },
      periodicUpdates,
      relatedInstances: relatedInstances as unknown as CompleteArgs['relatedInstances'],
      instances: resolvedInstances as unknown as CompleteArgs['instances'],
      setInstances: applyInstanceUpdates,
      currentUsername,
    };
    await runTradeAction(() => handleCompleteTrade(args));
  };

  const handleCancel = async () => {
    const isConfirmed = await confirm('Are you sure you want to cancel this trade?');
    if (!isConfirmed) return;

    const args: CancelArgs = {
      trade: canonicalTrade as unknown as CancelArgs['trade'],
      trades: canonicalTrades as unknown as CancelArgs['trades'],
      setTradeData: async (updatedTrades) => {
        await persistTradeData(updatedTrades as unknown as Record<string, unknown>);
      },
      periodicUpdates,
      currentUsername,
    };
    await runTradeAction(
      () => handleCancelTrade(args),
      'Cancellation failed. This proposal is still active.',
    );
  };

  const handleRePropose = async () => {
    const isConfirmed = await confirm('Are you sure you want to re-propose this trade?');
    if (!isConfirmed) return;

    const args: ReProposeArgs = {
      trade: canonicalTrade as unknown as ReProposeArgs['trade'],
      trades: canonicalTrades as unknown as ReProposeArgs['trades'],
      setTradeData: async (updatedTrades) => {
        await persistTradeData(updatedTrades as unknown as Record<string, unknown>);
      },
      periodicUpdates,
      currentUsername,
    };
    await runTradeAction(() => handleReProposeTrade(args));
  };

  const handleThumbsUp = async () => {
    const args: ThumbsUpArgs = {
      trade: canonicalTrade as unknown as ThumbsUpArgs['trade'],
      trades: canonicalTrades as unknown as ThumbsUpArgs['trades'],
      setTradeData: async (updatedTrades) => {
        await persistTradeData(updatedTrades as unknown as Record<string, unknown>);
      },
      periodicUpdates,
      currentUsername,
    };
    await runTradeAction(() => handleThumbsUpTrade(args));
  };

  const normalizedStatus = selectedStatus.toLowerCase();
  const isProposed = normalizedStatus === 'proposed';
  const offeringHeading = isProposed ? 'Offered:' : 'Offering:';
  const receivingHeading = isProposed ? 'For Trade:' : 'Receiving:';
  const partnerUsername = isCurrentUserProposer
    ? canonicalTrade.username_accepting
    : canonicalTrade.username_proposed;
  const currentUserConfirmed = isCurrentUserProposer
    ? canonicalTrade.user_proposed_completion_confirmed
    : canonicalTrade.user_accepting_completion_confirmed;
  const activityCopy: Record<string, { label: string; title: string; description: string }> = {
    accepting: {
      label: 'Needs your response',
      title: `Offer from ${partnerUsername || 'trainer'}`,
      description: 'Review both Pokémon, then accept or deny this offer.',
    },
    proposed: {
      label: 'Waiting for trainer',
      title: `Sent to ${partnerUsername || 'trainer'}`,
      description: 'Your proposal is waiting for a response.',
    },
    pending: {
      label: currentUserConfirmed ? 'Waiting for final confirmation' : 'Ready to confirm',
      title: `Active trade with ${partnerUsername || 'trainer'}`,
      description: currentUserConfirmed
        ? 'You confirmed completion. The other trainer still needs to confirm.'
        : 'Coordinate the exchange, then confirm after it happens.',
    },
    completed: {
      label: 'Completed',
      title: `Traded with ${partnerUsername || 'trainer'}`,
      description: 'This trade was completed successfully.',
    },
    cancelled: {
      label: 'Closed',
      title: `Trade with ${partnerUsername || 'trainer'}`,
      description: 'This proposal was cancelled or denied.',
    },
  };
  const copy = activityCopy[normalizedStatus] ?? {
    label: selectedStatus,
    title: `Trade with ${partnerUsername || 'trainer'}`,
    description: '',
  };
  const wrapTradeView = (content: ReactNode) => (
    <article className={`trade-activity-card-shell status-${normalizedStatus}`}>
      <header className="trade-activity-card-header">
        <div>
          <span>{copy.label}</span>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <time dateTime={canonicalTrade.trade_proposal_date}>
          {new Date(canonicalTrade.trade_proposal_date).toLocaleDateString()}
        </time>
      </header>
      {content}
    </article>
  );

  if (normalizedStatus === 'accepting') {
    return wrapTradeView(
      <OffersTradeView
        trade={trade}
        currentUsername={currentUsername}
        currentUserDetails={currentUserDetails}
        partnerDetails={partnerDetails}
        loading={loading}
        handleAccept={handleAccept}
        handleDeny={handleDeny}
      />,
    );
  }

  if (normalizedStatus === 'proposed') {
    return wrapTradeView(
      <ProposedTradeView
        trade={trade}
        currentUserDetails={currentUserDetails}
        partnerDetails={partnerDetails}
        loading={loading}
        offeringHeading={offeringHeading}
        receivingHeading={receivingHeading}
        handleCancel={handleCancel}
      />,
    );
  }

  if (normalizedStatus === 'pending') {
    return wrapTradeView(
      <PendingTradeView
        trade={trade}
        currentUserDetails={currentUserDetails}
        partnerDetails={partnerDetails}
        loading={loading}
        handleComplete={handleComplete}
        handleCancel={handleCancel}
      />,
    );
  }

  if (normalizedStatus === 'cancelled') {
    return wrapTradeView(
      <CancelledTradeView
        trade={trade}
        currentUserDetails={currentUserDetails}
        partnerDetails={partnerDetails}
        loading={loading}
        handleRePropose={handleRePropose}
      />,
    );
  }

  if (normalizedStatus === 'completed') {
    return wrapTradeView(
      <CompletedTradeView
        trade={trade}
        currentUserDetails={currentUserDetails}
        partnerDetails={partnerDetails}
        loading={loading}
        handleThumbsUp={handleThumbsUp}
      />,
    );
  }

  return <div className="trade-card">Unknown trade status: {selectedStatus}</div>;
}

export default TradeCard;
