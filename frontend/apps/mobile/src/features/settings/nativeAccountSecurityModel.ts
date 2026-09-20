import type { OAuthProvider } from '@pokemongonexus/shared-contracts/auth';

export type NativeAccountSecurityDraft = {
  confirmNewPassword: string;
  currentPassword: string;
  email: string;
  newPassword: string;
  username: string;
};

export type NativeUsernameUpdateRequest = {
  email: string;
  username: string;
};

export type NativePasswordUpdateRequest = {
  currentPassword?: string;
  email: string;
  password: string;
  username: string;
};

export type NativeEmailChangeRequest = {
  currentPassword?: string;
  email: string;
};

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const USERNAME_RE = /^[A-Za-z0-9_]{3,15}$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/;

export const createNativeAccountSecurityDraft = ({
  email,
  username,
}: {
  email: string;
  username: string;
}): NativeAccountSecurityDraft => ({
  confirmNewPassword: '',
  currentPassword: '',
  email,
  newPassword: '',
  username,
});

const requireCurrentPassword = (hasPassword: boolean, currentPassword: string): string | undefined => {
  const normalized = currentPassword.trim();
  if (hasPassword && !normalized) {
    throw new Error('Enter your current password to confirm this security change.');
  }
  return normalized || undefined;
};

export const buildNativeUsernameUpdateRequest = ({
  currentEmail,
  currentUsername,
  username,
}: {
  currentEmail: string;
  currentUsername: string;
  username: string;
}): NativeUsernameUpdateRequest | null => {
  const normalized = username.trim();
  if (normalized === currentUsername) return null;
  if (!USERNAME_RE.test(normalized)) {
    throw new Error('Username must use 3–15 letters, numbers, or underscores.');
  }
  return { email: currentEmail.trim().toLowerCase(), username: normalized };
};

export const buildNativeEmailChangeRequest = ({
  currentEmail,
  currentPassword,
  email,
  hasPassword,
}: {
  currentEmail: string;
  currentPassword: string;
  email: string;
  hasPassword: boolean;
}): NativeEmailChangeRequest | null => {
  const normalized = email.trim().toLowerCase();
  if (normalized === currentEmail.trim().toLowerCase()) return null;
  if (normalized.length > 255 || !EMAIL_RE.test(normalized)) {
    throw new Error('Enter a valid email address.');
  }
  return {
    email: normalized,
    ...(requireCurrentPassword(hasPassword, currentPassword)
      ? { currentPassword: currentPassword.trim() }
      : {}),
  };
};

export const buildNativePasswordUpdateRequest = ({
  confirmNewPassword,
  currentEmail,
  currentPassword,
  currentUsername,
  hasPassword,
  newPassword,
}: {
  confirmNewPassword: string;
  currentEmail: string;
  currentPassword: string;
  currentUsername: string;
  hasPassword: boolean;
  newPassword: string;
}): NativePasswordUpdateRequest | null => {
  if (!newPassword && !confirmNewPassword) return null;
  if (newPassword !== confirmNewPassword) throw new Error('Passwords do not match.');
  if (!PASSWORD_RE.test(newPassword)) {
    throw new Error('Use 8–128 characters with uppercase, lowercase, a number, and a symbol.');
  }
  const proof = requireCurrentPassword(hasPassword, currentPassword);
  return {
    email: currentEmail.trim().toLowerCase(),
    username: currentUsername,
    password: newPassword,
    ...(proof ? { currentPassword: proof } : {}),
  };
};

export const buildNativeSensitiveActionProof = ({
  currentPassword,
  hasPassword,
}: {
  currentPassword: string;
  hasPassword: boolean;
}): { currentPassword?: string } => {
  const proof = requireCurrentPassword(hasPassword, currentPassword);
  return proof ? { currentPassword: proof } : {};
};

export const nativeOAuthProviderLabel = (provider: OAuthProvider): string =>
  provider[0].toUpperCase() + provider.slice(1);

