import { useRouter } from 'expo-router';
import { runtimeConfig } from '../../config/runtimeConfig';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { raidMethodologyContent } from '../../features/tools/nativeMethodologyContent';
import { NativeMethodologyScreen } from '../../screens/NativeMethodologyScreen';

export default function NativeRaidMethodologyRoute() {
  const router = useRouter();
  return (
    <>
      <NativeMethodologyScreen
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        content={raidMethodologyContent}
        onBack={() => router.canGoBack() ? router.back() : router.replace('/native/raid')}
      />
      <NativeRouteActionMenu currentPath="/raid/methodology" />
    </>
  );
}
