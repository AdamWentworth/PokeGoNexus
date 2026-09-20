// src/features/variants/store/useVariantsStore.ts
import { create } from 'zustand';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { variantsRepository } from '../repositories/variantsRepository';
import { createScopedLogger } from '@/utils/logger';
import {
  getPokemonCatalogManifest,
  getPokemonMovesChunk,
  getPokemonRaidDataChunk,
} from '@/services/pokemonDataService';
import { queueVariantsPersist } from '@/db/variantsDB';
import { getStorageString, setStorageString, STORAGE_KEYS } from '@/utils/storage';
import {
  mergePokemonMovesChunk,
  mergePokemonRaidDataChunk,
} from '../utils/mergePokemonDataChunks';
import {
  hasHydratedMoves,
  hasHydratedRaidData,
  prepareVariantChunkHydration,
} from '../utils/prepareVariantChunkHydration';

interface VariantsState {
  variants: PokemonVariant[];
  variantsLoading: boolean;
  isRefreshing: boolean;
  isMovesLoading: boolean;
  isRaidDataLoading: boolean;
  raidDataRequested: boolean;
  hydrateFromCache(): Promise<void>;
  refreshVariants(): Promise<void>;
  ensureMoves(): Promise<void>;
  ensureRaidData(): Promise<void>;
}

const log = createScopedLogger('VariantsStore');
let movesHydrationRequest: Promise<void> | null = null;
let raidDataHydrationRequest: Promise<void> | null = null;

export const useVariantsStore = create<VariantsState>((set, get) => ({
  variants: [],
  variantsLoading: true,
  isRefreshing: false,
  isMovesLoading: false,
  isRaidDataLoading: false,
  raidDataRequested: false,

  async hydrateFromCache() {
    try {
      const { variants } = await variantsRepository.loadCache();
      if (variants.length) {
        set({ variants, variantsLoading: false });
        // Move pools power detail and instance controls, but they should not
        // delay catalog cards from becoming usable.
        void get().ensureMoves();
      }

      // Always let the manifest-aware refresh path verify the cached catalog version.
      // If the server version matches, this only costs the small manifest request.
      if (variants.length) {
        void get().refreshVariants();
      } else {
        await get().refreshVariants();
      }
    } catch (error) {
      log.error('hydrateFromCache failed', error);
      void get().refreshVariants();
    }
  },

  async refreshVariants() {
    if (get().isRefreshing) return;
    set({ isRefreshing: true });

    try {
      // The repository refresh path checks the lightweight catalog manifest first.
      // Matching versions return IndexedDB data; changed versions fetch the data chunk.
      const { variants } = await variantsRepository.fetchFresh();
      set({ variants, variantsLoading: false });
      if (variants.length) {
        void get().ensureMoves();
        if (get().raidDataRequested) {
          void get().ensureRaidData();
        }
      }
    } catch (error) {
      log.error('refreshVariants failed', error);

      // Fallback to whatever cache we have
      try {
        const { variants } = await variantsRepository.loadCache();
        if (variants.length) {
          set({ variants, variantsLoading: false });
        } else {
          set({ variantsLoading: false });
        }
      } catch (fallbackErr) {
        log.error('cache fallback failed', fallbackErr);
        set({ variantsLoading: false });
      }
    } finally {
      set({ isRefreshing: false });
    }
  },

  ensureMoves() {
    if (get().variants.length === 0) return Promise.resolve();
    if (movesHydrationRequest) return movesHydrationRequest;

    set({ isMovesLoading: true });
    const request = (async () => {
      try {
        const manifest = await getPokemonCatalogManifest();
        const update = await prepareVariantChunkHydration({
          manifest,
          chunkName: 'moves',
          storedVersion: getStorageString(STORAGE_KEYS.pokemonMovesVersion),
          getVariants: () => get().variants,
          hasHydratedData: hasHydratedMoves,
          fetchChunk: getPokemonMovesChunk,
        });
        if (!update) return;

        // Merge against the latest snapshot so catalog refreshes and other
        // lazy chunks cannot overwrite data while this request is in flight.
        const variants = mergePokemonMovesChunk(get().variants, update.chunk);
        set({ variants });
        queueVariantsPersist(variants, Date.now(), undefined, update.catalogVersion);
        setStorageString(STORAGE_KEYS.pokemonMovesVersion, update.chunkVersion);
      } catch (error) {
        log.warn('ensureMoves failed; retaining the current catalog cache', error);
      } finally {
        set({ isMovesLoading: false });
      }
    })();

    const trackedRequest = request.finally(() => {
      if (movesHydrationRequest === trackedRequest) {
        movesHydrationRequest = null;
      }
    });
    movesHydrationRequest = trackedRequest;
    return trackedRequest;
  },

  ensureRaidData() {
    set({ raidDataRequested: true });
    if (get().variants.length === 0) return Promise.resolve();
    if (raidDataHydrationRequest) return raidDataHydrationRequest;

    set({ isRaidDataLoading: true });
    const request = (async () => {
      try {
        const manifest = await getPokemonCatalogManifest();
        const update = await prepareVariantChunkHydration({
          manifest,
          chunkName: 'raidData',
          storedVersion: getStorageString(STORAGE_KEYS.pokemonRaidDataVersion),
          getVariants: () => get().variants,
          hasHydratedData: hasHydratedRaidData,
          fetchChunk: getPokemonRaidDataChunk,
        });
        if (!update) return;

        const variants = mergePokemonRaidDataChunk(get().variants, update.chunk);
        set({ variants });
        queueVariantsPersist(variants, Date.now(), undefined, update.catalogVersion);
        setStorageString(STORAGE_KEYS.pokemonRaidDataVersion, update.chunkVersion);
      } catch (error) {
        log.warn('ensureRaidData failed; retaining the current catalog cache', error);
      } finally {
        set({ isRaidDataLoading: false });
      }
    })();

    const trackedRequest = request.finally(() => {
      if (raidDataHydrationRequest === trackedRequest) {
        raidDataHydrationRequest = null;
      }
    });
    raidDataHydrationRequest = trackedRequest;
    return trackedRequest;
  },
}));
