import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  useTradeInstanceController,
  type TradePokemon,
} from '@/pages/Pokemon/features/instances/hooks/useTradeInstanceController';
import type { VariantBackground } from '@/types/pokemonSubTypes';
import { calculateCP } from '@/utils/calculateCP';
import { cpMultipliers } from '@/utils/constants';

const makePokemon = (
  overrides: Partial<TradePokemon> = {},
  instanceOverrides: Record<string, unknown> = {},
): TradePokemon => {
  const pokemon = {
    variant_id: 'variant-1',
    pokemon_id: 25,
    name: 'Pikachu',
    species_name: 'Pikachu',
    variantType: 'default',
    currentImage: '/images/pikachu.png',
    image_url: '/images/pikachu.png',
    image_url_shadow: '/images/pikachu-shadow.png',
    image_url_shiny: '/images/pikachu-shiny.png',
    image_url_shiny_shadow: '/images/pikachu-shiny-shadow.png',
    attack: 112,
    defense: 96,
    stamina: 111,
    backgrounds: [
      {
        background_id: 2,
        image_url: '/images/bg-2.png',
        name: 'Seattle',
        costume_id: 0,
        date: '2026-02-17',
        location: 'Seattle',
      },
      {
        background_id: 3,
        image_url: '/images/bg-3.png',
        name: 'Tokyo',
        costume_id: 0,
        date: '2026-02-17',
        location: 'Tokyo',
      },
    ],
    max: [],
    instanceData: {
      variant_id: 'variant-1',
      pokemon_id: 25,
      nickname: 'Sparky',
      cp: 500,
      level: 20,
      attack_iv: 10,
      defense_iv: 11,
      stamina_iv: 12,
      shiny: false,
      costume_id: null,
      lucky: false,
      shadow: false,
      purified: false,
      fast_move_id: 216,
      charged_move1_id: 90,
      charged_move2_id: null,
      weight: 6,
      height: 0.4,
      gender: 'Male',
      mega: false,
      mega_form: null,
      is_mega: false,
      dynamax: false,
      gigantamax: false,
      crown: false,
      max_attack: null,
      max_guard: null,
      max_spirit: null,
      is_fused: false,
      fusion: null,
      fusion_form: null,
      fused_with: null,
      is_traded: false,
      traded_date: null,
      original_trainer_id: null,
      original_trainer_name: null,
      is_caught: true,
      is_for_trade: true,
      is_wanted: false,
      most_wanted: false,
      caught_tags: [],
      trade_tags: [],
      wanted_tags: [],
      not_trade_list: {},
      not_wanted_list: {},
      trade_filters: {},
      wanted_filters: {},
      mirror: false,
      pref_lucky: false,
      registered: true,
      favorite: false,
      disabled: false,
      pokeball: null,
      location_card: '2',
      location_caught: 'Seattle',
      date_caught: '2026-02-17',
      date_added: '2026-02-17T00:00:00.000Z',
      last_update: 1771286400000,
      ...instanceOverrides,
    },
    ...overrides,
  };

  return pokemon as unknown as TradePokemon;
};

describe('useTradeInstanceController', () => {
  it('preselects background from instance location_card', async () => {
    const pokemon = makePokemon();
    const { result } = renderHook(() => useTradeInstanceController(pokemon));

    await waitFor(() => {
      expect(result.current.selectedBackground?.background_id).toBe(2);
    });
  });

  it('updates gender/image state and applies computed values', () => {
    const pokemon = makePokemon({
      female_data: {
        image_url: '/images/pikachu-female.png',
      },
    } as Partial<TradePokemon>);
    const { result } = renderHook(() => useTradeInstanceController(pokemon));

    expect(result.current.currentImage).toBe('/images/pikachu.png');

    act(() => {
      result.current.handleGenderChange('Female');
      result.current.applyComputedValues({
        level: 40,
        cp: 1337,
        ivs: { Attack: 15, Defense: 14, Stamina: 13 },
      });
    });

    expect(result.current.gender).toBe('Female');
    expect(result.current.isFemale).toBe(true);
    expect(result.current.currentImage).toBe('/images/pikachu-female.png');
    expect(result.current.level).toBe(40);
    expect(result.current.ivs).toEqual({ Attack: 15, Defense: 14, Stamina: 13 });

    const multiplier = (cpMultipliers as Record<string, number>)['40'];
    const expectedCp = calculateCP(112, 96, 111, 15, 14, 13, multiplier);
    expect(result.current.cp).toBe(String(expectedCp));
  });

  it('selects a background and closes the modal', () => {
    const pokemon = makePokemon({}, { location_card: null });
    const { result } = renderHook(() =>
      useTradeInstanceController(pokemon),
    );

    const bg: VariantBackground = {
      background_id: 3,
      image_url: '/images/bg-3.png',
      name: 'Tokyo',
      costume_id: 0,
      date: '2026-02-17',
      location: 'Tokyo',
    };

    act(() => {
      result.current.setShowBackgrounds(true);
      result.current.handleBackgroundSelect(bg);
    });

    expect(result.current.showBackgrounds).toBe(false);
    expect(result.current.selectedBackground).toEqual(bg);
  });

  it('does not restore a no-costume background for a costumed trade instance', async () => {
    const pokemon = makePokemon(
      {
        variantType: 'costume_7',
        backgrounds: [
          {
            background_id: 2,
            image_url: '/images/bg-2.png',
            name: 'Seattle',
            costume_id: null,
            date: '2026-02-17',
            location: 'Seattle',
          },
          {
            background_id: 4,
            image_url: '/images/bg-4.png',
            name: 'Party Seattle',
            costume_id: 7,
            date: '2026-02-17',
            location: 'Seattle',
          },
        ],
      },
      { costume_id: 7, location_card: '2' },
    );
    const { result } = renderHook(() => useTradeInstanceController(pokemon));

    await waitFor(() => expect(result.current.selectedBackground).toBeNull());
  });
});
