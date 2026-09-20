// useMegaPokemonSelection.ts

import { useState, useCallback } from 'react';
import { megaEvolveExisting, createNewMega } from '../services/megaPokemonService';
import { createScopedLogger } from '@/utils/logger';

const log = createScopedLogger('useMegaPokemonSelection');

export function useMegaPokemonSelection(
  variantKey: string | undefined,
  megaForm: string | undefined,
  onAssignExisting: (id: string) => void,
  onCreateNew: (id: string) => void,
) {
  const [error, setError] = useState<string | null>(null);

  const assignExisting = useCallback(
    async (instanceId: string) => {
      try {
        await megaEvolveExisting(instanceId, megaForm);
        onAssignExisting(instanceId);
      } catch (e) {
        log.error('Failed to assign existing mega candidate:', e);
        setError(`Failed to mega-evolve ${instanceId}.`);
      }
    },
    [megaForm, onAssignExisting],
  );

  const createNew = useCallback(async () => {
    try {
      if (!variantKey) throw new Error('No variantKey');
      const instanceId = await createNewMega(variantKey, megaForm);
      onCreateNew(instanceId);
    } catch (e) {
      log.error('Failed to create new mega candidate:', e);
      setError('Failed to create a new Mega Pokemon.');
    }
  }, [variantKey, megaForm, onCreateNew]);

  return { error, assignExisting, createNew };
}
