import { describe, expect, it } from 'vitest';

import {
  buildTradeBoardModel,
  tradeBoardFilename,
} from '@/features/tradeBoard/model/tradeBoardModel';
import { tradeBoardPublicUrl } from '@/features/tradeBoard/model/tradeBoardUrl';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { TagItem } from '@/types/tags';

const item = (overrides: Partial<TagItem> = {}): TagItem => ({
  cp: null,
  currentImage: '/images/bulbasaur.png',
  favorite: false,
  friendship_level: null,
  gender: 'Any',
  hp: 0,
  instance_id: 'instance-1',
  is_caught: true,
  is_for_trade: true,
  is_wanted: false,
  mirror: false,
  most_wanted: false,
  moves: [],
  name: 'Bulbasaur',
  pokedex_number: 1,
  pokemon_id: 1,
  pref_lucky: false,
  registered: true,
  shiny: false,
  variant_id: '0001-default',
  variantType: 'default',
  ...overrides,
});

const variants = [{
  backgrounds: [{ background_id: 7, image_url: '/images/background-7.png' }],
  currentImage: '/images/bulbasaur.png',
  pokemon_id: 1,
  variant_id: '0001-default',
  variantType: 'default',
}] as unknown as PokemonVariant[];

describe('tradeBoardModel', () => {
  it('groups visually identical listings while preserving the real listing count', () => {
    const model = buildTradeBoardModel({
      boardUrl: 'https://pokegonexus.com/trade-board/AdamZilla',
      generatedAt: '2026-08-20T10:00:00.000Z',
      tradeItems: [item(), item({ instance_id: 'instance-2' })],
      username: 'AdamZilla',
      variants,
      wantedItems: [],
    });

    expect(model.tradeCount).toBe(2);
    expect(model.tradeEntries).toHaveLength(1);
    expect(model.tradeEntries[0]).toMatchObject({ name: 'Bulbasaur', quantity: 2 });
  });

  it('keeps meaningful visual requirements separate and ranks Most Wanted first', () => {
    const model = buildTradeBoardModel({
      boardUrl: 'https://pokegonexus.com/trade-board/AdamZilla',
      tradeItems: [],
      username: 'AdamZilla',
      variants,
      wantedItems: [
        item({ instance_id: 'wanted-1', is_caught: false, is_for_trade: false, is_wanted: true }),
        item({
          instance_id: 'wanted-2',
          is_caught: false,
          is_for_trade: false,
          is_wanted: true,
          location_card: '7',
          most_wanted: true,
          pref_lucky: true,
        }),
      ],
    });

    expect(model.wantedCount).toBe(2);
    expect(model.mostWantedCount).toBe(1);
    expect(model.wantedEntries).toHaveLength(2);
    expect(model.wantedEntries[0]).toMatchObject({
      locationBackgroundUrl: '/images/background-7.png',
      luckyRequested: true,
      mostWanted: true,
    });
  });

  it('omits disabled sections and duplicate Pokémon GO identity', () => {
    const model = buildTradeBoardModel({
      boardUrl: 'https://pokegonexus.com/trade-board/AdamZilla',
      includeTrade: false,
      pokemonGoName: 'adamzilla',
      tradeItems: [item()],
      username: 'AdamZilla',
      variants,
      wantedItems: [],
    });

    expect(model.includeTrade).toBe(false);
    expect(model.tradeCount).toBe(0);
    expect(model.tradeEntries).toEqual([]);
    expect(model.pokemonGoName).toBeNull();
  });

  it('creates stable production links and safe filenames', () => {
    expect(tradeBoardPublicUrl('Adam Zilla')).toBe(
      'https://pokegonexus.com/trade-board/Adam%20Zilla',
    );
    expect(tradeBoardFilename('Adam Zilla!', '2026-08-20T10:00:00.000Z')).toBe(
      'pokegonexus-Adam-Zilla-trade-board-2026-08-20.png',
    );
  });
});
