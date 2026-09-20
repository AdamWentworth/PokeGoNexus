// src/pages/Pokemon/hooks/useInstanceIdProcessor.ts
//--------------------------------------------------
// Handles deep‑links like “…?instanceId=xxx” by opening
// the overlay for that instance once all data is ready.
//--------------------------------------------------

import { useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router';

import { useUserSearchStore } from '@/stores/useUserSearchStore';
import { getEntityKeyFrom } from '@/utils/PokemonIDUtils';

import type { PokemonVariant  } from '@/types/pokemonVariants';
import type { Instances } from '@/types/instances';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LocationState {
  instanceId?: string | null;
  [key: string]: unknown;
}
interface AppLocation {
  state?: LocationState;
  pathname: string;
  search?: string;
}

export type PokemonOverlaySelection =
  | PokemonVariant
  | { pokemon: PokemonVariant; overlayType: 'instance' }
  | null;

export interface UseInstanceIdProcessorProps {
  /** Are the base variants still loading? */
  variantsLoading: boolean;

  /** List already filtered/search‑sorted by the parent */
  filteredVariants: PokemonVariant[];

  /** Canonical instance map for the catalog currently being viewed. */
  instances: Instances;

  /* router bits */
  location: AppLocation;
  navigate: NavigateFunction;

  /* UI state setters */
  selectedPokemon: PokemonOverlaySelection;
  setSelectedPokemon: (p: PokemonOverlaySelection) => void;
  hasProcessedInstanceId: boolean;
  setHasProcessedInstanceId: (b: boolean) => void;

  /* misc */
  isOwnCollection: boolean;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */
export default function useInstanceIdProcessor({
  variantsLoading,
  filteredVariants,
  instances,
  location,
  navigate,
  selectedPokemon,
  setSelectedPokemon,
  hasProcessedInstanceId,
  setHasProcessedInstanceId,
  isOwnCollection,
}: UseInstanceIdProcessorProps): void {
  const [retryCounter, setRetryCounter] = useState(0);
  const [pendingSelection, setPendingSelection] = useState<PokemonVariant | null>(null);

  // 🔎  Pull loader state straight from the stores (no prop‑drilling)
  const { foreignInstancesLoading, viewedInstances } = useUserSearchStore.getState();
  const searchInstances = viewedInstances;

  const queryInstanceId = new URLSearchParams(location.search ?? '').get('instanceId');
  const requestedInstanceId = location.state?.instanceId ?? queryInstanceId;

  useEffect(() => {
    if (!pendingSelection || requestedInstanceId || selectedPokemon) return;
    setSelectedPokemon({ pokemon: pendingSelection, overlayType: 'instance' });
    setPendingSelection(null);
  }, [pendingSelection, requestedInstanceId, selectedPokemon, setSelectedPokemon]);

  useEffect(() => {
    if (variantsLoading || (!isOwnCollection && foreignInstancesLoading)) return;
    if (filteredVariants.length === 0 || hasProcessedInstanceId) return;

    const instanceId = requestedInstanceId;
    if (!instanceId || selectedPokemon) return;
    const availableInstances = isOwnCollection ? instances : searchInstances;
    if (!availableInstances) return;

    /* -------------------------------------------------------------- */
    /* 1) Try to find it in the already‑filtered list                 */
    /* -------------------------------------------------------------- */
    let combined: PokemonVariant | null =
      filteredVariants.find(
        (p) => getEntityKeyFrom(p) === instanceId || p.variant_id === instanceId,
      ) ?? null;

    /* -------------------------------------------------------------- */
    /* 2) Fallback: enrich base variant with raw instance data        */
    /* -------------------------------------------------------------- */
    if (!combined) {
      const raw = availableInstances[instanceId];
      if (raw) {
        const variant = filteredVariants.find(
          (p) => p.pokemon_id === raw.pokemon_id,
        );
        if (variant) {
          combined = {
            ...variant,
            variant_id: variant.variant_id,
            instanceData: raw,
          };
        }
      }
    }

    /* -------------------------------------------------------------- */
    /* 3) Open overlay if we found something                          */
    /* -------------------------------------------------------------- */
    if (combined) {
      setHasProcessedInstanceId(true);
      setPendingSelection(combined);

      // Commit the one-shot deep-link cleanup before mounting the overlay.
      // Otherwise the replace can erase the overlay's browser-Back guard and
      // leave a duplicate catalog entry behind in history.
      const cleanQuery = new URLSearchParams(location.search ?? '');
      cleanQuery.delete('instanceId');
      const cleanSearch = cleanQuery.toString();
      void navigate(`${location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`, {
        replace: true,
        state: { ...location.state, instanceId: null },
      });
    } else {
      // Still missing — try again shortly (rare race condition)
      setTimeout(() => setRetryCounter(c => c + 1), 500);
    }
  }, [
    variantsLoading,
    foreignInstancesLoading,
    instances,
    searchInstances,
    filteredVariants,
    location,
    requestedInstanceId,
    selectedPokemon,
    isOwnCollection,
    hasProcessedInstanceId,
    navigate,
    setSelectedPokemon,
    setHasProcessedInstanceId,
    retryCounter,
  ]);
}
