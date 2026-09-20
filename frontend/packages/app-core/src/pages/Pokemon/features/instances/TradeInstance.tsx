import React, { useMemo, useState } from 'react';
import './TradeInstance.css';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';

import PowerPanel from './sections/PowerPanel';
import InstanceDetailsLayout from './sections/InstanceDetailsLayout';
import { hasMovesAndIVContent } from './sections/MovesAndIV';
import { hasMetaPanelContent } from './sections/MetaPanel';
import BackgroundSelector from './sections/BackgroundSelector';

import useValidation from './hooks/useValidation';
import { useModal } from '@/contexts/ModalContext';
import { getEntityKey } from './utils/getEntityKey';
import {
  buildTradeInstancePatch,
  toTradeValidationFields,
} from './utils/tradeInstanceForm';
import TradeBackgroundModal from './sections/TradeBackgroundModal';
import type { PokemonInstance } from '@/types/pokemonInstance';
import {
  useTradeInstanceController,
  type TradePokemon,
} from './hooks/useTradeInstanceController';
import { createScopedLogger } from '@/utils/logger';
import { getCrownFormLabel, resolveActiveCrownForm } from '@/utils/crownHelpers';
import { resolveCrownDisplayData } from '@/features/pokemonDisplay/crownDisplayData';
import { resolveCrownMovePool } from '@/features/pokemonDisplay/crownMovePool';
import { isSpecialMaxMoveEligible } from '@/features/max/specialMaxPokemon';

const log = createScopedLogger('TradeInstance');

interface TradeInstanceProps {
  pokemon: TradePokemon;
  isEditable: boolean;
  catalogView?: boolean;
  compactListingView?: boolean;
}

const TradeInstance: React.FC<TradeInstanceProps> = ({
  pokemon,
  isEditable,
  catalogView = false,
  compactListingView = false,
}) => {
  const hideCollectionMetadata = catalogView || compactListingView;
  const updateDetails = useInstancesStore((s) => s.updateInstanceDetails);
  const { alert } = useModal();
  const entityKey = getEntityKey(pokemon);

  const { validate, resetErrors } = useValidation();
  const crownForms = pokemon.crownForms ?? [];
  const [crownData, setCrownData] = useState<{
    isCrown: boolean;
    crownForm: string | null;
  }>(() => {
    const selected = resolveActiveCrownForm(crownForms, null);
    return {
      isCrown: Boolean(pokemon.instanceData.crown),
      crownForm: getCrownFormLabel(selected),
    };
  });
  const isTraded = false;
  const originalTrainerName = null;
  const originalTrainerId = null;
  const tradedDate = null;
  const [pokeball, setPokeball] = useState<string | null>(pokemon.instanceData.pokeball ?? null);

  const {
    editMode,
    setEditMode,
    nickname,
    cp,
    gender,
    weight,
    height,
    dynamax,
    gigantamax,
    showMaxOptions,
    maxAttack,
    setMaxAttack,
    maxGuard,
    setMaxGuard,
    maxSpirit,
    setMaxSpirit,
    moves,
    ivs,
    areIVsEmpty,
    level,
    locationCaught,
    dateCaught,
    showBackgrounds,
    setShowBackgrounds,
    selectedBackground,
    currentBaseStats,
    currentImage,
    applyComputedValues,
    handleGenderChange,
    handleCPChange,
    handleNicknameChange,
    handleWeightChange,
    handleHeightChange,
    handleMovesChange,
    handleIvChange,
    handleLevelChange,
    handleLocationCaughtChange,
    handleDateCaughtChange,
    handleBackgroundSelect,
    handleToggleMaxOptions,
  } = useTradeInstanceController(pokemon, {
    isCrown: crownData.isCrown,
    crownForm: crownData.crownForm,
  });
  const showLevelMetadata =
    !catalogView && (!compactListingView || editMode || level != null);
  const showLevelArc = !catalogView && level != null;

  const isShadow = Boolean(pokemon.instanceData.shadow);
  const isPurified = Boolean(pokemon.instanceData.purified);
  const isLucky = Boolean(pokemon.instanceData.lucky);
  const displayName = pokemon.name ?? pokemon.species_name ?? 'Pokemon';
  const resolvedCrownDisplay = useMemo(
    () =>
      resolveCrownDisplayData({
        pokemon,
        crown: {
          is_crown: crownData.isCrown,
          crown_form: crownData.crownForm,
        },
      }),
    [crownData.crownForm, crownData.isCrown, pokemon],
  );
  const resolvedCrownMoves = useMemo(
    () =>
      resolveCrownMovePool({
        pokemon,
        baseMoves: pokemon.moves ?? [],
        crown: {
          is_crown: crownData.isCrown,
          crown_form: crownData.crownForm,
        },
      }),
    [crownData.crownForm, crownData.isCrown, pokemon],
  );
  const statsPokemon = useMemo(
    () => ({
      ...pokemon,
      type1_name: resolvedCrownDisplay.type1_name,
      type2_name: resolvedCrownDisplay.type2_name,
      type_1_icon: resolvedCrownDisplay.type_1_icon,
      type_2_icon: resolvedCrownDisplay.type_2_icon,
      sizes: resolvedCrownDisplay.sizes,
    }),
    [pokemon, resolvedCrownDisplay],
  );
  const showPowerSection = Boolean(
    (editMode &&
      ((typeof pokemon.variantType === 'string' &&
        (pokemon.variantType.includes('dynamax') ||
          pokemon.variantType.includes('gigantamax')) &&
        Array.isArray(pokemon.max) &&
        pokemon.max.length > 0) ||
        isSpecialMaxMoveEligible({
          pokemonId: pokemon.pokemon_id,
          variantType: pokemon.variantType,
          form: crownData.isCrown ? crownData.crownForm : pokemon.form,
          isCrowned: crownData.isCrown,
        })) &&
      !isShadow &&
      !isPurified &&
      !pokemon.variantType?.includes('costume')) ||
      (crownForms.length > 0 && !isShadow),
  );

  const movesPokemon = useMemo(
    () => ({
      ...pokemon,
      moves: resolvedCrownMoves.moves,
      instanceData: {
        ...(pokemon.instanceData ?? {}),
        nickname,
        crown: crownData.isCrown,
        fast_move_id: moves.fastMove,
        charged_move1_id: moves.chargedMove1,
        charged_move2_id: moves.chargedMove2,
        location_caught: locationCaught,
        date_caught: dateCaught,
      },
    }),
    [
      dateCaught,
      locationCaught,
      moves.chargedMove1,
      moves.chargedMove2,
      moves.fastMove,
      nickname,
      pokemon,
      resolvedCrownMoves.moves,
      crownData.isCrown,
    ],
  );
  const metaPokemon = useMemo(
    () => ({
      ...pokemon,
      instanceData: {
        ...(pokemon.instanceData ?? {}),
        location_caught: locationCaught,
        date_caught: dateCaught,
        is_traded: isTraded,
        original_trainer_name: originalTrainerName,
        original_trainer_id: originalTrainerId,
        traded_date: tradedDate,
      },
    }),
    [
      dateCaught,
      isTraded,
      locationCaught,
      originalTrainerId,
      originalTrainerName,
      pokemon,
      tradedDate,
    ],
  );
  const movesAndIVVisible = useMemo(
    () =>
      hasMovesAndIVContent({
        pokemon: movesPokemon,
        editMode,
        areIVsEmpty,
      }),
    [areIVsEmpty, editMode, movesPokemon],
  );
  const showStatsDivider = Boolean(showPowerSection || movesAndIVVisible);
  const metaPanelVisible = useMemo(
    () =>
      hasMetaPanelContent({
        pokemon: metaPokemon,
        editMode,
        isTraded,
        originalTrainerName,
        tradedDate,
        pokeball,
        allowTradeMetadata: false,
      }),
    [editMode, isTraded, metaPokemon, originalTrainerName, pokeball, tradedDate],
  );
  const showMetaDivider = Boolean(metaPanelVisible && (movesAndIVVisible || !showPowerSection));
  const addStatsBottomGap = Boolean(!showStatsDivider && !metaPanelVisible);

  const toggleEditMode = async () => {
    if (editMode) {
      const { validationErrors: ve, computedValues: cv } = validate(
        toTradeValidationFields({
          level,
          cp,
          ivs,
          weight,
          height,
        }),
        currentBaseStats,
      );

      const hasErrors = Object.keys(ve).length > 0;
      if (hasErrors) {
        alert(Object.values(ve).join('\n'));
        return;
      }
      resetErrors();
      applyComputedValues(cv);

      const payload = buildTradeInstancePatch({
        nickname,
        cp,
        gender,
        weight,
        height,
        moves,
        level,
        ivs,
        locationCaught,
        dateCaught,
        isTraded,
        originalTrainerName,
        originalTrainerId,
        tradedDate,
        pokeball,
        selectedBackgroundId: selectedBackground?.background_id ?? null,
        crown: crownData.isCrown,
        maxAttack,
        maxGuard,
        maxSpirit,
        computedValues: cv,
      });

      try {
        await updateDetails({ [entityKey]: payload as Partial<PokemonInstance> });
      } catch (error) {
        log.error('Error updating trade details:', error);
        alert('An error occurred while updating the Pokemon details. Please try again.');
        return;
      }
    }

    setEditMode((prev) => !prev);
  };

  return (
    <InstanceDetailsLayout
      className={`caught-instance trade-instance trade-instance--caught-layout${
        catalogView ? ' trade-instance--catalog-view' : ''
      }`}
      dateCaught={dateCaught}
      headerRow={{
        editMode,
        toggleEditMode,
        isEditable,
        cp,
        onCPChange: handleCPChange,
        onFavoriteChange: () => undefined,
        showFavorite: false,
        rightSlot: catalogView || !editMode ? null : (
          <BackgroundSelector
            canPick={pokemon.backgrounds.length > 0}
            editMode={editMode}
            onToggle={() => setShowBackgrounds((prev) => !prev)}
            variant="header"
          />
        ),
      }}
      backgroundSelector={{
        canPick: pokemon.backgrounds.length > 0,
        editMode,
        onToggle: () => setShowBackgrounds((prev) => !prev),
      }}
      levelArcLevel={showLevelArc ? level : null}
      imageStage={{
        selectedBackground,
        isLucky,
        currentImage,
        name: displayName,
        dynamax,
        gigantamax,
        isPurified,
      }}
      identityRow={{
        pokemon,
        isLucky,
        isShadow,
        isPurified,
        editMode,
        onToggleLucky: () => undefined,
        onNicknameChange: handleNicknameChange,
        onTogglePurify: () => undefined,
        showLucky: false,
        showPurify: false,
        eyebrow: compactListingView || catalogView ? 'For Trade' : undefined,
      }}
      levelGenderRow={{
        pokemon,
        editMode,
        level,
        onLevelChange: handleLevelChange,
        gender,
        onGenderChange: handleGenderChange,
      }}
      showLevelGenderRow={showLevelMetadata}
      statsRow={{
        pokemon: statsPokemon,
        editMode,
        onWeightChange: (value) => handleWeightChange(String(value)),
        onHeightChange: (value) => handleHeightChange(String(value)),
        showTypes: !hideCollectionMetadata,
      }}
      addStatsBottomGap={addStatsBottomGap}
      showStatsDivider={showStatsDivider}
      powerContent={
        showPowerSection ? (
          <PowerPanel
            pokemon={pokemon}
            editMode={editMode}
            crownData={crownData}
            setCrownData={setCrownData}
            megaEvolutions={[]}
            crownForms={crownForms}
            isShadow={isShadow}
            name={displayName}
            dynamax={dynamax}
            gigantamax={gigantamax}
            showMaxOptions={showMaxOptions}
            onToggleMax={handleToggleMaxOptions}
            maxAttack={maxAttack}
            maxGuard={maxGuard}
            maxSpirit={maxSpirit}
            onMaxAttackChange={setMaxAttack}
            onMaxGuardChange={setMaxGuard}
            onMaxSpiritChange={setMaxSpirit}
          />
        ) : null
      }
      showPowerDivider={showPowerSection}
      showBackgroundSelectorRow={false}
      showMetaPanel={metaPanelVisible}
      showMetaDivider={showMetaDivider}
      movesAndIV={{
        pokemon: movesPokemon,
        editMode,
        onMovesChange: handleMovesChange,
        isShadow,
        isPurified,
        ivs,
        onIvChange: handleIvChange,
        areIVsEmpty,
      }}
      metaPanel={{
        pokemon: metaPokemon,
        editMode,
        pokeball,
        originalTrainerName,
        originalTrainerId,
        tradedDate,
        isLucky,
        isTraded,
        isShadow,
        allowTradeMetadata: false,
        onLocationChange: handleLocationCaughtChange,
        onDateChange: handleDateCaughtChange,
        onIsTradedChange: () => undefined,
        onOriginalTrainerNameChange: () => undefined,
        onOriginalTrainerIdChange: () => undefined,
        onTradedDateChange: () => undefined,
        onPokeballChange: setPokeball,
      }}
      footerContent={
        <TradeBackgroundModal
          showBackgrounds={showBackgrounds}
          pokemon={pokemon}
          onClose={() => setShowBackgrounds(false)}
          onSelectBackground={handleBackgroundSelect}
        />
      }
    />
  );
};

export default TradeInstance;
