// useMegaPokemonHandler.ts
import { useState } from 'react';
import { getAllInstances, getVariantById } from '@/db/indexedDB';
import { parseVariantId } from '@/utils/PokemonIDUtils';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { createScopedLogger } from '@/utils/logger';

export interface MegaSelectionData {
  caughtPokemon: (PokemonInstance & { variantData: PokemonVariant | null })[];
  variantKey: string; // kept prop name for now
  megaForm?: string;
  resolve: (value: MegaSelectionResult) => void;
  reject: (reason?: unknown) => void;
}

export interface MegaSelectionResult {
  action: 'assignExisting' | 'createNew';
  instanceId: string;
}

const log = createScopedLogger('useMegaPokemonHandler');

function useMegaPokemonHandler() {
  const [isMegaSelectionOpen, setIsMegaSelectionOpen] = useState<boolean>(false);
  const [megaSelectionData, setMegaSelectionData] = useState<MegaSelectionData | null>(null);

  const parseBaseKey = (baseKey: string): string | null => {
    const match = baseKey.match(/^\d+/);
    return match ? match[0] : null;
  };

  const parseShinyStatus = (baseKey: string): boolean => {
    return baseKey.includes('shiny');
  };

  const getCaughtPokemon = async (baseNumber: string, isShiny: boolean): Promise<PokemonInstance[]> => {
    const rawData = await getAllInstances();
    if (!rawData || !Array.isArray(rawData)) {
      throw new Error("Invalid data retrieved from IndexedDB");
    }

    const allData = rawData as PokemonInstance[];

    const filteredPokemon = allData.filter((entry) => {
      if (!entry.instance_id || typeof entry.instance_id !== 'string') {
        log.warn('Skipping entry with invalid instance_id:', entry);
        return false;
      }
      const parsed = parseVariantId(entry.instance_id);
      if (!parsed) {
        log.warn('Failed to parse instance_id:', entry.instance_id);
        return false;
      }
      const { baseKey } = parsed;
      if (!baseKey) return false;

      const entryBaseKey = entry.instance_id.split('-')[0];
      return (
        entryBaseKey === baseNumber &&
        entry.is_caught &&
        entry.shiny === isShiny &&
        !entry.is_mega &&
        !baseKey.includes('clone') &&
        !baseKey.includes('shadow') &&
        !baseKey.includes('mega')
      );
    });

    return filteredPokemon;
  };

  const handleMegaPokemon = async (baseKey: string) => {
    try {
      const baseNumber = parseBaseKey(baseKey);
      if (!baseNumber) {
        throw new Error(`Invalid baseKey format: ${baseKey}`);
      }

      const isShiny = parseShinyStatus(baseKey);
      const caughtPokemon = await getCaughtPokemon(baseNumber, isShiny);
      log.debug('Caught Pokemon matching requirements.', { count: caughtPokemon.length });

      const caughtPokemonWithVariants = await Promise.all(
        caughtPokemon.map(async (pokemon) => {
          const { instance_id } = pokemon;
          if (!instance_id) {
            log.warn('Missing instance_id for pokemon:', pokemon);
            return { ...pokemon, variantData: null };
          }
          const parsed = parseVariantId(instance_id);
          if (!parsed) {
            log.warn(`Invalid instance_id format: ${instance_id}`);
            return { ...pokemon, variantData: null };
          }
          const { baseKey: variantKey } = parsed;
          if (!variantKey) {
            log.warn(`No valid baseKey parsed for instance_id: ${instance_id}`);
            return { ...pokemon, variantData: null };
          }
          try {
            const variantData = await getVariantById(variantKey);
            if (!variantData) {
              throw new Error(`Variant data not found for baseKey: ${variantKey}`);
            }
            return { ...pokemon, variantData };
          } catch (error) {
            log.error(`Error fetching variant data for ${variantKey}:`, error);
            return { ...pokemon, variantData: null };
          }
        })
      );

      return caughtPokemonWithVariants;
    } catch (error) {
      log.error('Error handling Mega Pokemon:', error);
      throw error;
    }
  };

  const promptMegaPokemonSelection = (baseKey: string, megaForm?: string): Promise<MegaSelectionResult> => {
    return new Promise((resolve, reject) => {
      void handleMegaPokemon(baseKey)
        .then((caughtPokemonWithVariants) => {
          const baseNumber = parseBaseKey(baseKey);
          if (!baseNumber) {
            throw new Error(`Invalid baseKey format: ${baseKey}`);
          }
          const isShiny = parseShinyStatus(baseKey);
          const variantKey = isShiny ? `${baseNumber}-shiny` : `${baseNumber}-default`;

          setMegaSelectionData({
            caughtPokemon: caughtPokemonWithVariants,
            variantKey,
            megaForm,
            resolve,
            reject,
          });

          setIsMegaSelectionOpen(true);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  const handleMegaSelectionResolve = (result: MegaSelectionResult) => {
    if (megaSelectionData && megaSelectionData.resolve) {
      megaSelectionData.resolve(result);
    }
    setIsMegaSelectionOpen(false);
    setMegaSelectionData(null);
  };

  const handleMegaSelectionReject = (error: unknown) => {
    if (megaSelectionData && megaSelectionData.reject) {
      megaSelectionData.reject(error);
    }
    setIsMegaSelectionOpen(false);
    setMegaSelectionData(null);
  };

  return {
    promptMegaPokemonSelection,
    isMegaSelectionOpen,
    megaSelectionData,
    handleMegaSelectionResolve,
    handleMegaSelectionReject,
  };
}

export default useMegaPokemonHandler;
