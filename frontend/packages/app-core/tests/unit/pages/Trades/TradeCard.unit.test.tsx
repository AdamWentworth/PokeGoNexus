import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import TradeCard from '@/pages/Trades/TradeCard';

const mocks = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  alertMock: vi.fn(),
  usePokemonDetailsMock: vi.fn(),
  handleAcceptTradeMock: vi.fn(),
  handleDenyTradeMock: vi.fn(),
  handleCancelTradeMock: vi.fn(),
  handleReProposeTradeMock: vi.fn(),
  handleCompleteTradeMock: vi.fn(),
  handleThumbsUpTradeMock: vi.fn(),
  tradeStoreState: {
    setTradeData: vi.fn().mockResolvedValue(undefined),
    trades: {
      t1: { trade_id: 't1', trade_status: 'proposed' },
    },
  },
}));

vi.mock('@/features/trades/store/useTradeStore', () => ({
  useTradeStore: (
    selector: (state: typeof mocks.tradeStoreState) => unknown,
  ) => selector(mocks.tradeStoreState),
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({ confirm: mocks.confirmMock, alert: mocks.alertMock }),
}));

vi.mock('@/pages/Trades/hooks/usePokemonDetails', () => ({
  usePokemonDetails: (...args: unknown[]) => mocks.usePokemonDetailsMock(...args),
}));

vi.mock('@/pages/Trades/handlers/handleAcceptTrade', () => ({
  handleAcceptTrade: (...args: unknown[]) => mocks.handleAcceptTradeMock(...args),
}));

vi.mock('@/pages/Trades/handlers/handleDenyTrade', () => ({
  handleDenyTrade: (...args: unknown[]) => mocks.handleDenyTradeMock(...args),
}));

vi.mock('@/pages/Trades/handlers/handleCancelTrade', () => ({
  handleCancelTrade: (...args: unknown[]) => mocks.handleCancelTradeMock(...args),
}));

vi.mock('@/pages/Trades/handlers/handleReProposeTrade', () => ({
  handleReProposeTrade: (...args: unknown[]) => mocks.handleReProposeTradeMock(...args),
}));

vi.mock('@/pages/Trades/handlers/handleCompleteTrade', () => ({
  handleCompleteTrade: (...args: unknown[]) => mocks.handleCompleteTradeMock(...args),
}));

vi.mock('@/pages/Trades/handlers/handleThumbsUpTrade', () => ({
  handleThumbsUpTrade: (...args: unknown[]) => mocks.handleThumbsUpTradeMock(...args),
}));

vi.mock('@/pages/Trades/views/OffersTradeView', () => ({
  default: (props: { handleAccept: () => void; handleDeny: () => void }) => (
    <div>
      <div data-testid="offers-view" />
      <button onClick={props.handleAccept}>accept</button>
      <button onClick={props.handleDeny}>deny</button>
    </div>
  ),
}));

vi.mock('@/pages/Trades/views/ProposedTradeView', () => ({
  default: (props: { handleCancel: () => void }) => (
    <div>
      <div data-testid="proposed-view" />
      <button onClick={props.handleCancel}>cancel proposal</button>
    </div>
  ),
}));

vi.mock('@/pages/Trades/views/PendingTradeView', () => ({
  default: (props: { handleComplete: () => void; handleCancel: () => void }) => (
    <div>
      <div data-testid="pending-view" />
      <button onClick={props.handleComplete}>complete</button>
      <button onClick={props.handleCancel}>cancel</button>
    </div>
  ),
}));

vi.mock('@/pages/Trades/views/CancelledTradeView', () => ({
  default: (props: { handleRePropose: () => void }) => (
    <div>
      <div data-testid="cancelled-view" />
      <button onClick={props.handleRePropose}>re-propose</button>
    </div>
  ),
}));

vi.mock('@/pages/Trades/views/CompletedTradeView', () => ({
  default: (props: { handleThumbsUp: () => void }) => (
    <div>
      <div data-testid="completed-view" />
      <button onClick={props.handleThumbsUp}>thumbs-up</button>
    </div>
  ),
}));

const baseTrade = {
  trade_id: 't1',
  trade_status: 'proposed',
  username_proposed: 'ash',
  username_accepting: 'misty',
  pokemon_instance_id_user_proposed: 'instance-1',
  pokemon_instance_id_user_accepting: 'instance-2',
};

const baseProps = {
  trade: baseTrade,
  relatedInstances: {},
  selectedStatus: 'Accepting' as const,
  setInstances: vi.fn(),
  variants: [],
  instances: {},
  loading: false,
  periodicUpdates: vi.fn(),
};

describe('TradeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ username: 'ash' }));

    mocks.confirmMock.mockResolvedValue(true);
    mocks.usePokemonDetailsMock.mockReturnValue({ name: 'Mewtwo' });
  });

  it('renders accepting view and calls accept handler when confirmed', async () => {
    render(<TradeCard {...baseProps} selectedStatus="Accepting" />);

    expect(screen.getByTestId('offers-view')).toBeInTheDocument();
    expect(screen.getByText('Needs your response')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Offer from misty' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'accept' }));

    expect(mocks.confirmMock).toHaveBeenCalledWith(
      'Are you sure you want to accept this trade?',
    );
    expect(mocks.handleAcceptTradeMock).toHaveBeenCalledTimes(1);
  });

  it('does not call deny handler when confirmation is rejected', async () => {
    mocks.confirmMock.mockResolvedValue(false);

    render(<TradeCard {...baseProps} selectedStatus="Accepting" />);
    await fireEvent.click(screen.getByRole('button', { name: 'deny' }));

    expect(mocks.handleDenyTradeMock).not.toHaveBeenCalled();
  });

  it('cancels a sent proposal through the cancel command', async () => {
    render(<TradeCard {...baseProps} selectedStatus="Proposed" />);

    await fireEvent.click(screen.getByRole('button', { name: 'cancel proposal' }));

    expect(mocks.confirmMock).toHaveBeenCalledWith(
      'Are you sure you want to cancel this trade?',
    );
    expect(mocks.handleCancelTradeMock).toHaveBeenCalledTimes(1);
  });

  it('makes a rejected cancellation explicit and leaves the proposal active', async () => {
    mocks.handleCancelTradeMock.mockRejectedValueOnce(
      new Error('trade state has changed'),
    );

    render(<TradeCard {...baseProps} selectedStatus="Proposed" />);

    fireEvent.click(screen.getByRole('button', { name: 'cancel proposal' }));

    await waitFor(() => {
      expect(mocks.alertMock).toHaveBeenCalledWith(
        'Cancellation failed. This proposal is still active. trade state has changed',
      );
    });
    expect(mocks.tradeStoreState.setTradeData).not.toHaveBeenCalled();
  });

  it('routes to status-specific views and fallback', () => {
    const { rerender } = render(<TradeCard {...baseProps} selectedStatus="Proposed" />);
    expect(screen.getByTestId('proposed-view')).toBeInTheDocument();

    rerender(<TradeCard {...baseProps} selectedStatus="Pending" />);
    expect(screen.getByTestId('pending-view')).toBeInTheDocument();

    rerender(<TradeCard {...baseProps} selectedStatus="Cancelled" />);
    expect(screen.getByTestId('cancelled-view')).toBeInTheDocument();

    rerender(<TradeCard {...baseProps} selectedStatus="Completed" />);
    expect(screen.getByTestId('completed-view')).toBeInTheDocument();

    rerender(<TradeCard {...baseProps} selectedStatus={'Unknown' as never} />);
    expect(screen.getByText(/unknown trade status/i)).toBeInTheDocument();
  });
});
