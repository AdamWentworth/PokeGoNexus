import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { runtimeConfig } from '../../config/runtimeConfig';
import { NativeLoginScreen } from '../../screens/NativeLoginScreen';
import { NativePasswordResetOverlay } from '../../components/NativePasswordResetOverlay';

export default function DeviceSmokeLoginRoute() {
  const params = useLocalSearchParams<{ performance?: string | string[] }>();
  const [notice, setNotice] = useState<string | null>(null);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1 }}>
      <NativeLoginScreen
        notice={notice}
        onOpenPasswordReset={() => setPasswordResetOpen(true)}
        onSignIn={async () => undefined}
        onSignedIn={() => setNotice('Signed in.')}
        onSocialSignIn={async (provider) => setNotice(`${provider} sign-in opened.`)}
      />
      {passwordResetOpen ? (
        <NativePasswordResetOverlay
          initialIdentifier={params.performance === '1' ? 'PerfAuth' : undefined}
          onClose={() => setPasswordResetOpen(false)}
          onRequest={async () => undefined}
          onRequested={() => {
            setPasswordResetOpen(false);
            setNotice('If that account exists, reset instructions are on the way.');
          }}
          visible
        />
      ) : null}
      <NativeRouteActionMenu />
    </View>
  );
}
