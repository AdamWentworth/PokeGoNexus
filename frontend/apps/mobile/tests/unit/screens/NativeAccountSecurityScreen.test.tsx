import { fireEvent, render } from '@testing-library/react-native';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { AccountSecuritySummary } from '@pokemongonexus/shared-contracts/auth';
import { NativeAccountSecurityScreen } from '../../../src/screens/NativeAccountSecurityScreen';
import type { NativeAccountSecurityDraft } from '../../../src/features/settings/nativeAccountSecurityModel';

const draft: NativeAccountSecurityDraft = {
  confirmNewPassword: '',
  currentPassword: '',
  email: 'trainer@example.com',
  newPassword: '',
  username: 'TrainerOne',
};

const security: AccountSecuritySummary = {
  activeSessions: 3,
  email: 'trainer@example.com',
  hasPassword: true,
  providers: [{
    email: 'trainer@gmail.com',
    emailVerified: true,
    linkedAt: '2026-08-24T12:00:00.000Z',
    provider: 'google',
  }],
};

const renderScreen = (props: Partial<React.ComponentProps<typeof NativeAccountSecurityScreen>> = {}) => render(
  <SafeAreaProvider initialMetrics={{
    frame: { x: 0, y: 0, width: 412, height: 915 },
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  }}>
    <NativeAccountSecurityScreen
      draft={draft}
      onBack={jest.fn()}
      onChange={jest.fn()}
      onConnectProvider={jest.fn()}
      onDeleteAccount={jest.fn()}
      onOpenSettings={jest.fn()}
      onRetry={jest.fn()}
      onRevokeAllSessions={jest.fn()}
      onSignOut={jest.fn()}
      onUnlinkProvider={jest.fn()}
      onUpdateAccount={jest.fn()}
      security={security}
      {...props}
    />
  </SafeAreaProvider>,
);

describe('NativeAccountSecurityScreen', () => {
  it('renders the canonical combined account update workflow', () => {
    const view = renderScreen();
    const flattenedContentStyle = StyleSheet.flatten(
      view.getByTestId('native-account-security-content').props.contentContainerStyle,
    );
    expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe(
      Platform.OS === 'ios' ? 'padding' : 'height',
    );
    expect(flattenedContentStyle.paddingBottom).toBeGreaterThanOrEqual(128);
    expect(view.getByText('Account details')).toBeTruthy();
    expect(view.getByText('Email')).toBeTruthy();
    expect(view.getByText('New password')).toBeTruthy();
    expect(view.getByText('Connected accounts')).toBeTruthy();
    expect(view.getAllByText('Delete account')).toHaveLength(2);
    expect(view.getByText('3 active sessions')).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Account' }).props.accessibilityState.selected).toBe(true);
  });

  it('updates identity fields and dispatches one account update command', () => {
    const onChange = jest.fn();
    const onUpdateAccount = jest.fn();
    const view = renderScreen({
      onChange,
      onUpdateAccount,
    });

    fireEvent.changeText(view.getByLabelText('Username'), 'TrainerTwo');
    expect(onChange).toHaveBeenCalledWith({ ...draft, username: 'TrainerTwo' });
    fireEvent.changeText(view.getByLabelText('Email'), 'new@example.com');
    expect(onChange).toHaveBeenCalledWith({ ...draft, email: 'new@example.com' });
    fireEvent.changeText(view.getByLabelText('New password'), 'Different_42!');
    fireEvent.press(view.getByRole('button', { name: 'Update account' }));
    expect(onUpdateAccount).toHaveBeenCalledTimes(1);
  });

  it('connects missing providers and confirms provider disconnection', () => {
    const dismissKeyboard = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const onChange = jest.fn();
    const onConnectProvider = jest.fn();
    const onUnlinkProvider = jest.fn();
    const view = renderScreen({ onChange, onConnectProvider, onUnlinkProvider });

    fireEvent.press(view.getByRole('button', { name: 'Connect Discord' }));
    expect(onConnectProvider).toHaveBeenCalledWith('discord');

    fireEvent.press(view.getByRole('button', { name: 'Disconnect Google' }));
    expect(view.getByText('Disconnect Google?')).toBeTruthy();
    const passwordInputs = view.getAllByLabelText('Current password');
    fireEvent.changeText(passwordInputs[passwordInputs.length - 1], 'Current_password_42!');
    expect(onChange).toHaveBeenCalledWith({
      ...draft,
      currentPassword: 'Current_password_42!',
    });
    const disconnectConfirmations = view.getAllByRole('button', { name: 'Disconnect' });
    fireEvent.press(disconnectConfirmations[disconnectConfirmations.length - 1]);
    expect(dismissKeyboard).toHaveBeenCalledTimes(3);
    expect(onUnlinkProvider).toHaveBeenCalledWith('google');
    dismissKeyboard.mockRestore();
  });

  it('confirms session revocation and permanent deletion before dispatching', () => {
    const onDeleteAccount = jest.fn();
    const onRevokeAllSessions = jest.fn();
    const view = renderScreen({ onDeleteAccount, onRevokeAllSessions });

    fireEvent.press(view.getByRole('button', { name: 'Sign out every device' }));
    expect(view.getByText('Sign out every device?')).toBeTruthy();
    const revokeConfirmations = view.getAllByRole('button', { name: 'Sign out every device' });
    fireEvent.press(revokeConfirmations[revokeConfirmations.length - 1]);
    expect(onRevokeAllSessions).toHaveBeenCalledTimes(1);

    fireEvent.press(view.getByRole('button', { name: 'Permanently delete account' }));
    expect(view.getByText('Permanently delete your account?')).toBeTruthy();
    const deletionConfirmations = view.getAllByRole('button', { name: 'Delete account' });
    fireEvent.press(deletionConfirmations[deletionConfirmations.length - 1]);
    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it('uses recent provider authentication instead of asking OAuth-only accounts for a password', () => {
    const view = renderScreen({ security: { ...security, hasPassword: false } });
    expect(view.queryByLabelText('Current password')).toBeNull();
    expect(view.getByText('New password')).toBeTruthy();
    expect(view.getByText(/recent provider sign-in confirms sensitive actions/i)).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Disconnect Google' }));
    expect(view.getByText(/you do not need a separate password/i)).toBeTruthy();
  });

  it('keeps loading, errors, and command feedback visible and actionable', () => {
    const onDismissFeedback = jest.fn();
    const onRetry = jest.fn();
    const view = renderScreen({
      error: 'Account security is unavailable.',
      feedback: { tone: 'success', text: 'Verification email sent.' },
      isLoading: true,
      onDismissFeedback,
      onRetry,
    });
    expect(view.getByText('Loading account security…')).toBeTruthy();
    expect(view.getByText('Account security is unavailable.')).toBeTruthy();
    expect(view.getByText('Verification email sent.')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Retry' }));
    fireEvent.press(view.getByRole('button', { name: 'Dismiss message' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismissFeedback).toHaveBeenCalledTimes(1);
  });
});
