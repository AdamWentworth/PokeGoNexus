import { Redirect } from 'expo-router';
import NativeNotFoundRoute from '../native/not-found';
import { runtimeConfig } from '../../config/runtimeConfig';

export default function DeviceSmokeNotFoundRoute() {
  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;
  return <NativeNotFoundRoute />;
}
