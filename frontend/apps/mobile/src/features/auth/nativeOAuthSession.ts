import type {
  MobileOAuthExchangeResponse,
  MobileOAuthIntent,
  OAuthProvider,
} from '@pokemongonexus/shared-contracts/auth';
import * as WebBrowser from 'expo-web-browser';
import type { MobileSessionApi } from '../../auth/mobileSessionApi';

export const NATIVE_OAUTH_SESSION_REDIRECT_URI = 'pokegonexus://native/account';

type AuthSessionResult =
  | { type: 'success'; url: string }
  | { type: 'cancel' | 'dismiss' | 'locked' | 'opened' };

type OpenAuthSession = (
  authorizationUrl: string,
  redirectUri: string,
) => Promise<AuthSessionResult>;

export type NativeOAuthAttemptResult = MobileOAuthExchangeResponse & {
  code: string;
};

export const parseNativeOAuthSessionCallback = (callbackUrl: string): {
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

export const authenticateWithNativeOAuth = async ({
  api,
  deviceId,
  intent,
  openAuthSession = WebBrowser.openAuthSessionAsync as OpenAuthSession,
  provider,
}: {
  api: Pick<MobileSessionApi, 'exchangeOAuth' | 'startOAuth'>;
  deviceId: string;
  intent: MobileOAuthIntent;
  openAuthSession?: OpenAuthSession;
  provider: OAuthProvider;
}): Promise<NativeOAuthAttemptResult | null> => {
  const start = await api.startOAuth({ provider, intent, device_id: deviceId });
  const browserResult = await openAuthSession(
    start.authorizationUrl,
    NATIVE_OAUTH_SESSION_REDIRECT_URI,
  );
  if (browserResult.type !== 'success') return null;
  const callback = parseNativeOAuthSessionCallback(browserResult.url);
  if (callback.error) {
    throw new Error('Provider sign-in expired or was not completed.');
  }
  if (!callback.code) {
    throw new Error('The provider did not return a valid sign-in result.');
  }
  const result = await api.exchangeOAuth({
    code: callback.code,
    device_id: deviceId,
  });
  return { ...result, code: callback.code };
};
