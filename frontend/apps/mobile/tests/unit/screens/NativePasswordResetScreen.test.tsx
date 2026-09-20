import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NativePasswordResetScreen } from '../../../src/screens/NativePasswordResetScreen';

describe('NativePasswordResetScreen', () => {
  it('shows the canonical incomplete-link state when no token is present', () => {
    render(<NativePasswordResetScreen onBackToLogin={jest.fn()} onConfirm={jest.fn()} />);
    expect(screen.getByText('This reset link is incomplete.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update password' })).toBeDisabled();
  });

  it('confirms only matching strong passwords', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    render(<NativePasswordResetScreen onBackToLogin={jest.fn()} onConfirm={onConfirm} token="reset-token" />);
    fireEvent.changeText(screen.getByLabelText('New password'), 'Strong_password_42!');
    fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'Strong_password_42!');
    fireEvent.press(screen.getByText('Update password'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('reset-token', 'Strong_password_42!'));
    await waitFor(() => expect(screen.getByText('Password updated')).toBeTruthy());
    expect(screen.getByText('Your other sessions have been signed out. Taking you back to login…')).toBeTruthy();
    expect(screen.getByText('Continue to login')).toBeTruthy();
  });
});
