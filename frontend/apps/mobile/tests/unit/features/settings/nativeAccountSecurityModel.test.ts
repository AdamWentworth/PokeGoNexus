import {
  buildNativeEmailChangeRequest,
  buildNativePasswordUpdateRequest,
  buildNativeSensitiveActionProof,
  buildNativeUsernameUpdateRequest,
  createNativeAccountSecurityDraft,
} from '../../../../src/features/settings/nativeAccountSecurityModel';

describe('nativeAccountSecurityModel', () => {
  it('creates an empty sensitive-data draft from the current identity', () => {
    expect(createNativeAccountSecurityDraft({
      email: 'trainer@example.com',
      username: 'TrainerOne',
    })).toEqual({
      confirmNewPassword: '',
      currentPassword: '',
      email: 'trainer@example.com',
      newPassword: '',
      username: 'TrainerOne',
    });
  });

  it('normalizes a changed username and ignores an unchanged one', () => {
    expect(buildNativeUsernameUpdateRequest({
      currentEmail: 'Trainer@Example.com',
      currentUsername: 'TrainerOne',
      username: ' Trainer_Two ',
    })).toEqual({ email: 'trainer@example.com', username: 'Trainer_Two' });
    expect(buildNativeUsernameUpdateRequest({
      currentEmail: 'trainer@example.com',
      currentUsername: 'TrainerOne',
      username: 'TrainerOne',
    })).toBeNull();
    expect(() => buildNativeUsernameUpdateRequest({
      currentEmail: 'trainer@example.com',
      currentUsername: 'TrainerOne',
      username: 'spaces are invalid',
    })).toThrow('Username must use 3–15 letters, numbers, or underscores.');
  });

  it('requires current-password proof for password-backed email changes', () => {
    expect(() => buildNativeEmailChangeRequest({
      currentEmail: 'old@example.com',
      currentPassword: '',
      email: 'new@example.com',
      hasPassword: true,
    })).toThrow('Enter your current password');
    expect(buildNativeEmailChangeRequest({
      currentEmail: 'old@example.com',
      currentPassword: 'Current_password_42!',
      email: ' NEW@example.com ',
      hasPassword: true,
    })).toEqual({
      currentPassword: 'Current_password_42!',
      email: 'new@example.com',
    });
  });

  it('guardrails password strength, confirmation, and proof independently', () => {
    expect(() => buildNativePasswordUpdateRequest({
      confirmNewPassword: 'Mismatch_42!',
      currentEmail: 'old@example.com',
      currentPassword: 'Current_password_42!',
      currentUsername: 'TrainerOne',
      hasPassword: true,
      newPassword: 'Different_42!',
    })).toThrow('Passwords do not match.');
    expect(buildNativePasswordUpdateRequest({
      confirmNewPassword: 'Different_42!',
      currentEmail: 'old@example.com',
      currentPassword: 'Current_password_42!',
      currentUsername: 'TrainerOne',
      hasPassword: true,
      newPassword: 'Different_42!',
    })).toEqual({
      currentPassword: 'Current_password_42!',
      email: 'old@example.com',
      password: 'Different_42!',
      username: 'TrainerOne',
    });
  });

  it('allows recent OAuth authentication to prove sensitive actions without a password', () => {
    expect(buildNativeSensitiveActionProof({ currentPassword: '', hasPassword: false })).toEqual({});
    expect(() => buildNativeSensitiveActionProof({ currentPassword: '', hasPassword: true }))
      .toThrow('Enter your current password');
  });
});

