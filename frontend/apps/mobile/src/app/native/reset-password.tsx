import { useLocalSearchParams, useRouter } from 'expo-router';
import { mobileSessionApi } from '../../auth/mobileSessionApi';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { NativePasswordResetScreen } from '../../screens/NativePasswordResetScreen';

const firstParam = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? value[0] ?? '' : value ?? ''
);

export default function NativePasswordResetRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = firstParam(params.token).trim();
  return (
    <>
      <NativePasswordResetScreen
        onBackToLogin={() => router.replace('/native/login')}
        onConfirm={(nextToken, password) => mobileSessionApi.confirmPasswordReset({ token: nextToken, password })}
        token={token}
      />
      <NativeRouteActionMenu />
    </>
  );
}
