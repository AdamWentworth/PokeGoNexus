import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  TradeTargetsIntro,
  TradeTargetsWantedPanel,
} from '@/pages/Pokemon/features/instances/components/Trade/TradeTargetsPanelSections';

describe('TradeTargetsPanelSections', () => {
  it('renders target and mirror intro copy', () => {
    const { rerender } = render(<TradeTargetsIntro isMirror={false} />);

    expect(screen.getByText('Desired Return')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Wanted Pokémon' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Choose the Pokémon you want in return for this For Trade listing.',
      ),
    ).toBeInTheDocument();

    rerender(<TradeTargetsIntro isMirror={true} />);

    expect(screen.getByText('Mirror Trade')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mirror Match' })).toBeInTheDocument();
    expect(screen.getByText('Review the mirrored partner that matches this offer.')).toBeInTheDocument();
  });

  it('renders wanted panel title, count, and children', () => {
    render(
      <TradeTargetsWantedPanel
        isMirror={false}
        isEditable={true}
        editMode={false}
        visibleCount={7}
        onResetFilters={vi.fn()}
      >
        <div>wanted-list</div>
      </TradeTargetsWantedPanel>,
    );

    expect(screen.getByRole('heading', { name: 'Wanted Pokémon' })).toBeInTheDocument();
    expect(screen.getByText('7 wanted · no advanced rules')).toBeInTheDocument();
    expect(screen.getByText('wanted-list')).toBeInTheDocument();
  });

  it('only fires reset while editable and in edit mode', () => {
    const onResetFilters = vi.fn();
    const { rerender } = render(
      <TradeTargetsWantedPanel
        isMirror={false}
        isEditable={true}
        editMode={false}
        visibleCount={1}
        onResetFilters={onResetFilters}
      >
        <div />
      </TradeTargetsWantedPanel>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onResetFilters).not.toHaveBeenCalled();

    rerender(
      <TradeTargetsWantedPanel
        isMirror={false}
        isEditable={true}
        editMode={true}
        visibleCount={1}
        onResetFilters={onResetFilters}
      >
        <div />
      </TradeTargetsWantedPanel>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it('hides reset controls for mirror and readonly panels', () => {
    const { rerender } = render(
      <TradeTargetsWantedPanel
        isMirror={true}
        isEditable={true}
        editMode={true}
        visibleCount={1}
        onResetFilters={vi.fn()}
      >
        <div />
      </TradeTargetsWantedPanel>,
    );

    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Available Mirror' })).toBeInTheDocument();
    expect(screen.getByText('1 mirror target')).toBeInTheDocument();

    rerender(
      <TradeTargetsWantedPanel
        isMirror={false}
        isEditable={false}
        editMode={true}
        visibleCount={1}
        onResetFilters={vi.fn()}
      >
        <div />
      </TradeTargetsWantedPanel>,
    );

    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
  });
});
