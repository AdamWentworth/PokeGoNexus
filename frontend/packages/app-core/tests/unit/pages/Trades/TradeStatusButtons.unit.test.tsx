import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import TradeStatusButtons from '@/pages/Trades/TradeStatusButtons';

describe('TradeStatusButtons', () => {
  it('renders all status controls and marks the selected one active', () => {
    const setSelectedStatus = vi.fn();

    render(
      <TradeStatusButtons
        selectedStatus="Pending"
        setSelectedStatus={setSelectedStatus}
      />,
    );

    expect(screen.getByRole('button', { name: 'Needs response, 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sent, 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active, 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completed, 0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Closed, 0' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Active, 0' })).toHaveClass('active');
  });

  it('emits canonical status values when buttons are clicked', () => {
    const setSelectedStatus = vi.fn();

    render(
      <TradeStatusButtons
        selectedStatus="Pending"
        setSelectedStatus={setSelectedStatus}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Needs response, 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sent, 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Active, 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Completed, 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Closed, 0' }));

    expect(setSelectedStatus.mock.calls.map(([value]) => value)).toEqual([
      'Accepting',
      'Proposed',
      'Pending',
      'Completed',
      'Cancelled',
    ]);
  });
});
