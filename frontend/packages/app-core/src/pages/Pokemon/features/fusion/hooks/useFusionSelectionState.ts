// useFusionSelectionState.ts
import { useState } from 'react';
import { resolveFusionDetails } from '../services/resolveFusionDetails';
import type { FusionSelectionData, FusionSelectionResult } from '@/types/fusion';
import { createScopedLogger } from '@/utils/logger';

const log = createScopedLogger('useFusionSelectionState');

export function useFusionSelectionState() {
  const [isFusionSelectionOpen, setIsFusionSelectionOpen] = useState(false);
  const [fusionSelectionData, setFusionSelectionData] = useState<FusionSelectionData | null>(null);

  async function promptFusionPokemonSelection(baseKey: string): Promise<FusionSelectionResult> {
    return new Promise((resolve, reject) => {
      void resolveFusionDetails(baseKey)
        .then((fusionDetails) => {
          setFusionSelectionData({
            baseKey,
            resolve,
            reject,
            ...fusionDetails,
          });
          setIsFusionSelectionOpen(true);
        })
        .catch((err) => {
          log.error('Error in promptFusionPokemonSelection:', err);
          reject(err);
        });
    });
  }

  function rejectSelection(error: unknown) {
    fusionSelectionData?.reject?.(error);
    setFusionSelectionData(null);
    setIsFusionSelectionOpen(false);
  }

  function closeSelection() {
    rejectSelection('User canceled');
  }

  return {
    isFusionSelectionOpen,
    fusionSelectionData,
    setFusionSelectionData,
    promptFusionPokemonSelection,
    rejectSelection,
    closeSelection,
  };
}
