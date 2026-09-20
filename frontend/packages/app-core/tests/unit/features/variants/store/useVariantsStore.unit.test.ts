import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { variantsRepository } from '@/features/variants/repositories/variantsRepository';
import {
  getChunkVersion,
  getPokemonCatalogManifest,
  getPokemonMovesChunk,
  getPokemonRaidDataChunk,
} from '@/services/pokemonDataService';
import { queueVariantsPersist } from '@/db/variantsDB';
import type { PokemonVariant } from '@/types/pokemonVariants';

import variantsFixture from '@/../tests/__helpers__/fixtures/variants.json';

vi.mock('@/features/variants/repositories/variantsRepository', () => ({
  variantsRepository: {
    loadCache: vi.fn(),
    fetchFresh: vi.fn(),
  },
}));

vi.mock('@/services/pokemonDataService', () => ({
  getPokemonCatalogManifest: vi.fn().mockResolvedValue({
    schemaVersion: 1,
    catalogVersion: 'catalog-v1',
    generatedAt: '2026-07-14T00:00:00Z',
    chunks: {
      pokemonFull: {
        name: 'pokemonFull',
        endpoint: '/pokemon/pokemons',
        contentType: 'application/json',
        etag: '"catalog-v1"',
        version: 'catalog-v1',
        bytesJson: 1,
        bytesGzip: 1,
      },
    },
  }),
  getCatalogDataVersion: vi.fn((manifest: { catalogVersion?: string } | null) => manifest?.catalogVersion ?? null),
  getChunkVersion: vi.fn(() => null),
  getPokemonMovesChunk: vi.fn(),
  getPokemonRaidDataChunk: vi.fn(),
}));

vi.mock('@/db/variantsDB', () => ({
  queueVariantsPersist: vi.fn(),
}));

const cachedVariants = (variantsFixture as unknown as PokemonVariant[]).slice(0, 3);
const freshVariants = (variantsFixture as unknown as PokemonVariant[]).slice(3, 8);

describe.sequential('useVariantsStore (unit)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    useVariantsStore.setState({
      variants: [],
      variantsLoading: true,
      isRefreshing: false,
      isMovesLoading: false,
      isRaidDataLoading: false,
      raidDataRequested: false,
    });

    vi.mocked(variantsRepository.loadCache).mockResolvedValue({
      variants: cachedVariants,
    });

    vi.mocked(variantsRepository.fetchFresh).mockResolvedValue({
      variants: freshVariants,
    });

    vi.mocked(getChunkVersion).mockReturnValue(null);

  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates from cache before the manifest-aware refresh completes', async () => {
    let resolveFresh: (value: { variants: PokemonVariant[] }) => void;
    vi.mocked(variantsRepository.fetchFresh).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFresh = resolve;
      }),
    );

    await useVariantsStore.getState().hydrateFromCache();

    expect(useVariantsStore.getState()).toMatchObject({
      variants: cachedVariants,
      variantsLoading: false,
    });
    expect(variantsRepository.fetchFresh).toHaveBeenCalledOnce();

    resolveFresh!({ variants: freshVariants });
    await vi.waitFor(() => {
      expect(useVariantsStore.getState().variants).toEqual(freshVariants);
    });
  });

  it('hydrates from cache and triggers a background manifest-aware refresh', async () => {
    await useVariantsStore.getState().hydrateFromCache();
    await vi.waitFor(() => {
      expect(variantsRepository.fetchFresh).toHaveBeenCalled();
    });

    expect(useVariantsStore.getState().variants).toEqual(freshVariants);
  });

  it('refreshVariants delegates freshness decisions to the manifest-aware repository', async () => {
    await useVariantsStore.getState().refreshVariants();

    const state = useVariantsStore.getState();
    expect(variantsRepository.fetchFresh).toHaveBeenCalledOnce();
    expect(variantsRepository.loadCache).not.toHaveBeenCalled();
    expect(state.variants).toEqual(freshVariants);
    expect(state.variantsLoading).toBe(false);
    expect(state.isRefreshing).toBe(false);
  });

  it('refreshVariants fetches fresh data when stale', async () => {
    await useVariantsStore.getState().refreshVariants();

    const state = useVariantsStore.getState();
    expect(variantsRepository.fetchFresh).toHaveBeenCalled();
    expect(state.variants).toEqual(freshVariants);
    expect(state.isRefreshing).toBe(false);
  });

  it('refreshVariants falls back to cache on fetch failure', async () => {
    vi.mocked(variantsRepository.fetchFresh).mockRejectedValueOnce(new Error('network down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await useVariantsStore.getState().refreshVariants();

    const state = useVariantsStore.getState();
    expect(variantsRepository.fetchFresh).toHaveBeenCalled();
    expect(variantsRepository.loadCache).toHaveBeenCalled();
    expect(state.variants).toEqual(cachedVariants);
    expect(state.variantsLoading).toBe(false);
    expect(state.isRefreshing).toBe(false);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('refreshVariants is a no-op while another refresh is running', async () => {
    useVariantsStore.setState({ isRefreshing: true });

    await useVariantsStore.getState().refreshVariants();

    expect(variantsRepository.fetchFresh).not.toHaveBeenCalled();
    expect(variantsRepository.loadCache).not.toHaveBeenCalled();
    expect(useVariantsStore.getState().isRefreshing).toBe(true);
  });

  it('hydrates move pools independently without rebuilding the catalog', async () => {
    const variant = {
      ...(cachedVariants[0] as PokemonVariant),
      pokemon_id: 1,
      variantType: 'default' as const,
      moves: [],
      fusion: [],
      crownForms: [],
    } as PokemonVariant;
    const manifest = {
      schemaVersion: 2,
      catalogVersion: 'catalog-v1',
      generatedAt: '2026-07-14T00:00:00Z',
      chunks: {
        pokemonFull: {} as any,
        catalog: { version: 'catalog-v1' },
        moves: { version: 'moves-v2' },
      },
    } as any;

    useVariantsStore.setState({ variants: [variant], variantsLoading: false });
    vi.mocked(getPokemonCatalogManifest).mockResolvedValueOnce(manifest);
    vi.mocked(getChunkVersion).mockImplementation((_, chunk) =>
      chunk === 'moves' ? 'moves-v2' : null,
    );
    vi.mocked(getPokemonMovesChunk).mockResolvedValueOnce([
      { pokemon_id: 1, moves: [{ move_id: 1, name: 'Tackle' } as any], fusion: [], crownForms: [] },
    ]);

    await useVariantsStore.getState().ensureMoves();

    expect(useVariantsStore.getState().variants[0]?.moves.map((move) => move.name)).toEqual(['Tackle']);
    expect(localStorage.getItem('pokemonMovesVersion')).toBe('moves-v2');
    expect(queueVariantsPersist).toHaveBeenCalledOnce();
  });

  it('rehydrates moves when the version matches but the current catalog has no move data', async () => {
    const variant = {
      ...(cachedVariants[0] as PokemonVariant),
      pokemon_id: 1,
      moves: [],
      fusion: [],
      crownForms: [],
    } as PokemonVariant;
    const manifest = {
      catalogVersion: 'catalog-v2',
      chunks: { moves: { version: 'moves-v2' } },
    } as any;

    localStorage.setItem('pokemonMovesVersion', 'moves-v2');
    useVariantsStore.setState({ variants: [variant], variantsLoading: false });
    vi.mocked(getPokemonCatalogManifest).mockResolvedValueOnce(manifest);
    vi.mocked(getChunkVersion).mockImplementation((_, chunk) =>
      chunk === 'moves' ? 'moves-v2' : null,
    );
    vi.mocked(getPokemonMovesChunk).mockResolvedValueOnce([
      { pokemon_id: 1, moves: [{ move_id: 1, name: 'Tackle' } as any], fusion: [], crownForms: [] },
    ]);

    await useVariantsStore.getState().ensureMoves();

    expect(getPokemonMovesChunk).toHaveBeenCalledOnce();
    expect(useVariantsStore.getState().variants[0]?.moves.map((move) => move.name)).toEqual(['Tackle']);
  });

  it('coalesces overlapping move hydration requests without scheduling a duplicate retry', async () => {
    const variant = {
      ...(cachedVariants[0] as PokemonVariant),
      pokemon_id: 1,
      moves: [],
      fusion: [],
      crownForms: [],
    } as PokemonVariant;
    const manifest = {
      catalogVersion: 'catalog-v2',
      chunks: { moves: { version: 'moves-v2' } },
    } as any;
    let resolveChunk: (chunk: any) => void;

    useVariantsStore.setState({ variants: [variant], variantsLoading: false });
    vi.mocked(getPokemonCatalogManifest).mockResolvedValue(manifest);
    vi.mocked(getChunkVersion).mockImplementation((_, chunk) =>
      chunk === 'moves' ? 'moves-v2' : null,
    );
    vi.mocked(getPokemonMovesChunk).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveChunk = resolve;
      }),
    );

    const firstHydration = useVariantsStore.getState().ensureMoves();
    await vi.waitFor(() => expect(useVariantsStore.getState().isMovesLoading).toBe(true));

    const overlappingHydration = useVariantsStore.getState().ensureMoves();
    expect(overlappingHydration).toBe(firstHydration);

    resolveChunk!([
      { pokemon_id: 1, moves: [{ move_id: 1, name: 'Tackle' }], fusion: [], crownForms: [] },
    ]);
    await Promise.all([firstHydration, overlappingHydration]);

    await vi.waitFor(() => {
      expect(useVariantsStore.getState()).toMatchObject({
        isMovesLoading: false,
      });
    });
    expect(useVariantsStore.getState().variants[0]?.moves.map((move) => move.name)).toEqual(['Tackle']);
    expect(getPokemonCatalogManifest).toHaveBeenCalledOnce();
    expect(getPokemonMovesChunk).toHaveBeenCalledOnce();
  });

  it('rehydrates move data after a base catalog refresh removes it', async () => {
    const enrichedVariant = {
      ...(cachedVariants[0] as PokemonVariant),
      pokemon_id: 1,
      moves: [{ move_id: 1, name: 'Tackle' } as any],
      fusion: [],
      crownForms: [],
    } as PokemonVariant;
    const refreshedVariant = { ...enrichedVariant, moves: [] } as PokemonVariant;
    const manifest = {
      catalogVersion: 'catalog-v2',
      chunks: { moves: { version: 'moves-v2' } },
    } as any;

    localStorage.setItem('pokemonMovesVersion', 'moves-v2');
    useVariantsStore.setState({ variants: [enrichedVariant], variantsLoading: false });
    vi.mocked(variantsRepository.fetchFresh).mockResolvedValueOnce({
      variants: [refreshedVariant],
    });
    vi.mocked(getPokemonCatalogManifest).mockResolvedValue(manifest);
    vi.mocked(getChunkVersion).mockImplementation((_, chunk) =>
      chunk === 'moves' ? 'moves-v2' : null,
    );
    vi.mocked(getPokemonMovesChunk).mockResolvedValueOnce([
      { pokemon_id: 1, moves: [{ move_id: 1, name: 'Tackle' } as any], fusion: [], crownForms: [] },
    ]);

    await useVariantsStore.getState().refreshVariants();

    await vi.waitFor(() => {
      expect(useVariantsStore.getState().variants[0]?.moves).toHaveLength(1);
    });
    expect(getPokemonMovesChunk).toHaveBeenCalledOnce();
  });

  it('hydrates raid history only when the raid loader requests it', async () => {
    const variant = {
      ...(cachedVariants[0] as PokemonVariant),
      pokemon_id: 1,
      form: null,
      name: 'Bulbasaur',
      species_name: 'Bulbasaur',
      variantType: 'shadow' as const,
      moves: [],
      fusion: [],
      crownForms: [],
    } as PokemonVariant;
    const manifest = {
      schemaVersion: 2,
      catalogVersion: 'catalog-v1',
      generatedAt: '2026-07-14T00:00:00Z',
      chunks: {
        pokemonFull: {} as any,
        catalog: { version: 'catalog-v1' },
        raidData: { version: 'raids-v2' },
      },
    } as any;

    useVariantsStore.setState({ variants: [variant], variantsLoading: false });
    vi.mocked(getPokemonCatalogManifest).mockResolvedValueOnce(manifest);
    vi.mocked(getChunkVersion).mockImplementation((_, chunk) =>
      chunk === 'raidData' ? 'raids-v2' : null,
    );
    vi.mocked(getPokemonRaidDataChunk).mockResolvedValueOnce([
      {
        pokemon_id: 1,
        raid_boss: [{ id: 1, pokemon_id: 1, name: 'Shadow Bulbasaur', form: '', tier: 'shadow_1' } as any],
      },
    ]);

    await useVariantsStore.getState().ensureRaidData();

    expect(useVariantsStore.getState().variants[0]?.raid_boss).toHaveLength(1);
    expect(localStorage.getItem('pokemonRaidDataVersion')).toBe('raids-v2');
    expect(queueVariantsPersist).toHaveBeenCalledOnce();
  });

  it('rehydrates requested raid data after a base catalog refresh removes it', async () => {
    const enrichedVariant = {
      ...(cachedVariants[0] as PokemonVariant),
      pokemon_id: 1,
      form: null,
      name: 'Bulbasaur',
      species_name: 'Bulbasaur',
      raid_boss: [{ id: 1, pokemon_id: 1, name: 'Bulbasaur', form: '', tier: '1' } as any],
    } as PokemonVariant;
    const refreshedVariant = { ...enrichedVariant };
    delete refreshedVariant.raid_boss;
    const manifest = {
      catalogVersion: 'catalog-v2',
      chunks: { raidData: { version: 'raids-v2' } },
    } as any;

    localStorage.setItem('pokemonRaidDataVersion', 'raids-v2');
    useVariantsStore.setState({
      variants: [enrichedVariant],
      variantsLoading: false,
      raidDataRequested: true,
    });
    vi.mocked(variantsRepository.fetchFresh).mockResolvedValueOnce({
      variants: [refreshedVariant],
    });
    vi.mocked(getPokemonCatalogManifest).mockResolvedValue(manifest);
    vi.mocked(getChunkVersion).mockImplementation((_, chunk) =>
      chunk === 'raidData' ? 'raids-v2' : null,
    );
    vi.mocked(getPokemonRaidDataChunk).mockResolvedValueOnce([
      {
        pokemon_id: 1,
        raid_boss: [{ id: 1, pokemon_id: 1, name: 'Bulbasaur', form: '', tier: '1' } as any],
      },
    ]);

    await useVariantsStore.getState().refreshVariants();

    await vi.waitFor(() => {
      expect(useVariantsStore.getState().variants[0]?.raid_boss).toHaveLength(1);
    });
    expect(getPokemonRaidDataChunk).toHaveBeenCalledOnce();
  });

  it('preserves both chunks when move and raid hydration finish together', async () => {
    const variant = {
      ...(cachedVariants[0] as PokemonVariant),
      pokemon_id: 1,
      form: null,
      name: 'Bulbasaur',
      species_name: 'Bulbasaur',
      moves: [],
      fusion: [],
      crownForms: [],
    } as PokemonVariant;
    const manifest = {
      catalogVersion: 'catalog-v2',
      chunks: {
        moves: { version: 'moves-v2' },
        raidData: { version: 'raids-v2' },
      },
    } as any;
    let resolveMoves: (chunk: any) => void;
    let resolveRaids: (chunk: any) => void;

    useVariantsStore.setState({ variants: [variant], variantsLoading: false });
    vi.mocked(getPokemonCatalogManifest).mockResolvedValue(manifest);
    vi.mocked(getChunkVersion).mockImplementation((_, chunk) =>
      chunk === 'moves' ? 'moves-v2' : chunk === 'raidData' ? 'raids-v2' : null,
    );
    vi.mocked(getPokemonMovesChunk).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMoves = resolve;
      }),
    );
    vi.mocked(getPokemonRaidDataChunk).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRaids = resolve;
      }),
    );

    const movesHydration = useVariantsStore.getState().ensureMoves();
    const raidHydration = useVariantsStore.getState().ensureRaidData();
    resolveMoves!([
      { pokemon_id: 1, moves: [{ move_id: 1, name: 'Tackle' }], fusion: [], crownForms: [] },
    ]);
    resolveRaids!([
      {
        pokemon_id: 1,
        raid_boss: [{ id: 1, pokemon_id: 1, name: 'Bulbasaur', form: '', tier: '1' }],
      },
    ]);
    await Promise.all([movesHydration, raidHydration]);

    expect(useVariantsStore.getState().variants[0]?.moves).toHaveLength(1);
    expect(useVariantsStore.getState().variants[0]?.raid_boss).toHaveLength(1);
  });

  it('remembers an early raid request and hydrates it when the catalog arrives', async () => {
    const refreshedVariant = {
      ...(cachedVariants[0] as PokemonVariant),
      pokemon_id: 1,
      form: null,
      name: 'Bulbasaur',
      species_name: 'Bulbasaur',
    } as PokemonVariant;
    const manifest = {
      catalogVersion: 'catalog-v2',
      chunks: { raidData: { version: 'raids-v2' } },
    } as any;

    await useVariantsStore.getState().ensureRaidData();
    expect(useVariantsStore.getState().raidDataRequested).toBe(true);

    vi.mocked(variantsRepository.fetchFresh).mockResolvedValueOnce({
      variants: [refreshedVariant],
    });
    vi.mocked(getPokemonCatalogManifest).mockResolvedValue(manifest);
    vi.mocked(getChunkVersion).mockImplementation((_, chunk) =>
      chunk === 'raidData' ? 'raids-v2' : null,
    );
    vi.mocked(getPokemonRaidDataChunk).mockResolvedValueOnce([
      {
        pokemon_id: 1,
        raid_boss: [{ id: 1, pokemon_id: 1, name: 'Bulbasaur', form: '', tier: '1' } as any],
      },
    ]);

    await useVariantsStore.getState().refreshVariants();

    await vi.waitFor(() => {
      expect(useVariantsStore.getState().variants[0]?.raid_boss).toHaveLength(1);
    });
    expect(getPokemonRaidDataChunk).toHaveBeenCalledOnce();
  });
});
