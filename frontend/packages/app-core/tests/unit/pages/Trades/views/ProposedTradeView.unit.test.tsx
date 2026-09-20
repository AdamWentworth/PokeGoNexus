import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import ProposedTradeView from '@/pages/Trades/views/ProposedTradeView';

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
  trade_friendship_level: 'Great',
  trade_dust_cost: 12345,
  is_lucky_trade: false,
};

const baseDetails = {
  name: 'Mewtwo',
  currentImage: '/images/mewtwo.png',
  type_1_icon: '/images/types/psychic.png',
};

describe('ProposedTradeView', () => {
  it('renders both pokemon sections and invokes cancel action', () => {
    const handleCancel = vi.fn();

    render(
      <ProposedTradeView
        trade={baseTrade}
        currentUserDetails={baseDetails}
        partnerDetails={{ ...baseDetails, name: 'Pikachu' }}
        loading={false}
        offeringHeading="Offering"
        receivingHeading="Receiving"
        handleCancel={handleCancel}
      />,
    );

    expect(screen.getByText('Offering')).toBeInTheDocument();
    expect(screen.getByText('Receiving')).toBeInTheDocument();
    expect(screen.getByText('ash')).toBeInTheDocument();
    expect(screen.getByText('misty')).toBeInTheDocument();
    expect(screen.getByText('12,345')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel proposal' }));
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('shows no-details fallback only when section is expanded', () => {
    render(
      <ProposedTradeView
        trade={baseTrade}
        currentUserDetails={baseDetails}
        partnerDetails={baseDetails}
        loading={false}
        offeringHeading="Offering"
        receivingHeading="Receiving"
        handleCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText('No additional details available.')).not.toBeInTheDocument();

    const showButtons = screen.getAllByRole('button', { name: 'Show Details' });
    fireEvent.click(showButtons[0]);

    expect(screen.getByText('No additional details available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide Details' })).toBeInTheDocument();
  });

  it('renders loading state when details are missing and request is in progress', () => {
    render(
      <ProposedTradeView
        trade={baseTrade}
        currentUserDetails={null}
        partnerDetails={null}
        loading={true}
        offeringHeading="Offering"
        receivingHeading="Receiving"
        handleCancel={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('loading-spinner')).toHaveLength(2);
  });
});
