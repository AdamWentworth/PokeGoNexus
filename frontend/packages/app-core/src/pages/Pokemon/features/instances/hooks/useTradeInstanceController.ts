import { useCallback, useEffect, useMemo, useState } from 'react';
import { cpMultipliers } from '@/utils/constants';
import { calculateCP } from '@/utils/calculateCP';
import { calculateBaseStats } from '@/utils/calculateBaseStats';
import { resolvePokemonDisplayImageUrl } from '@/features/pokemonDisplay/pokemonDisplayPresentation';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { VariantBackground } from '@/types/pokemonSubTypes';
import { backgroundMatchesVariant } from '@/utils/backgroundCostume';
import {
  areInstanceIvsEmpty,
  getInitialCpText,
  getInitialGenderState,
  getInitialIvs,
  getInitialLevel,
  getInitialMaxMoveValue,
  getInitialMoves,
  getInitialOptionalNumericValue,
  parseEditableLevel,
} from '../utils/instanceFormState';
import type { TradeIvs, TradeMoves } from '../utils/tradeInstanceForm';

type BackgroundOption = VariantBackground;

export type TradePokemon = PokemonVariant & {
  instanceData: PokemonInstance;
  backgrounds: BackgroundOption[];
  max: unknown[];
};

type TradeComputedValues = {
  level?: number | null;
  cp?: number | null;
  ivs?: TradeIvs;
};

type TradeDisplayOptions = {
  isCrown?: boolean;
  crownForm?: string | null;
};

export const useTradeInstanceController = (
  pokemon: TradePokemon,
  options: TradeDisplayOptions = {},
) => {
  const isCrown = Boolean(options.isCrown);
  const crownForm = options.crownForm ?? null;
  const gigantamax = !!pokemon.instanceData.gigantamax;
  const initialGenderState = getInitialGenderState(pokemon.instanceData);
  const [isFemale, setIsFemale] = useState<boolean>(initialGenderState.isFemale);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [nickname, setNickname] = useState<string | null>(
    pokemon.instanceData.nickname,
  );
  const [cp, setCP] = useState<string>(getInitialCpText(pokemon.instanceData));
  const [gender, setGender] = useState<string | null>(initialGenderState.gender);
  const [weight, setWeight] = useState<number | ''>(
    getInitialOptionalNumericValue(pokemon.instanceData.weight),
  );
  const [height, setHeight] = useState<number | ''>(
    getInitialOptionalNumericValue(pokemon.instanceData.height),
  );
  const dynamax = !!pokemon.instanceData.dynamax;
  const [showMaxOptions, setShowMaxOptions] = useState<boolean>(false);

  const [maxAttack, setMaxAttack] = useState<string>(
    getInitialMaxMoveValue(pokemon.instanceData.max_attack),
  );
  const [maxGuard, setMaxGuard] = useState<string>(
    getInitialMaxMoveValue(pokemon.instanceData.max_guard),
  );
  const [maxSpirit, setMaxSpirit] = useState<string>(
    getInitialMaxMoveValue(pokemon.instanceData.max_spirit),
  );

  const [moves, setMoves] = useState<TradeMoves>(getInitialMoves(pokemon.instanceData));

  const [ivs, setIvs] = useState<TradeIvs>(getInitialIvs(pokemon.instanceData));

  const [level, setLevel] = useState<number | null>(getInitialLevel(pokemon.instanceData));
  const [locationCaught, setLocationCaught] = useState<string | null>(
    pokemon.instanceData.location_caught,
  );
  const [dateCaught, setDateCaught] = useState<string | null>(
    pokemon.instanceData.date_caught,
  );

  const [showBackgrounds, setShowBackgrounds] = useState<boolean>(false);
  const [selectedBackground, setSelectedBackground] =
    useState<BackgroundOption | null>(null);

  const currentBaseStats = useMemo(
    () =>
      calculateBaseStats(
        pokemon,
        {
          isMega: false,
          megaForm: undefined,
        },
        undefined,
        {
          is_crown: isCrown,
          crown_form: crownForm ?? undefined,
        },
      ),
    [crownForm, isCrown, pokemon],
  );

  const currentImage = useMemo(
    () =>
      resolvePokemonDisplayImageUrl({
        pokemon,
        attributes: {
          isFemale,
          isMega: false,
          isFused: false,
          isPurified: false,
          isGigantamax: gigantamax,
          isCrown,
          crownForm,
        },
        crownForm,
      }),
    [crownForm, gigantamax, isCrown, isFemale, pokemon],
  );

  useEffect(() => {
    if (pokemon.instanceData.location_card === null) {
      setSelectedBackground(null);
      return;
    }

    const locationCardId = parseInt(pokemon.instanceData.location_card, 10);
    const background = pokemon.backgrounds.find(
      (candidate: BackgroundOption) =>
        candidate.background_id === locationCardId &&
        backgroundMatchesVariant(candidate, pokemon.variantType),
    );
    setSelectedBackground(background ?? null);
  }, [pokemon.backgrounds, pokemon.instanceData.location_card, pokemon.variantType]);

  useEffect(() => {
    const { attack, defense, stamina } = currentBaseStats;
    const atk = ivs.Attack;
    const def = ivs.Defense;
    const sta = ivs.Stamina;

    if (
      level != null &&
      !isNaN(level) &&
      atk !== '' &&
      atk !== null &&
      def !== '' &&
      def !== null &&
      sta !== '' &&
      sta !== null &&
      !isNaN(atk) &&
      !isNaN(def) &&
      !isNaN(sta)
    ) {
      const multiplier = (cpMultipliers as Record<string, number>)[String(level)];
      if (multiplier) {
        const calculatedCP = calculateCP(
          attack,
          defense,
          stamina,
          Number(atk),
          Number(def),
          Number(sta),
          multiplier,
        );
        setCP(calculatedCP.toString());
      }
    }
  }, [currentBaseStats, level, ivs]);

  const areIVsEmpty = areInstanceIvsEmpty(ivs);

  const handleGenderChange = useCallback((newGender: string | null) => {
    setGender(newGender);
    setIsFemale(newGender === 'Female');
  }, []);

  const handleCPChange = useCallback((newCP: string) => setCP(newCP), []);
  const handleNicknameChange = useCallback(
    (newNickname: string | null) => setNickname(newNickname),
    [],
  );
  const handleWeightChange = useCallback((newWeight: string) => {
    setWeight(newWeight === '' ? '' : Number(newWeight));
  }, []);
  const handleHeightChange = useCallback((newHeight: string) => {
    setHeight(newHeight === '' ? '' : Number(newHeight));
  }, []);
  const handleMovesChange = useCallback((newMoves: TradeMoves) => setMoves(newMoves), []);
  const handleIvChange = useCallback((newIvs: TradeIvs) => setIvs(newIvs), []);
  const handleLevelChange = useCallback((newLevel: string) => {
    setLevel(parseEditableLevel(newLevel));
  }, []);
  const handleLocationCaughtChange = useCallback(
    (newLocation: string) => setLocationCaught(newLocation),
    [],
  );
  const handleDateCaughtChange = useCallback((newDate: string) => setDateCaught(newDate), []);
  const handleBackgroundSelect = useCallback(
    (background: BackgroundOption | null) => {
      setSelectedBackground(
        background && backgroundMatchesVariant(background, pokemon.variantType)
          ? background
          : null,
      );
      setShowBackgrounds(false);
    },
    [pokemon.variantType],
  );
  const handleToggleMaxOptions = useCallback(
    () => setShowMaxOptions((prev) => !prev),
    [],
  );

  const applyComputedValues = useCallback((computedValues: TradeComputedValues) => {
    if (computedValues.level !== undefined) {
      setLevel(computedValues.level);
    }
    if (computedValues.cp !== undefined) {
      setCP(computedValues.cp == null ? '' : String(computedValues.cp));
    }
    if (computedValues.ivs !== undefined) {
      setIvs(computedValues.ivs);
    }
  }, []);

  return {
    isFemale,
    currentImage,
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
    setShowMaxOptions,
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
  };
};
