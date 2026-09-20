import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SegmentedControl from '@/components/layout/SegmentedControl';

const items = [
  { label: 'Overview', value: 'overview', ariaControls: 'overview-panel' },
  { label: 'Activity', value: 'activity', ariaControls: 'activity-panel' },
  { label: 'History', value: 'history', ariaControls: 'history-panel' },
] as const;

describe('SegmentedControl', () => {
  it('exposes tab semantics and changes the selected item on click', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="Trade workspace"
        items={items}
        mode="tabs"
        onChange={onChange}
        value="overview"
      />,
    );

    expect(screen.getByRole('tablist', { name: 'Trade workspace' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute(
      'aria-controls',
      'activity-panel',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(onChange).toHaveBeenCalledWith('activity');
  });

  it('supports arrow, Home, and End keyboard navigation for tabs', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="Trade workspace"
        items={items}
        mode="tabs"
        onChange={onChange}
        value="activity"
      />,
    );

    const activity = screen.getByRole('tab', { name: 'Activity' });
    fireEvent.keyDown(activity, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('history');
    expect(screen.getByRole('tab', { name: 'History' })).toHaveFocus();

    fireEvent.keyDown(activity, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('overview');

    fireEvent.keyDown(activity, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('history');
  });

  it('uses pressed-button semantics when the control is not a tab list', () => {
    render(
      <SegmentedControl
        ariaLabel="Roster source"
        items={items.slice(0, 2)}
        onChange={vi.fn()}
        value="overview"
      />,
    );

    expect(screen.getByRole('group', { name: 'Roster source' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
