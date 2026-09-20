import type { TradeRecord } from '@pokemongonexus/shared-contracts/trades';
import type { TradeActivityFilter } from '@pokemongonexus/shared-domain/trade-activity';

export type NativeTradeParticipantRole = 'proposer' | 'accepter';

export type NativeTradeActivityAction =
  | 'accept'
  | 'deny'
  | 'cancel'
  | 'coordinate'
  | 'complete'
  | 'repropose'
  | 'satisfy';

export type NativeTradeActivityActionModel = {
  action: NativeTradeActivityAction;
  disabled?: boolean;
  label: string;
  selected?: boolean;
  tone: 'primary' | 'secondary' | 'destructive';
};

export type NativeTradeActivityModel = {
  actions: NativeTradeActivityActionModel[];
  activityFilter: TradeActivityFilter;
  cancelledBy: string | null;
  cancellationTimestamp: string | null;
  completionTimestamp: string | null;
  currentUserConfirmed: boolean;
  currentUserInstanceId: string;
  currentUserSatisfaction: boolean | null;
  currentUsername: string;
  description: string;
  displayTimestamp: string | null;
  friendshipLevel: 0 | 1 | 2 | 3 | 4 | 5;
  isLuckyTrade: boolean;
  isRemoteTrade: boolean;
  label: string;
  partnerConfirmed: boolean;
  partnerInstanceId: string;
  partnerUsername: string;
  participantRole: NativeTradeParticipantRole;
  stardustCost: number | null;
  status: 'proposed' | 'pending' | 'completed' | 'cancelled' | 'denied';
  title: string;
  tradeId: string;
};

const normalizeString = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const normalizeBoolean = (value: unknown): boolean => (
  value === true || value === 1 || value === '1'
);

const FRIENDSHIP_LEVELS: Record<string, 1 | 2 | 3 | 4 | 5> = {
  good: 1,
  great: 2,
  ultra: 3,
  best: 4,
  forever: 5,
};

export const normalizeTradeFriendshipLevel = (
  value: unknown,
): 0 | 1 | 2 | 3 | 4 | 5 => {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5) {
    return value as 1 | 2 | 3 | 4 | 5;
  }
  const normalized = normalizeString(value).toLocaleLowerCase();
  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) {
    return numeric as 1 | 2 | 3 | 4 | 5;
  }
  return FRIENDSHIP_LEVELS[normalized] ?? 0;
};

const normalizeSatisfaction = (value: unknown): boolean | null => (
  typeof value === 'boolean' ? value : null
);

const normalizeCost = (value: unknown): number | null => {
  const cost = Number(value);
  return Number.isFinite(cost) && cost >= 0 ? cost : null;
};

const activityActions = ({
  activityFilter,
  currentUserConfirmed,
  currentUserSatisfaction,
}: Pick<
  NativeTradeActivityModel,
  'activityFilter' | 'currentUserConfirmed' | 'currentUserSatisfaction'
>): NativeTradeActivityActionModel[] => {
  switch (activityFilter) {
    case 'Accepting':
      return [
        { action: 'accept', label: 'Accept offer', tone: 'primary' },
        { action: 'deny', label: 'Deny', tone: 'destructive' },
      ];
    case 'Proposed':
      return [{ action: 'cancel', label: 'Cancel proposal', tone: 'destructive' }];
    case 'Pending':
      return [
        { action: 'coordinate', label: 'Coordinate trade', tone: 'secondary' },
        {
          action: 'complete',
          disabled: currentUserConfirmed,
          label: currentUserConfirmed ? 'Awaiting Partner...' : 'Confirm Complete',
          tone: 'primary',
        },
        { action: 'cancel', label: 'Cancel', tone: 'destructive' },
      ];
    case 'Completed':
      return [
        {
          action: 'satisfy',
          label: currentUserSatisfaction === true ? 'Feedback saved' : 'Mark as satisfying',
          selected: currentUserSatisfaction === true,
          tone: 'primary',
        },
      ];
    case 'Cancelled':
      return [{ action: 'repropose', label: 'Re-Propose Trade', tone: 'primary' }];
  }
};

export const buildNativeTradeActivityModel = (
  trade: TradeRecord,
  currentUsername: string,
): NativeTradeActivityModel | null => {
  const tradeId = normalizeString(trade.trade_id);
  const username = currentUsername.trim();
  const proposer = normalizeString(trade.username_proposed);
  const accepter = normalizeString(trade.username_accepting);
  if (!tradeId || !username || !proposer || !accepter) return null;

  const participantRole: NativeTradeParticipantRole | null = username === proposer
    ? 'proposer'
    : username === accepter
      ? 'accepter'
      : null;
  if (!participantRole) return null;

  const rawStatus = normalizeString(trade.trade_status).toLocaleLowerCase();
  if (!['proposed', 'pending', 'completed', 'cancelled', 'denied'].includes(rawStatus)) {
    return null;
  }
  const status = rawStatus as NativeTradeActivityModel['status'];
  const isProposer = participantRole === 'proposer';
  const partnerUsername = isProposer ? accepter : proposer;
  const currentUserInstanceId = normalizeString(
    isProposer
      ? trade.pokemon_instance_id_user_proposed
      : trade.pokemon_instance_id_user_accepting,
  );
  const partnerInstanceId = normalizeString(
    isProposer
      ? trade.pokemon_instance_id_user_accepting
      : trade.pokemon_instance_id_user_proposed,
  );
  if (!currentUserInstanceId || !partnerInstanceId) return null;

  const currentUserConfirmed = normalizeBoolean(
    isProposer
      ? trade.user_proposed_completion_confirmed
      : trade.user_accepting_completion_confirmed,
  );
  const partnerConfirmed = normalizeBoolean(
    isProposer
      ? trade.user_accepting_completion_confirmed
      : trade.user_proposed_completion_confirmed,
  );
  const currentUserSatisfaction = normalizeSatisfaction(
    isProposer ? trade.user_1_trade_satisfaction : trade.user_2_trade_satisfaction,
  );

  const activityFilter: TradeActivityFilter = status === 'proposed'
    ? isProposer ? 'Proposed' : 'Accepting'
    : status === 'pending'
      ? 'Pending'
      : status === 'completed'
        ? 'Completed'
        : 'Cancelled';

  const copy = activityFilter === 'Accepting'
    ? {
        label: 'Needs your response',
        title: `Offer from ${partnerUsername}`,
        description: 'Review both Pokémon, then accept or deny this offer.',
      }
    : activityFilter === 'Proposed'
      ? {
          label: 'Waiting for trainer',
          title: `Sent to ${partnerUsername}`,
          description: 'Your proposal is waiting for a response.',
        }
      : activityFilter === 'Pending'
        ? {
            label: currentUserConfirmed ? 'Waiting for final confirmation' : 'Ready to confirm',
            title: `Active trade with ${partnerUsername}`,
            description: currentUserConfirmed
              ? 'You confirmed completion. The other trainer still needs to confirm.'
              : 'Coordinate the exchange, then confirm after it happens.',
          }
        : activityFilter === 'Completed'
          ? {
              label: 'Completed',
              title: `Traded with ${partnerUsername}`,
              description: 'This trade was completed successfully.',
            }
          : {
              label: 'Closed',
              title: `Trade with ${partnerUsername}`,
              description: 'This proposal was cancelled or denied.',
            };
  const friendshipLevel = normalizeTradeFriendshipLevel(trade.trade_friendship_level);

  const model: NativeTradeActivityModel = {
    actions: [],
    activityFilter,
    cancelledBy: normalizeString(trade.trade_cancelled_by) || null,
    cancellationTimestamp: normalizeString(trade.trade_cancelled_date) || null,
    completionTimestamp: normalizeString(trade.trade_completed_date) || null,
    currentUserConfirmed,
    currentUserInstanceId,
    currentUserSatisfaction,
    currentUsername: username,
    description: copy.description,
    // Vite's activity-card header consistently shows the proposal date. Status-
    // specific timestamps remain part of the underlying trade record rather
    // than silently replacing the header's meaning.
    displayTimestamp: normalizeString(trade.trade_proposal_date) || null,
    friendshipLevel,
    isLuckyTrade: normalizeBoolean(trade.is_lucky_trade),
    isRemoteTrade: friendshipLevel === 5,
    label: copy.label,
    partnerConfirmed,
    partnerInstanceId,
    partnerUsername,
    participantRole,
    stardustCost: normalizeCost(trade.trade_dust_cost),
    status,
    title: copy.title,
    tradeId,
  };
  model.actions = activityActions(model);
  return model;
};
