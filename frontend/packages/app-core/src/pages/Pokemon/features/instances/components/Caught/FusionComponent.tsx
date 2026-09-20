import React from 'react';
import '@/components/modals/ModalStyles.css';
import './FusionComponent.css';
import { resolveAssetUrl } from '@/utils/assetUrl';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import {
  collectInstanceRefCandidates,
  findInstanceByRefs,
} from '@pokemongonexus/shared-domain/instances';

import type { Fusion } from '@/types/pokemonSubTypes';
import type { PokemonVariant } from '@/types/pokemonVariants';

interface FusionState {
  is_fused: boolean;
  fusion_form: number | string | null;
  fusedWith?: string | null;
}

interface FusionComponentProps {
  fusion: Fusion[] | null;
  editMode: boolean;
  pokemon: PokemonVariant;
  onFusionToggle: (fusionId: number) => void;
  onUndoFusion: () => void;
  fusionState: FusionState;
}

const buildFusionIconUrl = (fusionId: number) =>
  resolveAssetUrl(`/media/images/fusion_${fusionId}.png`);

const buildPokemonIconUrl = (pokemonId: number, isShiny: boolean) =>
  resolveAssetUrl(
    isShiny
      ? `/media/images/shiny/shiny_pokemon_${pokemonId}.png`
      : `/media/images/default/pokemon_${pokemonId}.png`,
  );

const buildFusionFormImageUrl = (
  fusionItem: Fusion & { fusion_id: number },
  isShiny: boolean,
) => {
  const explicitUrl = isShiny
    ? fusionItem.image_url_shiny ?? fusionItem.image_url
    : fusionItem.image_url;

  if (explicitUrl && explicitUrl.trim().length > 0) {
    return resolveAssetUrl(explicitUrl);
  }

  return buildFusionIconUrl(fusionItem.fusion_id);
};

const FusionComponent: React.FC<FusionComponentProps> = ({
  fusion,
  editMode,
  pokemon,
  onFusionToggle,
  onUndoFusion,
  fusionState,
}) => {
  const fusionOptions = (fusion ?? []).filter(
    (item): item is Fusion & { fusion_id: number } =>
      item.base_pokemon_id1 === pokemon.pokemon_id &&
      typeof item.fusion_id === 'number',
  );

  const hasOptions = fusionOptions.length > 0;
  const fusedWithKey = typeof fusionState.fusedWith === 'string' ? fusionState.fusedWith : null;

  const partnerInstance = useInstancesStore((state) => {
    if (!fusedWithKey) return null;
    const candidateIds = collectInstanceRefCandidates(fusedWithKey);
    const fromOwned = findInstanceByRefs(state.instances, candidateIds);
    if (fromOwned) return fromOwned;
    return findInstanceByRefs(state.foreignInstances, candidateIds);
  });

  if (!fusionState.is_fused && !hasOptions) {
    return null;
  }

  const currentFusion =
    fusionOptions.find((item) => {
      if (fusionState.fusion_form == null) return false;
      return (
        String(item.fusion_id) === String(fusionState.fusion_form) ||
        item.name === fusionState.fusion_form
      );
    }) ?? null;

  const isShiny = Boolean(pokemon.instanceData?.shiny);
  const leftPokemonId = currentFusion?.base_pokemon_id1 ?? pokemon.pokemon_id;
  const rightPokemonId = currentFusion?.base_pokemon_id2 ?? null;

  const rightIsShiny = partnerInstance ? Boolean(partnerInstance.shiny) : isShiny;

  return (
    <div className="fusion-component">
      {fusionState.is_fused ? (
        <div className="fusion-state-layout">
          <div className="fusion-state-row">
            <button
              type="button"
              className="fusion-action-button btn btn-success"
              disabled={!editMode}
              onClick={onUndoFusion}
            >
              {leftPokemonId != null ? (
                <img
                  src={buildPokemonIconUrl(leftPokemonId, isShiny)}
                  alt={pokemon.name ?? `Pokemon ${leftPokemonId}`}
                  className="fusion-partner-icon fusion-partner-icon--left"
                />
              ) : null}

              Separate

              {rightPokemonId != null ? (
                <img
                  src={buildPokemonIconUrl(rightPokemonId, rightIsShiny)}
                  alt={`Pokemon ${rightPokemonId}`}
                  className="fusion-partner-icon fusion-partner-icon--right"
                />
              ) : null}
            </button>
          </div>
        </div>
      ) : (
        <div className={`fusion-option-list ${fusionOptions.length === 1 ? 'single' : 'multiple'}`}>
          {fusionOptions.map((fusionItem) => (
            <button
              key={fusionItem.fusion_id}
              type="button"
              className="fusion-option-button btn btn-success"
              disabled={!editMode}
              onClick={() => onFusionToggle(fusionItem.fusion_id)}
              title={editMode ? undefined : 'Enable edit mode to fuse this Pokemon.'}
            >
              <img
                src={buildFusionIconUrl(fusionItem.fusion_id)}
                alt={`${fusionItem.name || `Fusion ${fusionItem.fusion_id}`} icon`}
                className="fusion-option-icon fusion-option-icon--glyph"
              />
              <span className="fusion-option-text">
                {fusionItem.name ? `Fuse ${fusionItem.name}` : 'Fuse'}
              </span>
              <img
                src={buildFusionFormImageUrl(fusionItem, isShiny)}
                alt={fusionItem.name || `Fusion ${fusionItem.fusion_id}`}
                className="fusion-option-icon fusion-option-icon--preview"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FusionComponent;
