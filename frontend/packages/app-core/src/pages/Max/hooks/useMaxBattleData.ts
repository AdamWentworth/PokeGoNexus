import { useEffect, useMemo, useState } from 'react';

import { loadInstances } from '@/features/instances/services/loadInstances';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import createPokemonVariants from '@/features/variants/utils/createPokemonVariants';
import { mergePokemonMovesChunk } from '@/features/variants/utils/mergePokemonDataChunks';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import {
  getPokemonCatalogManifest,
  getPokemonMaxDataChunk,
  getPokemonMovesChunk,
  getPokemons,
} from '@/services/pokemonDataService';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Instances } from '@/types/instances';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { createScopedLogger } from '@/utils/logger';
import { mergePokemonMaxData, mergePokemonMoveData } from '@pokemongonexus/shared-domain/pokemon-data';

const log = createScopedLogger('useMaxBattleData');

const maxVariantsRequests = new Map<boolean, Promise<PokemonVariant[]>>();

async function fetchMaxBattleVariants(includeOwnedBases: boolean): Promise<PokemonVariant[]> {
  const manifest = await getPokemonCatalogManifest();
  // Owned crowned entries reference their original species. The compact Max
  // chunk omits those bases, so it cannot resolve the trainer's full roster.
  if (includeOwnedBases) {
    const [pokemon, maxPokemon, moves] = await Promise.all([
      getPokemons({ manifest }),
      getPokemonMaxDataChunk(manifest),
      getPokemonMovesChunk(manifest),
    ]);
    return createPokemonVariants(mergePokemonMaxData(
      mergePokemonMoveData(pokemon, moves ?? []),
      maxPokemon ?? [],
    ));
  }
  const maxPokemon = await getPokemonMaxDataChunk(manifest);

  if (maxPokemon) {
    return createPokemonVariants(maxPokemon);
  }

  // Backward-compatible rollout path while an older Pokemon API is still
  // serving the manifest. This path disappears naturally once maxData exists.
  const pokemon = await getPokemons({ manifest });
  let variants = createPokemonVariants(pokemon);
  const moves = await getPokemonMovesChunk(manifest);
  if (moves) {
    variants = mergePokemonMovesChunk(variants, moves);
  }
  return variants;
}

function loadMaxBattleVariants(includeOwnedBases: boolean): Promise<PokemonVariant[]> {
  let request = maxVariantsRequests.get(includeOwnedBases);
  if (!request) {
    request = fetchMaxBattleVariants(includeOwnedBases).catch((error) => {
      maxVariantsRequests.delete(includeOwnedBases);
      throw error;
    });
    maxVariantsRequests.set(includeOwnedBases, request);
  }
  return request;
}

export function resetMaxBattleDataRequestForTests(): void {
  maxVariantsRequests.clear();
}

export function useMaxBattleData() {
  const sharedVariants = useVariantsStore((state) => state.variants);
  const sharedVariantsLoading = useVariantsStore((state) => state.variantsLoading);
  const sharedMovesLoading = useVariantsStore((state) => state.isMovesLoading);
  const sharedInstances = useInstancesStore((state) => state.instances);
  const sharedInstancesLoading = useInstancesStore(
    (state) => state.instancesLoading,
  );
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  const [localVariants, setLocalVariants] = useState<PokemonVariant[]>([]);
  const [localVariantsLoading, setLocalVariantsLoading] = useState(true);
  const [localInstances, setLocalInstances] = useState<Instances>({});
  const [localInstancesLoading, setLocalInstancesLoading] = useState(true);

  const usesSharedCatalog = sharedVariants.length > 0;
  const variants = usesSharedCatalog ? sharedVariants : localVariants;

  useEffect(() => {
    if (usesSharedCatalog) {
      setLocalVariantsLoading(false);
      return;
    }

    let active = true;
    setLocalVariantsLoading(true);
    void loadMaxBattleVariants(isLoggedIn)
      .then((loaded) => {
        if (!active) return;
        setLocalVariants(loaded);
        setLocalVariantsLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        log.error('Failed to load the Max Battle catalog', error);
        setLocalVariantsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isLoggedIn, usesSharedCatalog]);

  useEffect(() => {
    if (usesSharedCatalog) {
      setLocalInstancesLoading(false);
      return;
    }
    if (!isLoggedIn) {
      setLocalInstances({});
      setLocalInstancesLoading(false);
      return;
    }
    if (localVariantsLoading) return;
    if (localVariants.length === 0) {
      setLocalInstancesLoading(false);
      return;
    }

    let active = true;
    void loadInstances(localVariants, true)
      .then((loaded) => {
        if (!active) return;
        setLocalInstances(loaded);
        setLocalInstancesLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        log.error('Failed to load owned Pokemon for Max Battles', error);
        setLocalInstancesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isLoggedIn, localVariants, localVariantsLoading, usesSharedCatalog]);

  return useMemo(
    () => ({
      variants,
      variantsLoading: usesSharedCatalog
        ? sharedVariantsLoading
        : localVariantsLoading,
      movesLoading: usesSharedCatalog ? sharedMovesLoading : false,
      instances: usesSharedCatalog ? sharedInstances : localInstances,
      instancesLoading: usesSharedCatalog
        ? sharedInstancesLoading
        : localInstancesLoading,
    }),
    [
      localInstances,
      localInstancesLoading,
      localVariantsLoading,
      sharedInstances,
      sharedInstancesLoading,
      sharedMovesLoading,
      sharedVariantsLoading,
      usesSharedCatalog,
      variants,
    ],
  );
}
