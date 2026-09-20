import React from 'react';
import BackgroundLocationCard from '@/components/pokemonComponents/BackgroundLocationCard';
import '@/components/pokemonComponents/BackgroundLocationOverlay.css';
import CloseButton from '@/components/CloseButton';
import OverlayPortal from '@/components/OverlayPortal';
import type { VariantBackground } from '@/types/pokemonSubTypes';

type BackgroundOption = VariantBackground;

type BackgroundPokemon = {
  variantType?: string;
  backgrounds: BackgroundOption[];
};

interface TradeBackgroundModalProps {
  showBackgrounds: boolean;
  pokemon: BackgroundPokemon;
  onClose: () => void;
  onSelectBackground: (background: BackgroundOption | null) => void;
}

const TradeBackgroundModal: React.FC<TradeBackgroundModalProps> = ({
  showBackgrounds,
  pokemon,
  onClose,
  onSelectBackground,
}) => {
  if (!showBackgrounds) {
    return null;
  }

  return (
    <OverlayPortal onClose={onClose} closeOnBackdrop>
      <div className="background-overlay" onClick={onClose}>
        <div className="background-overlay-content" onClick={(e) => e.stopPropagation()}>
          <BackgroundLocationCard
            pokemon={pokemon}
            onSelectBackground={onSelectBackground}
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

export default TradeBackgroundModal;
