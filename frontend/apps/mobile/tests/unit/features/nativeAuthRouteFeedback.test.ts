import {
  nativeAccountOAuthFeedback,
  nativeLoginOAuthNotice,
  nativeRegisterOAuthNotice,
} from '../../../src/features/auth/nativeAuthRouteFeedback';

describe('native auth route feedback', () => {
  test('preserves canonical login OAuth guidance', () => {
    expect(nativeLoginOAuthNotice('account-exists')).toContain('already exists');
    expect(nativeLoginOAuthNotice('link-required')).toContain('Sign in normally');
    expect(nativeLoginOAuthNotice('denied')).toContain('could not be completed securely');
    expect(nativeLoginOAuthNotice('success')).toBeNull();
    expect(nativeLoginOAuthNotice(null)).toBeNull();
  });

  test('guides a provider login without an account into registration', () => {
    expect(nativeRegisterOAuthNotice('account-not-found')).toContain('Choose a sign-up method');
    expect(nativeRegisterOAuthNotice('google')).toBeNull();
  });

  test('preserves canonical account-provider feedback', () => {
    expect(nativeAccountOAuthFeedback('linked')).toEqual({
      tone: 'success',
      text: 'Sign-in method connected.',
    });
    expect(nativeAccountOAuthFeedback('link-conflict')).toEqual({
      tone: 'error',
      text: 'That provider account is already connected elsewhere.',
    });
    expect(nativeAccountOAuthFeedback(null)).toBeNull();
  });
});
