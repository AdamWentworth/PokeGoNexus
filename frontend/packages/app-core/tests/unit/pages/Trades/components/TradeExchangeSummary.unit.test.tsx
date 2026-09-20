import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import TradeExchangeSummary from '@/pages/Trades/components/TradeExchangeSummary';

describe('TradeExchangeSummary', () => {
  it('groups friendship, stardust, and contextual actions', () => {
    render(
      <TradeExchangeSummary
        friendshipLevel={5}
        isLuckyTrade={false}
        stardustCost={40_000}
      >
        <button type="button">Primary action</button>
      </TradeExchangeSummary>,
    );

    const summary = screen.getByLabelText('Trade details');
    expect(summary).toHaveTextContent('Friendship');
    expect(summary).toHaveTextContent('Stardust');
    expect(summary).toHaveTextContent('40,000');
    expect(screen.getByRole('button', { name: 'Primary action' })).toBeInTheDocument();
  });
});
