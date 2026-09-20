// PokemonCard.tsx
import { useEffect, useState, memo, useRef, useMemo } from 'react';
import CP from '@/components/pokemonComponents/CP';
import CollectionPriorityStar from '@/components/pokemonComponents/CollectionPriorityStar';
import PokemonImagePresentation from './PokemonImagePresentation';
import './PokemonCard.css';
import { usePokemonCardTouchHandlers } from './hooks/usePokemonCardTouchHandlers';
import SelectChip from './SelectChip';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import {
  buildPokemonDisplayModel,
  collectInstanceRefCandidates,
  findInstanceByRefs,
  resolvePokemonDisplayFusionBackgroundPool,
  resolvePokemonDisplayLocationBackground,
} from '@/features/pokemonDisplay/pokemonDisplayModel';
import {
  resolvePokemonDisplayAttributes,
  resolvePokemonDisplayImageUrl,
} from '@/features/pokemonDisplay/pokemonDisplayPresentation';

import type { PokemonVariant } from '@/types/pokemonVariants';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { VariantBackground } from '@/types/pokemonSubTypes';

interface Props {
  pokemon: PokemonVariant & {
    instanceData?: Partial<PokemonInstance>;
    currentImage: string;
  };
  onSelect: () => void;
  onSwipe?: (direction: 'left' | 'right') => void;
  toggleCardHighlight: (key: string) => void;
  setIsFastSelectEnabled: (enabled: boolean) => void;
  isEditable: boolean;
  isFastSelectEnabled: boolean;
  isHighlighted: boolean;
  tagFilter: string;
  sortType: string;
  variantByPokemonId: Map<number, { backgrounds?: VariantBackground[] }>;
}

const PokemonCard = memo(({
  pokemon,
  onSelect,
  onSwipe,
  toggleCardHighlight,
  setIsFastSelectEnabled,
  isEditable,
  isFastSelectEnabled,
  isHighlighted,
  tagFilter = '',
  sortType,
  variantByPokemonId,
}: Props) => {
  const [shouldJiggle, setShouldJiggle] = useState(false);
  const prevIsHighlighted = useRef(isHighlighted);
  const displayAttributes = resolvePokemonDisplayAttributes(pokemon);
  const {
    isDisabled = false,
    isFemale = false,
    isMega = false,
    megaForm,
    isFused = false,
    fusionForm,
    isCrown = false,
    isPurified = false,
    isDynamax = false,
    isGigantamax = false,
  } = displayAttributes;
  const displayModel = useMemo(
    () =>
      buildPokemonDisplayModel({
        pokemon,
        attributes: {
          isDisabled,
          isFemale,
          isMega,
          megaForm,
          isFused,
          fusionForm,
          isCrown,
          isPurified,
          isDynamax,
          isGigantamax,
        },
        tagFilter,
        sortType,
      }),
    [
      fusionForm,
      isCrown,
      isDisabled,
      isDynamax,
      isFemale,
      isFused,
      isGigantamax,
      isMega,
      isPurified,
      megaForm,
      pokemon,
      sortType,
      tagFilter,
    ],
  );
  const fusedPartnerInstance = useInstancesStore((state) => {
    const fusedWithKey =
      typeof pokemon.instanceData?.fused_with === 'string' ? pokemon.instanceData.fused_with : null;
    if (!fusedWithKey) return null;

    const refs = collectInstanceRefCandidates(fusedWithKey);
    if (refs.length === 0) return null;

    const fromOwned = findInstanceByRefs(state.instances, refs);
    if (fromOwned) return fromOwned;
    return findInstanceByRefs(state.foreignInstances, refs);
  });
  const resolvedFusionBackgrounds = useMemo(
    () =>
      resolvePokemonDisplayFusionBackgroundPool({
        pokemon,
        fusion: {
          is_fused: Boolean(isFused),
          fusion_form: fusionForm ?? null,
          storedFusionObject:
            pokemon.instanceData && typeof pokemon.instanceData.fusion === 'object'
              ? (pokemon.instanceData.fusion as Record<string, unknown>)
              : null,
        },
      }),
    [fusionForm, isFused, pokemon],
  );

  useEffect(() => {
    if (prevIsHighlighted.current !== isHighlighted) {
      setShouldJiggle(true);
      const timer = setTimeout(() => setShouldJiggle(false), 300);
      return () => clearTimeout(timer);
    }
    prevIsHighlighted.current = isHighlighted;
  }, [isHighlighted]);

  const currentImage = useMemo(
    () =>
      resolvePokemonDisplayImageUrl({
        pokemon,
        attributes: {
          isDisabled,
          isFemale,
          isMega,
          megaForm,
          isFused,
          fusionForm,
          isCrown,
          isPurified,
          isDynamax,
          isGigantamax,
        },
        crownForm: displayModel.crownFormLabel,
      }),
    [
      displayModel.crownFormLabel,
      fusionForm,
      isCrown,
      isDisabled,
      isDynamax,
      isFemale,
      isFused,
      isGigantamax,
      isMega,
      isPurified,
      megaForm,
      pokemon,
    ],
  );

  // Prefer instance UUID, fallback to variant key
  const highlightKey = displayModel.highlightKey;

  const { handleTouchStart, handleTouchMove, handleTouchEnd, handleClick } =
    usePokemonCardTouchHandlers({
      onSelect,
      onSwipe,
      toggleCardHighlight,
      setIsFastSelectEnabled,
      isEditable,
      isFastSelectEnabled,
      isDisabled,
      selectKey: highlightKey,
    });

  const locationBackground = useMemo(() => {
    return resolvePokemonDisplayLocationBackground({
      pokemon,
      variantByPokemonId,
      resolvedFusionBackgrounds,
      isFused,
      fusedPartnerInstance,
      fusionForm,
    });
  }, [
    fusedPartnerInstance,
    fusionForm,
    isFused,
    pokemon,
    resolvedFusionBackgrounds,
    variantByPokemonId,
  ]);

  const cardClass = `
    pokemon-card
    ${displayModel.ownershipClass}
    ${isHighlighted ? 'highlighted' : ''}
    ${isDisabled ? 'disabled-card' : ''}
    ${shouldJiggle ? 'jiggle' : ''}
  `.trim();
  const isWantedListing =
    displayModel.ownershipClass === 'wanted' || Boolean(pokemon.instanceData?.is_wanted);

  // Modifier-click toggles selection on desktop; normal activation delegates to the
  // parent, which selects catalog entries and opens owned instance details.
  const handleCardClick = (e: React.MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      if (isEditable) {
        setIsFastSelectEnabled(true);
        toggleCardHighlight(highlightKey);
      }
      return;
    }
    handleClick();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (isEditable) {
        setIsFastSelectEnabled(true);
        toggleCardHighlight(highlightKey);
      } else {
        onSelect();
      }
    } else if (e.key === 'Enter') {
      onSelect();
    }
  };

  return (
    <div
      className={`${cardClass} ${isFastSelectEnabled ? 'hide-select-chip' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={
        `${pokemon.instanceData?.instance_id ? 'View' : 'Select'} ${pokemon.name}${
          pokemon.instanceData?.instance_id ? ' details' : ''
        }${isEditable ? '. Press Space to select it for tagging.' : ''}`
      }
    >
      {/* Select chip (desktop hover only before fast-select is enabled) */}
      {isEditable && (
        <SelectChip
          selected={isHighlighted}
          delayMs={300}
          onToggle={() => {
            // enter fast-select only when selecting via chip
            if (!isHighlighted && !isFastSelectEnabled) {
              setIsFastSelectEnabled(true);
            }
            toggleCardHighlight(highlightKey);
          }}
        />
      )}

      <div className="cp-container">
        <CP cp={displayModel.cpValue} editMode={false} onCPChange={() => {}} />
      </div>

      <div className="fav-container">
        {!isWantedListing && pokemon.instanceData?.favorite && (
          <CollectionPriorityStar
            filled
            label="Favorite"
            tone="favorite"
            className="favorite-icon"
          />
        )}
        {isWantedListing && pokemon.instanceData?.most_wanted ? (
          <CollectionPriorityStar
            filled
            className="favorite-icon most-wanted-icon"
            label="Most Wanted"
            tone="most-wanted"
          />
        ) : null}
      </div>

      <PokemonImagePresentation
        imageUrl={currentImage}
        altText={pokemon.name}
        locationBackground={locationBackground}
        shouldDisplayLuckyBackdrop={displayModel.shouldDisplayLuckyBackdrop}
        isDynamax={isDynamax}
        isGigantamax={isGigantamax}
        isPurified={isPurified}
      />

      <p>#{pokemon.pokedex_number}</p>

      <div className="type-icons">
        {displayModel.typeData.type_1_icon && displayModel.typeData.type1_name && (
          <img
            src={displayModel.typeData.type_1_icon}
            alt={displayModel.typeData.type1_name}
            loading="lazy"
            draggable={false}
          />
        )}
        {displayModel.typeData.type_2_icon && displayModel.typeData.type2_name && (
          <img
            src={displayModel.typeData.type_2_icon}
            alt={displayModel.typeData.type2_name}
            loading="lazy"
            draggable={false}
          />
        )}
      </div>

      <h2 className="pokemon-name-display">{displayModel.displayName}</h2>
    </div>
  );
});

export default PokemonCard;
