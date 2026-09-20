// src/features/tags/hooks/useBootstrapTags.ts
import { useEffect } from 'react';

import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { useTagsStore } from '../store/useTagsStore';
import { createScopedLogger } from '@/utils/logger';
import { useAuthStore } from '@/stores/useAuthStore';

const log = createScopedLogger('useBootstrapTags');

/**
 * Hook to bootstrap the tags system:
 * 1. Hydrates from cache on initial mount.
 * 2. Rebuilds tags whenever both instances and variants are available.
 */
export function useBootstrapTags(enabled = true) {
  const isLoggedIn = useAuthStore(state => state.isLoggedIn);
  const hydrateFromCache = useTagsStore(state => state.hydrateFromCache);
  const buildTags        = useTagsStore(state => state.buildTags);
  const refreshCustomTagDefinitions = useTagsStore(
    state => state.refreshCustomTagDefinitions,
  );

  const instances = useInstancesStore(state => state.instances);
  const variants  = useVariantsStore(state => state.variants);

  // Hydrate tags from the cache on mount
  useEffect(() => {
    if (!enabled) return;
    hydrateFromCache().catch(error => {
      log.error('Hydration error:', error);
    });
    if (isLoggedIn) {
      refreshCustomTagDefinitions().catch(error => {
        log.warn('Using cached custom tags because refresh failed:', error);
      });
    }
  }, [enabled, hydrateFromCache, isLoggedIn, refreshCustomTagDefinitions]);

  // Whenever we have both instances and variants, rebuild the tags
  useEffect(() => {
    if (!enabled) return;
    if (
      instances && Object.keys(instances).length > 0 &&
      variants && variants.length > 0
    ) {
      buildTags().catch(error => {
        log.error('Build error:', error);
      });
    }
  }, [enabled, instances, variants, buildTags]);
}
