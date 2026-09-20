import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CloseButton from '@/components/CloseButton';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isLightMode: false }),
}));

describe('CloseButton stack', () => {
  it('allows only the topmost mounted close button to be interactive', async () => {
    const closeParent = vi.fn();
    const closeChild = vi.fn();
    const { rerender } = render(
      <>
        <CloseButton data-testid="parent-close" onClick={closeParent} />
        <CloseButton data-testid="child-close" onClick={closeChild} />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('parent-close')).toBeDisabled();
      expect(screen.getByTestId('child-close')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTestId('parent-close'));
    fireEvent.click(screen.getByTestId('child-close'));
    expect(closeParent).not.toHaveBeenCalled();
    expect(closeChild).toHaveBeenCalledTimes(1);

    rerender(<CloseButton data-testid="parent-close" onClick={closeParent} />);

    await waitFor(() => {
      expect(screen.getByTestId('parent-close')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTestId('parent-close'));
    expect(closeParent).toHaveBeenCalledTimes(1);
  });
});
