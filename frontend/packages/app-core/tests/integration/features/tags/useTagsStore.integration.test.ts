import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  getAllTagDefs: vi.fn(),
  getAllInstanceTags: vi.fn(),
  replaceTagDefs: vi.fn(),
  persistSystemMembershipsFromBuckets: vi.fn(),
  getSystemChildrenSnapshot: vi.fn(),
  setSystemChildrenSnapshot: vi.fn(),
}));

const tagServiceMocks = vi.hoisted(() => ({
  createCustomTag: vi.fn(),
  deleteCustomTag: vi.fn(),
  fetchCustomTags: vi.fn(),
  updateCustomTag: vi.fn(),
  updatePokemonTagOrder: vi.fn(),
}));

vi.mock('@/db/tagsDB', () => dbMocks);
vi.mock('@/db/variantsDB', () => ({ getAllVariants: vi.fn() }));
vi.mock('@/db/instancesDB', () => ({ getAllInstances: vi.fn() }));
vi.mock('@/services/tagService', () => tagServiceMocks);

import { useTagsStore } from '@/features/tags/store/useTagsStore';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { readCachedTagOrders } from '@/features/tags/utils/tagOrderCache';
import { useAuthStore } from '@/stores/useAuthStore';

const variantsFixture = [
  {
    variant_id: '0001-default',
    pokemon_id: 1,
    name: 'Bulbasaur',
    form: null,
    variantType: 'default',
    currentImage: '/images/default/pokemon_1.png',
    stamina: 111,
    shiny_rarity: 'common',
    rarity: 'common',
    pokedex_number: 1,
    moves: [],
    type1_name: 'Grass',
    type2_name: 'Poison',
    type_1_icon: '/images/types/grass.png',
    type_2_icon: '/images/types/poison.png',
  },
] as any[];

const caughtTagItem = {
  instance_id: 'caught-fav',
  currentImage: '/images/default/pokemon_1.png',
  pokemon_id: 1,
  cp: 500,
  hp: 111,
  favorite: true,
  most_wanted: false,
  is_caught: true,
  is_for_trade: false,
  is_wanted: false,
  mirror: false,
  pref_lucky: false,
  registered: true,
  gender: 'Male',
  pokedex_number: 1,
  moves: [],
  shiny: false,
  rarity: 'common',
  shiny_rarity: 'common',
} as any;

const wantedTagItem = {
  ...caughtTagItem,
  instance_id: 'wanted-most',
  favorite: false,
  most_wanted: true,
  is_caught: false,
  is_wanted: true,
} as any;

describe('useTagsStore integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    dbMocks.getAllTagDefs.mockResolvedValue([]);
    dbMocks.getAllInstanceTags.mockResolvedValue([]);
    dbMocks.replaceTagDefs.mockResolvedValue(undefined);
    dbMocks.persistSystemMembershipsFromBuckets.mockResolvedValue(undefined);
    dbMocks.getSystemChildrenSnapshot.mockResolvedValue(null);
    dbMocks.setSystemChildrenSnapshot.mockResolvedValue(undefined);
    tagServiceMocks.fetchCustomTags.mockResolvedValue({
      tags: [],
      orders: {
        caught: ['system:caught', 'system:favorites', 'system:trade'],
        wanted: ['system:wanted', 'system:most-wanted'],
      },
    });

    useAuthStore.setState({
      isLoggedIn: true,
      user: { user_id: 'user-1' } as any,
    });

    useVariantsStore.setState({
      variants: [],
      variantsLoading: false,
      isRefreshing: false,
    });

    useInstancesStore.setState({
      instances: {},
      foreignInstances: null,
      instancesLoading: false,
    });

    useTagsStore.setState({
      tags: { caught: {}, wanted: {}, trade: {} } as any,
      customTags: { caught: {}, wanted: {} },
      tagOrders: {
        caught: ['system:caught', 'system:favorites', 'system:trade'],
        wanted: ['system:wanted', 'system:most-wanted'],
      },
      systemChildren: {
        caught: { favorite: {}, trade: {} },
        wanted: { mostWanted: {} },
      },
      tagsLoading: true,
      customTagsLoading: true,
      foreignTags: null,
    });
  });

  it('hydrates an interleaved account tag order and appends newly available tags', async () => {
    tagServiceMocks.fetchCustomTags.mockResolvedValue({
      tags: [
        {
          tag_id: 'tag-shadow',
          parent: 'caught',
          name: 'Shadow Shinies',
          color: '#7C3AED',
          sort: 10,
          created_at: '2026-08-20T00:00:00Z',
        },
        {
          tag_id: 'tag-raids',
          parent: 'caught',
          name: 'Raid team',
          color: '#2563EB',
          sort: 20,
          created_at: '2026-08-20T00:00:00Z',
        },
      ],
      orders: {
        caught: [
          'custom:tag-shadow',
          'system:favorites',
          'system:caught',
          'system:trade',
        ],
        wanted: ['system:wanted', 'system:most-wanted'],
      },
    });

    await useTagsStore.getState().refreshCustomTagDefinitions();

    expect(useTagsStore.getState().tagOrders.caught).toEqual([
      'custom:tag-shadow',
      'system:favorites',
      'system:caught',
      'system:trade',
      'custom:tag-raids',
    ]);
  });

  it('adopts the canonical order only after the server saves it', async () => {
    const requested = [
      'system:favorites',
      'system:trade',
      'system:caught',
    ] as const;
    tagServiceMocks.updatePokemonTagOrder.mockResolvedValue({
      parent: 'caught',
      tag_keys: requested,
    });

    await useTagsStore.getState().saveTagOrder('caught', [...requested]);

    expect(tagServiceMocks.updatePokemonTagOrder).toHaveBeenCalledWith({
      parent: 'caught',
      tag_keys: requested,
    });
    expect(useTagsStore.getState().tagOrders.caught).toEqual(requested);
    expect(readCachedTagOrders('user-1')?.caught).toEqual(requested);
  });

  it('rebuildCustomTags groups memberships by allowed parents and ignores legacy trade parent', async () => {
    useTagsStore.setState({
      tags: {
        caught: { 'caught-fav': caughtTagItem },
        wanted: { 'wanted-most': wantedTagItem },
      } as any,
    });

    dbMocks.getAllTagDefs.mockResolvedValue([
      { tag_id: 'tag-caught', parent: 'caught', name: 'My Caught' },
      { tag_id: 'tag-wanted', parent: 'wanted', name: 'My Wanted' },
      { tag_id: 'legacy-trade-parent', parent: 'trade', name: 'Legacy Trade Parent' },
      { tag_id: 'deleted-tag', parent: 'caught', name: 'Deleted', deleted_at: '2026-01-01T00:00:00Z' },
    ]);
    useInstancesStore.setState({
      instances: {
        'caught-fav': {
          ...caughtTagItem,
          variant_id: '0001-default',
          caught_tags: ['tag-caught', 'legacy-trade-parent', 'deleted-tag'],
          wanted_tags: [],
        },
        'wanted-most': {
          ...wantedTagItem,
          variant_id: '0001-default',
          caught_tags: [],
          wanted_tags: ['tag-wanted'],
        },
      } as any,
      instancesLoading: false,
    });

    await useTagsStore.getState().rebuildCustomTags();

    const state = useTagsStore.getState();
    expect(state.customTags.caught).toHaveProperty('tag-caught');
    expect(state.customTags.caught['tag-caught'].items).toHaveProperty('caught-fav');

    expect(state.customTags.wanted).toHaveProperty('tag-wanted');

    expect(state.customTags.caught).not.toHaveProperty('legacy-trade-parent');
    expect(state.customTags.caught).not.toHaveProperty('deleted-tag');
  });

  it('reacts to instances-store updates via subscription quick rebuild', async () => {
    useVariantsStore.setState({ variants: variantsFixture, variantsLoading: false });
    useInstancesStore.setState({
      instances: {
        'caught-fav': {
          instance_id: 'caught-fav',
          variant_id: '0001-default',
          pokemon_id: 1,
          shiny: false,
          is_caught: true,
          is_for_trade: false,
          is_wanted: false,
          favorite: true,
          most_wanted: false,
          registered: true,
          mirror: false,
          pref_lucky: false,
          gender: 'Male',
        },
      } as any,
      instancesLoading: false,
    });

    await Promise.resolve();

    const state = useTagsStore.getState();
    expect(state.tags.caught).toHaveProperty('caught-fav');
    expect(state.systemChildren.caught.favorite).toHaveProperty('caught-fav');
    expect(dbMocks.persistSystemMembershipsFromBuckets).toHaveBeenCalled();
  });

  it('applies custom tags only to instances in the matching parent collection', async () => {
    dbMocks.getAllTagDefs.mockResolvedValue([
      { tag_id: 'inventory-tag', parent: 'caught', name: 'Raid team', color: '#2563EB' },
      { tag_id: 'wanted-tag', parent: 'wanted', name: 'Priority', color: '#E11D48' },
    ]);
    useTagsStore.setState({
      tags: {
        caught: { 'caught-1': caughtTagItem },
        wanted: { 'wanted-1': wantedTagItem },
      } as any,
    });
    useInstancesStore.setState({
      instances: {
        'caught-1': {
          ...caughtTagItem,
          variant_id: '0001-default',
          caught_tags: [],
          wanted_tags: [],
        },
        'wanted-1': {
          ...wantedTagItem,
          variant_id: '0001-default',
          caught_tags: [],
          wanted_tags: [],
        },
      } as any,
      instancesLoading: false,
    });

    const updateSpy = vi
      .spyOn(useInstancesStore.getState(), 'updateInstanceDetails')
      .mockImplementation(async (patches: any) => {
        useInstancesStore.setState((state) => ({
          instances: Object.fromEntries(
            Object.entries(state.instances).map(([key, instance]) => [
              key,
              { ...instance, ...(patches[key] ?? {}) },
            ]),
          ) as any,
        }));
      });

    const result = await useTagsStore.getState().applyCustomTagChanges(
      ['caught-1', 'wanted-1', 'not-an-instance'],
      { 'inventory-tag': true, 'wanted-tag': true },
    );

    expect(result).toEqual({ updated: 2, skipped: 1 });
    expect(updateSpy).toHaveBeenCalledWith({
      'caught-1': { caught_tags: ['inventory-tag'], wanted_tags: [] },
      'wanted-1': { caught_tags: [], wanted_tags: ['wanted-tag'] },
    });
  });
});
