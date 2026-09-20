export type NativeRouteFeedback = {
  text: string;
  tone: 'error' | 'success';
};

export const nativeLoginOAuthNotice = (status: string | null): string | null => {
  if (!status || status === 'success') return null;
  if (status === 'account-exists') {
    return 'An account already exists for that email. Sign in with the provider or your password.';
  }
  if (status === 'link-required') {
    return 'That email already has a password account. Sign in normally before linking a provider.';
  }
  return 'Provider login could not be completed securely. Please try again.';
};

export const nativeRegisterOAuthNotice = (status: string | null): string | null => (
  status === 'account-not-found'
    ? 'No account exists for that provider email yet. Choose a sign-up method to register.'
    : null
);

export const nativeAccountOAuthFeedback = (status: string | null): NativeRouteFeedback | null => {
  if (status === 'linked') {
    return { tone: 'success', text: 'Sign-in method connected.' };
  }
  if (status === 'link-conflict') {
    return { tone: 'error', text: 'That provider account is already connected elsewhere.' };
  }
  return null;
};
