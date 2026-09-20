import {
  connectNativeOAuthProvider,
  exchangeNativeOAuthLinkCode,
  NATIVE_OAUTH_LINK_REDIRECT_URI,
  parseNativeOAuthLinkCallback,
} from '../../../../src/features/settings/nativeOAuthProviderLink';

describe('nativeOAuthProviderLink', () => {
  it('parses result codes and explicit callback failures', () => {
    expect(parseNativeOAuthLinkCallback(
      'pokegonexus://native/account?oauth_code=one-use-code',
    )).toEqual({ code: 'one-use-code', error: null });
    expect(parseNativeOAuthLinkCallback(
      'pokegonexus://native/account?oauth_error=expired',
    )).toEqual({ code: null, error: 'expired' });
    expect(parseNativeOAuthLinkCallback('not a url')).toEqual({
      code: null,
      error: 'invalid-callback',
    });
  });

  it('opens the provider in an auth session and exchanges the one-use result', async () => {
    const post = jest.fn()
      .mockResolvedValueOnce({
        authorizationUrl: 'https://accounts.example.test/authorize',
        provider: 'discord',
      })
      .mockResolvedValueOnce({ provider: 'discord', status: 'linked' });
    const openAuthSession = jest.fn().mockResolvedValue({
      type: 'success',
      url: 'pokegonexus://native/account?oauth_code=callback-code',
    });

    await expect(connectNativeOAuthProvider({
      client: { post },
      provider: 'discord',
      openAuthSession,
    })).resolves.toEqual({ provider: 'discord', status: 'linked' });
    expect(openAuthSession).toHaveBeenCalledWith(
      'https://accounts.example.test/authorize',
      NATIVE_OAUTH_LINK_REDIRECT_URI,
    );
    expect(post).toHaveBeenNthCalledWith(1, '/mobile/oauth/link/start', { provider: 'discord' });
    expect(post).toHaveBeenNthCalledWith(2, '/mobile/oauth/link/exchange', { code: 'callback-code' });
  });

  it('does not exchange a cancelled browser session', async () => {
    const post = jest.fn().mockResolvedValue({
      authorizationUrl: 'https://accounts.example.test/authorize',
      provider: 'facebook',
    });
    await expect(connectNativeOAuthProvider({
      client: { post },
      provider: 'facebook',
      openAuthSession: jest.fn().mockResolvedValue({ type: 'cancel' }),
    })).resolves.toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('rejects callback failures and provider ownership conflicts', async () => {
    const callbackFailurePost = jest.fn().mockResolvedValue({
      authorizationUrl: 'https://accounts.example.test/authorize',
      provider: 'google',
    });
    await expect(connectNativeOAuthProvider({
      client: { post: callbackFailurePost },
      provider: 'google',
      openAuthSession: jest.fn().mockResolvedValue({
        type: 'success',
        url: 'pokegonexus://native/account?oauth_error=expired',
      }),
    })).rejects.toThrow('authorization expired');
    expect(callbackFailurePost).toHaveBeenCalledTimes(1);

    await expect(exchangeNativeOAuthLinkCode({
      client: { post: jest.fn().mockResolvedValue({
        provider: 'google',
        status: 'link-conflict',
      }) },
      code: 'conflicted-code',
    })).rejects.toThrow('already connected to another');
  });
});
