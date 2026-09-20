import React from 'react';

import PokemonArtwork from '@/components/pokemonComponents/PokemonArtwork';
import type { UseVariantSearchControllerResult } from './useVariantSearchController';

type SelectedPokemonPreviewProps = {
  className?: string;
  controller: Pick<
    UseVariantSearchControllerResult,
    | 'handleImageError'
    | 'imageError'
    | 'imageUrl'
    | 'selectedBackground'
  >;
  dynamax: boolean;
  gigantamax: boolean;
  pokemon: string;
};

const SelectedPokemonPreview: React.FC<SelectedPokemonPreviewProps> = ({
  className,
  controller,
  dynamax,
  gigantamax,
  pokemon,
}) => {
  if (!controller.imageUrl || controller.imageError) return null;

  return (
    <div
      className={[
        'selected-pokemon-preview',
        controller.selectedBackground && 'has-background',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        controller.selectedBackground
          ? {
              backgroundImage: `url(${controller.selectedBackground.image_url})`,
            }
          : undefined
      }
    >
      <PokemonArtwork
        alt={`${pokemon || 'Selected Pokémon'} preview`}
        className="selected-pokemon-preview__artwork"
        dynamax={dynamax}
        gigantamax={gigantamax}
        imageClassName="selected-pokemon-preview__pokemon"
        imageUrl={controller.imageUrl}
        onError={controller.handleImageError}
      />
    </div>
  );
};

export default SelectedPokemonPreview;
