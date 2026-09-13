import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PokemonVariant } from '@/types/pokemonVariants';
import type { Instances } from '@/types/instances';

const variantsState = vi.hoisted(() => ({
  variants: [] as PokemonVariant[],
  variantsLoading: true,
  isMovesLoading: false,
}));
const instancesState = vi.hoisted(() => ({
  instances: {} as Instances,
  instancesLoading: true,
}));
const authState = vi.hoisted(() => ({ isLoggedIn: false }));
const serviceMocks = vi.hoisted(() => ({
  manifest: vi.fn(),
  maxData: vi.fn(),
  moves: vi.fn(),
  pokemon: vi.fn(),
}));
const createVariants = vi.hoisted(() => vi.fn());
const loadInstances = vi.hoisted(() => vi.fn());

vi.mock('@/features/variants/store/useVariantsStore', () => ({
  useVariantsStore: (selector: (state: typeof variantsState) => unknown) =>
    selector(variantsState),
}));
vi.mock('@/features/instances/store/useInstancesStore', () => ({
  useInstancesStore: (selector: (state: typeof instancesState) => unknown) =>
    selector(instancesState),
}));
vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) =>
    selector(authState),
}));
vi.mock('@/services/pokemonDataService', () => ({
  getPokemonCatalogManifest: serviceMocks.manifest,
  getPokemonMaxDataChunk: serviceMocks.maxData,
  getPokemonMovesChunk: serviceMocks.moves,
  getPokemons: serviceMocks.pokemon,
}));
vi.mock('@/features/variants/utils/createPokemonVariants', () => ({
  default: createVariants,
}));
vi.mock('@/features/instances/services/loadInstances', () => ({
  loadInstances,
}));

import {
  resetMaxBattleDataRequestForTests,
  useMaxBattleData,
} from '@/pages/Max/hooks/useMaxBattleData';

const maxVariant = {
  variant_id: '0001-dynamax',
  variantType: 'dynamax',
  pokemon_id: 1,
  pokedex_number: 1,
  name: 'Dynamax Bulbasaur',
} as PokemonVariant;

describe('useMaxBattleData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMaxBattleDataRequestForTests();
    variantsState.variants = [];
    variantsState.variantsLoading = true;
    variantsState.isMovesLoading = false;
    instancesState.instances = {};
    instancesState.instancesLoading = true;
    authState.isLoggedIn = false;
    serviceMocks.manifest.mockResolvedValue({
      chunks: { maxData: { endpoint: '/max-data' } },
    });
    serviceMocks.maxData.mockResolvedValue([{ pokemon_id: 1 }]);
    serviceMocks.pokemon.mockResolvedValue([{ pokemon_id: 1, moves: [], fusion: [] }, { pokemon_id: 888, moves: [], fusion: [] }]);
    serviceMocks.moves.mockResolvedValue([]);
    createVariants.mockReturnValue([maxVariant]);
  });

  it('loads the compact Max catalog without requesting the full catalog', async () => {
    const { result } = renderHook(() => useMaxBattleData());

    await waitFor(() => expect(result.current.variantsLoading).toBe(false));

    expect(result.current.variants).toEqual([maxVariant]);
    expect(serviceMocks.maxData).toHaveBeenCalledOnce();
    expect(serviceMocks.pokemon).not.toHaveBeenCalled();
    expect(serviceMocks.moves).not.toHaveBeenCalled();
  });

  it('includes original species for owned crowned forms on a direct Max visit', async () => {
    authState.isLoggedIn = true;
    loadInstances.mockResolvedValue({
      caught: { variant_id: '0001-dynamax', is_caught: true },
    });

    const { result } = renderHook(() => useMaxBattleData());

    await waitFor(() => expect(result.current.instancesLoading).toBe(false));

    expect(loadInstances).toHaveBeenCalledWith([maxVariant], true);
    expect(serviceMocks.pokemon).toHaveBeenCalledOnce();
    expect(serviceMocks.moves).toHaveBeenCalledOnce();
    expect(createVariants).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ pokemon_id: 888 }),
    ]));
    expect(result.current.instances).toHaveProperty('caught');
  });

  it('does not reuse a guest-only catalog when the trainer signs in', async () => {
    const { result, rerender } = renderHook(() => useMaxBattleData());
    await waitFor(() => expect(result.current.variantsLoading).toBe(false));
    expect(serviceMocks.pokemon).not.toHaveBeenCalled();
    authState.isLoggedIn = true;
    loadInstances.mockResolvedValue({});
    rerender();
    await waitFor(() => expect(serviceMocks.pokemon).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.variantsLoading).toBe(false));
  });

  it('reuses an already-hydrated shared catalog instead of fetching again', () => {
    variantsState.variants = [maxVariant];
    variantsState.variantsLoading = false;
    instancesState.instances = {
      shared: { variant_id: '0001-dynamax' } as Instances[string],
    };
    instancesState.instancesLoading = false;

    const { result } = renderHook(() => useMaxBattleData());

    expect(result.current.variants).toEqual([maxVariant]);
    expect(result.current.instances).toHaveProperty('shared');
    expect(serviceMocks.manifest).not.toHaveBeenCalled();
  });
});
