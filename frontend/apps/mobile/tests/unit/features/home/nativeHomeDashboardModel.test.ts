import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { NativeCollectionRow } from '../../../../src/features/collection/collectionModel';
import {
  buildNativeHomeOnboardingProgress,
  selectNativeHomeRecentRows,
  summarizeNativeHomeCollection,
  summarizeNativeHomeTrades,
} from '../../../../src/features/home/nativeHomeDashboardModel';

const instance = (overrides: Partial<PokemonInstance>): PokemonInstance => ({
  instance_id: 'instance',
  pokemon_id: 1,
  variant_id: 'variant',
  is_caught: true,
  is_for_trade: false,
  is_wanted: false,
  favorite: false,
  most_wanted: false,
  ...overrides,
} as PokemonInstance);

const row = (id: string): NativeCollectionRow => ({
  id,
  pokemonId: 1,
  pokedexNumber: 1,
  name: id,
  imageUri: null,
  locationBackgroundUri: null,
  maxKind: null,
  purified: false,
  lucky: false,
  typeIconUris: [],
  status: 'caught',
  source: 'instance',
  cp: null,
  favorite: false,
  mostWanted: false,
});

describe('nativeHomeDashboardModel', () => {
  it('excludes disabled fusion partners from every collection count', () => {
    expect(summarizeNativeHomeCollection({
      caught: instance({}),
      partner: instance({ disabled: true, favorite: true, is_for_trade: true, is_wanted: true, most_wanted: true }),
    })).toEqual({ caught: 1, favorites: 0, forTrade: 0, wanted: 0, mostWanted: 0 });
  });

  it('counts caught, trade, wanted, favorite, and most-wanted instances independently', () => {
    expect(summarizeNativeHomeCollection({
      favorite: instance({ instance_id: 'favorite', favorite: true }),
      trade: instance({ instance_id: 'trade', is_for_trade: true }),
      wanted: instance({ instance_id: 'wanted', is_caught: false, is_wanted: true, most_wanted: true }),
    })).toEqual({
      caught: 2,
      favorites: 1,
      forTrade: 1,
      wanted: 1,
      mostWanted: 1,
    });
  });

  it('groups trade work from the current trainer perspective', () => {
    expect(summarizeNativeHomeTrades([
      { trade_status: 'proposed', username_accepting: 'Misty' },
      { trade_status: 'proposed', username_proposed: 'misty' },
      { trade_status: 'pending', username_proposed: 'MISTY', user_proposed_completion_confirmed: false },
      { trade_status: 'pending', username_accepting: 'misty', user_accepting_completion_confirmed: true },
      { trade_status: 'completed' },
      { trade_status: 'cancelled' },
    ], 'misty')).toEqual({
      needsResponse: 1,
      readyToConfirm: 1,
      waiting: 2,
      completed: 1,
      active: 4,
    });
  });

  it('selects only real instances in most-recent order', () => {
    const rows = [row('old'), { ...row('catalog'), source: 'catalog' as const }, row('new')];
    const instances = {
      old: instance({ instance_id: 'old', last_update: 10 }),
      new: instance({ instance_id: 'new', last_update: 30 }),
    };

    expect(selectNativeHomeRecentRows(rows, instances, 2).map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  it('matches the canonical four onboarding milestones', () => {
    const progress = buildNativeHomeOnboardingProgress({
      caught: 2,
      favorites: 0,
      forTrade: 1,
      wanted: 0,
      mostWanted: 0,
    }, 0);

    expect(progress.completed).toBe(2);
    expect(progress.total).toBe(4);
    expect(progress.tasks.map(({ id, complete, to }) => ({ id, complete, to }))).toEqual([
      { id: 'collection', complete: true, to: '/pokemon' },
      { id: 'wanted', complete: false, to: '/pokemon?filter=wanted' },
      { id: 'trade', complete: true, to: '/pokemon?filter=trade' },
      { id: 'connect', complete: false, to: '/search' },
    ]);
  });
});
