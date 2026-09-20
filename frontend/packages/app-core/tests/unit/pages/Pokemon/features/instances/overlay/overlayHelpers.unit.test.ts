import { describe, expect, it } from 'vitest';
import {
  getBackgroundImageSrc,
  getPrimaryTypeName,
} from '@/pages/Pokemon/features/instances/overlay/overlayBackground';
import { getOverlayIdentityKey } from '@/pages/Pokemon/features/instances/overlay/overlayPokemon';
import { deriveInitialOverlay } from '@/pages/Pokemon/features/instances/overlay/overlayState';
import { resolveSwipeAxis } from '@/pages/Pokemon/features/instances/overlay/overlaySwipe';
import type { OverlayPokemon } from '@/pages/Pokemon/features/instances/overlay/overlayTypes';

const pokemon = (overrides: Record<string, unknown> = {}): OverlayPokemon =>
  ({
    pokemon_id: 1,
    name: 'Bulbasaur',
    species_name: 'Bulbasaur',
    variant_id: '0001-default',
    variantType: 'default',
    currentImage: '/images/1.png',
    image_url: '/images/1.png',
    costumes: [],
    ...overrides,
  }) as unknown as OverlayPokemon;

describe('overlay helpers', () => {
  it('derives overlay from tag filter before pokemon status', () => {
    expect(
      deriveInitialOverlay(
        'trade',
        pokemon({ instanceData: { status: 'wanted' } }),
      ),
    ).toBe('trade');
  });

  it('treats Most Wanted as a Wanted filter rather than a separate ownership type', () => {
    expect(
      deriveInitialOverlay(
        'Most Wanted',
        pokemon({ instanceData: { is_wanted: true, most_wanted: true } }),
      ),
    ).toBe('wanted');
  });

  it('falls back to ownership flags when a filtered instance has no status', () => {
    expect(
      deriveInitialOverlay(
        'unknown',
        pokemon({ instanceData: { is_wanted: true, most_wanted: true } }),
      ),
    ).toBe('wanted');
  });

  it('treats a caught Pokémon listed for trade as a trade overlay', () => {
    expect(
      deriveInitialOverlay(
        'unknown',
        pokemon({ instanceData: { is_caught: true, is_for_trade: true } }),
      ),
    ).toBe('trade');
  });

  it('falls back from unknown tag to instance status, top-level status, then caught', () => {
    expect(
      deriveInitialOverlay(
        'unknown',
        pokemon({ instanceData: { status: 'wanted' } }),
      ),
    ).toBe('wanted');
    expect(deriveInitialOverlay('unknown', pokemon({ status: 'missing' }))).toBe(
      'missing',
    );
    expect(deriveInitialOverlay('unknown', pokemon())).toBe('caught');
  });

  it('keeps overlay identity precedence stable', () => {
    expect(
      getOverlayIdentityKey(
        pokemon({
          pokemon_id: 25,
          variant_id: '0025-default',
          instanceData: { instance_id: 'instance-25' },
        }),
      ),
    ).toBe('instance:instance-25');
    expect(getOverlayIdentityKey(pokemon({ variant_id: '0025-default' }))).toBe(
      'variant:0025-default',
    );
    expect(
      getOverlayIdentityKey(
        pokemon({ pokemon_id: 25, variant_id: undefined, variantType: 'shiny' }),
      ),
    ).toBe('pokemon:25:shiny');
  });

  it('resolves primary type from explicit fields, nested type shapes, and variantType fallback', () => {
    expect(getPrimaryTypeName(pokemon({ type1_name: 'Fire' }))).toBe('fire');
    expect(
      getPrimaryTypeName(
        pokemon({
          types: [{ type: { name: 'Grass' } }],
        }),
      ),
    ).toBe('grass');
    expect(getPrimaryTypeName(pokemon({ variantType: 'type_bug' }))).toBe('bug');
    expect(getPrimaryTypeName(pokemon({ type1_name: 'NotAType' }))).toBe('normal');
  });

  it('uses shadow and lucky background precedence before type backgrounds', () => {
    expect(
      getBackgroundImageSrc(
        pokemon({
          type1_name: 'Water',
          instanceData: { shadow: true, lucky: true, purified: false },
        }),
      ),
    ).toBe('/images/backgrounds/bg_shadow.png');
    expect(
      getBackgroundImageSrc(
        pokemon({
          type1_name: 'Water',
          instanceData: { shadow: true, purified: true },
        }),
      ),
    ).toBe('/images/backgrounds/bg_water.png');
    expect(
      getBackgroundImageSrc(
        pokemon({
          type1_name: 'Water',
          instanceData: { lucky: true },
        }),
      ),
    ).toBe('/images/backgrounds/bg_lucky.png');
    expect(
      getBackgroundImageSrc(
        pokemon({
          type1_name: 'Water',
          instanceData: { is_wanted: true, pref_lucky: true },
        }),
      ),
    ).toBe('/images/backgrounds/bg_lucky.png');
  });

  it('locks swipe axis only after intent is clear', () => {
    expect(resolveSwipeAxis(9, 1, null)).toBeNull();
    expect(resolveSwipeAxis(12, 13, null)).toBe('x');
    expect(resolveSwipeAxis(8, 18, null)).toBe('y');
    expect(resolveSwipeAxis(0, 30, 'x')).toBe('x');
    expect(resolveSwipeAxis(80, 0, 'y')).toBe('y');
  });
});
