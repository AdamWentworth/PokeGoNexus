import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import PendingTradeView from '@/pages/Trades/views/PendingTradeView';

const mocks = vi.hoisted(() => ({
  revealPartnerInfoMock: vi.fn(),
  partnerInfoModalProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/components/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">loading...</div>,
}));

vi.mock('@/components/pokemonComponents/MoveDisplay', () => ({
  default: () => <div data-testid="move-display">moves</div>,
}));

vi.mock('@/components/pokemonComponents/IV', () => ({
  default: () => <div data-testid="iv-display">ivs</div>,
}));

vi.mock('@/components/pokemonComponents/FriendshipLevel', () => ({
  default: ({ level }: { level: number }) => <div data-testid="friendship-level">{level}</div>,
}));

vi.mock('@/components/pokemonComponents/Gender', () => ({
  default: ({ gender }: { gender: string }) => <div data-testid="gender">{gender}</div>,
}));

vi.mock('@/services/tradeService', () => ({
  revealPartnerInfo: (...args: unknown[]) => mocks.revealPartnerInfoMock(...args),
}));

vi.mock('@/pages/Trades/components/PartnerInfoModal', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.partnerInfoModalProps.push(props);
    const partnerInfo = props.partnerInfo as { trainerCode?: string } | null;
    return (
      <div data-testid="partner-info-modal">
        {partnerInfo?.trainerCode ?? 'empty'}
      </div>
    );
  },
}));

const baseTrade = {
  trade_id: 't1',
  username_proposed: 'ash',
  username_accepting: 'misty',
  trade_friendship_level: 'Ultra',
  trade_dust_cost: 20000,
  is_lucky_trade: true,
  user_proposed_completion_confirmed: false,
  user_accepting_completion_confirmed: false,
};

const baseDetails = {
  name: 'Mewtwo',
  currentImage: '/images/mewtwo.png',
  type_1_icon: '/images/types/psychic.png',
};

describe('PendingTradeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.partnerInfoModalProps.length = 0;
    localStorage.setItem('user', JSON.stringify({ username: 'ash' }));
  });

  it('reveals partner info and forwards data to partner modal', async () => {
    mocks.revealPartnerInfoMock.mockResolvedValue({
      sharingEnabled: true,
      trainerCode: '123456789012',
      pokemonGoName: 'Misty',
      coordinationMethod: 'campfire',
      location: 'Cerulean City',
    });

    render(
      <PendingTradeView
        trade={baseTrade}
        currentUserDetails={baseDetails}
        partnerDetails={baseDetails}
        loading={false}
        handleComplete={vi.fn()}
        handleCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /coordinate trade/i }));

    await waitFor(() => {
      expect(mocks.revealPartnerInfoMock).toHaveBeenCalledWith(baseTrade);
      expect(screen.getByText('123456789012')).toBeInTheDocument();
      expect(mocks.partnerInfoModalProps.at(-1)).toEqual(expect.objectContaining({
        partnerUsername: 'misty',
      }));
    });
  });

  it('calls complete and cancel handlers from action buttons', async () => {
    const handleComplete = vi.fn().mockResolvedValue(undefined);
    const handleCancel = vi.fn();

    render(
      <PendingTradeView
        trade={baseTrade}
        currentUserDetails={baseDetails}
        partnerDetails={baseDetails}
        loading={false}
        handleComplete={handleComplete}
        handleCancel={handleCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Complete' }));

    await waitFor(() => {
      expect(handleComplete).toHaveBeenCalledTimes(1);
      expect(handleComplete).toHaveBeenCalledWith(baseTrade);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('disables complete action when current user already confirmed', () => {
    render(
      <PendingTradeView
        trade={{
          ...baseTrade,
          user_proposed_completion_confirmed: true,
          user_accepting_completion_confirmed: false,
        }}
        currentUserDetails={baseDetails}
        partnerDetails={baseDetails}
        loading={false}
        handleComplete={vi.fn()}
        handleCancel={vi.fn()}
      />,
    );

    const completeButton = screen.getByRole('button', { name: 'Awaiting Partner...' });
    expect(completeButton).toBeDisabled();
  });
});
