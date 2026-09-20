// PokedexOverlay.tsx

import React, { useState } from 'react';
import './PokedexOverlay.css';
import OverlayPortal from '@/components/OverlayPortal';
import WindowOverlay from '@/components/WindowOverlay';
import MoveList from './MoveList';
import MainInfo from './MainInfo';
import ShinyInfo from './ShinyInfo';
import Costumes from './Costumes';
import ShadowInfo from './ShadowInfo';
import EvolutionShortcut from './EvolutionShortcut';
import CloseButton from '@/components/CloseButton';

import type { PokemonVariant, AllVariants } from '@/types/pokemonVariants';
import type { Fusion } from '@/types/pokemonSubTypes';
import { useViewportWidth, VIEWPORT_BREAKPOINTS } from '@/hooks/useViewport';

export interface PokedexOverlayProps {
  pokemon: PokemonVariant;
  onClose: () => void;
  setSelectedPokemon: (p: PokemonVariant & { fusionInfo?: Fusion }) => void;
  allPokemons: AllVariants;
}

const PokedexOverlay: React.FC<PokedexOverlayProps> = ({ pokemon, onClose, setSelectedPokemon, allPokemons }) => {
  const [currentPokemon, setCurrentPokemon] = useState(pokemon);
  const [isMale, setIsMale] = useState(true);
  const width = useViewportWidth();
  const isWidescreen = width >= VIEWPORT_BREAKPOINTS.wide;
  const isMedium =
    width >= VIEWPORT_BREAKPOINTS.desktop && width < VIEWPORT_BREAKPOINTS.wide;
  const isNarrow = width < VIEWPORT_BREAKPOINTS.desktop;

  const toggleGender = () => setIsMale(prev => !prev);

  const variant = currentPokemon.variantType ?? '';
  const isMega = variant.includes('mega');
  const isFusion = variant.includes('fusion');
  const totalMoves = currentPokemon.moves.length;
  const fastMoves = currentPokemon.moves.filter(m => m.is_fast === 1);
  const chargedMoves = currentPokemon.moves.filter(m => m.is_fast === 0);
  const showShiny = currentPokemon.shiny_available === 1;
  const showShadow = !isMega && Boolean(currentPokemon.date_shadow_available?.trim());
  const showCostumes = !isMega && Array.isArray(currentPokemon.costumes) && currentPokemon.costumes.length > 0;

  const switchOverlay = (p: typeof currentPokemon) => {
    setCurrentPokemon(p);
    setSelectedPokemon(p);
  };

  const renderMoves = () => (
    totalMoves > 15 ? (
      <>
        <WindowOverlay onClose={onClose} className="overlay-fast-moves">
          <MoveList moves={fastMoves} pokemon={currentPokemon} />
        </WindowOverlay>
        <WindowOverlay onClose={onClose} className="overlay-charged-moves">
          <MoveList moves={chargedMoves} pokemon={currentPokemon} />
        </WindowOverlay>
      </>
    ) : (
      <WindowOverlay onClose={onClose} className="overlay-all-moves">
        <MoveList moves={currentPokemon.moves} pokemon={currentPokemon} />
      </WindowOverlay>
    )
  );

  const renderMedium = () => (
    <div className="overlay-row other-overlays-row">
      {renderMoves()}
      <div className="column main-info-column">
        <WindowOverlay onClose={onClose} className="overlay-main-info">
          <MainInfo pokemon={currentPokemon} isMale={isMale} toggleGender={toggleGender} />
        </WindowOverlay>
        {showShadow && (
          <WindowOverlay onClose={onClose} className="overlay-shadow-info">
            <ShadowInfo pokemon={currentPokemon} allPokemonData={allPokemons} isMale={isMale} />
          </WindowOverlay>
        )}
      </div>
      <div className="column third-column">
        {showShiny && (
          <WindowOverlay onClose={onClose} className="overlay-shiny-info">
            <ShinyInfo pokemon={currentPokemon} allPokemonData={allPokemons} isMale={isMale} />
          </WindowOverlay>
        )}
        {showCostumes && (
          <WindowOverlay onClose={onClose} className="overlay-costumes">
            <Costumes costumes={currentPokemon.costumes!} isMale={isMale} />
          </WindowOverlay>
        )}
      </div>
    </div>
  );

  const renderWide = () => (
    <div className="overlay-row other-overlays-row">
      {renderMoves()}
      <WindowOverlay onClose={onClose} className="overlay-main-info">
        <MainInfo pokemon={currentPokemon} isMale={isMale} toggleGender={toggleGender} />
      </WindowOverlay>
      {showShiny && (
        <WindowOverlay onClose={onClose} className="overlay-shiny-info">
          <ShinyInfo pokemon={currentPokemon} allPokemonData={allPokemons} isMale={isMale} />
        </WindowOverlay>
      )}
      {showShadow && (
        <WindowOverlay onClose={onClose} className="overlay-shadow-info">
          <ShadowInfo pokemon={currentPokemon} allPokemonData={allPokemons} isMale={isMale} />
        </WindowOverlay>
      )}
      {showCostumes && (
        <WindowOverlay onClose={onClose} className="overlay-costumes">
          <Costumes costumes={currentPokemon.costumes!} isMale={isMale} />
        </WindowOverlay>
      )}
    </div>
  );

  const renderNarrow = () => (
    <div className="overlay-row other-overlays-row column-layout">
      <WindowOverlay onClose={onClose} className="overlay-main-info">
        <MainInfo pokemon={currentPokemon} isMale={isMale} toggleGender={toggleGender} />
      </WindowOverlay>
      {showShiny && (
        <WindowOverlay onClose={onClose} className="overlay-shiny-info">
          <ShinyInfo pokemon={currentPokemon} allPokemonData={allPokemons} isMale={isMale} />
        </WindowOverlay>
      )}
      {showShadow && (
        <WindowOverlay onClose={onClose} className="overlay-shadow-info">
          <ShadowInfo pokemon={currentPokemon} allPokemonData={allPokemons} isMale={isMale} />
        </WindowOverlay>
      )}
      {showCostumes && (
        <WindowOverlay onClose={onClose} className="overlay-costumes">
          <Costumes costumes={currentPokemon.costumes!} isMale={isMale} />
        </WindowOverlay>
      )}
      {renderMoves()}
    </div>
  );

  return (
    <OverlayPortal onClose={onClose}>
      <div className="pokemon-overlay">
        <div className="close-button-container">
          <CloseButton onClick={onClose} />
        </div>
        <div className={`overlay-row evolution-shortcuts-row ${isWidescreen ? '' : 'column-layout'}`}>
          {currentPokemon.evolves_from?.length > 0 && (
            <WindowOverlay onClose={onClose} className="overlay-evolves-from">
              <EvolutionShortcut
                evolvesFrom={currentPokemon.evolves_from}
                allPokemonData={allPokemons}
                currentPokemon={currentPokemon}
                setSelectedPokemon={switchOverlay}
              />
            </WindowOverlay>
          )}
          {(currentPokemon.evolves_to?.length ?? 0) > 0 && (
            <WindowOverlay onClose={onClose} className="overlay-evolves-to">
              <EvolutionShortcut
                evolvesTo={currentPokemon.evolves_to!}
                allPokemonData={allPokemons}
                currentPokemon={currentPokemon}
                setSelectedPokemon={switchOverlay}
              />
            </WindowOverlay>
          )}
          {!isMega && currentPokemon.megaEvolutions?.length > 0 && (
            <WindowOverlay onClose={onClose} className="overlay-mega-evolutions">
              <EvolutionShortcut
                megaEvolutions={currentPokemon.megaEvolutions}
                allPokemonData={allPokemons}
                currentPokemon={currentPokemon}
                setSelectedPokemon={switchOverlay}
              />
            </WindowOverlay>
          )}
        </div>
        {currentPokemon.fusion?.length > 0 && !isFusion && (
          <WindowOverlay onClose={onClose} className="overlay-fusion-evolutions">
            <EvolutionShortcut
              fusionEvolutions={currentPokemon.fusion!}
              allPokemonData={allPokemons}
              currentPokemon={currentPokemon}
              setSelectedPokemon={switchOverlay}
            />
          </WindowOverlay>
        )}
        {isMedium && renderMedium()}
        {isWidescreen && !isMedium && renderWide()}
        {isNarrow && renderNarrow()}
      </div>
    </OverlayPortal>
  );
};

export default React.memo(PokedexOverlay);
