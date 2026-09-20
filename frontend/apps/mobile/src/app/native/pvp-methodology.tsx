import { useRouter } from 'expo-router';
import { runtimeConfig } from '../../config/runtimeConfig';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { NativeMethodologyScreen } from '../../screens/NativeMethodologyScreen';
import { pvpMethodologyContent } from '../../features/tools/nativeMethodologyContent';

export default function NativePvpMethodologyRoute() {
  const router = useRouter();
  return (
    <>
      <NativeMethodologyScreen
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        content={pvpMethodologyContent}
        onBack={() => router.canGoBack() ? router.back() : router.replace('/native/pvp')}
      />
      <NativeRouteActionMenu currentPath="/pvp/methodology" />
    </>
  );
}
