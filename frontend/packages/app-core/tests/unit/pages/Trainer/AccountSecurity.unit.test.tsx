import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AccountSecurity from '@/pages/Trainer/AccountSecurity';

const mocks = vi.hoisted(() => ({
  updateUserDetails: vi.fn(),
  logout: vi.fn(),
  deleteAccount: vi.fn(),
  confirm: vi.fn(),
  fetchSecurity: vi.fn(),
  revokeAllSessions: vi.fn(),
  requestEmailChange: vi.fn(),
  unlinkProvider: vi.fn(),
  startGoogleAuthentication: vi.fn(),
  startDiscordAuthentication: vi.fn(),
  startFacebookAuthentication: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    updateUserDetails: mocks.updateUserDetails,
    logout: mocks.logout,
    deleteAccount: mocks.deleteAccount,
  }),
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({ confirm: mocks.confirm }),
}));

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        user_id: 'user-adam',
        username: 'Adam',
        email: 'adam@example.com',
      },
    }),
}));

vi.mock('@/services/authService', () => ({
  fetchAccountSecurity: mocks.fetchSecurity,
  revokeAllSessions: mocks.revokeAllSessions,
  requestEmailChange: mocks.requestEmailChange,
  unlinkProvider: mocks.unlinkProvider,
  startGoogleAuthentication: mocks.startGoogleAuthentication,
  startDiscordAuthentication: mocks.startDiscordAuthentication,
  startFacebookAuthentication: mocks.startFacebookAuthentication,
}));

describe('AccountSecurity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateUserDetails.mockResolvedValue({ success: true });
    mocks.confirm.mockResolvedValue(true);
    mocks.fetchSecurity.mockResolvedValue({
      email: 'adam@example.com',
      hasPassword: true,
      activeSessions: 2,
      providers: [
        {
          provider: 'google',
          email: 'adam@example.com',
          emailVerified: true,
          linkedAt: '2026-07-28T00:00:00.000Z',
        },
      ],
    });
    mocks.requestEmailChange.mockResolvedValue(undefined);
  });

  it('keeps the current email until the new address is verified', async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/required for security changes/i), {
      target: { value: 'Current_valid_42!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update account/i }));

    await waitFor(() =>
      expect(mocks.requestEmailChange).toHaveBeenCalledWith(
        'new@example.com',
        'Current_valid_42!',
      ),
    );
    expect(mocks.updateUserDetails).toHaveBeenCalledWith('user-adam', {
      username: 'Adam',
      email: 'adam@example.com',
    });
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/settings/account']}>
        <AccountSecurity />
      </MemoryRouter>,
    );

  it('shows connected identities and protects password changes with the current password', async () => {
    const { container } = renderPage();

    expect(await screen.findByRole('button', { name: 'Disconnect' }))
      .toBeInTheDocument();
    expect(screen.getByText('2 active sessions')).toBeInTheDocument();
    await expect(container).toHaveNoViolations();

    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: 'Different_valid_42!' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'Different_valid_42!' },
    });
    fireEvent.change(screen.getByPlaceholderText(/required for security changes/i), {
      target: { value: 'Current_valid_42!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update account/i }));

    await waitFor(() =>
      expect(mocks.updateUserDetails).toHaveBeenCalledWith('user-adam', {
        username: 'Adam',
        email: 'adam@example.com',
        password: 'Different_valid_42!',
        currentPassword: 'Current_valid_42!',
      }),
    );
  });

  it('requires confirmation and forwards proof for account deletion', async () => {
    renderPage();
    fireEvent.change(await screen.findByPlaceholderText(/required for security changes/i), {
      target: { value: 'Current_valid_42!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^delete account$/i }));

    await waitFor(() =>
      expect(mocks.deleteAccount).toHaveBeenCalledWith(
        'user-adam',
        'Current_valid_42!',
      ),
    );
  });

  it('revokes every session and clears the local session', async () => {
    renderPage();
    fireEvent.change(await screen.findByPlaceholderText(/required for security changes/i), {
      target: { value: 'Current_valid_42!' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /sign out every device/i }),
    );

    await waitFor(() =>
      expect(mocks.revokeAllSessions).toHaveBeenCalledWith(
        'Current_valid_42!',
      ),
    );
    expect(mocks.logout).toHaveBeenCalled();
  });
});
