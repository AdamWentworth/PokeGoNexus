import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

import Trades from '@/pages/Trades/Trades';

const mocks = vi.hoisted(() => ({
  tradeStoreState: {
    trades: {
      t1: { trade_status: 'pending' },
      t2: { trade_status: 'denied' },
    },
    relatedInstances: { i1: { instance_id: 'i1' } },
  },
  variantsStoreState: {
    variants: [{ variant_id: '1' }],
    variantsLoading: true,
  },
  instancesStoreState: {
    instances: { i1: { instance_id: 'i1', is_caught: true } },
    setInstances: vi.fn(),
    periodicUpdates: vi.fn(),
  },
  statusPropsHistory: [] as Array<Record<string, unknown>>,
  listPropsHistory: [] as Array<Record<string, unknown>>,
  workspaceRenderCount: 0,
}));

vi.mock('@/features/trades/store/useTradeStore', () => ({
  useTradeStore: (selector: (state: typeof mocks.tradeStoreState) => unknown) =>
    selector(mocks.tradeStoreState),
}));

vi.mock('@/features/variants/store/useVariantsStore', () => ({
  useVariantsStore: (selector: (state: typeof mocks.variantsStoreState) => unknown) =>
    selector(mocks.variantsStoreState),
}));

vi.mock('@/features/instances/store/useInstancesStore', () => ({
  useInstancesStore: (selector: (state: typeof mocks.instancesStoreState) => unknown) =>
    selector(mocks.instancesStoreState),
}));

vi.mock('@/pages/Trades/TradeStatusButtons', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.statusPropsHistory.push(props);
    return <div data-testid="trade-status-buttons" />;
  },
}));

vi.mock('@/pages/Trades/TradeList', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.listPropsHistory.push(props);
    return <div data-testid="trade-list" />;
  },
}));

vi.mock('@/pages/Trades/TradeTargetsWorkspace', () => ({
  default: () => {
    mocks.workspaceRenderCount += 1;
    return <div data-testid="trade-targets-workspace" />;
  },
}));

describe('Trades page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.statusPropsHistory.length = 0;
    mocks.listPropsHistory.length = 0;
    mocks.workspaceRenderCount = 0;
  });

  it('wires store data to status controls and list, and updates selected status', () => {
    render(<Trades />, { wrapper: MemoryRouter });

    expect(screen.getByRole('link', { name: 'Share board' })).toHaveAttribute('href', '/trade-board');
    expect(screen.getByTestId('trade-targets-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('trade-targets-workspace').closest('[data-active]')).toHaveAttribute(
      'data-active',
      'true',
    );
    expect(screen.getByTestId('trade-list').closest('[data-active]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(document.querySelector('.horizontal-page-slider__track')).toHaveStyle({
      transform: 'translate3d(calc(0% + 0px), 0, 0)',
    });

    act(() => {
      screen.getByRole('tab', { name: 'Trade Activity' }).click();
    });

    expect(screen.getByTestId('trade-status-buttons')).toBeInTheDocument();
    expect(screen.getByTestId('trade-list')).toBeInTheDocument();
    expect(screen.getByTestId('trade-list').closest('[data-active]')).toHaveAttribute(
      'data-active',
      'true',
    );
    expect(document.querySelector('.horizontal-page-slider__track')).toHaveStyle({
      transform: 'translate3d(calc(-100% + 0px), 0, 0)',
    });

    const activityStatusProps = mocks.statusPropsHistory.at(-1);
    const activityListProps = mocks.listPropsHistory.at(-1);

    expect(activityStatusProps?.selectedStatus).toBe('Accepting');
    expect(activityStatusProps?.counts).toMatchObject({ Pending: 1, Cancelled: 1 });
    expect(activityListProps?.selectedStatus).toBe('Accepting');
    expect(activityListProps?.trades).toEqual(mocks.tradeStoreState.trades);
    expect(activityListProps?.relatedInstances).toEqual(mocks.tradeStoreState.relatedInstances);
    expect(activityListProps?.variants).toEqual(mocks.variantsStoreState.variants);
    expect(activityListProps?.instances).toEqual(mocks.instancesStoreState.instances);
    expect(activityListProps?.loading).toBe(true);

    const setSelectedStatus = activityStatusProps?.setSelectedStatus as
      | ((status: string) => void)
      | undefined;
    expect(setSelectedStatus).toBeTypeOf('function');

    act(() => {
      setSelectedStatus?.('Completed');
    });

    const updatedListProps = mocks.listPropsHistory.at(-1);
    expect(updatedListProps?.selectedStatus).toBe('Completed');

    act(() => {
      screen.getByRole('tab', { name: 'Trade Preferences' }).click();
    });

    expect(screen.getByTestId('trade-targets-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('trade-list').closest('[data-active]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
