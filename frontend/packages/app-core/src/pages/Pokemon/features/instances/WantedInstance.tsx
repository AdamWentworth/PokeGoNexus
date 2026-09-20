import React, { useEffect, useMemo, useState } from 'react';
import './WantedInstance.css';

import { useModal } from '@/contexts/ModalContext';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import EditSaveComponent from '@/components/EditSaveComponent';
import Moves from '@/components/pokemonComponents/Moves';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { VariantBackground } from '@/types/pokemonSubTypes';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { determineImageUrl } from '@/utils/imageHelpers';
import { createScopedLogger } from '@/utils/logger';
import { backgroundMatchesVariant } from '@/utils/backgroundCostume';

import FriendshipManager from './components/Wanted/FriendshipManager';
import MostWantedToggle from './components/Wanted/MostWantedToggle';
import WantedSizePreferences from './components/Wanted/WantedSizePreferences';
import {
  buildWantedSizePreferences,
  getStoredWantedSizePreference,
  type WantedSizePreference,
} from './components/Wanted/wantedSizePreferences';
import BackgroundSelector from './sections/BackgroundSelector';
import IdentityRow from './sections/IdentityRow';
import ImageStage from './sections/ImageStage';
import LevelGenderRow from './sections/LevelGenderRow';
import TradeBackgroundModal from './sections/TradeBackgroundModal';
import { getEntityKey } from './utils/getEntityKey';

const log = createScopedLogger('WantedInstance');

type BackgroundOption = VariantBackground;

type WantedPokemon = PokemonVariant & {
  instanceData: PokemonInstance;
  backgrounds: BackgroundOption[];
};

interface WantedInstanceProps {
  pokemon: WantedPokemon;
  isEditable: boolean;
  catalogView?: boolean;
  compactListingView?: boolean;
  onPreviewInstanceDataChange?: (patch: Partial<PokemonInstance>) => void;
}

type MovesSelection = {
  fastMove: number | null;
  chargedMove1: number | null;
  chargedMove2: number | null;
};

const hasSpecificGender = (gender: string | null): boolean =>
  Boolean(gender && gender !== 'Any' && gender !== 'Both');

const hasDesiredDetails = (
  gender: string | null,
  weight: WantedSizePreference,
  height: WantedSizePreference,
  moves: MovesSelection,
): boolean =>
  Boolean(
    hasSpecificGender(gender) ||
      weight != null ||
      height != null ||
      moves.fastMove ||
      moves.chargedMove1 ||
      moves.chargedMove2,
  );

const WantedInstance: React.FC<WantedInstanceProps> = ({
  pokemon,
  isEditable,
  catalogView = false,
  compactListingView = false,
  onPreviewInstanceDataChange,
}) => {
  const updateDetails = useInstancesStore((state) => state.updateInstanceDetails);
  const { alert } = useModal();
  const entityKey = getEntityKey(pokemon);
  const instanceData = pokemon.instanceData;

  const [editMode, setEditMode] = useState(false);
  const [nickname, setNickname] = useState<string | null>(instanceData.nickname);
  const [gender, setGender] = useState<string | null>(instanceData.gender);
  const [weight, setWeight] = useState<WantedSizePreference>(() =>
    getStoredWantedSizePreference(
      instanceData.wanted_size_preferences,
      instanceData.weight,
      pokemon.sizes,
      'weight',
    ),
  );
  const [height, setHeight] = useState<WantedSizePreference>(() =>
    getStoredWantedSizePreference(
      instanceData.wanted_size_preferences,
      instanceData.height,
      pokemon.sizes,
      'height',
    ),
  );
  const [moves, setMoves] = useState<MovesSelection>({
    fastMove: instanceData.fast_move_id,
    chargedMove1: instanceData.charged_move1_id,
    chargedMove2: instanceData.charged_move2_id,
  });
  const [friendship, setFriendship] = useState(
    Math.max(0, Math.min(5, Math.trunc(Number(instanceData.friendship_level ?? 0)))),
  );
  const [isLucky, setIsLucky] = useState(Boolean(instanceData.pref_lucky));
  const [mostWanted, setMostWanted] = useState(Boolean(instanceData.most_wanted));
  const [showBackgrounds, setShowBackgrounds] = useState(false);
  const [selectedBackground, setSelectedBackground] =
    useState<BackgroundOption | null>(() => {
      const locationCardId = Number.parseInt(String(instanceData.location_card ?? ''), 10);
      return (
        (pokemon.backgrounds ?? []).find(
          (background) => background.background_id === locationCardId,
        ) ?? null
      );
    });

  useEffect(() => {
    onPreviewInstanceDataChange?.({
      pref_lucky: isLucky,
      most_wanted: mostWanted,
    });
  }, [isLucky, mostWanted, onPreviewInstanceDataChange]);

  useEffect(() => {
    if (!editMode) setMostWanted(Boolean(instanceData.most_wanted));
  }, [editMode, instanceData.most_wanted]);

  useEffect(() => {
    if (editMode) return;
    setWeight(
      getStoredWantedSizePreference(
        instanceData.wanted_size_preferences,
        instanceData.weight,
        pokemon.sizes,
        'weight',
      ),
    );
    setHeight(
      getStoredWantedSizePreference(
        instanceData.wanted_size_preferences,
        instanceData.height,
        pokemon.sizes,
        'height',
      ),
    );
  }, [
    editMode,
    instanceData.height,
    instanceData.wanted_size_preferences,
    instanceData.weight,
    pokemon.sizes,
  ]);

  const backgrounds = useMemo(() => pokemon.backgrounds ?? [], [pokemon.backgrounds]);
  const selectableBackgrounds = useMemo(
    () =>
      backgrounds.filter((background) =>
        backgroundMatchesVariant(background, pokemon.variantType),
      ),
    [backgrounds, pokemon.variantType],
  );

  useEffect(() => {
    const locationCardId = Number.parseInt(String(instanceData.location_card ?? ''), 10);
    setSelectedBackground(
      selectableBackgrounds.find(
        (background) => background.background_id === locationCardId,
      ) ?? null,
    );
  }, [instanceData.location_card, selectableBackgrounds]);

  const isFemale = gender === 'Female';
  const dynamax = Boolean(instanceData.dynamax);
  const gigantamax = Boolean(instanceData.gigantamax);
  const isShadow = Boolean(instanceData.shadow);
  const isPurified = Boolean(instanceData.purified);
  const displayName = pokemon.name ?? pokemon.species_name ?? 'Pokemon';
  const wantedSizePreferences = useMemo(
    () => buildWantedSizePreferences(weight, height, pokemon.sizes),
    [height, pokemon.sizes, weight],
  );
  const currentImage = useMemo(
    () =>
      determineImageUrl(
        isFemale,
        pokemon,
        false,
        undefined,
        false,
        undefined,
        false,
        gigantamax,
      ),
    [gigantamax, isFemale, pokemon],
  );

  const displayPokemon = useMemo(
    () => ({
      ...pokemon,
      instanceData: {
        ...instanceData,
        nickname,
        gender,
        weight: null,
        height: null,
        wanted_size_preferences: wantedSizePreferences,
        fast_move_id: moves.fastMove,
        charged_move1_id: moves.chargedMove1,
        charged_move2_id: moves.chargedMove2,
      },
    }),
    [
      gender,
      instanceData,
      moves,
      nickname,
      pokemon,
      wantedSizePreferences,
    ],
  );

  const showWantedDetails =
    editMode || hasDesiredDetails(gender, weight, height, moves);

  const handleBackgroundSelect = (background: BackgroundOption | null) => {
    setSelectedBackground(
      background && backgroundMatchesVariant(background, pokemon.variantType)
        ? background
        : null,
    );
    setShowBackgrounds(false);
  };

  const toggleEditMode = async () => {
    if (!editMode) {
      setEditMode(true);
      return;
    }

    try {
      await updateDetails(entityKey, {
        nickname,
        gender,
        weight: null,
        height: null,
        wanted_size_preferences: wantedSizePreferences,
        fast_move_id: moves.fastMove,
        charged_move1_id: moves.chargedMove1,
        charged_move2_id: moves.chargedMove2,
        friendship_level: friendship,
        pref_lucky: isLucky,
        most_wanted: mostWanted,
        location_card: selectedBackground
          ? String(selectedBackground.background_id)
          : null,
      });
      setEditMode(false);
    } catch (error) {
      log.error('Error updating wanted details:', error);
      await alert('An error occurred while updating the wanted Pokémon. Please try again.');
    }
  };

  const friendshipSection = (
    <section
      className={`wanted-instance__conditions${isEditable ? ' has-actions' : ''}${
        isEditable || mostWanted ? ' has-priority' : ''
      }`}
      aria-labelledby={`${entityKey}-conditions`}
    >
      {isEditable ? (
        <div className="wanted-instance__condition-actions">
          <EditSaveComponent
            editMode={editMode}
            toggleEditMode={toggleEditMode}
            isEditable
            label={editMode ? 'Save wanted listing' : 'Edit wanted listing'}
          />
        </div>
      ) : null}
      <div className="wanted-instance__conditions-label">
        <strong id={`${entityKey}-conditions`}>Wanted conditions</strong>
        <span>Friendship and eligibility</span>
      </div>
      {isEditable || mostWanted ? (
        <div className="wanted-instance__condition-right-actions">
          {editMode ? (
            <BackgroundSelector
              canPick={selectableBackgrounds.length > 0}
              editMode
              onToggle={() => setShowBackgrounds((visible) => !visible)}
              variant="header"
            />
          ) : null}
          <MostWantedToggle
            active={mostWanted}
            editMode={editMode}
            onChange={setMostWanted}
          />
        </div>
      ) : null}
      <FriendshipManager
        friendship={friendship}
        setFriendship={setFriendship}
        editMode={editMode}
        isLucky={isLucky}
        setIsLucky={setIsLucky}
      />
    </section>
  );

  const wantedImageStage = (
    <ImageStage
      selectedBackground={selectedBackground}
      isLucky={isLucky}
      currentImage={currentImage}
      name={displayName}
      dynamax={dynamax}
      gigantamax={gigantamax}
      isPurified={isPurified}
    />
  );

  const wantedDetails = showWantedDetails ? (
    <div className="wanted-instance__requirements" aria-label="Wanted Pokémon details">
      <LevelGenderRow
        pokemon={displayPokemon}
        editMode={editMode}
        level={null}
        onLevelChange={() => undefined}
        gender={gender}
        onGenderChange={setGender}
        showLevel={false}
        showGenderWhenUnset={editMode}
        searchMode
      />

      <WantedSizePreferences
        weight={weight}
        height={height}
        editMode={editMode}
        onWeightChange={setWeight}
        onHeightChange={setHeight}
      />

      <div className="wanted-instance__moves">
        <Moves
          pokemon={displayPokemon}
          editMode={editMode}
          onMovesChange={setMoves}
          isShadow={isShadow}
          isPurified={isPurified}
        />
      </div>
    </div>
  ) : null;

  if (catalogView) {
    return (
      <div className="caught-instance wanted-instance wanted-instance--catalog-view">
        <div className="instance-details-body">
          {friendshipSection}
          {wantedImageStage}
          <IdentityRow
            pokemon={displayPokemon}
            isLucky={isLucky}
            isShadow={isShadow}
            isPurified={isPurified}
            editMode={false}
            onToggleLucky={() => undefined}
            onNicknameChange={setNickname}
            onTogglePurify={() => undefined}
            showLucky={false}
            showPurify={false}
            eyebrow="Wanted"
          />
          {wantedDetails}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`caught-instance wanted-instance wanted-instance--caught-layout${
        compactListingView ? ' wanted-instance--compact-listing' : ''
      }`}
    >
      <div className="instance-details-body">
        {friendshipSection}

        {wantedImageStage}

        <IdentityRow
          pokemon={displayPokemon}
          isLucky={isLucky}
          isShadow={isShadow}
          isPurified={isPurified}
          editMode={editMode}
          onToggleLucky={() => undefined}
          onNicknameChange={setNickname}
          onTogglePurify={() => undefined}
          showLucky={false}
          showPurify={false}
          eyebrow="Wanted"
        />

        {wantedDetails}

        <TradeBackgroundModal
          showBackgrounds={showBackgrounds}
          pokemon={pokemon}
          onClose={() => setShowBackgrounds(false)}
          onSelectBackground={handleBackgroundSelect}
        />
      </div>
    </div>
  );
};

export default WantedInstance;
