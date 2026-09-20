import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import WantedSizePreferences from '@/pages/Pokemon/features/instances/components/Wanted/WantedSizePreferences';
import {
  buildWantedSizePreferences,
  getWantedSizePreference,
  getStoredWantedSizePreference,
} from '@/pages/Pokemon/features/instances/components/Wanted/wantedSizePreferences';

const sizes = {
  pokedex_height: 1,
  pokedex_weight: 6,
  height_standard_deviation: 0.25,
  weight_standard_deviation: 1.5,
  height_xxs_threshold: 0.5,
  height_xs_threshold: 0.75,
  height_xl_threshold: 1.25,
  height_xxl_threshold: 1.5,
  weight_xxs_threshold: 4,
  weight_xs_threshold: 5,
  weight_xl_threshold: 8,
  weight_xxl_threshold: 9,
};

describe('wanted size preferences', () => {
  it('migrates legacy measurements and builds explicit persisted ranges', () => {
    expect(getWantedSizePreference(3.5, sizes, 'weight')).toBe('XXS');
    expect(getWantedSizePreference(4.5, sizes, 'weight')).toBe('XS');
    expect(getWantedSizePreference(6, sizes, 'weight')).toBeNull();
    expect(getWantedSizePreference(8.5, sizes, 'weight')).toBe('XL');
    expect(getWantedSizePreference(10, sizes, 'weight')).toBe('XXL');

    const preferences = buildWantedSizePreferences('XS', 'XXL', sizes);
    expect(preferences).toEqual({
      weight: {
        category: 'XS',
        min: 4,
        max: 5,
        min_inclusive: true,
        max_inclusive: false,
      },
      height: {
        category: 'XXL',
        min: 1.5,
        max: null,
        min_inclusive: false,
        max_inclusive: false,
      },
    });
    expect(buildWantedSizePreferences(null, null, sizes)).toBeNull();
    expect(
      getStoredWantedSizePreference(preferences, 3.5, sizes, 'weight'),
    ).toBe('XS');
    expect(
      getStoredWantedSizePreference(null, 3.5, sizes, 'weight'),
    ).toBe('XXS');
  });

  it('offers independent accessible weight and height toggles with Any as null', () => {
    const onWeightChange = vi.fn();
    const onHeightChange = vi.fn();
    const { container } = render(
      <WantedSizePreferences
        weight="XL"
        height={null}
        editMode
        onWeightChange={onWeightChange}
        onHeightChange={onHeightChange}
      />,
    );

    expect(container.querySelector('img[src="/images/weight.png"]')).not.toBeNull();
    expect(container.querySelector('img[src="/images/height.png"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'XL weight' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Any height' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'XXL weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'XS height' }));
    expect(onWeightChange).toHaveBeenCalledWith('XXL');
    expect(onHeightChange).toHaveBeenCalledWith('XS');
  });

  it('shows only selected requirements outside edit mode', () => {
    const { rerender } = render(
      <WantedSizePreferences
        weight={null}
        height={null}
        editMode={false}
        onWeightChange={vi.fn()}
        onHeightChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Weight')).not.toBeInTheDocument();

    rerender(
      <WantedSizePreferences
        weight="XXS"
        height={null}
        editMode={false}
        onWeightChange={vi.fn()}
        onHeightChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('XXS')).toBeInTheDocument();
    expect(screen.queryByText('Height')).not.toBeInTheDocument();
  });
});
