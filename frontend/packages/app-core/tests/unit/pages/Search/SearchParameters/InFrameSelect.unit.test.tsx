import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import InFrameSelect from '@/pages/Search/SearchParameters/InFrameSelect';

const options = [
  { label: 'Any costume', value: '' },
  { label: 'Party Hat', value: 'party' },
  { label: 'Flower Crown', value: 'flower' },
];

describe('InFrameSelect', () => {
  it('opens an in-document listbox, selects an option, and closes', () => {
    const onChange = vi.fn();
    render(
      <InFrameSelect
        label="Costume"
        onChange={onChange}
        options={options}
        value=""
      />,
    );

    fireEvent.click(screen.getByLabelText('Costume'));
    expect(screen.getByRole('listbox', { name: 'Costume' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'Flower Crown' }));

    expect(onChange).toHaveBeenCalledWith('flower');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Costume')).toHaveFocus();
  });

  it('supports arrow navigation, selection, and escape from the trigger', () => {
    const onChange = vi.fn();
    render(
      <InFrameSelect
        label="Costume"
        onChange={onChange}
        options={options}
        value=""
      />,
    );

    const trigger = screen.getByLabelText('Costume');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('party');

    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not open while disabled', () => {
    render(
      <InFrameSelect
        disabled
        label="Costume"
        onChange={vi.fn()}
        options={options}
        value=""
      />,
    );

    fireEvent.click(screen.getByLabelText('Costume'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens above the trigger when the sheet has more room there', () => {
    render(
      <div className="search-filter-sheet__body">
        <InFrameSelect
          label="Costume"
          onChange={vi.fn()}
          options={options}
          value=""
        />
      </div>,
    );

    const trigger = screen.getByLabelText('Costume');
    const root = trigger.parentElement;
    const sheetBody = root?.parentElement;
    vi.spyOn(root as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      bottom: 680,
      height: 60,
      left: 20,
      right: 300,
      top: 620,
      width: 280,
      x: 20,
      y: 620,
      toJSON: () => ({}),
    });
    vi.spyOn(sheetBody as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      bottom: 700,
      height: 600,
      left: 0,
      right: 320,
      top: 100,
      width: 320,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    fireEvent.click(trigger);

    expect(screen.getByRole('listbox')).toHaveClass(
      'in-frame-select__menu--above',
    );
  });
});
