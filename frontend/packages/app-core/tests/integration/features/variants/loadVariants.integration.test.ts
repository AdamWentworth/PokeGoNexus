import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/variants/utils/fetchAndProcessVariants', () => ({
  fetchAndProcessVariants: vi.fn(),
}));

vi.mock('@/services/pokemonDataService', () => ({
  getPokemonCatalogManifest: vi.fn(),
  getCatalogDataVersion: (manifest: { chunks?: { catalog?: { version?: string } }; catalogVersion?: string } | null) =>
    manifest?.chunks?.catalog?.version ?? manifest?.catalogVersion ?? null,
}));

import { loadVariants } from '@/features/variants/utils/loadVariants';
import { fetchAndProcessVariants } from '@/features/variants/utils/fetchAndProcessVariants';
import { getPokemonCatalogManifest } from '@/services/pokemonDataService';
import { initVariantsDB } from '@/db/init';
import { VARIANTS_STORE } from '@/db/constants';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { PokemonCatalogManifest } from '@shared-contracts/pokemon';
import variantsFixture from '@/../tests/__helpers__/fixtures/variants.json';

async function clearVariantCache() {
  const variantsDB = await initVariantsDB();
  if (variantsDB) await variantsDB.clear(VARIANTS_STORE);
  localStorage.removeItem('variantsTimestamp');
}

async function persistVariants(variants: PokemonVariant[]) {
  const variantsDB = await initVariantsDB();
  if (!variantsDB) return;

  const tx = variantsDB.transaction(VARIANTS_STORE, 'readwrite');
  for (const variant of variants) tx.store.put(variant);
  await tx.done;
}

describe.sequential('loadVariants (integration)', () => {
  const manifest: PokemonCatalogManifest = {
    schemaVersion: 2,
    catalogVersion: 'legacy-catalog-v1',
    generatedAt: '2026-07-14T00:00:00Z',
    chunks: {
      pokemonFull: {
        name: 'pokemonFull',
        endpoint: '/pokemon/pokemons',
        contentType: 'application/json',
        etag: '"catalog-v1"',
        version: 'catalog-v1',
        bytesJson: 100,
        bytesGzip: 50,
      },
      catalog: {
        name: 'catalog',
        endpoint: '/pokemon/catalog',
        contentType: 'application/json',
        etag: '"catalog-chunk-v1"',
        version: 'catalog-chunk-v1',
        bytesJson: 90,
        bytesGzip: 45,
      },
      moves: {
        name: 'moves',
        endpoint: '/pokemon/moves',
        contentType: 'application/json',
        etag: '"moves-v1"',
        version: 'moves-v1',
        bytesJson: 20,
        bytesGzip: 10,
      },
    },
  };
  const catalogChunkVersion = manifest.chunks.catalog?.version as string;
  const freshVariants = (variantsFixture as PokemonVariant[]).slice(0, 50).map((variant, idx) => ({
    ...variant,
    variant_id:
      (variant as any).variant_id ??
      `${String(variant.pokemon_id).padStart(4, '0')}-${variant.variantType}-${idx}`,
  }));
  const staleTimestamp = Date.now() - 1000 * 60 * 60 * 48;

  beforeEach(async () => {
    vi.clearAllMocks();
    await clearVariantCache();
    localStorage.removeItem('pokemonCatalogVersion');
    vi.mocked(getPokemonCatalogManifest).mockResolvedValue(manifest);
    vi.mocked(fetchAndProcessVariants).mockResolvedValue(freshVariants);
  });

  it('cold start fetches and returns the canonical variants catalog', async () => {
    const result = await loadVariants();

    expect(fetchAndProcessVariants).toHaveBeenCalledWith({ manifest });
    expect(result).toEqual({ variants: freshVariants });
  });

  it('warm cache uses IndexedDB and skips the fetch path', async () => {
    await persistVariants(freshVariants);
    localStorage.setItem('variantsTimestamp', Date.now().toString());
    localStorage.setItem('pokemonCatalogVersion', catalogChunkVersion);

    const result = await loadVariants();

    expect(fetchAndProcessVariants).not.toHaveBeenCalled();
    expect(result.variants).toHaveLength(freshVariants.length);
  });

  it('versioned warm cache remains valid when its timestamp is older than the TTL', async () => {
    await persistVariants(freshVariants);
    localStorage.setItem('variantsTimestamp', staleTimestamp.toString());
    localStorage.setItem('pokemonCatalogVersion', catalogChunkVersion);

    const result = await loadVariants();

    expect(fetchAndProcessVariants).not.toHaveBeenCalled();
    expect(result.variants).toHaveLength(freshVariants.length);
  });

  it('fetches fresh variants when the catalog version changes', async () => {
    localStorage.setItem('variantsTimestamp', Date.now().toString());
    localStorage.setItem('pokemonCatalogVersion', 'old-catalog');

    const result = await loadVariants();

    expect(fetchAndProcessVariants).toHaveBeenCalledWith({ manifest });
    expect(result.variants).toHaveLength(freshVariants.length);
  });

  it('uses timestamp freshness when the manifest endpoint is unavailable', async () => {
    await persistVariants(freshVariants);
    localStorage.setItem('variantsTimestamp', Date.now().toString());
    vi.mocked(getPokemonCatalogManifest).mockRejectedValueOnce(new Error('manifest unavailable'));

    const result = await loadVariants();

    expect(fetchAndProcessVariants).not.toHaveBeenCalled();
    expect(result.variants).toHaveLength(freshVariants.length);
  });

  it('does not rebuild catalog variants when only the moves chunk version changes', async () => {
    await persistVariants(freshVariants);
    const movesChangedManifest: PokemonCatalogManifest = {
      ...manifest,
      chunks: {
        ...manifest.chunks,
        moves: {
          ...manifest.chunks.moves!,
          etag: '"moves-v2"',
          version: 'moves-v2',
        },
      },
    };
    vi.mocked(getPokemonCatalogManifest).mockResolvedValueOnce(movesChangedManifest);
    localStorage.setItem('variantsTimestamp', Date.now().toString());
    localStorage.setItem('pokemonCatalogVersion', catalogChunkVersion);

    const result = await loadVariants();

    expect(fetchAndProcessVariants).not.toHaveBeenCalled();
    expect(result.variants).toHaveLength(freshVariants.length);
  });
});
