import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import TradeBackgroundModal from '@/pages/Pokemon/features/instances/sections/TradeBackgroundModal';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { VariantBackground } from '@/types/pokemonSubTypes';

vi.mock('@/components/pokemonComponents/BackgroundLocationCard', () => ({
  __esModule: true,
  default: ({
    onSelectBackground,
  }: {
    onSelectBackground: (background: VariantBackground) => void;
  }) => (
    <button
      onClick={() =>
        onSelectBackground({
          background_id: 7,
          image_url: 'bg-7.png',
          name: 'Mock BG',
          costume_id: 0,
          date: '2026-02-17',
          location: 'test',
        })
      }
    >
      mock-pick-background
    </button>
  ),
}));

describe('Trade sections', () => {
  it('TradeBackgroundModal opens/closes and relays background selections', async () => {
    const onClose = vi.fn();
    const onSelectBackground = vi.fn();

    render(
      <ThemeProvider>
        <TradeBackgroundModal
          showBackgrounds
          pokemon={
            {
              backgrounds: [],
              instanceData: {},
              max: [],
            } as never
          }
          onClose={onClose}
          onSelectBackground={onSelectBackground}
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText('mock-pick-background'));
    expect(onSelectBackground).toHaveBeenCalledWith({
      background_id: 7,
      image_url: 'bg-7.png',
      name: 'Mock BG',
      costume_id: 0,
      date: '2026-02-17',
      location: 'test',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
