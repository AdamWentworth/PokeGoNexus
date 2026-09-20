import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TradeTargetsHeader from '@/pages/Pokemon/features/instances/components/Trade/TradeTargetsHeader';

const makeProps = () => ({
  isMirror: false,
  isEditable: true,
  editMode: true,
  shouldShowFewLayout: false,
  filtersSlot: <div data-testid="matching-rules">Matching rules</div>,
  toggleEditMode: vi.fn(),
});

describe('TradeTargetsHeader', () => {
  it('renders trade top row controls without filter headings', () => {
    render(<TradeTargetsHeader {...makeProps()} />);

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.getByTestId('matching-rules')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Exclude' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Include' })).not.toBeInTheDocument();
  });

  it('keeps the same controls in few-layout mode', () => {
    render(<TradeTargetsHeader {...makeProps()} shouldShowFewLayout />);

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.getByTestId('matching-rules')).toBeInTheDocument();
  });

  it('does not render reset affordance in the header', () => {
    const mirrorProps = makeProps();
    const { rerender } = render(<TradeTargetsHeader {...mirrorProps} isMirror />);
    expect(screen.queryByAltText('Reset Filters')).not.toBeInTheDocument();

    const editableProps = makeProps();
    rerender(<TradeTargetsHeader {...editableProps} isMirror={false} editMode />);
    expect(screen.queryByAltText('Reset Filters')).not.toBeInTheDocument();
  });
});
