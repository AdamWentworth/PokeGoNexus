import type { OwnershipMode } from '@pokemongonexus/shared-contracts/domain';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import type { PokemonSearchQueryParams } from '@pokemongonexus/shared-contracts/search';
import { resolvePokemonInstanceImagePath } from '@pokemongonexus/shared-domain/pokemon-display';

export type NativePokemonSearchDraft = {
  pokemonId: number | null;
  pokemonName: string;
  form: string | null;
  shiny: boolean;
  shadow: boolean;
  costumeId: number | null;
  gender: string | null;
  backgroundId: number | null;
  dynamax: boolean;
  gigantamax: boolean;
  fastMoveId: number | null;
  chargedMove1Id: number | null;
  chargedMove2Id: number | null;
  ownership: OwnershipMode;
  city: string;
  useCurrentLocation: boolean;
  latitude: number | null;
  longitude: number | null;
  rangeKm: number;
  limit: number;
  attackIv: number | null;
  defenseIv: number | null;
  staminaIv: number | null;
  onlyMatchingTrades: boolean;
  prefLucky: boolean;
  friendshipLevel: number;
  alreadyRegistered: boolean;
  tradeInWantedList: boolean;
};

export type NativePokemonSearchPrepared =
  | { ok: true; query: PokemonSearchQueryParams }
  | { ok: false; message: string; section: 'pokemon' | 'location' | 'matching' };

export const createNativePokemonSearchDraft = ({
  city = '',
  latitude = null,
  longitude = null,
}: {
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
} = {}): NativePokemonSearchDraft => ({
  pokemonId: null,
  pokemonName: '',
  form: null,
  shiny: false,
  shadow: false,
  costumeId: null,
  gender: null,
  backgroundId: null,
  dynamax: false,
  gigantamax: false,
  fastMoveId: null,
  chargedMove1Id: null,
  chargedMove2Id: null,
  ownership: 'caught',
  city: city ?? '',
  useCurrentLocation: false,
  latitude,
  longitude,
  rangeKm: 5,
  // Vite treats five results as the untouched/default Search state. Keeping
  // native on the same baseline prevents a fresh mobile search from doing
  // four times the work and from silently changing the result set.
  limit: 5,
  attackIv: null,
  defenseIv: null,
  staminaIv: null,
  onlyMatchingTrades: false,
  prefLucky: false,
  friendshipLevel: 0,
  alreadyRegistered: false,
  tradeInWantedList: false,
});

export type NativePokemonSearchGender = 'Any' | 'Male' | 'Female' | 'Genderless';

/** Matches the gender choices and automatic single-gender selection used by Vite Search. */
export const nativePokemonSearchGenderOptions = (
  pokemon: Pick<BasePokemon, 'gender_rate'> | null,
): NativePokemonSearchGender[] => {
  const rate = String(pokemon?.gender_rate ?? '').trim().toLocaleUpperCase();
  if (!rate) return [];
  if (rate === 'GENDERLESS' || rate === 'NONE') return ['Genderless'];
  if (rate === 'M/M') return ['Male'];
  if (rate === 'F/F') return ['Female'];
  if (rate === 'M/F' || rate === 'F/M') return ['Any', 'Male', 'Female'];

  const [maleRate, femaleRate, genderlessRate] = rate
    .split('_')
    .map((value) => Number.parseInt(value, 10) || 0);
  if (genderlessRate === 100) return ['Genderless'];
  if (maleRate > 0 && femaleRate > 0) return ['Any', 'Male', 'Female'];
  if (maleRate > 0) return ['Male'];
  if (femaleRate > 0) return ['Female'];
  return [];
};

export const normalizeNativePokemonSelection = (
  draft: NativePokemonSearchDraft,
  pokemon: BasePokemon,
): NativePokemonSearchDraft => {
  const genderOptions = nativePokemonSearchGenderOptions(pokemon);
  return {
    ...draft,
    pokemonId: pokemon.pokemon_id,
    pokemonName: pokemon.name,
    form: pokemon.form || null,
    costumeId: null,
    gender: genderOptions.includes('Any') ? null : genderOptions[0] ?? null,
    backgroundId: null,
    dynamax: false,
    gigantamax: false,
    fastMoveId: null,
    chargedMove1Id: null,
    chargedMove2Id: null,
  };
};

export const setNativePokemonSearchMaxMode = (
  draft: NativePokemonSearchDraft,
  mode: 'standard' | 'dynamax' | 'gigantamax',
): NativePokemonSearchDraft => ({
  ...draft,
  dynamax: mode === 'dynamax',
  gigantamax: mode === 'gigantamax',
  ...(mode === 'standard' ? {} : {
    shadow: false,
    costumeId: null,
    backgroundId: null,
  }),
});

export const setNativePokemonSearchOwnership = (
  draft: NativePokemonSearchDraft,
  ownership: OwnershipMode,
): NativePokemonSearchDraft => ({
  ...draft,
  ownership,
  ...(ownership === 'caught' ? {} : {
    attackIv: null,
    defenseIv: null,
    staminaIv: null,
  }),
  ...(ownership === 'trade' ? {} : { onlyMatchingTrades: false }),
  ...(ownership === 'wanted' ? {} : {
    prefLucky: false,
    friendshipLevel: 0,
    alreadyRegistered: false,
    tradeInWantedList: false,
  }),
});

export const selectNativePokemonSearchBackground = (
  draft: NativePokemonSearchDraft,
  pokemon: BasePokemon,
  backgroundId: number | null,
): { draft: NativePokemonSearchDraft; notice: string | null } => {
  if (backgroundId == null) {
    return { draft: { ...draft, backgroundId: null }, notice: null };
  }
  const background = pokemon.backgrounds?.find(
    (candidate) => Number(candidate.background_id) === Number(backgroundId),
  );
  if (!background) return { draft, notice: null };
  const requiredCostume = background.costume_id ?? null;
  const costume = requiredCostume == null
    ? null
    : pokemon.costumes?.find((candidate) => candidate.costume_id === requiredCostume) ?? null;
  if (requiredCostume != null && !costume) {
    return {
      draft,
      notice: 'This background’s required costume is unavailable.',
    };
  }
  const costumeName = costume?.name?.trim() || null;
  const changed = draft.costumeId !== requiredCostume;
  return {
    draft: {
      ...draft,
      backgroundId: background.background_id,
      costumeId: requiredCostume,
      ...(requiredCostume == null ? {} : { dynamax: false, gigantamax: false }),
    },
    notice: changed
      ? costumeName
        ? `Costume set to ${costumeName} to match ${background.name}.`
        : `Costume removed because ${background.name} requires no costume.`
      : null,
  };
};

export const nativePokemonSearchPreviewImage = (
  draft: NativePokemonSearchDraft,
  pokemon: BasePokemon | null,
): string | null => pokemon ? resolvePokemonInstanceImagePath({
  pokemon_id: pokemon.pokemon_id,
  shiny: draft.shiny,
  shadow: draft.shadow,
  costume_id: draft.costumeId,
  gender: draft.gender,
  dynamax: draft.dynamax,
  gigantamax: draft.gigantamax,
}, pokemon) : null;

export const prepareNativePokemonSearch = (
  draft: NativePokemonSearchDraft,
  pokemon: BasePokemon | null,
): NativePokemonSearchPrepared => {
  if (!pokemon || draft.pokemonId == null) {
    return { ok: false, message: 'Choose a Pokémon to search for.', section: 'pokemon' };
  }
  if (draft.shadow && draft.ownership !== 'caught') {
    return {
      ok: false,
      message: 'Shadow Pokémon cannot be listed For Trade or Wanted.',
      section: 'pokemon',
    };
  }
  if (!Number.isFinite(draft.latitude) || !Number.isFinite(draft.longitude)) {
    return {
      ok: false,
      message: 'Choose a location before searching.',
      section: 'location',
    };
  }
  if (draft.backgroundId != null) {
    const background = pokemon.backgrounds?.find(
      (candidate) => Number(candidate.background_id) === Number(draft.backgroundId),
    );
    const requiredCostumeExists = background?.costume_id == null
      || pokemon.costumes?.some((costume) => costume.costume_id === background.costume_id);
    if (!background || !requiredCostumeExists || (background.costume_id ?? null) !== draft.costumeId) {
      return {
        ok: false,
        message: 'The selected background and costume are not a valid combination.',
        section: 'pokemon',
      };
    }
  }

  const query: PokemonSearchQueryParams = {
    pokemon_id: draft.pokemonId,
    shiny: draft.shiny,
    shadow: draft.shadow,
    costume_id: draft.costumeId,
    fast_move_id: draft.fastMoveId,
    charged_move_1_id: draft.chargedMove1Id,
    charged_move_2_id: draft.chargedMove2Id,
    gender: draft.gender,
    background_id: draft.backgroundId,
    attack_iv: draft.ownership === 'caught' ? draft.attackIv : null,
    defense_iv: draft.ownership === 'caught' ? draft.defenseIv : null,
    stamina_iv: draft.ownership === 'caught' ? draft.staminaIv : null,
    only_matching_trades: draft.ownership === 'trade' && draft.onlyMatchingTrades
      ? true
      : null,
    pref_lucky: draft.ownership === 'wanted' && draft.prefLucky ? true : null,
    friendship_level: draft.ownership === 'wanted' ? draft.friendshipLevel : null,
    already_registered: draft.ownership === 'wanted' && draft.alreadyRegistered
      ? true
      : null,
    trade_in_wanted_list: draft.ownership === 'wanted' && draft.tradeInWantedList
      ? true
      : null,
    latitude: draft.latitude,
    longitude: draft.longitude,
    ownership: draft.ownership,
    range_km: Math.max(1, Math.min(25, Math.round(draft.rangeKm))),
    limit: Math.max(5, Math.min(100, Math.round(draft.limit / 5) * 5)),
    dynamax: draft.dynamax,
    gigantamax: draft.gigantamax,
  };
  return { ok: true, query };
};

export const countNativePokemonSearchFilters = (
  draft: NativePokemonSearchDraft,
): number => [
  draft.shiny,
  draft.shadow,
  draft.costumeId != null,
  Boolean(draft.form),
  draft.gender != null,
  draft.backgroundId != null,
  draft.dynamax,
  draft.gigantamax,
  draft.fastMoveId != null,
  draft.chargedMove1Id != null,
  draft.chargedMove2Id != null,
  draft.rangeKm !== 5,
  draft.limit !== 5,
  draft.attackIv != null,
  draft.defenseIv != null,
  draft.staminaIv != null,
  draft.onlyMatchingTrades,
  draft.prefLucky,
  draft.friendshipLevel > 0,
  draft.alreadyRegistered,
  draft.tradeInWantedList,
].filter(Boolean).length;
