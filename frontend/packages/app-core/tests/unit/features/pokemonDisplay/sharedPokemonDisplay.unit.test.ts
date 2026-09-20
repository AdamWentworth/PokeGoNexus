import { describe, expect, it } from 'vitest';

import {
  resolvePokemonActiveCrownForm,
  resolvePokemonActiveFusionEntry,
  resolvePokemonActiveMegaEvolution,
  resolvePokemonInstanceImagePath,
} from '@pokemongonexus/shared-domain/pokemon-display';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';

const pokemon = {
  pokemon_id: 25,
  image_url: '/base.png',
  image_url_shadow: '/shadow.png',
  image_url_shiny: '/shiny.png',
  image_url_shiny_shadow: '/shiny-shadow.png',
  female_data: {
    image_url: '/female.png',
    shadow_image_url: '/female-shadow.png',
    shiny_image_url: '/female-shiny.png',
    shiny_shadow_image_url: '/female-shiny-shadow.png',
  },
  costumes: [{
    costume_id: 7,
    image_url: '/costume.png',
    image_url_female: '/costume-female.png',
    image_url_shiny: '/costume-shiny.png',
    image_url_shiny_female: '/costume-female-shiny.png',
    shadow_costume: {
      image_url_shadow_costume: '/costume-shadow.png',
      image_url_female_shadow_costume: '/costume-female-shadow.png',
      image_url_shiny_shadow_costume: '/costume-shiny-shadow.png',
      image_url_female_shiny_shadow_costume: '/costume-female-shiny-shadow.png',
    },
  }],
  megaEvolutions: [{
    form: 'X',
    image_url: '/mega-x.png',
    image_url_shiny: '/mega-x-shiny.png',
  }],
  crownForms: [{
    form: 'sword',
    display_form: 'Sword Crown',
    image_url: '/crown.png',
    image_url_shiny: '/crown-shiny.png',
  }],
  fusion: [{
    fusion_id: 12,
    name: 'Dawn Wings',
    image_url: '/fusion.png',
    image_url_shiny: '/fusion-shiny.png',
  }],
  max: [{
    gigantamax: true,
    gigantamax_image_url: '/gigantamax.png',
    shiny_gigantamax_image_url: '/gigantamax-shiny.png',
  }],
} as unknown as BasePokemon;

const instance = (
  overrides: Partial<PokemonInstance> = {},
): Partial<PokemonInstance> => ({
  pokemon_id: 25,
  shiny: false,
  shadow: false,
  purified: false,
  disabled: false,
  gender: 'Male',
  costume_id: null,
  is_mega: false,
  mega: false,
  is_fused: false,
  crown: false,
  dynamax: false,
  gigantamax: false,
  ...overrides,
});

describe('shared Pokémon presentation decisions', () => {
  it('resolves female, shadow, shiny, and costume combinations identically for every renderer', () => {
    expect(resolvePokemonInstanceImagePath(
      instance({ gender: 'Female', shiny: true, shadow: true }),
      pokemon,
    )).toBe('/female-shiny-shadow.png');

    expect(resolvePokemonInstanceImagePath(
      instance({ costume_id: 7, gender: 'Female', shiny: true, shadow: true }),
      pokemon,
    )).toBe('/costume-female-shiny-shadow.png');
  });

  it('resolves the selected Mega form and its artwork', () => {
    expect(resolvePokemonActiveMegaEvolution({
      isMega: true,
      megaForm: 'x',
      megaEvolutions: pokemon.megaEvolutions,
    })?.form).toBe('X');
    expect(resolvePokemonInstanceImagePath(
      instance({ is_mega: true, mega_form: 'x', shiny: true }),
      pokemon,
    )).toBe('/mega-x-shiny.png');
  });

  it('does not display a registered but currently inactive Mega form', () => {
    expect(resolvePokemonInstanceImagePath(
      instance({ is_mega: false, mega: true, mega_form: null }),
      pokemon,
    )).toBe('/base.png');
  });

  it('resolves crown labels and crown artwork', () => {
    expect(resolvePokemonActiveCrownForm(
      pokemon.crownForms,
      'sword-crown',
    )?.display_form).toBe('Sword Crown');
    expect(resolvePokemonInstanceImagePath(
      instance({ crown: true, fusion_form: 'Sword Crown', shiny: true }),
      pokemon,
    )).toBe('/crown-shiny.png');
  });

  it('resolves fusion selection by normalized name or stored id', () => {
    expect(resolvePokemonActiveFusionEntry({
      isFused: true,
      fusionForm: 'dawn-wings',
      fusionEntries: pokemon.fusion,
    })?.fusion_id).toBe(12);
    expect(resolvePokemonActiveFusionEntry({
      isFused: true,
      fusionEntries: pokemon.fusion,
      storedFusion: { fusion_id: '12' },
    })?.name).toBe('Dawn Wings');
    expect(resolvePokemonInstanceImagePath(
      instance({ is_fused: true, fusion_form: 'Dawn Wings', shiny: true }),
      pokemon,
    )).toBe('/fusion-shiny.png');
  });

  it.each(['12', 'fusion_12', 'dawn-wings'])('prioritizes active form %s over registration history', (fusionForm) => {
    const fusionEntries = [{ ...pokemon.fusion[0], fusion_id: 1, name: 'Dusk Mane' }, ...pokemon.fusion];
    expect(resolvePokemonActiveFusionEntry({
      isFused: true, fusionForm, fusionEntries, storedFusion: { 1: true, 12: true },
    })?.fusion_id).toBe(12);
    expect(resolvePokemonActiveFusionEntry({
      isFused: true, fusionEntries, storedFusion: { 12: true },
    })?.fusion_id).toBe(12);
  });

  it('resolves Gigantamax and shiny Gigantamax artwork', () => {
    expect(resolvePokemonInstanceImagePath(
      instance({ gigantamax: true }),
      pokemon,
    )).toBe('/gigantamax.png');
    expect(resolvePokemonInstanceImagePath(
      instance({ gigantamax: true, shiny: true }),
      pokemon,
    )).toBe('/gigantamax-shiny.png');
  });

  it('removes shadow artwork when purified while retaining shiny state', () => {
    expect(resolvePokemonInstanceImagePath(
      instance({ purified: true, shadow: true, shiny: true }),
      pokemon,
    )).toBe('/shiny.png');
  });

  it('uses disabled artwork before any other state', () => {
    expect(resolvePokemonInstanceImagePath(
      instance({ disabled: true, gigantamax: true, shiny: true }),
      pokemon,
    )).toBe('/images/disabled/disabled_25.png');
  });
});
