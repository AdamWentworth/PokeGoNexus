import type { TradeRecord } from '@pokemongonexus/shared-contracts/trades';
import {
  buildNativeTradeActivityModel,
  normalizeTradeFriendshipLevel,
} from '../../../../src/features/trades/nativeTradeActivityModel';

const trade = (overrides: Partial<TradeRecord> = {}): TradeRecord => ({
  trade_id: 'trade-1',
  trade_status: 'proposed',
  username_proposed: 'AdamZilla',
  username_accepting: 'OtherTrainer',
  pokemon_instance_id_user_proposed: 'mine-1',
  pokemon_instance_id_user_accepting: 'theirs-1',
  trade_friendship_level: 'Forever',
  trade_dust_cost: 40_000,
  is_lucky_trade: false,
  trade_proposal_date: '2026-08-24T10:00:00.000Z',
  ...overrides,
});

describe('native trade activity model', () => {
  it.each([
    [1, 1],
    ['2', 2],
    ['Ultra', 3],
    ['Best', 4],
    ['Forever', 5],
    ['unknown', 0],
  ])('normalizes friendship %p as %p hearts', (input, expected) => {
    expect(normalizeTradeFriendshipLevel(input)).toBe(expected);
  });

  it('models an outgoing proposal with mine left and theirs right', () => {
    expect(buildNativeTradeActivityModel(trade(), 'AdamZilla')).toMatchObject({
      activityFilter: 'Proposed',
      currentUserInstanceId: 'mine-1',
      partnerInstanceId: 'theirs-1',
      partnerUsername: 'OtherTrainer',
      participantRole: 'proposer',
      label: 'Waiting for trainer',
      title: 'Sent to OtherTrainer',
      friendshipLevel: 5,
      isRemoteTrade: true,
      isLuckyTrade: false,
      actions: [{ action: 'cancel', label: 'Cancel proposal', tone: 'destructive' }],
    });
  });

  it('models an incoming proposal from the accepter perspective', () => {
    expect(buildNativeTradeActivityModel(trade(), 'OtherTrainer')).toMatchObject({
      activityFilter: 'Accepting',
      currentUserInstanceId: 'theirs-1',
      partnerInstanceId: 'mine-1',
      partnerUsername: 'AdamZilla',
      participantRole: 'accepter',
      label: 'Needs your response',
      actions: [
        { action: 'accept', tone: 'primary' },
        { action: 'deny', tone: 'destructive' },
      ],
    });
  });

  it('offers coordination, confirmation, and cancellation on an active trade', () => {
    expect(buildNativeTradeActivityModel(trade({
      trade_status: 'pending',
      trade_accepted_date: '2026-08-24T11:00:00.000Z',
      user_proposed_completion_confirmed: false,
      user_accepting_completion_confirmed: true,
    }), 'AdamZilla')).toMatchObject({
      activityFilter: 'Pending',
      currentUserConfirmed: false,
      partnerConfirmed: true,
      label: 'Ready to confirm',
      displayTimestamp: '2026-08-24T10:00:00.000Z',
      actions: [
        { action: 'coordinate' },
        { action: 'complete' },
        { action: 'cancel' },
      ],
    });
  });

  it('preserves Vite completion feedback after the user confirms without allowing a duplicate command', () => {
    const model = buildNativeTradeActivityModel(trade({
      trade_status: 'pending',
      user_proposed_completion_confirmed: true,
    }), 'AdamZilla');

    expect(model?.label).toBe('Waiting for final confirmation');
    expect(model?.actions.map(({ action }) => action)).toEqual(['coordinate', 'complete', 'cancel']);
    expect(model?.actions.find(({ action }) => action === 'complete')).toMatchObject({
      disabled: true,
      label: 'Awaiting Partner...',
    });
  });

  it('maps completed satisfaction to the current participant with the persistent Vite feedback action', () => {
    const proposedModel = buildNativeTradeActivityModel(trade({
      trade_status: 'completed',
      user_1_trade_satisfaction: true,
      user_2_trade_satisfaction: false,
      trade_completed_date: '2026-08-24T12:00:00.000Z',
    }), 'AdamZilla');
    const acceptingModel = buildNativeTradeActivityModel(trade({
      trade_status: 'completed',
      user_1_trade_satisfaction: true,
      user_2_trade_satisfaction: false,
    }), 'OtherTrainer');

    expect(proposedModel).toMatchObject({
      currentUserSatisfaction: true,
      actions: [{ action: 'satisfy', label: 'Feedback saved', selected: true }],
    });
    expect(acceptingModel?.actions).toEqual([{
      action: 'satisfy',
      label: 'Mark as satisfying',
      selected: false,
      tone: 'primary',
    }]);
  });

  it.each(['cancelled', 'denied'] as const)('groups %s as closed with the Vite re-propose action', (status) => {
    expect(buildNativeTradeActivityModel(trade({ trade_status: status }), 'AdamZilla')).toMatchObject({
      activityFilter: 'Cancelled',
      label: 'Closed',
      actions: [
        { action: 'repropose' },
      ],
    });
  });

  it('rejects malformed, deleted, and non-participant records', () => {
    expect(buildNativeTradeActivityModel(trade({ trade_id: '' }), 'AdamZilla')).toBeNull();
    expect(buildNativeTradeActivityModel(trade({ trade_status: 'deleted' }), 'AdamZilla')).toBeNull();
    expect(buildNativeTradeActivityModel(trade(), 'NotInThisTrade')).toBeNull();
  });
});
