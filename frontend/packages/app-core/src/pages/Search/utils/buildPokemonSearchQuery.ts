import type { PokemonVariant } from '@/types/pokemonVariants';
import type { PokemonSearchQueryParams } from '@shared-contracts/search';
import {
  isCaughtOwnershipMode,
  toOwnershipApiValue,
  type SearchOwnershipMode,
} from './ownershipMode';
import {
  backgroundMatchesCostume,
  normalizeCostumeId,
} from '@/utils/backgroundCostume';

export type SelectedMoves = {
  fastMove: number | '' | null;
  chargedMove1: number | '' | null;
  chargedMove2: number | '' | null;
};

export type Coordinates = {
  latitude: number | null;
  longitude: number | null;
};

export type IvFilters = {
  Attack: number | '' | null;
  Defense: number | '' | null;
  Stamina: number | '' | null;
};

export type { PokemonSearchQueryParams } from '@shared-contracts/search';

type ValidateSearchInputArgs = {
  isShadow: boolean;
  ownershipMode: SearchOwnershipMode;
  pokemon: string;
  useCurrentLocation: boolean;
  city: string;
  coordinates: Coordinates;
  pokemonCache: PokemonVariant[] | null;
};

type BuildQueryArgs = {
  matchingPokemon: PokemonVariant;
  costume: string | null;
  isShiny: boolean;
  isShadow: boolean;
  selectedMoves: SelectedMoves;
  selectedGender: string | null;
  selectedBackgroundId: number | null;
  ivs: IvFilters;
  onlyMatchingTrades: boolean;
  prefLucky: boolean;
  friendshipLevel: number;
  alreadyRegistered: boolean;
  tradeInWantedList: boolean;
  coordinates: Coordinates;
  ownershipMode: SearchOwnershipMode;
  range: number;
  resultsLimit: number;
  dynamax: boolean;
  gigantamax: boolean;
};

type PreparePokemonSearchQueryArgs = {
  pokemon: string;
  selectedForm: string;
  isShiny: boolean;
  isShadow: boolean;
  costume: string | null;
  selectedMoves: SelectedMoves;
  selectedGender: string | null;
  selectedBackgroundId: number | null;
  dynamax: boolean;
  gigantamax: boolean;
  city: string;
  useCurrentLocation: boolean;
  ownershipMode: SearchOwnershipMode;
  coordinates: Coordinates;
  range: number;
  resultsLimit: number;
  ivs: IvFilters;
  onlyMatchingTrades: boolean;
  prefLucky: boolean;
  friendshipLevel: number;
  alreadyRegistered: boolean;
  tradeInWantedList: boolean;
  pokemonCache: PokemonVariant[] | null;
};

export type PreparedPokemonSearchQuery =
  | {
      ok: true;
      queryParams: PokemonSearchQueryParams;
    }
  | {
      ok: false;
      errorMessage: string;
      shouldExpandSearchBar: boolean;
    };

const toNullableNumber = (value: number | '' | null): number | null =>
  typeof value === 'number' ? value : null;

export const validateSearchInput = ({
  isShadow,
  ownershipMode,
  pokemon,
  useCurrentLocation,
  city,
  coordinates,
  pokemonCache,
}: ValidateSearchInputArgs): string | null => {
  if (isShadow && (ownershipMode === 'trade' || ownershipMode === 'wanted')) {
    return 'Shadow Pokemon cannot be listed for trade or wanted';
  }

  if (!pokemon) {
    return 'Please provide a Pokemon name.';
  }

  if (!useCurrentLocation && (!city || !coordinates.latitude || !coordinates.longitude)) {
    return 'Please provide a location or use your current location.';
  }

  if (!pokemonCache || pokemonCache.length === 0) {
    return 'No Pokemon data found in the default store.';
  }

  return null;
};

export const findMatchingPokemonVariant = (
  pokemonCache: PokemonVariant[],
  pokemon: string,
  selectedForm: string,
): PokemonVariant | undefined =>
  pokemonCache.find(
    (variant) =>
      variant.name?.toLowerCase() === pokemon.toLowerCase() &&
      (!selectedForm ||
        (variant.form ?? '').toLowerCase() === selectedForm.toLowerCase()),
  );

export const validateBackgroundCostumePair = (
  matchingPokemon: PokemonVariant,
  costume: string | null,
  selectedBackgroundId: number | null,
): string | null => {
  if (selectedBackgroundId == null) {
    return null;
  }

  const background = matchingPokemon.backgrounds?.find(
    (entry) => Number(entry.background_id) === Number(selectedBackgroundId),
  );
  if (!background) {
    return 'The selected background is not available for this Pokémon.';
  }

  const matchingCostume = costume
    ? matchingPokemon.costumes?.find((entry) => entry.name === costume)
    : undefined;
  if (costume && !matchingCostume) {
    return 'The selected costume is not available for this Pokémon.';
  }

  const costumeId = normalizeCostumeId(matchingCostume?.costume_id);
  if (!backgroundMatchesCostume(background, costumeId)) {
    return 'The selected background and costume do not form a valid Pokémon combination.';
  }

  return null;
};

export const buildPokemonSearchQueryParams = ({
  matchingPokemon,
  costume,
  isShiny,
  isShadow,
  selectedMoves,
  selectedGender,
  selectedBackgroundId,
  ivs,
  onlyMatchingTrades,
  prefLucky,
  friendshipLevel,
  alreadyRegistered,
  tradeInWantedList,
  coordinates,
  ownershipMode,
  range,
  resultsLimit,
  dynamax,
  gigantamax,
}: BuildQueryArgs): PokemonSearchQueryParams => {
  const matchingCostume = matchingPokemon.costumes?.find(
    (entry) => entry.name === costume,
  );

  const queryParams: PokemonSearchQueryParams = {
    pokemon_id: matchingPokemon.pokemon_id,
    shiny: isShiny,
    shadow: isShadow,
    costume_id: matchingCostume?.costume_id ?? null,
    fast_move_id: selectedMoves.fastMove,
    charged_move_1_id: selectedMoves.chargedMove1,
    charged_move_2_id: selectedMoves.chargedMove2,
    gender: selectedGender === 'Any' ? null : selectedGender,
    background_id: selectedBackgroundId,
    attack_iv: toNullableNumber(ivs.Attack),
    defense_iv: toNullableNumber(ivs.Defense),
    stamina_iv: toNullableNumber(ivs.Stamina),
    only_matching_trades: onlyMatchingTrades ? true : null,
    pref_lucky: prefLucky ? true : null,
    friendship_level: friendshipLevel,
    already_registered: alreadyRegistered ? true : null,
    trade_in_wanted_list: tradeInWantedList ? true : null,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    ownership: toOwnershipApiValue(ownershipMode),
    range_km: range,
    limit: resultsLimit,
    dynamax,
    gigantamax,
  };

  if (!isCaughtOwnershipMode(ownershipMode)) {
    queryParams.attack_iv = null;
    queryParams.defense_iv = null;
    queryParams.stamina_iv = null;
  }

  if (ownershipMode !== 'trade') {
    queryParams.only_matching_trades = null;
  }

  if (ownershipMode !== 'wanted') {
    queryParams.pref_lucky = null;
    queryParams.friendship_level = null;
    queryParams.already_registered = null;
    queryParams.trade_in_wanted_list = null;
  }

  return queryParams;
};

export const preparePokemonSearchQuery = ({
  pokemon,
  selectedForm,
  isShiny,
  isShadow,
  costume,
  selectedMoves,
  selectedGender,
  selectedBackgroundId,
  dynamax,
  gigantamax,
  city,
  useCurrentLocation,
  ownershipMode,
  coordinates,
  range,
  resultsLimit,
  ivs,
  onlyMatchingTrades,
  prefLucky,
  friendshipLevel,
  alreadyRegistered,
  tradeInWantedList,
  pokemonCache,
}: PreparePokemonSearchQueryArgs): PreparedPokemonSearchQuery => {
  const inputError = validateSearchInput({
    isShadow,
    ownershipMode,
    pokemon,
    useCurrentLocation,
    city,
    coordinates,
    pokemonCache,
  });
  if (inputError) {
    return {
      ok: false,
      errorMessage: inputError,
      shouldExpandSearchBar: false,
    };
  }

  const matchingPokemon = findMatchingPokemonVariant(
    pokemonCache as PokemonVariant[],
    pokemon,
    selectedForm,
  );
  if (!matchingPokemon) {
    return {
      ok: false,
      errorMessage: 'No matching Pokemon found in the default list.',
      shouldExpandSearchBar: true,
    };
  }

  const backgroundCostumeError = validateBackgroundCostumePair(
    matchingPokemon,
    costume,
    selectedBackgroundId,
  );
  if (backgroundCostumeError) {
    return {
      ok: false,
      errorMessage: backgroundCostumeError,
      shouldExpandSearchBar: true,
    };
  }

  return {
    ok: true,
    queryParams: buildPokemonSearchQueryParams({
      matchingPokemon,
      costume,
      isShiny,
      isShadow,
      selectedMoves,
      selectedGender,
      selectedBackgroundId,
      ivs,
      onlyMatchingTrades,
      prefLucky,
      friendshipLevel,
      alreadyRegistered,
      tradeInWantedList,
      coordinates,
      ownershipMode,
      range,
      resultsLimit,
      dynamax,
      gigantamax,
    }),
  };
};
