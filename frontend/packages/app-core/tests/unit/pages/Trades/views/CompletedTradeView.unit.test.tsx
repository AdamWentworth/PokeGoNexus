import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import CompletedTradeView from '@/pages/Trades/views/CompletedTradeView';

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

const baseTrade = {
  trade_id: 't1',
  username_proposed: 'ash',
  username_accepting: 'misty',
  trade_friendship_level: 'Best',
  trade_dust_cost: 50000,
  trade_completed_date: '2026-02-10T00:00:00.000Z',
  user_1_trade_satisfaction: false,
  user_2_trade_satisfaction: false,
  is_lucky_trade: true,
};

const baseDetails = {
  name: 'Mewtwo',
  currentImage: '/images/mewtwo.png',
  type_1_icon: '/images/types/psychic.png',
};

describe('CompletedTradeView', () => {
  beforeEach(() => {
    localStorage.setItem('user', JSON.stringify({ username: 'ash' }));
  });

  it('renders completion details and invokes thumbs up handler', () => {
    const handleThumbsUp = vi.fn();

    render(
      <CompletedTradeView
        trade={baseTrade}
        currentUserDetails={baseDetails}
        partnerDetails={{ ...baseDetails, name: 'Pikachu' }}
        loading={false}
        handleThumbsUp={handleThumbsUp}
      />,
    );

    expect(screen.getByText('Trade Completed')).toBeInTheDocument();
    expect(screen.getByText(/Completed on:/i)).toBeInTheDocument();
    expect(screen.getByText('Satisfied with your trade?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark as satisfying' }));
    expect(handleThumbsUp).toHaveBeenCalledTimes(1);
  });

  it('shows thanks text and active thumbs-up style when already satisfied', () => {
    render(
      <CompletedTradeView
        trade={{ ...baseTrade, user_1_trade_satisfaction: true }}
        currentUserDetails={baseDetails}
        partnerDetails={baseDetails}
        loading={false}
        handleThumbsUp={vi.fn()}
      />,
    );

    expect(screen.getByText('Thanks for the feedback!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Feedback saved' })).toHaveClass('active');
  });

  it('renders loading state when details are unavailable', () => {
    render(
      <CompletedTradeView
        trade={baseTrade}
        currentUserDetails={null}
        partnerDetails={null}
        loading={true}
        handleThumbsUp={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('loading-spinner')).toHaveLength(2);
  });
});
