import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ResetPasswordOverlay from '@/pages/Authentication/ResetPasswordOverlay';
import { OVERLAY_MOTION_DURATION_MS } from '@/components/OverlayPortal';

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}));

vi.mock('@/services/authService', () => ({
  resetPassword: mocks.resetPassword,
}));

describe('ResetPasswordOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetPassword.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('submits the identifier and closes after the privacy-safe response', async () => {
    const onClose = vi.fn();
    render(<ResetPasswordOverlay onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/username or email/i), {
      target: { value: 'adam@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /email reset link/i }));

    await waitFor(() =>
      expect(mocks.resetPassword).toHaveBeenCalledWith({
        identifier: 'adam@example.com',
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('is an accessible modal and closes from its close control', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<ResetPasswordOverlay onClose={onClose} />);

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    fireEvent.click(
      screen.getByRole('button', { name: /close password reset/i }),
    );
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(OVERLAY_MOTION_DURATION_MS));
    expect(onClose).toHaveBeenCalled();
  });
});
