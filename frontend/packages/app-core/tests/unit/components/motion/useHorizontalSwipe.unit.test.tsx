import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useHorizontalSwipe from '@/components/motion/useHorizontalSwipe';

const SwipeHarness = ({
  onSwipe,
}: {
  onSwipe: (direction: 'left' | 'right' | null) => void;
}) => {
  const handlers = useHorizontalSwipe({ onSwipe });
  return <div data-testid="swipe-surface" {...handlers} />;
};

describe('useHorizontalSwipe', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => null),
    });
  });

  it('preserves the browser back gesture at either screen edge', () => {
    const onSwipe = vi.fn();
    render(<SwipeHarness onSwipe={onSwipe} />);
    const surface = screen.getByTestId('swipe-surface');

    fireEvent.touchStart(surface, {
      touches: [{ clientX: 10, clientY: 100 }],
    });
    fireEvent.touchMove(surface, {
      touches: [{ clientX: 180, clientY: 100 }],
    });
    fireEvent.touchEnd(surface);

    fireEvent.touchStart(surface, {
      touches: [{ clientX: 390, clientY: 100 }],
    });
    fireEvent.touchMove(surface, {
      touches: [{ clientX: 210, clientY: 100 }],
    });
    fireEvent.touchEnd(surface);

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('keeps peer-page swipes available away from the screen edges', () => {
    const onSwipe = vi.fn();
    render(<SwipeHarness onSwipe={onSwipe} />);
    const surface = screen.getByTestId('swipe-surface');

    fireEvent.touchStart(surface, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchMove(surface, {
      touches: [{ clientX: 250, clientY: 100 }],
    });
    fireEvent.touchEnd(surface);

    expect(onSwipe).toHaveBeenCalledWith('right');
  });
});
