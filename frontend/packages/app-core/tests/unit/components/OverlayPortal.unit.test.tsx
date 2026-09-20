import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OverlayPortal, {
  OVERLAY_MOTION_DURATION_MS,
  useOverlayMotion,
} from '@/components/OverlayPortal';
import CloseButton from '@/components/CloseButton';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isLightMode: false }),
}));

const MotionCloseButton = ({ onClose }: { onClose: () => void }) => {
  const motion = useOverlayMotion();
  return (
    <button type="button" onClick={() => motion?.requestClose(onClose)}>
      Close overlay
    </button>
  );
};

const OverlayStackHarness = () => {
  const [showParent, setShowParent] = React.useState(true);
  const [showChild, setShowChild] = React.useState(true);
  return (
    <>
      {showParent ? (
        <OverlayPortal onClose={() => setShowParent(false)}>
          <div data-testid="parent-overlay">Parent</div>
        </OverlayPortal>
      ) : null}
      {showChild ? (
        <OverlayPortal onClose={() => setShowChild(false)}>
          <div data-testid="child-overlay">Child</div>
        </OverlayPortal>
      ) : null}
    </>
  );
};

describe('OverlayPortal motion', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the overlay mounted until its downward exit finishes', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <OverlayPortal>
        <div className="test-overlay">
          <MotionCloseButton onClose={onClose} />
        </div>
      </OverlayPortal>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close overlay' }));

    expect(document.querySelector('.test-overlay')).toHaveAttribute(
      'data-overlay-motion',
      'exiting',
    );
    expect(onClose).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(OVERLAY_MOTION_DURATION_MS));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the same delayed exit for backdrop dismissal', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <OverlayPortal closeOnBackdrop onClose={onClose}>
        <div className="backdrop">
          <div>Dialog content</div>
        </div>
      </OverlayPortal>,
    );

    fireEvent.click(screen.getByText('Dialog content'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector('.backdrop') as HTMLElement);
    expect(document.querySelector('.backdrop')).toHaveAttribute(
      'data-overlay-motion',
      'exiting',
    );
    act(() => vi.advanceTimersByTime(OVERLAY_MOTION_DURATION_MS));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('routes the shared close button through the overlay exit motion', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <OverlayPortal>
        <div className="close-button-overlay">
          <CloseButton onClick={onClose} />
        </div>
      </OverlayPortal>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('.close-button-overlay')).toHaveAttribute(
      'data-overlay-motion',
      'exiting',
    );

    act(() => vi.advanceTimersByTime(OVERLAY_MOTION_DURATION_MS));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses only the topmost stacked overlay for each Escape press', () => {
    vi.useFakeTimers();
    render(<OverlayStackHarness />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('child-overlay')).toHaveAttribute(
      'data-overlay-motion',
      'exiting',
    );
    expect(screen.getByTestId('parent-overlay')).not.toHaveAttribute(
      'data-overlay-motion',
      'exiting',
    );

    act(() => vi.advanceTimersByTime(OVERLAY_MOTION_DURATION_MS));
    expect(screen.queryByTestId('child-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('parent-overlay')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    act(() => vi.advanceTimersByTime(OVERLAY_MOTION_DURATION_MS));
    expect(screen.queryByTestId('parent-overlay')).not.toBeInTheDocument();
  });

  it('keeps a busy overlay mounted when backdrop, controls, or Escape request dismissal', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <OverlayPortal closeOnBackdrop dismissible={false} onClose={onClose}>
        <div className="busy-overlay">
          <MotionCloseButton onClose={onClose} />
        </div>
      </OverlayPortal>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close overlay' }));
    fireEvent.click(document.querySelector('.busy-overlay') as HTMLElement);
    fireEvent.keyDown(document, { key: 'Escape' });
    act(() => vi.advanceTimersByTime(OVERLAY_MOTION_DURATION_MS));

    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('.busy-overlay')).toHaveAttribute(
      'data-overlay-motion',
      'entered',
    );
  });
});
