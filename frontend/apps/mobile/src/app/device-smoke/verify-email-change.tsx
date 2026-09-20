import { Redirect } from 'expo-router';
import NativeVerifyEmailChangeRoute from '../native/verify-email-change';
import { NativeSessionProvider } from '../../auth/NativeSessionContext';
import { runtimeConfig } from '../../config/runtimeConfig';

export default function DeviceSmokeVerifyEmailChangeRoute() {
  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;
  return (
    <NativeSessionProvider>
      <NativeVerifyEmailChangeRoute />
    </NativeSessionProvider>
  );
}
