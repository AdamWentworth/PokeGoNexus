import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import TradeList from '@/pages/Trades/TradeList';

import type { TradeMap } from '@/pages/Trades/types';

const mocks = vi.hoisted(() => ({
  tradeCardProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/pages/Trades/TradeCard', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.tradeCardProps.push(props);
    const trade = props.trade as { trade_id?: string } | undefined;
    return <div data-testid="trade-card">{trade?.trade_id ?? 'unknown-trade'}</div>;
  },
}));

const baseTrades: TradeMap = {
  t1: {
    trade_status: 'proposed',
    username_proposed: 'ash',
    username_accepting: 'misty',
  },
  t2: {
    trade_status: 'proposed',
    username_proposed: 'misty',
    username_accepting: 'ash',
  },
  t3: {
    trade_status: 'pending',
    username_proposed: 'misty',
    username_accepting: 'ash',
  },
  t4: {
    trade_status: 'completed',
    username_proposed: 'misty',
    username_accepting: 'ash',
  },
  t5: {
    trade_status: 'denied',
    username_proposed: 'misty',
    username_accepting: 'ash',
  },
};

const baseProps = {
  trades: baseTrades,
  relatedInstances: {},
  selectedStatus: 'Pending' as const,
  setInstances: vi.fn(),
  variants: [],
  instances: undefined,
  loading: false,
  periodicUpdates: vi.fn(),
};

describe('TradeList', () => {
  beforeEach(() => {
    mocks.tradeCardProps.length = 0;
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ username: 'ash' }));
  });

  it('filters proposed trades to those proposed by current user', () => {
    render(<TradeList {...baseProps} selectedStatus="Proposed" />);

    expect(screen.getByText('t1')).toBeInTheDocument();
    expect(screen.queryByText('t2')).not.toBeInTheDocument();
    expect(screen.queryByText('t3')).not.toBeInTheDocument();
  });

  it('filters accepting trades to proposed trades where current user is accepting', () => {
    render(<TradeList {...baseProps} selectedStatus="Accepting" />);

    expect(screen.getByText('t2')).toBeInTheDocument();
    expect(screen.queryByText('t1')).not.toBeInTheDocument();
    expect(screen.queryByText('t3')).not.toBeInTheDocument();
  });

  it('groups denied trades into Closed', () => {
    render(<TradeList {...baseProps} selectedStatus="Cancelled" />);

    expect(screen.getByText('t5')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No trades here' })).not.toBeInTheDocument();
  });

  it('passes a safe empty instances object to trade cards when instances are missing', () => {
    render(<TradeList {...baseProps} selectedStatus="Completed" instances={undefined} />);

    expect(screen.getByText('t4')).toBeInTheDocument();
    expect(mocks.tradeCardProps[0]?.instances).toEqual({});
  });
});
