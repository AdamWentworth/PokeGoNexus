// AppBootstrap.tsx

import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { useBootstrapInstances } from '@/features/instances/hooks/useBootstrapInstances';
import { useInstanceReconciliation } from '@/features/instances/hooks/useInstanceReconciliation';
import { useBootstrapVariants } from '@/features/variants/hooks/useBootstrapVariants';
import { useBootstrapTags } from '@/features/tags/hooks/useBootstrapTags';
import { useBootstrapTrades } from '@/features/trades/hooks/useBootstrapTrades';
import { useInitLocation } from '@/features/location/hooks/useInitLocation';
import { useAuthStore } from '@/stores/useAuthStore';
import { isAuthRoute } from '@/utils/routes/isAuthRoute';

/** Runs one-off bootstrapping side-effects. Mount once at app start. */
const AppBootstrap = () => {
  const location = useLocation();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const enabled =
    !isAuthRoute(location.pathname) &&
    location.pathname !== '/max' &&
    location.pathname !== '/pvp';

  useBootstrapVariants(enabled);
  useBootstrapInstances(enabled);
  useInstanceReconciliation(enabled);
  useBootstrapTags(enabled);
  // Trade reconciliation calls the authenticated users API. Public routes
  // still bootstrap shared catalog data, but must not issue trade requests
  // for a signed-out visitor.
  useBootstrapTrades(enabled && isLoggedIn);
  useInitLocation(enabled);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(
      localStorage.getItem('pokegonexus-reduced-motion') === 'true',
    );
  }, []);

  return null;
};

export default AppBootstrap;
