// src/features/instances/utils/createNewInstanceData.ts
import { getKeyParts } from '@/utils/PokemonIDUtils';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant  } from '@/types/pokemonVariants';

export function createNewInstanceData(variant: PokemonVariant): PokemonInstance {
  const keyParts       = getKeyParts(variant.variant_id);
  const matchedCostume = variant.costumes?.find(c => c.name === keyParts.costumeName);
  const costumeId      = matchedCostume ? matchedCostume.costume_id : null;

  return {
    instance_id: undefined,
    variant_id : variant.variant_id,
    pokemon_id : variant.pokemon_id,
    nickname   : null,
    gender     : null,

    cp        : null,
    attack_iv : null,
    defense_iv: null,
    stamina_iv: null,
    level     : null,
    weight    : null,
    height    : null,

    shiny     : !!keyParts.isShiny,
    costume_id: costumeId,

    lucky   : false,
    shadow  : !!keyParts.isShadow,
    purified: false,

    fast_move_id    : null,
    charged_move1_id: null,
    charged_move2_id: null,

    pokeball       : null,
    location_card  : null,
    location_caught: null,
    date_caught    : null,
    date_added     : new Date().toISOString(),
    last_update    : Date.now(),          // number per interface
    disabled       : false,

    is_traded            : false,
    traded_date          : null,
    original_trainer_id  : null,
    original_trainer_name: null,

    is_caught    : false,
    is_for_trade : false,
    is_wanted    : false,
    most_wanted  : false,
    caught_tags  : [],
    trade_tags   : [],
    wanted_tags  : [],
    not_trade_list : {},
    not_wanted_list: {},
    trade_filters  : {},
    wanted_filters : {},
    wanted_size_preferences: null,

    mirror    : false,
    pref_lucky: false,
    friendship_level: null,
    registered: false,
    favorite  : false,

    mega      : false,
    mega_form : null,
    is_mega   : false,            // ← was null; make it boolean
    dynamax   : false,
    gigantamax: false,
    crown     : false,
    max_attack: null,
    max_guard : null,
    max_spirit: null,

    is_fused   : false,
    fusion     : {},
    fusion_form: null,
    fused_with : null,

    gps: null,
  };
}
