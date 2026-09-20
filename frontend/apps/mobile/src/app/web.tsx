import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebReplicaApp } from '../screens/WebReplicaApp';
import { resolveNativeActionMenuDestination } from '../navigation/nativeActionMenuNavigation';

export default function WebExperienceRoute() {
  const params = useLocalSearchParams<{ path?: string | string[] }>();
  const router = useRouter();
  const path = Array.isArray(params.path) ? params.path[0] : params.path;
  return (
    <WebReplicaApp
      initialPath={path}
      onOpenNativePath={(canonicalPath) => {
        if (canonicalPath.includes('?') || canonicalPath.includes('#')) return false;
        const destination = resolveNativeActionMenuDestination(canonicalPath);
        if (destination.kind !== 'native') return false;
        router.push(destination.pathname);
        return true;
      }}
    />
  );
}
