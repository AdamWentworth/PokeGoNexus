import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import {
  buildNativePvpIvPokemonOptions,
  nativePvpIvOptionImage,
  resolveNativePvpIvOptionForInstance,
} from '../../../src/features/tools/nativePvpIvPokemon';

const catalog = [{
  pokemon_id: 888,
  name: 'Zacian',
  pokedex_number: 888,
  attack: 254,
  defense: 236,
  stamina: 192,
  type1_name: 'Fairy',
  type2_name: '',
  image_url: '/zacian.png',
  image_url_shiny: '/zacian-shiny.png',
  fusion: [{
    fusion_id: 91,
    base_pokemon_id1: 888,
    base_pokemon_id2: 889,
    name: 'Zacian Shield Fusion',
    attack: 300,
    defense: 270,
    stamina: 210,
    type1_name: 'Fairy',
    type2_name: 'Steel',
    image_url: '/fusion.png',
    image_url_shiny: '/fusion-shiny.png',
  }],
  crownForms: [{
    id: 44,
    base_pokemon_id: 888,
    crown_pokemon_id: 2288,
    display_form: 'Crowned Sword',
    name: 'Zacian',
    attack: 332,
    defense: 240,
    stamina: 192,
    type_1_id: 18,
    type1_name: 'Fairy',
    type2_name: 'Steel',
    image_url: '/crowned.png',
    image_url_shiny: '/crowned-shiny.png',
  }],
}] as BasePokemon[];

const instance = (patch: Partial<PokemonInstance>): PokemonInstance => ({
  instance_id: 'owned-zacian',
  variant_id: '0888-default',
  pokemon_id: 888,
  is_caught: true,
  disabled: false,
  shiny: false,
  crown: false,
  is_fused: false,
  fusion: null,
  fusion_form: null,
  ...patch,
} as PokemonInstance);

describe('native PvP IV Pokémon options', () => {
  it('keeps base, fusion, and crowned forms as distinct stat evaluations', () => {
    const options = buildNativePvpIvPokemonOptions(catalog);

    expect(options.map((option) => [option.kind, option.name])).toEqual(expect.arrayContaining([
      ['base', 'Zacian'],
      ['crown', 'Crowned Sword Zacian'],
      ['fusion', 'Zacian Shield Fusion'],
    ]));
    expect(options.find((option) => option.kind === 'crown')?.evaluationPokemon.attack).toBe(332);
    expect(options.find((option) => option.kind === 'fusion')?.evaluationPokemon.defense).toBe(270);
  });

  it('resolves an owned special form without falling back to the base species', () => {
    const options = buildNativePvpIvPokemonOptions(catalog);
    const crowned = resolveNativePvpIvOptionForInstance(
      instance({ crown: true, fusion_form: 'Crowned Sword', shiny: true }),
      catalog[0],
      options,
    );
    const fused = resolveNativePvpIvOptionForInstance(
      instance({
        is_fused: true,
        fusion: { fusion_id: 91 },
        fusion_form: 'Zacian Shield Fusion',
      }),
      catalog[0],
      options,
    );

    expect(crowned?.kind).toBe('crown');
    expect(crowned && nativePvpIvOptionImage(crowned, true)).toBe('/crowned-shiny.png');
    expect(fused?.kind).toBe('fusion');
    expect(fused?.name).toBe('Zacian Shield Fusion');
  });

  it('rejects a flagged special form when its exact form cannot be resolved', () => {
    const options = buildNativePvpIvPokemonOptions(catalog);
    expect(resolveNativePvpIvOptionForInstance(
      instance({ is_fused: true, fusion_form: 'Unknown Fusion' }),
      catalog[0],
      options,
    )).toBeUndefined();
  });
});
