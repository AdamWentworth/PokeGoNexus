import React from 'react';
import CloseButton from '@/components/CloseButton';
import OverlayPortal from '@/components/OverlayPortal';
import '@/components/pokemonComponents/BackgroundLocationOverlay.css';
import BackgroundLocationCard from '@/components/pokemonComponents/BackgroundLocationCard';
import FuseOverlay from '../components/Caught/FuseOverlay';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { VariantBackground } from '@/types/pokemonSubTypes';

interface ModalsProps {
  showBackgrounds: boolean;
  setShowBackgrounds: React.Dispatch<React.SetStateAction<boolean>>;
  pokemon: {
    variantType?: PokemonVariant['variantType'];
    backgrounds?: VariantBackground[];
  };
  onSelectBackground: (background: VariantBackground | null) => void;
  overlayCandidates?: PokemonVariant[];
  overlayPokemon: PokemonVariant | Record<string, unknown> | null;
  onSelectOverlayPokemon?: (pokemon: PokemonVariant) => void;
  onCloseOverlay: () => void;
  onFuse: () => void;
}

const Modals: React.FC<ModalsProps> = ({
  showBackgrounds,
  setShowBackgrounds,
  pokemon,
  onSelectBackground,
  overlayCandidates = [],
  overlayPokemon,
  onSelectOverlayPokemon,
  onCloseOverlay,
  onFuse,
}) => {
  const candidates =
    overlayCandidates.length > 0
      ? overlayCandidates
      : overlayPokemon
        ? [overlayPokemon as PokemonVariant]
        : [];

  const selectedCandidate =
    (overlayPokemon as PokemonVariant | null) ?? candidates[0] ?? null;

  return (
    <>
      {showBackgrounds && (
        <OverlayPortal
          onClose={() => setShowBackgrounds(false)}
          closeOnBackdrop
        >
          <div className="background-overlay" onClick={() => setShowBackgrounds(false)}>
            <div className="background-overlay-content" onClick={(e) => e.stopPropagation()}>
              <BackgroundLocationCard
                pokemon={pokemon}
                onSelectBackground={onSelectBackground}
              />
            </div>
            <CloseButton
              onClick={(event) => {
                event.stopPropagation();
                setShowBackgrounds(false);
              }}
            />
          </div>
        </OverlayPortal>
      )}

      {candidates.length > 0 && (
        <FuseOverlay
          candidates={candidates}
          selectedPokemon={selectedCandidate}
          onSelectPokemon={(selected) => onSelectOverlayPokemon?.(selected)}
          onClose={onCloseOverlay}
          onFuse={onFuse}
        />
      )}
    </>
  );
};

export default Modals;
