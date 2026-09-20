import { describe, expect, it, vi } from 'vitest';

import {
  resolvePokemonDisplayAttributes,
  resolvePokemonDisplayImageUrl,
} from '@/features/pokemonDisplay/pokemonDisplayPresentation';

const determineImageUrlMock = vi.hoisted(() => vi.fn());

vi.mock('@/utils/imageHelpers', () => ({
  determineImageUrl: determineImageUrlMock,
}));

const basePokemon = {
  pokemon_id: 25,
  currentImage: '/images/default/pokemon_25.png',
  variantType: 'default',
  instanceData: {},
} as any;

describe('pokemonDisplayPresentation', () => {
  it('derives card display attributes from instance ownership state and variant type', () => {
    expect(
      resolvePokemonDisplayAttributes({
        ...basePokemon,
        variantType: 'shiny_dynamax',
        instanceData: {
          disabled: true,
          gender: 'Female',
          is_mega: true,
          mega_form: 'X',
          is_fused: true,
          fusion_form: 'Dawn Wings Necrozma',
          crown: true,
          purified: true,
          dynamax: true,
        },
      }),
    ).toEqual({
      isDisabled: true,
      isFemale: true,
      isMega: true,
      megaForm: 'X',
      isFused: true,
      fusionForm: 'Dawn Wings Necrozma',
      isCrown: true,
      isPurified: true,
      isDynamax: true,
      isGigantamax: false,
    });

    expect(
      resolvePokemonDisplayAttributes({
        ...basePokemon,
        variantType: 'default',
        instanceData: {
          gigantamax: true,
        },
      }),
    ).toMatchObject({
      isDynamax: true,
      isGigantamax: true,
    });
  });

  it('returns disabled sprite paths without invoking the image resolver', () => {
    determineImageUrlMock.mockReset();

    expect(
      resolvePokemonDisplayImageUrl({
        pokemon: basePokemon,
        attributes: {
          isDisabled: true,
        },
      }),
    ).toBe('/images/disabled/disabled_25.png');
    expect(determineImageUrlMock).not.toHaveBeenCalled();
  });

  it('normalizes catalog display attributes before delegating image selection', () => {
    determineImageUrlMock.mockReset();
    determineImageUrlMock.mockReturnValue('/images/custom.png');

    expect(
      resolvePokemonDisplayImageUrl({
        pokemon: { ...basePokemon, instanceData: undefined },
        attributes: {
          isFemale: true,
          isMega: true,
          megaForm: 'X',
          isFused: true,
          fusionForm: 'Dawn Wings Necrozma',
          isPurified: true,
          isGigantamax: true,
          isCrown: true,
          crownForm: 'Crowned Sword',
        },
      }),
    ).toBe('/images/custom.png');

    expect(determineImageUrlMock).toHaveBeenCalledWith(
      true,
      { ...basePokemon, instanceData: undefined },
      true,
      'X',
      true,
      'Dawn Wings Necrozma',
      true,
      true,
      true,
      'Crowned Sword',
    );
  });

  it('uses the shared owned-instance artwork resolver before renderer-specific code', () => {
    determineImageUrlMock.mockReset();

    expect(
      resolvePokemonDisplayImageUrl({
        pokemon: {
          ...basePokemon,
          image_url: '/images/base.png',
          image_url_shiny: '/images/shiny.png',
          instanceData: { shiny: true },
        },
        attributes: {},
      }),
    ).toBe('/images/shiny.png');
    expect(determineImageUrlMock).not.toHaveBeenCalled();
  });
});
