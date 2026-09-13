import type { BasePokemon, CrownForm, Move } from '@pokemongonexus/shared-contracts/pokemon';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import { buildNativeMaxRankings, buildNativeRaidAttackers, buildNativeRaidBosses, buildNativeRaidCounterAttackersAsync, buildNativeRaidRosterSummary, hydrateNativeToolCatalog, nativeTypeEffectiveness } from '../../../src/features/tools/nativeBattleModels';

const fast = { move_id: 1, name: 'Vine Whip', type_id: 10, raid_power: 10, pvp_power: 5, raid_energy: 8, pvp_energy: 8, raid_cooldown: 1, pvp_turns: 2, is_fast: 1, type_name: 'grass', legacy: false, type: 'grass' } as Move;
const charged = { ...fast, move_id: 2, name: 'Power Whip', raid_power: 90, raid_energy: -50, raid_cooldown: 2.5, is_fast: 0 } as Move;
const secondCharged = { ...charged, move_id: 3, name: 'Sludge Bomb', type_name: 'poison', type: 'poison' } as Move;
const pokemon = { pokemon_id: 1, name: 'Bulbasaur', pokedex_number: 1, attack: 118, defense: 111, stamina: 128, available: 1, cp40: 1000, cp50: 1200, type1_name: 'grass', type2_name: 'poison', image_url: '/1.png', moves: [], raid_boss: [], max: [{ pokemon_id: 1, dynamax: 1, gigantamax: 0, dynamax_release_date: null, gigantamax_release_date: null }] } as unknown as BasePokemon;
const ownedInstance = {
  attack_iv: 12,
  charged_move1_id: 3,
  charged_move2_id: null,
  cp: 987,
  defense_iv: 13,
  disabled: false,
  fast_move_id: 1,
  instance_id: 'caught-bulbasaur',
  is_caught: true,
  level: 37,
  nickname: 'Leafy',
  pokemon_id: 1,
  stamina_iv: 14,
  variant_id: '0001-default',
} as PokemonInstance;
const raidBoss = {
  id: 1,
  pokemon_id: 1,
  name: 'Bulbasaur',
  form: 'Normal',
  type: '1',
  boosted_weather: '',
  max_boosted_cp: 500,
  max_unboosted_cp: 400,
  min_boosted_cp: 300,
  min_unboosted_cp: 200,
  possible_shiny: 1,
  tier: '1',
};

describe('native battle models', () => {
  it('ranks an owned crowned form after loading its separate move pool', () => {
    const crownFast = { ...fast, move_id: 20, name: 'Metal Claw', type: 'steel', type_name: 'steel' };
    const crownCharged = { ...charged, move_id: 21, name: 'Behemoth Blade', type: 'steel', type_name: 'steel' };
    const zacian = {
      ...pokemon, pokemon_id: 888, pokedex_number: 888, name: 'Zacian',
      crownForms: [{ id: 1, base_pokemon_id: 888, crown_pokemon_id: 2290, display_form: 'Crowned Sword', name: 'Zacian', image_url: '/crowned-zacian.png', attack: 332, defense: 240, stamina: 192, type1_name: 'Fairy', type2_name: 'Steel', moves: [] } as unknown as CrownForm],
    };
    const catalog = hydrateNativeToolCatalog([zacian], [{ pokemon_id: 888, moves: [fast, charged], fusion: [], crownForms: [{ id: 1, moves: [crownFast, crownCharged] }] }]);
    const instances = { zacian: { ...ownedInstance, instance_id: 'zacian', pokemon_id: 888, variant_id: '0888-default', crown: true, fast_move_id: 20, charged_move1_id: 21 } };
    const roster = buildNativeRaidRosterSummary(catalog, instances);
    expect(roster.eligibleCount).toBe(1);
    expect(roster.attackers[0]).toMatchObject({ name: 'Crowned Sword Zacian', raidRoster: { formSource: 'crown' } });
    expect(buildNativeMaxRankings({ catalog, instances, scope: 'owned', role: 'damage' })[0]?.maxRanking?.maxMoveName).toBe('Behemoth Blade');
  });

  it('hydrates move and raid chunks and ranks legal attackers', () => {
    const hydrated = hydrateNativeToolCatalog([pokemon], [{ pokemon_id: 1, moves: [fast, charged], fusion: [], crownForms: [] }], [{ pokemon_id: 1, raid_boss: [raidBoss] }]);
    expect(buildNativeRaidBosses(hydrated)).toHaveLength(1);
    expect(buildNativeRaidAttackers({ catalog: hydrated })[0]?.fastMove?.name).toBe('Vine Whip');
    expect(buildNativeMaxRankings({ catalog: hydrated, role: 'damage' })[0]?.maxKind).toBe('dynamax');
  });
  it('reuses immutable Max ranking projections without mixing filter settings', () => {
    const catalog = [{ ...pokemon, moves: [fast, charged] }] as BasePokemon[];
    const damage = buildNativeMaxRankings({ catalog, role: 'damage' });
    expect(buildNativeMaxRankings({ catalog, role: 'damage' })).toBe(damage);
    expect(buildNativeMaxRankings({ catalog, role: 'tank' })).not.toBe(damage);
    expect(buildNativeMaxRankings({ catalog, role: 'damage', selectedType: 'grass' })).not.toBe(damage);
  });
  it('applies both defending types', () => expect(nativeTypeEffectiveness('grass', ['water', 'ground'])).toBeCloseTo(2.56));
  it('ranks each caught copy using its recorded build instead of a species proxy', () => {
    const hydrated = { ...pokemon, moves: [fast, charged, secondCharged] } as BasePokemon;
    const rows = buildNativeRaidAttackers({
      catalog: [hydrated],
      instances: { 'caught-bulbasaur': ownedInstance },
      scope: 'owned',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      chargedMove: expect.objectContaining({ name: 'Sludge Bomb' }),
      cp: 987,
      fastMove: expect.objectContaining({ name: 'Vine Whip' }),
      name: 'Bulbasaur',
      rosterDetail: 'Leafy · Level 37 · 87% IV',
      sourceInstanceId: 'caught-bulbasaur',
    });
  });
  it('shows all legal movesets and applies battle-condition modifiers', () => {
    const hydrated = { ...pokemon, moves: [fast, charged, secondCharged] } as BasePokemon;
    const best = buildNativeRaidAttackers({ catalog: [hydrated] });
    const all = buildNativeRaidAttackers({ catalog: [hydrated], settings: { bestOnly: false } });
    const boosted = buildNativeRaidAttackers({
      catalog: [hydrated],
      settings: { friendship: 'best', megaAllyBonus: 'matching', partyPower: 'party4' },
    });
    expect(best).toHaveLength(1);
    expect(all).toHaveLength(2);
    expect(boosted[0]?.score).toBeGreaterThan(best[0]?.score ?? Infinity);
  });
  it('applies boss behavior, dodging, Party Power timing, and shadow state to boss counters', () => {
    const hydrated = { ...pokemon, moves: [fast, charged, secondCharged] } as BasePokemon;
    const boss = buildNativeRaidBosses(hydrateNativeToolCatalog(
      [hydrated],
      [],
      [{ pokemon_id: 1, raid_boss: [raidBoss] }],
    ))[0];
    const expected = buildNativeRaidAttackers({ boss, catalog: [hydrated] })[0];
    const favorableDodging = buildNativeRaidAttackers({ boss, catalog: [hydrated], settings: { bossMovesetMode: 'favorable', dodgeStrategy: 'charged' } })[0];
    const hostileEnraged = buildNativeRaidAttackers({ boss, catalog: [hydrated], settings: { bossMovesetMode: 'hostile', shadowBossMode: 'enraged' } })[0];
    const timedPartyPower = buildNativeRaidAttackers({ boss, catalog: [hydrated], settings: { partyPower: 'party4', partyPowerStrategy: 'strongest-charged' } })[0];
    expect(favorableDodging?.counter).toBeTruthy();
    expect(favorableDodging?.counter?.faints).toBeLessThanOrEqual(expected?.counter?.faints ?? -1);
    expect(hostileEnraged?.score).toBeLessThan(expected?.score ?? 0);
    expect(timedPartyPower?.score).toBeGreaterThan(expected?.score ?? Infinity);
  });
  it('cooperatively produces the same boss counter order and metrics as the canonical synchronous model', async () => {
    const hydrated = { ...pokemon, moves: [fast, charged, secondCharged] } as BasePokemon;
    const boss = buildNativeRaidBosses(hydrateNativeToolCatalog(
      [hydrated],
      [],
      [{ pokemon_id: 1, raid_boss: [raidBoss] }],
    ))[0];
    const expected = buildNativeRaidAttackers({ boss, catalog: [hydrated] });
    const actual = await buildNativeRaidCounterAttackersAsync({ boss, catalog: [hydrated] });
    expect(actual).toEqual(expected);
  });
  it('globally sorts cooperative chunks exactly like the canonical model', async () => {
    const catalog = Array.from({ length: 24 }, (_, index) => ({
      ...pokemon,
      attack: 95 + (index * 11) % 137,
      defense: 90 + (index * 7) % 89,
      image_url: `/${index + 1}.png`,
      moves: [
        { ...fast, move_id: 1000 + index * 3, raid_power: 7 + index % 9 },
        { ...charged, move_id: 1001 + index * 3, raid_power: 55 + (index * 17) % 80 },
        { ...secondCharged, move_id: 1002 + index * 3, raid_power: 50 + (index * 13) % 90 },
      ],
      name: index === 0 ? 'Bulbasaur' : `Attacker ${index + 1}`,
      pokemon_id: index + 1,
      pokedex_number: index + 1,
      raid_boss: index === 0 ? [raidBoss] : [],
    })) as BasePokemon[];
    const boss = buildNativeRaidBosses(catalog)[0];
    const expected = buildNativeRaidAttackers({ boss, catalog, settings: { bestOnly: false } });
    const actual = await buildNativeRaidCounterAttackersAsync({ boss, catalog, settings: { bestOnly: false } });
    expect(actual.map((entry) => entry.id)).toEqual(expected.map((entry) => entry.id));
    expect(actual).toEqual(expected);
  });
  it('uses the calibrated dodge success rate instead of treating every dodge as successful', () => {
    const hydrated = { ...pokemon, moves: [fast, charged, secondCharged] } as BasePokemon;
    const boss = buildNativeRaidBosses(hydrateNativeToolCatalog(
      [hydrated],
      [],
      [{ pokemon_id: 1, raid_boss: [raidBoss] }],
    ))[0];
    const alwaysDodges = buildNativeRaidAttackers({
      boss,
      catalog: [hydrated],
      settings: { dodgeStrategy: 'charged', dodgeSuccessRate: 1 },
    })[0];
    const rarelyDodges = buildNativeRaidAttackers({
      boss,
      catalog: [hydrated],
      settings: { dodgeStrategy: 'charged', dodgeSuccessRate: .25 },
    })[0];
    expect(alwaysDodges?.counter).toBeTruthy();
    expect(alwaysDodges?.counter?.faints).toBeLessThanOrEqual(rarelyDodges?.counter?.faints ?? -1);
  });
});
