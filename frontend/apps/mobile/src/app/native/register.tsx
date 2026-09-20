import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { NativeRegisterScreen } from '../../screens/NativeRegisterScreen';
import { nativeRegisterOAuthNotice } from '../../features/auth/nativeAuthRouteFeedback';
import { NativeProtectedSessionGate } from '../../components/NativeProtectedSessionGate';

export default function NativeRegisterRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ oauth?: string | string[] }>();
  const session = useNativeSession();
  const oauthStatus = Array.isArray(params.oauth) ? params.oauth[0] : params.oauth;
  if (session.status === 'restoring' || session.status === 'unavailable') {
    return (
      <NativeProtectedSessionGate
        message="Checking your secure session…"
        onRetry={session.retrySession}
        status={session.status}
      />
    );
  }
  if (session.status === 'signed-in' && session.user) return <Redirect href="/native" />;
  return (
    <>
      <NativeRegisterScreen
        notice={nativeRegisterOAuthNotice(oauthStatus?.trim() || null)}
        onBackToLogin={() => router.replace('/native/login')}
        onOpenPrivacy={() => router.push({ pathname: '/native/info/[slug]', params: { slug: 'privacy' } })}
        onOpenTerms={() => router.push({ pathname: '/native/info/[slug]', params: { slug: 'terms' } })}
        onOAuthStart={async (provider) => {
          const result = await session.authenticateWithOAuth(provider, 'register');
          if (!result) throw new Error('Provider registration was canceled.');
          if (result.status === 'account-exists') {
            throw new Error('An account already exists for that email. Sign in instead.');
          }
          if (result.status !== 'registration-required' || !result.email) {
            throw new Error('Provider registration could not be started.');
          }
          return { code: result.code, email: result.email };
        }}
        onOAuthRegister={(code, request) => session.completeOAuthRegistration(code, request)}
        onRegister={session.register}
        onRegistered={() => router.replace('/native')}
      />
      <NativeRouteActionMenu currentPath="/register" />
    </>
  );
}
