import { runtimeConfig } from '../config/runtimeConfig';
import { resolveNativeDeepLink } from '../navigation/nativeDeepLink';

export const redirectSystemPath = ({ path }: { path: string; initial: boolean }): string => {
  try {
    if (runtimeConfig.mobile.experienceMode === 'native-preview') {
      return resolveNativeDeepLink(path);
    }
    const parsed = new URL(path, 'https://pokegonexus.invalid');
    const canonicalPath = `${parsed.pathname}${parsed.search}`;
    return `/web?path=${encodeURIComponent(canonicalPath)}`;
  } catch {
    return runtimeConfig.mobile.experienceMode === 'native-preview' ? '/native' : '/web';
  }
};
