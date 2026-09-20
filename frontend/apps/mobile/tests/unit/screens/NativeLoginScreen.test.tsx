import { ApiClientError } from '@pokemongonexus/shared-api-client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NativeLoginScreen } from '../../../src/screens/NativeLoginScreen';

describe('NativeLoginScreen', () => {
  it('keeps a security-action result visible when reauthentication is required', () => {
    render(
      <NativeLoginScreen
        notice="Password updated. Sign in again on this device."
        onOpenPasswordReset={jest.fn()}
        onSignIn={jest.fn()}
        onSignedIn={jest.fn()}
        onSocialSignIn={jest.fn()}
      />,
    );
    expect(screen.getByText('Password updated. Sign in again on this device.')).toBeTruthy();
  });

  it('submits credentials and advances only after the session succeeds', async () => {
    const onSignIn = jest.fn().mockResolvedValue(undefined);
    const onSignedIn = jest.fn();
    render(
      <NativeLoginScreen
        onOpenPasswordReset={jest.fn()}
        onSignIn={onSignIn}
        onSignedIn={onSignedIn}
        onSocialSignIn={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByPlaceholderText('Username or Email'), 'misty');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password');
    fireEvent.press(screen.getByText('Login'));

    await waitFor(() => expect(onSignIn).toHaveBeenCalledWith('misty', 'password'));
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it('matches the canonical field validation instead of silently disabling submit', () => {
    const onSignIn = jest.fn();
    render(
      <NativeLoginScreen
        onOpenPasswordReset={jest.fn()}
        onSignIn={onSignIn}
        onSignedIn={jest.fn()}
        onSocialSignIn={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText('Login'));
    expect(screen.getByText('Username or Email is required.')).toBeTruthy();
    expect(screen.getByText('Password is required.')).toBeTruthy();
    expect(onSignIn).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByPlaceholderText('Username or Email'), 'not-an-email@');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'x');
    fireEvent.press(screen.getByText('Login'));
    expect(screen.getByText('Please enter a valid email address.')).toBeTruthy();
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('keeps the form visible and explains invalid credentials', async () => {
    const onSignIn = jest.fn().mockRejectedValue(
      new ApiClientError(401, 'Invalid credentials', { message: 'Invalid credentials' }),
    );
    render(
      <NativeLoginScreen
        onOpenPasswordReset={jest.fn()}
        onSignIn={onSignIn}
        onSignedIn={jest.fn()}
        onSocialSignIn={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByPlaceholderText('Username or Email'), 'misty');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password');
    fireEvent.press(screen.getByText('Login'));

    expect(await screen.findByText(
      'That username, email, or password was not recognized.',
    )).toBeTruthy();
  });

  it('matches the canonical reset and provider actions', async () => {
    const onOpenPasswordReset = jest.fn();
    const onSocialSignIn = jest.fn();
    render(
      <NativeLoginScreen
        onOpenPasswordReset={onOpenPasswordReset}
        onSignIn={jest.fn()}
        onSignedIn={jest.fn()}
        onSocialSignIn={onSocialSignIn}
      />,
    );

    fireEvent.press(screen.getByText('Reset Password'));
    fireEvent.press(screen.getByText('Login with Google'));
    await waitFor(() => expect(onSocialSignIn).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByText('Login with Discord'));
    await waitFor(() => expect(onSocialSignIn).toHaveBeenCalledTimes(2));
    fireEvent.press(screen.getByText('Login with Facebook'));
    await waitFor(() => expect(onSocialSignIn).toHaveBeenCalledTimes(3));

    expect(onOpenPasswordReset).toHaveBeenCalledTimes(1);
    expect(onSocialSignIn).toHaveBeenNthCalledWith(1, 'google');
    expect(onSocialSignIn).toHaveBeenNthCalledWith(2, 'discord');
    expect(onSocialSignIn).toHaveBeenNthCalledWith(3, 'facebook');
  });
});
