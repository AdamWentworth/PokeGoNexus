import React from 'react';

import BackgroundLocationCard from '@/components/pokemonComponents/BackgroundLocationCard';
import '@/components/pokemonComponents/BackgroundLocationOverlay.css';
import CloseButton from '@/components/CloseButton';
import OverlayPortal from '@/components/OverlayPortal';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { resolveBackgroundCostume } from '@/utils/backgroundCostume';
import type { SortableCostume } from './variantSearchHelpers';

export type BackgroundSelection = {
  background_id: number;
  image_url: string;
  name: string;
  location: string;
  date: string;
  costume_id?: number | null;
};

interface VariantSearchBackgroundOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentPokemonData: PokemonVariant | undefined;
  onSelectBackground: (background: BackgroundSelection | null) => void;
  availableCostumes: SortableCostume[];
}

const VariantSearchBackgroundOverlay: React.FC<VariantSearchBackgroundOverlayProps> = ({
  isOpen,
  onClose,
  currentPokemonData,
  onSelectBackground,
  availableCostumes,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <OverlayPortal onClose={onClose} closeOnBackdrop>
      <div className="background-overlay" onClick={onClose}>
        <div
          className="background-overlay-content"
          onClick={(event) => event.stopPropagation()}
        >
          <BackgroundLocationCard
            costumeOptions={availableCostumes}
            filterBackground={(background) =>
              resolveBackgroundCostume(background, availableCostumes) !== null
            }
            onSelectBackground={onSelectBackground}
            pokemon={currentPokemonData ?? {}}
            showCostumePairing
            title="Select exact background"
          />
        </div>
        <CloseButton
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        />
      </div>
    </OverlayPortal>
  );
};

export default VariantSearchBackgroundOverlay;
