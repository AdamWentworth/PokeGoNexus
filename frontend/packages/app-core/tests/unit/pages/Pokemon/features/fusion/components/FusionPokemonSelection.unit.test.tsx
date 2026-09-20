import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OVERLAY_MOTION_DURATION_MS } from '@/components/OverlayPortal';

import FusionPokemonSelection from '@/pages/Pokemon/features/fusion/components/FusionPokemonSelection';

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({ alert: vi.fn() }),
}));

vi.mock('@/pages/Pokemon/features/instances/CaughtInstance', () => ({
  default: ({ pokemon }: { pokemon: { name?: string } }) => (
    <div data-testid="fusion-candidate-card">{pokemon.name ?? 'candidate'}</div>
  ),
}));

vi.mock('@/components/CloseButton', () => ({
  default: ({ onClick }: { onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }) => (
    <button type="button" onClick={onClick} aria-label="Close">
      close
    </button>
  ),
}));

describe('FusionPokemonSelection', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders inside a full-screen overlay portal', () => {
    render(
      <FusionPokemonSelection
        leftCandidatesList={[{ name: 'Kyurem', instanceData: { instance_id: 'left-1' } } as any]}
        rightCandidatesList={[{ name: 'Reshiram', instanceData: { instance_id: 'right-1' } } as any]}
        fusionData={{ name: 'White Kyurem' } as any}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onCreateNewLeft={vi.fn()}
        onCreateNewRight={vi.fn()}
      />,
    );

    expect(screen.getByText('White Kyurem')).toBeInTheDocument();
    expect(document.body.querySelector('.fusion-pokemon-selection-overlay')).not.toBeNull();
  });

  it('closes when the backdrop is clicked', () => {
    vi.useFakeTimers();
    const onCancel = vi.fn();

    render(
      <FusionPokemonSelection
        leftCandidatesList={[{ name: 'Kyurem', instanceData: { instance_id: 'left-1' } } as any]}
        rightCandidatesList={[{ name: 'Reshiram', instanceData: { instance_id: 'right-1' } } as any]}
        fusionData={{ name: 'White Kyurem' } as any}
        onConfirm={vi.fn()}
        onCancel={onCancel}
        onCreateNewLeft={vi.fn()}
        onCreateNewRight={vi.fn()}
      />,
    );

    const overlay = document.body.querySelector('.fusion-pokemon-selection-overlay');
    expect(overlay).not.toBeNull();

    fireEvent.click(overlay!);

    expect(overlay).toHaveAttribute('data-overlay-motion', 'exiting');
    expect(onCancel).not.toHaveBeenCalled();
    vi.advanceTimersByTime(OVERLAY_MOTION_DURATION_MS);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
