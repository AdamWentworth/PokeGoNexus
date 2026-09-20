// tests/integration/features/variants/store/useVariantsStore.integration.test.ts
import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  type MockInstance,
} from 'vitest';

import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { variantsRepository } from '@/features/variants/repositories/variantsRepository';
import type { PokemonVariant } from '@/types/pokemonVariants';

import variantsFixture from '@/../tests/__helpers__/fixtures/variants.json';

const dummyVariants = variantsFixture as unknown as PokemonVariant[];

let loadCacheSpy: MockInstance;
let fetchFreshSpy: MockInstance;

describe.sequential('useVariantsStore integration', () => {
  beforeEach(() => {
    localStorage.clear();

    const now = Date.now();
    localStorage.setItem('variantsTimestamp', now.toString());

    loadCacheSpy = vi
      .spyOn(variantsRepository, 'loadCache')
      .mockResolvedValue({
        variants: dummyVariants,
      });

    fetchFreshSpy = vi
      .spyOn(variantsRepository, 'fetchFresh')
      .mockResolvedValue({ variants: dummyVariants });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useVariantsStore.setState({
      variants: [],
      variantsLoading: true,
      isRefreshing: false,
    });
  });

  it('hydrates from cache correctly', async () => {
    await useVariantsStore.getState().hydrateFromCache();
    expect(useVariantsStore.getState().variantsLoading).toBe(false);
    expect(useVariantsStore.getState().variants).toEqual(dummyVariants);
    expect(fetchFreshSpy).toHaveBeenCalled();
  });

  it('fetches fresh variants when cache is stale', async () => {
    const stale = Date.now() - 1000 * 60 * 60 * 48;
    localStorage.setItem('variantsTimestamp', stale.toString());

    await useVariantsStore.getState().refreshVariants();

    expect(fetchFreshSpy).toHaveBeenCalled();
    expect(useVariantsStore.getState().variants).toEqual(dummyVariants);
  });

  it('triggers a background manifest-aware refresh after cache hydration', async () => {
    const refreshSpy = vi
      .spyOn(useVariantsStore.getState(), 'refreshVariants')
      .mockResolvedValue();

    await useVariantsStore.getState().hydrateFromCache();
    await Promise.resolve();

    expect(refreshSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(useVariantsStore.getState().variants).toEqual(dummyVariants);
  });

  it('checks the manifest-aware refresh path even when timestamp cache is fresh', async () => {
    await useVariantsStore.getState().refreshVariants();

    expect(fetchFreshSpy).toHaveBeenCalled();
    expect(useVariantsStore.getState().variants).toEqual(dummyVariants);
  });

  it('falls back to cached variants when fetchFresh throws', async () => {
    const stale = Date.now() - 1000 * 60 * 60 * 48;
    localStorage.setItem('variantsTimestamp', stale.toString());

    vi.spyOn(variantsRepository, 'fetchFresh').mockRejectedValue(new Error('network down'));

    await useVariantsStore.getState().refreshVariants();

    expect(loadCacheSpy.mock.calls.length).toBeGreaterThanOrEqual(1); // fallback read
    expect(useVariantsStore.getState().variants).toEqual(dummyVariants);
  });

  it('ignores a second refresh call while one is already running', async () => {
    // Stale timestamps so refreshVariants will attempt the network
    const stale = Date.now() - 1000 * 60 * 60 * 48;
    localStorage.setItem('variantsTimestamp', stale.toString());

    // Create a deferred promise to keep the first fetch busy
    let resolveFetch!: (v: { variants: PokemonVariant[] }) => void;
    const fetchPromise = new Promise<{ variants: PokemonVariant[] }>(
      (r) => (resolveFetch = r),
    );
    const fetchFreshSpy = vi
      .spyOn(variantsRepository, 'fetchFresh')
      .mockReturnValue(fetchPromise as unknown as Promise<any>);

    // Kick off two refreshes without awaiting the first
    const store = useVariantsStore.getState();
    const first = store.refreshVariants();
    const second = store.refreshVariants(); // should return immediately

    // Let the call stack clear so isRefreshing has time to flip
    await Promise.resolve();

    // Complete the network request
    resolveFetch({ variants: dummyVariants });
    await Promise.all([first, second]);

    // Only one network call should have been made
    expect(fetchFreshSpy).toHaveBeenCalledTimes(1);
    expect(useVariantsStore.getState().variants).toEqual(dummyVariants);
  });
});
