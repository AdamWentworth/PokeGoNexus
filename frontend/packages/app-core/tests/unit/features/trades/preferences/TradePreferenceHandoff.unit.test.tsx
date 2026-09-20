import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import TradePreferenceHandoff from '@/features/trades/preferences/TradePreferenceHandoff';

describe('TradePreferenceHandoff', () => {
  it('links a specific For Trade instance to the preferences workspace', () => {
    render(
      <MemoryRouter>
        <TradePreferenceHandoff mode="trade" instanceId="instance with spaces" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Manage preferences' })).toHaveAttribute(
      'href',
      '/trades?section=preferences&mode=trade&instance=instance%20with%20spaces',
    );
  });
});
