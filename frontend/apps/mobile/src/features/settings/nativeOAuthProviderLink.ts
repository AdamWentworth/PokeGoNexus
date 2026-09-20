import type {
  MobileOAuthLinkExchangeResponse,
  OAuthProvider,
} from '@pokemongonexus/shared-contracts/auth';
import * as WebBrowser from 'expo-web-browser';
import type { NativeAuthApiClient } from '../../services/nativeApiClients';
import {
  exchangeNativeOAuthProviderLink,
  startNativeOAuthProviderLink,
} from '../../services/nativeAccountSecurityApi';

export const NATIVE_OAUTH_LINK_REDIRECT_URI = 'pokegonexus://native/account';

type AuthSessionResult =
  | { type: 'success'; url: string }
  | { type: 'cancel' | 'dismiss' | 'locked' | 'opened' };

type OpenAuthSession = (
  authorizationUrl: string,
  redirectUri: string,
) => Promise<AuthSessionResult>;

type AuthClient = Pick<NativeAuthApiClient, 'post'>;

export const parseNativeOAuthLinkCallback = (callbackUrl: string): {
  code: string | null;
  error: string | null;
} => {
  try {
    const parsed = new URL(callbackUrl);
    return {
      code: parsed.searchParams.get('oauth_code'),
      error: parsed.searchParams.get('oauth_error'),
    };
  } catch {
    return { code: null, error: 'invalid-callback' };
  }
};

export const exchangeNativeOAuthLinkCode = async ({
  client,
  code,
}: {
  client: AuthClient;
  code: string;
}): Promise<MobileOAuthLinkExchangeResponse> => {
  const result = await exchangeNativeOAuthProviderLink(client, code);
  if (result.status === 'link-conflict') {
    throw new Error('That provider account is already connected to another Pokémon Go Nexus account.');
  }
  if (result.status !== 'linked') {
    throw new Error('The provider account could not be connected. Please try again.');
  }
  return result;
};

export const connectNativeOAuthProvider = async ({
  client,
  provider,
  openAuthSession = WebBrowser.openAuthSessionAsync as OpenAuthSession,
}: {
  client: AuthClient;
  provider: OAuthProvider;
  openAuthSession?: OpenAuthSession;
}): Promise<MobileOAuthLinkExchangeResponse | null> => {
  const start = await startNativeOAuthProviderLink(client, provider);
  const browserResult = await openAuthSession(
    start.authorizationUrl,
    NATIVE_OAUTH_LINK_REDIRECT_URI,
  );
  if (browserResult.type !== 'success') return null;

  const callback = parseNativeOAuthLinkCallback(browserResult.url);
  if (callback.error) {
    throw new Error('The provider authorization expired or was not completed.');
  }
  if (!callback.code) {
    throw new Error('The provider did not return a valid account connection result.');
  }
  return exchangeNativeOAuthLinkCode({ client, code: callback.code });
};
