export type PokemonMaxMoveValue = string | number | null;

export type PokemonSizeClass = 'XXS' | 'XS' | 'XL' | 'XXL';

export interface WantedSizeRange {
  category: PokemonSizeClass;
  min: number | null;
  max: number | null;
  min_inclusive: boolean;
  max_inclusive: boolean;
}

export interface WantedSizePreferences {
  weight: WantedSizeRange | null;
  height: WantedSizeRange | null;
}

export interface PokemonInstance {
  // identity
  instance_id?: string;
  variant_id: string;
  user_id?: string;
  pokemon_id: number;
  nickname: string | null;

  // stats and IVs
  cp: number | null;
  level: number | null;
  attack_iv: number | null;
  defense_iv: number | null;
  stamina_iv: number | null;

  // appearance and forms
  shiny: boolean;
  costume_id: number | null;

  // shadow and purification state
  lucky: boolean;
  shadow: boolean;
  purified: boolean;

  // moves
  fast_move_id: number | null;
  charged_move1_id: number | null;
  charged_move2_id: number | null;

  // physical attributes
  weight: number | null;
  height: number | null;
  gender: string | null;

  // mega, dynamax, and crown
  mega: boolean;
  mega_form: string | null;
  is_mega: boolean;
  dynamax: boolean;
  gigantamax: boolean;
  crown: boolean;
  max_attack: PokemonMaxMoveValue;
  max_guard: PokemonMaxMoveValue;
  max_spirit: PokemonMaxMoveValue;

  // fusion
  is_fused: boolean;
  fusion: Record<string, unknown> | null;
  fusion_form: string | null;
  fused_with: string | null;

  // provenance and trade flags
  is_traded: boolean;
  traded_date: string | null;
  original_trainer_id: string | null;
  original_trainer_name: string | null;

  // ownership state and tags
  is_caught: boolean;
  is_for_trade: boolean;
  is_wanted: boolean;
  most_wanted: boolean;
  caught_tags: string[] | null;
  trade_tags: string[] | null;
  wanted_tags: string[] | null;
  not_trade_list: Record<string, unknown> | null;
  not_wanted_list: Record<string, unknown> | null;
  trade_filters: Record<string, unknown> | null;
  wanted_filters: Record<string, unknown> | null;
  wanted_size_preferences?: WantedSizePreferences | null;

  // misc flags
  mirror: boolean;
  pref_lucky: boolean;
  friendship_level: number | null;
  registered: boolean;
  favorite: boolean;
  disabled: boolean;
  trace_id?: string | null;

  // timestamps and location
  pokeball: string | null;
  location_card: string | null;
  location_caught: string | null;
  date_caught: string | null;
  date_added: string;
  last_update: number;

  // optional convenience props used by clients
  username?: string;
  gps?: string | null;

  [key: string]: unknown;
}

export type InstancesMap = Record<string, PokemonInstance>;
