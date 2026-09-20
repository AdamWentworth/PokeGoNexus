import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';

const species = (id: number, name: string, patch: Partial<BasePokemon> = {}): BasePokemon => ({
  pokemon_id: id, pokedex_number: id, name, image_url: '/images/base.png', image_url_shiny: '/images/shiny.png',
  date_available: '2000-01-01', shiny_available: true, date_shiny_available: '2000-01-01',
  type1_name: 'Dragon', moves: [], fusion: [], megaEvolutions: [], costumes: [], crownForms: [], ...patch,
} as unknown as BasePokemon);

export const formCatalog: BasePokemon[] = [
  species(6, 'Charizard', { megaEvolutions: [
    { id: 1, form: 'X', date_available: '2000-01-01', image_url: '/images/mega.png', image_url_shiny: '/images/mega-shiny.png', type1_name: 'Fire' },
    { id: 2, form: 'Y', date_available: '2000-01-01', image_url: '/images/mega-y.png', type1_name: 'Fire' },
  ] as BasePokemon['megaEvolutions'] }),
  species(383, 'Groudon', { megaEvolutions: [
    { id: 3, primal: true, date_available: '2000-01-01', image_url: '/images/primal.png', type1_name: 'Ground' },
  ] as BasePokemon['megaEvolutions'] }),
  species(646, 'Kyurem', { fusion: [
    { fusion_id: 1, name: 'Black Kyurem', base_pokemon_id1: 646, base_pokemon_id2: 644, image_url: '/images/fusion.png', image_url_shiny: '/images/shiny-fusion.png', type1_name: 'Dragon' },
  ] as BasePokemon['fusion'] }),
  species(644, 'Zekrom'),
];

export const caughtCopy = (id: string, pokemonId: number, patch: Partial<PokemonInstance> = {}): PokemonInstance => ({
  instance_id: id, pokemon_id: pokemonId, variant_id: `${String(pokemonId).padStart(4, '0')}-default`,
  nickname: null, costume_id: null, lucky: false, shadow: false, purified: false,
  fast_move_id: 1, charged_move1_id: 2, charged_move2_id: null, weight: 200, height: 2, gender: 'Male',
  mega_form: null, dynamax: false, gigantamax: false, crown: false,
  max_attack: null, max_guard: null, max_spirit: null, fusion: null, fusion_form: null,
  is_traded: false, traded_date: null, original_trainer_id: null, original_trainer_name: null,
  most_wanted: false, trade_tags: [], not_trade_list: {}, not_wanted_list: {}, trade_filters: {}, wanted_filters: {},
  mirror: false, pref_lucky: false, friendship_level: null, registered: true,
  pokeball: 'poke_ball', location_card: null, location_caught: 'Vancouver', date_caught: '2025-06-01',
  is_caught: true, is_for_trade: false, is_wanted: false, is_fused: false, fused_with: null,
  is_mega: false, mega: false, shiny: false, cp: 3210, level: 40, attack_iv: 15, defense_iv: 14, stamina_iv: 13,
  favorite: true, caught_tags: ['old-tag'], wanted_tags: [], disabled: false, last_update: 500,
  ...patch,
} as PokemonInstance);
