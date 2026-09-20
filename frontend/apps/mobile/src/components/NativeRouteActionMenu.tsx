import { useRouter } from 'expo-router';
import { useState } from 'react';
import { NativeActionMenu } from './NativeActionMenu';
import { NativeActionMenuAnchor } from './NativeActionMenuAnchor';
import { runtimeConfig } from '../config/runtimeConfig';
import { resolveNativeActionMenuDestination } from '../navigation/nativeActionMenuNavigation';

type Props = {
  anchorInteractive?: boolean;
  currentPath?: string;
  signedIn?: boolean;
};

/** Keeps the established global Poké Ball navigation available on routes that
 * do not otherwise own page-level action-menu state (auth confirmations,
 * registration, recovery, and methodology references). */
export const NativeRouteActionMenu = ({ anchorInteractive = true, currentPath, signedIn }: Props) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const navigate = (path: string) => {
    setOpen(false);
    const destination = resolveNativeActionMenuDestination(path, currentPath);
    if (destination.kind === 'current') return;
    if (destination.kind === 'native') {
      router.push(destination.pathname);
      return;
    }
    router.push({ pathname: '/web', params: { path: destination.path } });
  };

  return (
    <>
      <NativeActionMenuAnchor
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        disabled={!anchorInteractive}
        onPress={() => setOpen(true)}
      />
      {open ? (
        <NativeActionMenu
          assetBaseUrl={runtimeConfig.api.frontendAppUrl}
          onClose={() => setOpen(false)}
          onNavigate={navigate}
          signedIn={signedIn}
          visible
        />
      ) : null}
    </>
  );
};
