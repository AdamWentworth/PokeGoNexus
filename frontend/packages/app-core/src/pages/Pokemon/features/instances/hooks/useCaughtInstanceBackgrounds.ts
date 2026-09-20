import { useMemo } from 'react';

import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { VariantBackground } from '@/types/pokemonSubTypes';
import type { PokemonVariant } from '@/types/pokemonVariants';

import type { FusionState as PersistFusionState } from '../utils/buildInstanceChanges';
import {
  collectInstanceRefCandidates,
  findInstanceByRefs,
  parseBackgroundId,
} from '../utils/caughtInstanceRefs';
import {
  resolvePokemonDisplayFusionBackgroundPool,
  resolvePokemonDisplayFusionComboBackground,
} from '@/features/pokemonDisplay/fusionBackgrounds';
import { useBackgrounds } from './useBackgrounds';

type CaughtBackgroundPokemon = Pick<
  PokemonVariant,
  'backgrounds' | 'fusion' | 'fusion_id' | 'pokemon_id' | 'variantType'
>;

type CaughtBackgroundFusionState = Pick<
  PersistFusionState,
  'fusedWith' | 'fusion_form' | 'is_fused' | 'storedFusionObject'
>;

type UseCaughtInstanceBackgroundsArgs = {
  pokemon: CaughtBackgroundPokemon;
  variantType?: string;
  locationCard?: PokemonInstance['location_card'] | null;
  fusion: CaughtBackgroundFusionState;
};

export const useCaughtInstanceBackgrounds = ({
  pokemon,
  variantType,
  locationCard,
  fusion,
}: UseCaughtInstanceBackgroundsArgs) => {
  const resolvedFusionBackgrounds = useMemo(
    () =>
      resolvePokemonDisplayFusionBackgroundPool({
        pokemon,
        fusion: {
          is_fused: fusion.is_fused,
          fusion_form: fusion.fusion_form,
          storedFusionObject: fusion.storedFusionObject,
        },
      }),
    [fusion.fusion_form, fusion.is_fused, fusion.storedFusionObject, pokemon],
  );

  const backgrounds: VariantBackground[] = resolvedFusionBackgrounds.backgrounds;

  const fusedPartnerInstance = useInstancesStore((state) => {
    const fusedWithKey = typeof fusion.fusedWith === 'string' ? fusion.fusedWith : null;
    if (!fusedWithKey) return null;

    const refs = collectInstanceRefCandidates(fusedWithKey);
    if (refs.length === 0) return null;

    const fromOwned = findInstanceByRefs(state.instances, refs);
    if (fromOwned) return fromOwned;
    return findInstanceByRefs(state.foreignInstances, refs);
  });

  const {
    showBackgrounds,
    setShowBackgrounds,
    selectedBackground,
    handleBackgroundSelect,
    selectableBackgrounds,
  } = useBackgrounds(backgrounds, variantType, locationCard ?? null);

  const effectiveSelectedBackground = useMemo(() => {
    const fallbackSelectedFromLocationCard = (() => {
      const locationCardId = parseBackgroundId(locationCard);
      if (locationCardId == null) return null;
      return (
        selectableBackgrounds.find(
          (background) => background.background_id === locationCardId,
        ) ?? null
      );
    })();

    const currentSelected = selectedBackground ?? fallbackSelectedFromLocationCard;

    if (!fusion.is_fused) return currentSelected;

    const ownBackgroundId = currentSelected?.background_id ?? null;
    const partnerBackgroundId = parseBackgroundId(fusedPartnerInstance?.location_card);

    const comboBackground = resolvePokemonDisplayFusionComboBackground({
      pokemonId: pokemon.pokemon_id,
      fusionEntries: pokemon.fusion ?? [],
      resolvedFusionId: resolvedFusionBackgrounds.fusionId,
      fusionForm: fusion.fusion_form,
      ownBackgroundId,
      partnerBackgroundId,
      availableBackgrounds: backgrounds,
    });

    return comboBackground ?? currentSelected;
  }, [
    backgrounds,
    fusedPartnerInstance?.location_card,
    fusion.fusion_form,
    fusion.is_fused,
    locationCard,
    pokemon.fusion,
    pokemon.pokemon_id,
    resolvedFusionBackgrounds.fusionId,
    selectedBackground,
    selectableBackgrounds,
  ]);

  return {
    resolvedFusionBackgrounds,
    backgrounds,
    fusedPartnerInstance,
    showBackgrounds,
    setShowBackgrounds,
    selectedBackground,
    handleBackgroundSelect,
    selectableBackgrounds,
    effectiveSelectedBackground,
  };
};
