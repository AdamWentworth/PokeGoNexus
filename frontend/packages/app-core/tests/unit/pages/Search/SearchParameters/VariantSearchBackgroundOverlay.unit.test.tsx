import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import VariantSearchBackgroundOverlay from '@/pages/Search/SearchParameters/VariantSearchBackgroundOverlay';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { OVERLAY_MOTION_DURATION_MS } from '@/components/OverlayPortal';

vi.mock('@/components/pokemonComponents/BackgroundLocationCard', () => ({
  default: ({
    costumeOptions,
    filterBackground,
    onSelectBackground,
    showCostumePairing,
  }: {
    costumeOptions: Array<{ name: string; costume_id?: number }>;
    filterBackground: (value: { costume_id?: number | null }) => boolean;
    onSelectBackground: (value: unknown) => void;
    showCostumePairing?: boolean;
  }) => (
    <div>
      <span data-testid="costume-options">
        {costumeOptions.map((costume) => costume.name).join(',')}
      </span>
      <span data-testid="shows-costume-pairing">{String(showCostumePairing)}</span>
      <span data-testid="allows-base">{String(filterBackground({ costume_id: null }))}</span>
      <span data-testid="allows-party">{String(filterBackground({ costume_id: 7 }))}</span>
      <span data-testid="allows-missing">{String(filterBackground({ costume_id: 9 }))}</span>
      <button
        type="button"
        data-testid="select-background"
        onClick={() =>
          onSelectBackground({
            background_id: 1,
            image_url: '/images/bg.png',
            name: 'City',
            location: 'Seattle',
            date: '2025-01-01',
          })
        }
      >
        select
      </button>
    </div>
  ),
}));

vi.mock('@/components/CloseButton', () => ({
  default: ({ onClick }: { onClick?: () => void }) => (
    <button type="button" aria-label="Close" onClick={onClick}>
      Close
    </button>
  ),
}));

describe('VariantSearchBackgroundOverlay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render while closed', () => {
    render(
      <VariantSearchBackgroundOverlay
        availableCostumes={[]}
        isOpen={false}
        onClose={vi.fn()}
        currentPokemonData={undefined}
        onSelectBackground={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('renders while open and forwards close/select actions', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onSelectBackground = vi.fn();
    render(
      <VariantSearchBackgroundOverlay
        availableCostumes={[{ name: 'Party', costume_id: 7 }]}
        isOpen={true}
        onClose={onClose}
        currentPokemonData={{ name: 'Bulbasaur' } as unknown as PokemonVariant}
        onSelectBackground={onSelectBackground}
      />,
    );

    fireEvent.click(document.body.querySelector('.background-overlay-content') as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('select-background'));
    expect(onSelectBackground).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('costume-options')).toHaveTextContent('Party');
    expect(screen.getByTestId('shows-costume-pairing')).toHaveTextContent('true');
    expect(screen.getByTestId('allows-base')).toHaveTextContent('true');
    expect(screen.getByTestId('allows-party')).toHaveTextContent('true');
    expect(screen.getByTestId('allows-missing')).toHaveTextContent('false');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(OVERLAY_MOTION_DURATION_MS);
  });
});
