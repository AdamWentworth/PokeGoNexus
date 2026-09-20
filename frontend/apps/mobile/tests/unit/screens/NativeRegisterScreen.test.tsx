import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NativeRegisterScreen } from '../../../src/screens/NativeRegisterScreen';

describe('NativeRegisterScreen', () => {
  it('shows canonical provider registration guidance before a method is selected', () => {
    render(
      <NativeRegisterScreen
        notice="No account exists for that provider email yet. Choose a sign-up method to register."
        onBackToLogin={jest.fn()}
        onOpenPrivacy={jest.fn()}
        onOpenTerms={jest.fn()}
        onOAuthRegister={jest.fn()}
        onOAuthStart={jest.fn()}
        onRegister={jest.fn()}
        onRegistered={jest.fn()}
      />,
    );

    expect(screen.getByText(/No account exists for that provider email yet/)).toBeTruthy();
    expect(screen.getByText('Sign up with Google')).toBeTruthy();
  });

  it('collects the canonical account fields and submits a normalized registration', async () => {
    const onRegister = jest.fn().mockResolvedValue(undefined);
    const onRegistered = jest.fn();
    render(
      <NativeRegisterScreen
        getCurrentCoordinates={async () => ({ latitude: 49.28, longitude: -123.12 })}
        getLocationOptions={async () => [{ displayName: 'Cerulean City' }]}
        onBackToLogin={jest.fn()}
        onOpenPrivacy={jest.fn()}
        onOpenTerms={jest.fn()}
        onOAuthRegister={jest.fn()}
        onOAuthStart={jest.fn()}
        onRegister={onRegister}
        onRegistered={onRegistered}
      />,
    );

    fireEvent.press(screen.getByText('Continue with email'));

    fireEvent.changeText(screen.getByPlaceholderText('Choose a unique username'), 'Misty_42');
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'MISTY@example.com ');
    fireEvent.press(screen.getByText('Continue ›'));

    fireEvent.changeText(screen.getByPlaceholderText('Create a password'), 'Strong_password_42!');
    fireEvent.changeText(screen.getByPlaceholderText('Enter it again'), 'Strong_password_42!');
    fireEvent.press(screen.getByText('Continue ›'));

    fireEvent.changeText(screen.getByPlaceholderText('Optional'), 'MistyGo');
    fireEvent.changeText(screen.getByPlaceholderText('0000 0000 0000'), '123456789012');
    fireEvent.press(screen.getByText('Continue ›'));

    fireEvent.changeText(
      screen.getByPlaceholderText('City, region, country'),
      'Cerulean City',
    );
    fireEvent.press(screen.getByRole('checkbox', { name: 'Use this device’s location' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Cerulean City' }));
    fireEvent.press(screen.getByText('Continue ›'));

    fireEvent.press(screen.getByText('Create account ✓'));
    await waitFor(() => expect(onRegister).toHaveBeenCalledWith({
      allowLocation: true,
      coordinates: { latitude: 49.28, longitude: -123.12 },
      email: 'misty@example.com',
      location: 'Cerulean City',
      password: 'Strong_password_42!',
      pokemonGoName: 'MistyGo',
      trainerCode: '123456789012',
      username: 'Misty_42',
    }));
    expect(onRegistered).toHaveBeenCalledTimes(1);
  });

  it('keeps the Pokémon GO name synchronized when the canonical same-name choice is enabled', async () => {
    const onRegister = jest.fn().mockResolvedValue(undefined);
    render(
      <NativeRegisterScreen
        onBackToLogin={jest.fn()}
        onOpenPrivacy={jest.fn()}
        onOpenTerms={jest.fn()}
        onOAuthRegister={jest.fn()}
        onOAuthStart={jest.fn()}
        onRegister={onRegister}
        onRegistered={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText('Continue with email'));
    fireEvent.changeText(screen.getByLabelText('Username'), 'Misty_42');
    fireEvent.changeText(screen.getByLabelText('Email'), 'misty@example.com');
    fireEvent.press(screen.getByText('Continue ›'));
    fireEvent.changeText(screen.getByLabelText('Password'), 'Strong_password_42!');
    fireEvent.changeText(screen.getByLabelText('Confirm password'), 'Strong_password_42!');
    fireEvent.press(screen.getByText('Continue ›'));

    const sameName = screen.getByRole('checkbox', { name: 'Use Misty_42 as my Pokémon GO name' });
    fireEvent.press(sameName);
    expect(sameName.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    expect(screen.getByLabelText('Pokémon GO name')).toBeDisabled();
    expect(screen.getByLabelText('Pokémon GO name')).toHaveProp('value', 'Misty_42');
  });

  it('keeps the user on the current step when validation fails', () => {
    render(
      <NativeRegisterScreen
        onBackToLogin={jest.fn()}
        onOpenPrivacy={jest.fn()}
        onOpenTerms={jest.fn()}
        onOAuthRegister={jest.fn()}
        onOAuthStart={jest.fn()}
        onRegister={jest.fn()}
        onRegistered={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText('Continue with email'));

    fireEvent.press(screen.getByText('Continue ›'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Username must be 3–15 letters, numbers, or underscores.',
    );
    expect(screen.getByPlaceholderText('Choose a unique username')).toBeTruthy();
  });

  it('uses a verified provider email and skips password collection for OAuth registration', async () => {
    const onOAuthStart = jest.fn().mockResolvedValue({
      code: 'native-oauth-result-code',
      email: 'misty@example.com',
    });
    const onOAuthRegister = jest.fn().mockResolvedValue(undefined);
    const onRegistered = jest.fn();
    render(
      <NativeRegisterScreen
        onBackToLogin={jest.fn()}
        onOpenPrivacy={jest.fn()}
        onOpenTerms={jest.fn()}
        onOAuthRegister={onOAuthRegister}
        onOAuthStart={onOAuthStart}
        onRegister={jest.fn()}
        onRegistered={onRegistered}
      />,
    );

    fireEvent.press(screen.getByText('Sign up with Google'));
    await screen.findByText('misty@example.com');
    expect(screen.queryByPlaceholderText('Create a password')).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText('Choose a unique username'), 'Misty_42');
    fireEvent.press(screen.getByText('Continue ›'));
    expect(screen.getByPlaceholderText('Optional')).toBeTruthy();
    fireEvent.press(screen.getByText('Continue ›'));
    fireEvent.press(screen.getByText('Continue ›'));
    fireEvent.press(screen.getByText('Create account ✓'));

    await waitFor(() => expect(onOAuthRegister).toHaveBeenCalledWith(
      'native-oauth-result-code',
      {
        allowLocation: false,
        coordinates: null,
        location: null,
        pokemonGoName: null,
        trainerCode: null,
        username: 'Misty_42',
      },
    ));
    expect(onRegistered).toHaveBeenCalledTimes(1);
  });
});
