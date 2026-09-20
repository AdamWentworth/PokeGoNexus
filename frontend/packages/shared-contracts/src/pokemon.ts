export const pokemonContract = {
  endpoints: {
    manifest: '/manifest',
    pokemons: '/pokemons',
    catalog: '/catalog',
    pokedex: '/pokedex',
    moves: '/moves',
    raidData: '/raid-data',
    maxData: '/max-data',
    pvpData: '/pvp-data',
  },
} as const;

export interface PokemonCatalogChunkManifest {
  name: string;
  endpoint: string;
  contentType: string;
  etag: string;
  version: string;
  bytesJson: number;
  bytesGzip: number;
}

export interface PokemonCatalogManifest {
  schemaVersion: number;
  catalogVersion: string;
  generatedAt: string;
  chunks: {
    pokemonFull: PokemonCatalogChunkManifest;
    catalog?: PokemonCatalogChunkManifest;
    pokedex?: PokemonCatalogChunkManifest;
    moves?: PokemonCatalogChunkManifest;
    raidData?: PokemonCatalogChunkManifest;
    maxData?: PokemonCatalogChunkManifest;
    pvpData?: PokemonCatalogChunkManifest;
    [key: string]: PokemonCatalogChunkManifest | undefined;
  };
}

export interface PokemonPokedexSpecies {
  pokemon_id: number;
  name: string;
  pokedex_number: number;
  image_url: string | null;
  gender_rate: string | null;
  form: string | null;
  generation: number;
  available: boolean | number;
}

export type PokemonPokedexSpeciesChunk = PokemonPokedexSpecies[];

export type PokemonPvPLeagueKey = 'great' | 'ultra' | 'master';

export interface PokemonPvPRankingMove {
  id: string;
  name: string;
  type: string;
  kind: 'fast' | 'charged';
  power?: number;
  energyGain?: number;
  energyCost?: number;
  turns?: number;
  buff?: PokemonPvPMoveBuff;
}

export interface PokemonPvPMoveBuff {
  attackerAttack: number;
  attackerDefense: number;
  targetAttack: number;
  targetDefense: number;
  chance: number;
}

export interface PokemonPvPRankingMatchup {
  speciesId: string;
  rating: number;
}

export interface PokemonPvPRankingMoveUsage extends PokemonPvPRankingMove {
  uses: number;
}

export interface PokemonPvPRankingEntry {
  rank: number;
  sourceRank: number;
  speciesId: string;
  name: string;
  pokemonId?: number;
  fusionId?: number;
  variantKind: 'pokemon' | 'shadow' | 'fusion' | 'crown';
  imageUrl: string;
  types: string[];
  moveset: PokemonPvPRankingMove[];
  score: number;
  rating: number;
  categoryScores: number[];
  matchups: PokemonPvPRankingMatchup[];
  counters: PokemonPvPRankingMatchup[];
  moveUsage: PokemonPvPRankingMoveUsage[];
  recommendedLevel: number;
  attackIv: number;
  defenseIv: number;
  staminaIv: number;
  statProduct?: number;
  battleAttack?: number;
  battleDefense?: number;
  battleHp?: number;
}

export interface PokemonPvPLeague {
  key: PokemonPvPLeagueKey;
  label: string;
  cpLimit: number | null;
  entries: PokemonPvPRankingEntry[];
}

export type PokemonPvPBattleMechanics =
  | 'pvpoke-legacy'
  | 'current-2026';

export interface PokemonPvPFormat {
  key: string;
  label: string;
  league: 'little' | PokemonPvPLeagueKey;
  cup: string;
  cpLimit: number | null;
  rules: string[];
  mechanics?: PokemonPvPBattleMechanics;
  entries: PokemonPvPRankingEntry[];
}

export interface PokemonPvPRankingsPayload {
  source: {
    name: string;
    version: string;
    url: string;
    license: string;
    importedAt: string;
    metadata: Record<string, unknown>;
  } | null;
  leagues: Record<PokemonPvPLeagueKey, PokemonPvPLeague>;
  formats?: PokemonPvPFormat[];
}

export interface PokemonPvPBattleFighter {
  id: string;
  name: string;
  types: string[];
  attack: number;
  defense: number;
  hp: number;
  shadow: boolean;
  fastMove: PokemonPvPRankingMove;
  chargedMoves: PokemonPvPRankingMove[];
}

export interface PokemonPvPBattleRequest {
  mechanics: PokemonPvPBattleMechanics;
  fighters: [PokemonPvPBattleFighter, PokemonPvPBattleFighter];
  shields: [number, number];
  startingEnergy: [number, number];
  recordTimeline?: boolean;
}

export interface PokemonPvPBattleCombatantResult {
  hp: number;
  maxHp: number;
  energy: number;
  shields: number;
  startShields: number;
  attackStage: number;
  defenseStage: number;
}

export interface PokemonPvPBattleEvent {
  turn: number;
  actor: number;
  kind: 'fast' | 'charged' | 'wait';
  moveId: string;
  damage: number;
  shielded: boolean;
  buffed: boolean;
}

export interface PokemonPvPBattleResponse {
  mechanics: PokemonPvPBattleMechanics;
  winner: number;
  turns: number;
  timeMs: number;
  ratings: [number, number];
  adjustedRatings: [number, number];
  fighters: [
    PokemonPvPBattleCombatantResult,
    PokemonPvPBattleCombatantResult,
  ];
  timeline: PokemonPvPBattleEvent[];
}

export interface PokemonPvPRosterEvaluationOpponent {
  fighter: PokemonPvPBattleFighter;
  weight: number;
}

export interface PokemonPvPRosterEvaluationRequest {
  mechanics: PokemonPvPBattleMechanics;
  candidates: PokemonPvPBattleFighter[];
  opponents: PokemonPvPRosterEvaluationOpponent[];
}

export interface PokemonPvPRosterEvaluationResult {
  fighterId: string;
  score: number;
  categoryScores: [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
}

export interface PokemonPvPRosterEvaluationResponse {
  mechanics: PokemonPvPBattleMechanics;
  fieldSize: number;
  results: PokemonPvPRosterEvaluationResult[];
}

export interface PokemonMovesChunkEntry {
  pokemon_id: number;
  moves: Move[];
  fusion: Array<Pick<Fusion, 'fusion_id' | 'moves'>>;
  crownForms: Array<Pick<CrownForm, 'id' | 'moves'>>;
}

export type PokemonMovesChunk = PokemonMovesChunkEntry[];

export interface PokemonRaidDataChunkEntry {
  pokemon_id: number;
  raid_boss: RaidBoss[];
}

export type PokemonRaidDataChunk = PokemonRaidDataChunkEntry[];

export interface Costume {
  costume_id: number;
  date_available: string;
  date_shiny_available: string | null;
  image_url?: string;
  image_url_female?: string;
  image_url_shiny?: string;
  image_url_shiny_female?: string | null;
  name: string;
  shadow_costume?: ShadowCostume | null;
  shiny_available: boolean | number;
}

export type ShadowCostume = {
  date_available: string;
  date_shiny_available: string;
  image_url_shadow_costume?: string;
  image_url_female_shadow_costume?: string;
  image_url_shiny_shadow_costume?: string;
  image_url_female_shiny_shadow_costume?: string;
};

export interface MegaEvolution {
  attack?: number;
  cp40?: number;
  cp50?: number;
  date_available: string;
  defense?: number;
  form?: string | null;
  id: number;
  image_url?: string;
  image_url_shiny?: string;
  mega_energy_cost: number;
  primal?: boolean | null;
  sprite_url?: string | null;
  stamina?: number;
  type1_name: string;
  type2_name?: string;
  type_1_id: number;
  type_2_id?: number;
  variantType?: string;
  female_data?: FemaleVariantData;
  costumes?: Costume[];
}

export interface CrownForm {
  id: number;
  base_pokemon_id: number;
  crown_pokemon_id: number;
  display_form: string;
  name: string;
  form?: string | null;
  image_url?: string;
  image_url_shiny?: string;
  sprite_url?: string | null;
  attack?: number;
  defense?: number;
  stamina?: number;
  type_1_id: number;
  type_2_id?: number;
  type1_name?: string;
  type2_name?: string;
  date_available?: string | null;
  date_shiny_available?: string | null;
  cp40?: number;
  cp50?: number;
  moves?: Move[];
}

export interface Fusion {
  date_available: string;
  base_pokemon_id1: number;
  base_pokemon_id2: number;
  attack?: number;
  defense?: number;
  stamina?: number;
  type_1_id: number;
  type_2_id?: number;
  type1_name: string;
  type2_name: string;
  image_url?: string;
  image_url_shiny?: string;
  name: string;
  fusion_id?: number | null;
  moves?: Move[];
  backgrounds?: VariantBackground[];
  background_combo_rules?: FusionBackgroundComboRule[];
}

export interface FusionBackgroundComboRule {
  member1_background_id: number;
  member2_background_id: number;
  combo_background_id: number;
  combo_background_name?: string;
  combo_background_location?: string;
  combo_background_image_url?: string;
  combo_background_date?: string;
}

export interface MaxForm {
  pokemon_id: number;
  dynamax: boolean | number;
  gigantamax: boolean | number;
  dynamax_release_date: string | null;
  gigantamax_release_date: string | null;
  gigantamax_image_url?: string | null;
  shiny_gigantamax_image_url?: string | null;
  gigantamax_move_name?: string | null;
  gigantamax_move_type_id?: number | null;
  gigantamax_move_type?: string | null;
}

export interface FemaleVariantData {
  pokemon_id: number;
  image_url: string;
  shadow_image_url: string;
  shiny_image_url: string;
  shiny_shadow_image_url: string;
}

export interface VariantBackground {
  background_id: number;
  image_url: string;
  name: string;
  costume_id: number | null;
  date: string;
  location: string;
}

export interface RaidBoss {
  id: number;
  pokemon_id: number;
  name: string;
  form: string;
  type: string;
  boosted_weather: string;
  max_boosted_cp: number;
  max_unboosted_cp: number;
  min_boosted_cp: number;
  min_unboosted_cp: number;
  possible_shiny: number;
  tier: string;
  costume_id?: number | null;
  shield_count?: number | null;
}

export interface MaxBattleProfile {
  profile_id: number;
  pokemon_id: number;
  variant_kind: 'dynamax' | 'gigantamax' | 'special';
  form: string | null;
  tier: 'one-star' | 'two-star' | 'three-star' | 'legendary' | 'gigantamax';
  label: string;
  kind: 'standard' | 'legendary' | 'gigantamax';
  boss_hp: number;
  default_trainers: number;
  max_trainers: number;
  battle_seconds: number;
  enrage_seconds: number;
  subgroup_size: number;
  meter_orb_energy: number;
  starts_at: string | null;
  ends_at: string | null;
  is_default: boolean | 0 | 1;
  priority: number;
  source_name: string | null;
  source_url: string | null;
  notes: string | null;
}

export interface Move {
  move_id: number;
  name: string;
  type_id: number;
  raid_power: number;
  pvp_power: number;
  raid_energy: number;
  pvp_energy: number;
  raid_cooldown: number;
  pvp_turns: number;
  pvp_attacker_attack_stage_change?: number;
  pvp_attacker_defense_stage_change?: number;
  pvp_target_attack_stage_change?: number;
  pvp_target_defense_stage_change?: number;
  pvp_buff_activation_chance?: number;
  is_fast: number;
  type_name: string;
  legacy: boolean;
  fusion_id?: number | null;
  shadow?: number | null;
  purified?: number | null;
  apex?: number | null;
  type: string;
}

export interface BasePokemon {
  pokemon_id: number;
  name: string;
  pokedex_number: number;
  attack: number;
  defense: number;
  stamina: number;
  type_1_id: number;
  type_2_id: number;
  gender_rate: string;
  rarity: string;
  form: string | null;
  generation: number;
  available: number;
  shiny_available: number;
  shiny_rarity: string | null;
  date_available: string;
  date_shiny_available: string;
  female_unique: number;
  type1_name: string;
  type2_name: string;
  shadow_shiny_available: number;
  shadow_apex: string | null;
  date_shadow_available: string;
  date_shiny_shadow_available: string;
  shiny_shadow_rarity: string | null;
  image_url: string;
  image_url_shadow: string;
  image_url_shiny: string;
  image_url_shiny_shadow: string;
  type_1_icon: string;
  type_2_icon: string;
  female_data?: FemaleVariantData;
  costumes: Costume[];
  moves: Move[];
  fusion: Fusion[];
  backgrounds: VariantBackground[];
  cp40: number;
  cp50: number;
  evolutionData?: {
    evolves_to?: number[];
    evolves_from?: number[];
  };
  evolves_to?: number[];
  evolves_from: number[];
  megaEvolutions: MegaEvolution[];
  crownForms?: CrownForm[];
  raid_boss: RaidBoss[];
  max_battle_profiles?: MaxBattleProfile[];
  sizes: {
    pokedex_height: number;
    pokedex_weight: number;
    height_standard_deviation: number;
    weight_standard_deviation: number;
    height_xxs_threshold: number;
    height_xs_threshold: number;
    height_xl_threshold: number;
    height_xxl_threshold: number;
    weight_xxs_threshold: number;
    weight_xs_threshold: number;
    weight_xl_threshold: number;
    weight_xxl_threshold: number;
  };
  max: MaxForm[];
  sprite_url: string | null;
}

export type Pokemons = BasePokemon[];
