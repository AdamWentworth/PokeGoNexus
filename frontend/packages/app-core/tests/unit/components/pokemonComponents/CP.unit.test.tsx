import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CP from '@/components/pokemonComponents/CP';

describe('CP', () => {
  it('uses a compact numeric text input while editing', () => {
    const onCPChange = vi.fn();
    render(<CP cp="2500" editMode onCPChange={onCPChange} />);

    const input = screen.getByRole('textbox', { name: 'Combat Power' });
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('maxlength', '5');
    expect(input).toHaveValue('2500');
    expect(input).toHaveStyle({ '--cp-character-count': '4' });

    fireEvent.change(input, { target: { value: '3200' } });
    expect(onCPChange).toHaveBeenCalledWith('3200');
  });

  it('rejects non-numeric and overlong CP edits', () => {
    const onCPChange = vi.fn();
    render(<CP cp="2500" editMode onCPChange={onCPChange} />);

    const input = screen.getByRole('textbox', { name: 'Combat Power' });
    fireEvent.change(input, { target: { value: '25a0' } });
    fireEvent.change(input, { target: { value: '123456' } });

    expect(onCPChange).not.toHaveBeenCalled();
  });

  it('keeps the read-only CP presentation unchanged', () => {
    render(<CP cp={2500} editMode={false} onCPChange={vi.fn()} />);

    expect(screen.getByText('CP')).toBeInTheDocument();
    expect(screen.getByText('2500')).toHaveClass('cp-value');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
