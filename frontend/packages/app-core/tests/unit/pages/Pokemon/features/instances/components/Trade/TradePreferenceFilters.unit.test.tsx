import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import TradePreferenceFilters from '@/pages/Pokemon/features/instances/components/Trade/TradePreferenceFilters';

const makeProps = () => ({
  context: 'wanted' as const,
  editMode: true,
  selectedExcludeImages: [true, false, false, false, false, false],
  selectedIncludeOnlyImages: [false, true, false, false, false],
  toggleExcludeImageSelection: vi.fn(),
  toggleIncludeOnlyImageSelection: vi.fn(),
});

describe('TradePreferenceFilters', () => {
  test('presents matching rules in plain-language groups', () => {
    render(<TradePreferenceFilters {...makeProps()} />);

    expect(screen.getByRole('heading', { name: 'Must match' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Leave out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Costume' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Community Day' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('routes rule changes to the existing filter callbacks', () => {
    const props = makeProps();
    render(<TradePreferenceFilters {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Shiny' }));
    fireEvent.click(screen.getByRole('button', { name: 'Research Day' }));

    expect(props.toggleIncludeOnlyImageSelection).toHaveBeenCalledWith(0, true);
    expect(props.toggleExcludeImageSelection).toHaveBeenCalledWith(1, true);
  });

  test('shows existing rules without allowing edits in view mode', () => {
    render(<TradePreferenceFilters {...makeProps()} editMode={false} />);

    expect(screen.getByText('2 active rules')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Costume' })).toBeDisabled();
  });

  test('nests mirror mode with matching rules and explains its unique behavior', () => {
    render(
      <TradePreferenceFilters
        {...makeProps()}
        isMirror
        mirrorControl={<button type="button">Mirror control</button>}
      />,
    );

    expect(screen.getByText('Mirror trade enabled')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mirror trade' })).toBeInTheDocument();
    expect(screen.getByText('Standard matching rules are paused.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Must match' })).not.toBeInTheDocument();
  });
});
