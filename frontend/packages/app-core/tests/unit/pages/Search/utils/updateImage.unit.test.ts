import { describe, expect, it } from 'vitest';

import { updateImage } from '@/pages/Search/utils/updateImage';

const pokemonData = [
  {
    name: 'Pikachu',
    form: 'Normal',
    image_url: '/images/base.png',
    image_url_shiny: '/images/shiny.png',
    image_url_shadow: '/images/shadow.png',
    image_url_shiny_shadow: '/images/shiny_shadow.png',
    shadow_shiny_available: 1,
    female_unique: 1,
    female_data: {
      image_url: '/images/female_base.png',
      shiny_image_url: '/images/female_shiny.png',
      shadow_image_url: '/images/female_shadow.png',
      shiny_shadow_image_url: '/images/female_shiny_shadow.png',
    },
    max: [
      {
        gigantamax_image_url: '/images/gmax.png',
        shiny_gigantamax_image_url: '/images/gmax_shiny.png',
      },
    ],
    costumes: [
      {
        name: 'party_hat',
        image_url: '/images/costume_base.png',
        image_url_shiny: '/images/costume_shiny.png',
        image_url_shadow: '/images/costume_shadow.png',
        image_url_shiny_shadow: '/images/costume_shiny_shadow.png',
        image_url_female: '/images/costume_female.png',
        image_url_shiny_female: '/images/costume_female_shiny.png',
      },
    ],
  },
];

describe('updateImage', () => {
  it('returns null when no matching variant is found', () => {
    const result = updateImage(
      pokemonData as any,
      'Bulbasaur',
      false,
      false,
      '',
      'Normal',
      'Any',
      false,
      false,
    );
    expect(result).toBeNull();
  });

  it('returns gigantamax image immediately when gigantamax is enabled', () => {
    const result = updateImage(
      pokemonData as any,
      'Pikachu',
      false,
      false,
      '',
      'Normal',
      'Any',
      false,
      true,
    );
    expect(result).toBe('/images/gmax.png');
  });

  it('returns shiny gigantamax image when shiny + gigantamax are enabled', () => {
    const result = updateImage(
      pokemonData as any,
      'Pikachu',
      true,
      false,
      '',
      'Normal',
      'Any',
      false,
      true,
    );
    expect(result).toBe('/images/gmax_shiny.png');
  });

  it('uses unique female data for female shadow requests', () => {
    const result = updateImage(
      pokemonData as any,
      'Pikachu',
      false,
      true,
      '',
      'Normal',
      'Female',
      false,
      false,
    );
    expect(result).toBe('/images/female_shadow.png');
  });

  it('applies costume image selection for shiny shadow combinations', () => {
    const result = updateImage(
      pokemonData as any,
      'Pikachu',
      true,
      true,
      'party_hat',
      'Normal',
      'Any',
      false,
      false,
    );
    expect(result).toBe('/images/costume_shiny_shadow.png');
  });

  it('prefers female costume shiny image for female shiny requests', () => {
    const result = updateImage(
      pokemonData as any,
      'Pikachu',
      true,
      false,
      'party_hat',
      'Normal',
      'Female',
      false,
      false,
    );
    expect(result).toBe('/images/costume_female_shiny.png');
  });

  it('ignores a stale costume image when dynamax is enabled', () => {
    const result = updateImage(
      pokemonData as any,
      'Pikachu',
      false,
      false,
      'party_hat',
      'Normal',
      'Any',
      true,
      false,
    );
    expect(result).toBe('/images/base.png');
  });

  it('ignores stale shadow and costume state when dynamax is enabled', () => {
    const result = updateImage(
      pokemonData as any,
      'Pikachu',
      false,
      true,
      'party_hat',
      'Normal',
      'Any',
      true,
      false,
    );
    expect(result).toBe('/images/base.png');
  });

  it('prefers gigantamax artwork even if stale costume state leaks through', () => {
    const result = updateImage(
      pokemonData as any,
      'Pikachu',
      false,
      false,
      'party_hat',
      'Normal',
      'Any',
      false,
      true,
    );
    expect(result).toBe('/images/gmax.png');
  });
});
