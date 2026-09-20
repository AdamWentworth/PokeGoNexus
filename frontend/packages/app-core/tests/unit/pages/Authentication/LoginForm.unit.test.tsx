import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import LoginForm from '@/pages/Authentication/FormComponents/LoginForm';

const authMocks = vi.hoisted(() => ({
  google: vi.fn(),
  discord: vi.fn(),
  facebook: vi.fn(),
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({ alert: vi.fn() }),
}));

vi.mock('@/services/authService', () => ({
  startGoogleAuthentication: authMocks.google,
  startDiscordAuthentication: authMocks.discord,
  startFacebookAuthentication: authMocks.facebook,
}));

describe('LoginForm', () => {
  it('labels the credentials and lets the user reveal the password', () => {
    render(
      <LoginForm
        values={{ username: '', password: 'trainer-password' }}
        errors={{}}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/username or email/i)).toHaveAttribute('autocomplete', 'username');

    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));

    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('associates validation feedback with the corresponding fields', () => {
    render(
      <LoginForm
        values={{ username: '', password: '' }}
        errors={{ username: 'Username is required.', password: 'Password is required.' }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/username or email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });

  it('renders consistently sized provider buttons and starts each login flow', () => {
    render(
      <LoginForm
        values={{ username: '', password: '' }}
        errors={{}}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const google = screen.getByRole('button', { name: /login with google/i });
    const discord = screen.getByRole('button', { name: /login with discord/i });
    const facebook = screen.getByRole('button', { name: /login with facebook/i });

    for (const button of [google, discord, facebook]) {
      expect(button).toHaveClass('oauth-login-button');
      expect(button).toHaveAttribute('type', 'button');
    }

    fireEvent.click(google);
    fireEvent.click(discord);
    fireEvent.click(facebook);

    expect(authMocks.google).toHaveBeenCalledWith('login');
    expect(authMocks.discord).toHaveBeenCalledWith('login');
    expect(authMocks.facebook).toHaveBeenCalledWith('login');
  });
});
