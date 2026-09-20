import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import OffersTradeView from '@/pages/Trades/views/OffersTradeView';

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
  username_proposed: 'misty',
  username_accepting: 'ash',
  trade_friendship_level: 'Ultra',
  trade_dust_cost: 20000,
  is_lucky_trade: true,
};

const baseDetails = {
  name: 'Mewtwo',
  currentImage: '/images/mewtwo.png',
  type_1_icon: '/images/types/psychic.png',
};

describe('OffersTradeView', () => {
  it('renders offer sections and invokes accept/deny handlers', () => {
    const handleAccept = vi.fn();
    const handleDeny = vi.fn();

    render(
      <OffersTradeView
        trade={baseTrade}
        currentUsername="ash"
        currentUserDetails={baseDetails}
        partnerDetails={{ ...baseDetails, name: 'Pikachu' }}
        loading={false}
        handleAccept={handleAccept}
        handleDeny={handleDeny}
      />,
    );

    expect(screen.getByText('For Trade:')).toBeInTheDocument();
    expect(screen.getByText('Offered')).toBeInTheDocument();
    expect(screen.getByText('20,000')).toBeInTheDocument();
    expect(screen.getByText(/accepting unlocks any coordination details/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Accept offer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));

    expect(handleAccept).toHaveBeenCalledTimes(1);
    expect(handleDeny).toHaveBeenCalledTimes(1);
  });

  it('renders loading state for missing details while request is in progress', () => {
    render(
      <OffersTradeView
        trade={baseTrade}
        currentUsername="ash"
        currentUserDetails={null}
        partnerDetails={null}
        loading={true}
        handleAccept={vi.fn()}
        handleDeny={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('loading-spinner')).toHaveLength(2);
  });

  it('shows no-details fallback only after expanding details', () => {
    render(
      <OffersTradeView
        trade={baseTrade}
        currentUsername="ash"
        currentUserDetails={baseDetails}
        partnerDetails={baseDetails}
        loading={false}
        handleAccept={vi.fn()}
        handleDeny={vi.fn()}
      />,
    );

    expect(screen.queryByText('No additional details available.')).not.toBeInTheDocument();

    const showButtons = screen.getAllByRole('button', { name: 'Show Details' });
    fireEvent.click(showButtons[0]);

    expect(screen.getByText('No additional details available.')).toBeInTheDocument();
  });
});
