import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import {
  buildNativeTradePreferenceEntries,
  buildNativeTradePreferenceEntrySets,
  buildNativeTradePreferencePatchPlan,
  resolveNativeTradePreferenceDraftCandidates,
} from '../../../../src/features/trades/nativeTradePreferencesModel';

const instance = (
  id: string,
  pokemonId: number,
  patch: Partial<PokemonInstance> = {},
): PokemonInstance => ({
  instance_id: id,
  variant_id: `${String(pokemonId).padStart(4, '0')}-default`,
  pokemon_id: pokemonId,
  nickname: null,
  cp: null,
  level: null,
  attack_iv: null,
  defense_iv: null,
  stamina_iv: null,
  shiny: false,
  costume_id: null,
  lucky: false,
  shadow: false,
  purified: false,
  fast_move_id: null,
  charged_move1_id: null,
  charged_move2_id: null,
  weight: null,
  height: null,
  gender: null,
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
  is_for_trade: false,
  is_wanted: false,
  most_wanted: false,
  caught_tags: null,
  trade_tags: null,
  wanted_tags: null,
  not_trade_list: null,
  not_wanted_list: null,
  trade_filters: null,
  wanted_filters: null,
  mirror: false,
  pref_lucky: false,
  friendship_level: null,
  registered: true,
  favorite: false,
  disabled: false,
  pokeball: null,
  location_card: null,
  location_caught: null,
  date_caught: null,
  date_added: '2026-08-24T00:00:00Z',
  last_update: 1,
  ...patch,
});

const pokemon = (
  id: number,
  name: string,
  patch: Record<string, unknown> = {},
): BasePokemon => ({
  pokemon_id: id,
  pokedex_number: id,
  name,
  attack: 100,
  defense: 100,
  stamina: 100,
  image_url: `/images/${name.toLocaleLowerCase()}.png`,
  image_url_shiny: `/images/shiny-${name.toLocaleLowerCase()}.png`,
  shiny_available: 1,
  costumes: [],
  megaEvolutions: [],
  fusion: [],
  max: [],
  ...patch,
} as unknown as BasePokemon);

const catalog = [
  pokemon(1, 'Bulbasaur'),
  pokemon(4, 'Charmander', { shiny_rarity: 'community_day' }),
  pokemon(7, 'Squirtle', { shiny_rarity: 'permaboosted' }),
  pokemon(25, 'Pikachu', {
    costumes: [{
      costume_id: 9,
      name: 'detective',
      image_url: '/images/detective-pikachu.png',
      image_url_shiny: '/images/shiny-detective-pikachu.png',
      shiny_available: 1,
    }],
  }),
] as BasePokemon[];

describe('native trade preference model', () => {
  it('shares preparation for both modes and materializes candidate rows only when opened', () => {
    const entries = buildNativeTradePreferenceEntrySets({
      assetOrigin: 'https://pokegonexus.com',
      catalog,
      instances: {
        offered: instance('offered', 25, { is_for_trade: true }),
        wanted: instance('wanted', 1, { is_caught: false, is_wanted: true }),
      },
    });

    expect(entries.trade).toHaveLength(1);
    expect(entries.wanted).toHaveLength(1);
    expect(Object.getOwnPropertyDescriptor(entries.trade[0], 'allowedCount')?.get)
      .toEqual(expect.any(Function));
    expect(entries.trade[0].allowedCount).toBe(1);
    expect(Object.getOwnPropertyDescriptor(entries.trade[0], 'candidates')?.get)
      .toEqual(expect.any(Function));
    const candidates = entries.trade[0].candidates;
    expect(candidates.map((candidate) => candidate.collectionKey)).toEqual(['wanted']);
    expect(entries.trade[0].candidates).toBe(candidates);
  });

  it('builds For Trade entries with Wanted candidates in Pokédex order', () => {
    const entries = buildNativeTradePreferenceEntries({
      assetOrigin: 'https://pokegonexus.com',
      catalog,
      instances: {
        offered: instance('offered', 25, { is_for_trade: true }),
        wantedSquirtle: instance('wantedSquirtle', 7, {
          is_caught: false,
          is_wanted: true,
          shiny: true,
        }),
        wantedBulbasaur: instance('wantedBulbasaur', 1, {
          is_caught: false,
          is_wanted: true,
        }),
      },
      mode: 'trade',
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      collectionKey: 'offered',
      allowedCount: 2,
      mode: 'trade',
    });
    expect(entries[0].candidates.map((candidate) => candidate.collectionKey)).toEqual([
      'wantedBulbasaur',
      'wantedSquirtle',
    ]);
  });

  it('applies For Trade rules with canonical encounter exclusions and quality requirements', () => {
    const entries = buildNativeTradePreferenceEntries({
      assetOrigin: 'https://pokegonexus.com',
      catalog,
      instances: {
        offered: instance('offered', 25, {
          is_for_trade: true,
          wanted_filters: {
            communityDayFilter: true,
            shinyIconFilter: true,
          },
        }),
        communityShiny: instance('communityShiny', 4, {
          is_caught: false,
          is_wanted: true,
          shiny: true,
        }),
        permaboostedShiny: instance('permaboostedShiny', 7, {
          is_caught: false,
          is_wanted: true,
          shiny: true,
        }),
        ordinary: instance('ordinary', 1, {
          is_caught: false,
          is_wanted: true,
        }),
      },
      mode: 'trade',
    });

    expect(entries[0].activeRuleCount).toBe(2);
    expect(entries[0].allowedCount).toBe(1);
    expect(entries[0].candidates.map((candidate) => ({
      id: candidate.collectionKey,
      allowed: candidate.allowed,
      excludedByRule: candidate.excludedByRule,
    }))).toEqual([
      { id: 'ordinary', allowed: false, excludedByRule: true },
      { id: 'communityShiny', allowed: false, excludedByRule: true },
      { id: 'permaboostedShiny', allowed: true, excludedByRule: false },
    ]);
  });

  it('does not mistake shiny costumes for ordinary shiny encounter candidates', () => {
    const entries = buildNativeTradePreferenceEntries({
      assetOrigin: 'https://pokegonexus.com',
      catalog,
      instances: {
        wanted: instance('wanted', 1, {
          is_caught: false,
          is_wanted: true,
          trade_filters: { permaboostedFilter: true },
        }),
        standard: instance('standard', 7, { is_for_trade: true }),
        shiny: instance('shiny', 7, { is_for_trade: true, shiny: true }),
        shinyCostume: instance('shinyCostume', 25, {
          costume_id: 9,
          is_for_trade: true,
          shiny: true,
        }),
      },
      mode: 'wanted',
    });

    expect(entries[0].candidates.filter((candidate) => candidate.allowed).map(
      (candidate) => candidate.collectionKey,
    )).toEqual(['shiny', 'standard']);
    expect(entries[0].candidates.find(
      (candidate) => candidate.collectionKey === 'shinyCostume',
    )?.excludedByRule).toBe(true);
  });

  it('plans symmetric For Trade updates without mutating the source snapshot', () => {
    const instances = {
      offered: instance('offered-id', 25, {
        is_for_trade: true,
        not_wanted_list: { oldWanted: true },
        wanted_filters: { regionalIconFilter: true },
      }),
      oldWanted: instance('old-wanted-id', 1, {
        is_caught: false,
        is_wanted: true,
        not_trade_list: { offered: true },
      }),
      newWanted: instance('new-wanted-id', 7, {
        is_caught: false,
        is_wanted: true,
      }),
    };
    const before = JSON.stringify(instances);
    const plan = buildNativeTradePreferencePatchPlan({
      filteredOutIds: [],
      filters: { shinyIconFilter: true },
      instances,
      manuallyExcludedIds: ['new-wanted-id'],
      mode: 'trade',
      selectedInstanceId: 'offered-id',
    });

    expect(plan).toEqual({
      selectedCollectionKey: 'offered',
      updatedExcludedIds: ['newWanted'],
      patches: {
        oldWanted: { not_trade_list: {} },
        newWanted: { not_trade_list: { offered: true } },
        offered: {
          mirror: false,
          not_wanted_list: { newWanted: true },
          wanted_filters: { shinyIconFilter: true },
        },
      },
    });
    expect(JSON.stringify(instances)).toBe(before);
  });

  it('plans symmetric Wanted updates and folds rule-filtered rows into the persisted exclusions', () => {
    const instances = {
      wanted: instance('wanted', 1, {
        is_caught: false,
        is_wanted: true,
      }),
      tradeA: instance('trade-a', 4, { is_for_trade: true }),
      tradeB: instance('trade-b', 7, { is_for_trade: true }),
    };
    const plan = buildNativeTradePreferencePatchPlan({
      filteredOutIds: ['trade-a'],
      filters: { legendaryIconFilter: true },
      instances,
      manuallyExcludedIds: ['trade-b'],
      mode: 'wanted',
      selectedInstanceId: 'wanted',
    });

    expect(plan.patches).toEqual({
      tradeA: { not_wanted_list: { wanted: true } },
      tradeB: { not_wanted_list: { wanted: true } },
      wanted: {
        not_trade_list: { tradeA: true, tradeB: true },
        trade_filters: { legendaryIconFilter: true },
      },
    });
  });

  it('rejects a save after the selected listing changed ownership state', () => {
    expect(() => buildNativeTradePreferencePatchPlan({
      filteredOutIds: [],
      filters: {},
      instances: { caught: instance('caught', 1) },
      manuallyExcludedIds: [],
      mode: 'trade',
      selectedInstanceId: 'caught',
    })).toThrow('no longer listed For Trade');
  });

  it('makes Mirror authoritative and clears ordinary target exclusions', () => {
    const instances = {
      offered: instance('offered', 25, {
        is_for_trade: true,
        not_wanted_list: { mirrorTarget: true, otherTarget: true },
      }),
      mirrorTarget: instance('mirror-target', 25, {
        is_caught: false,
        is_wanted: true,
      }),
      otherTarget: instance('other-target', 7, {
        is_caught: false,
        is_wanted: true,
      }),
    };
    const entry = buildNativeTradePreferenceEntries({
      assetOrigin: 'https://pokegonexus.com',
      catalog,
      instances,
      mode: 'trade',
    })[0];

    const plan = buildNativeTradePreferencePatchPlan({
      filteredOutIds: ['otherTarget'],
      filters: { shinyIconFilter: true },
      instances,
      manuallyExcludedIds: ['mirrorTarget'],
      mirror: true,
      mode: 'trade',
      selectedInstanceId: 'offered',
    });

    expect(plan.updatedExcludedIds).toEqual([]);
    expect(plan.patches.offered).toEqual({
      mirror: true,
      not_wanted_list: {},
      wanted_filters: {},
    });
    expect(resolveNativeTradePreferenceDraftCandidates({
      entry,
      filters: {},
      manuallyExcludedIds: new Set(['mirrorTarget']),
      mirror: true,
    }).map(({ collectionKey, allowed }) => ({ collectionKey, allowed }))).toEqual([
      { collectionKey: 'otherTarget', allowed: false },
      { collectionKey: 'mirrorTarget', allowed: true },
    ]);
  });
});
