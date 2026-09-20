// src/features/variants/utils/loadVariants.ts

import { getAllVariants } from '@/db/variantsDB';
import { isDataFresh } from '@/utils/cacheHelpers';
import { formatTimeAgo } from '@/utils/formattingHelpers';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { logSize } from '@/utils/loggers';
import { fetchAndProcessVariants } from './fetchAndProcessVariants';
import { createScopedLogger } from '@/utils/logger';
import { getCatalogDataVersion, getPokemonCatalogManifest } from '@/services/pokemonDataService';
import {
  getStorageNumber,
  getStorageString,
  STORAGE_KEYS,
} from '@/utils/storage';
import type { PokemonCatalogManifest } from '@shared-contracts/pokemon';

const log = createScopedLogger('loadVariants');

function getForcedRefreshCutoff(): number {
  const raw = import.meta.env.VITE_FORCED_REFRESH_TIMESTAMP || '0';
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function passesForcedRefreshCutoff(timestamp: number): boolean {
  const forcedRefreshCutoff = getForcedRefreshCutoff();
  return !forcedRefreshCutoff || timestamp >= forcedRefreshCutoff;
}

function isVersionedCacheFresh(
  timestamp: number,
  cachedCatalogVersion: string | null,
  currentCatalogVersion: string | null,
): boolean {
  if (!timestamp || !passesForcedRefreshCutoff(timestamp)) return false;

  if (currentCatalogVersion) {
    return cachedCatalogVersion === currentCatalogVersion;
  }

  return isDataFresh(timestamp);
}

async function getManifestOrNull(): Promise<PokemonCatalogManifest | null> {
  try {
    return await getPokemonCatalogManifest();
  } catch (error) {
    log.warn('Pokemon catalog manifest unavailable; falling back to timestamp cache freshness.', error);
    return null;
  }
}

export async function loadVariants() {
  log.debug('Fetching data from API or cache...');

  const variantsTimestamp = getStorageNumber(STORAGE_KEYS.variantsTimestamp, 0);
  const manifest = await getManifestOrNull();
  const currentCatalogVersion = getCatalogDataVersion(manifest);
  const variantsCatalogVersion = getStorageString(STORAGE_KEYS.pokemonCatalogVersion);

  const variantsFresh = isVersionedCacheFresh(
    variantsTimestamp,
    variantsCatalogVersion,
    currentCatalogVersion,
  );

  const logAge = (label: string, t: number) =>
    log.debug(t ? `${label} Age: ${formatTimeAgo(t)}` : `${label} data is missing.`);

  logAge('Cached Variants', variantsTimestamp);
  if (currentCatalogVersion) {
    log.debug(
      `Pokemon catalog version: current=${currentCatalogVersion}, variants=${variantsCatalogVersion ?? 'missing'}`,
    );
  }

  let variants: PokemonVariant[];

  if (variantsFresh) {
    log.debug('Using cached variants...');
    const t0 = Date.now();
    variants = await getAllVariants<PokemonVariant>();
    log.debug(`Retrieved variants from IndexedDB in ${Date.now() - t0} ms`);
    logSize('cached variants', variants);
  } else {
    log.debug('Variants are stale or missing, updating...');
    variants = await fetchAndProcessVariants({ manifest });
  }

  log.debug(`Returning ${variants.length} variants.`);
  return { variants };
}
