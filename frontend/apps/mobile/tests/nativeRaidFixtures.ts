import type { BasePokemon, Move } from '@pokemongonexus/shared-contracts/pokemon';
import {
  buildNativeRaidAttackers,
  buildNativeRaidBosses,
  DEFAULT_NATIVE_RAID_SETTINGS,
} from '../src/features/tools/nativeBattleModels';

const fastMove = (index: number): Move => ({
  move_id: 100 + index,
  name: `Fast ${index}`,
  raid_power: 10 + index,
  raid_energy: 8,
  raid_cooldown: 1,
  is_fast: 1,
  type_name: 'grass',
  type: 'grass',
} as Move);

const chargedMove = (index: number): Move => ({
  move_id: 200 + index,
  name: `Charged ${index}`,
  raid_power: 70 + index,
  raid_energy: -50,
  raid_cooldown: 2.5,
  is_fast: 0,
  type_name: 'grass',
  type: 'grass',
} as Move);

export const nativeRaidCatalog = Array.from({ length: 8 }, (_, index) => ({
  pokemon_id: index + 1,
  name: index === 0 ? 'Bulbasaur' : `Attacker ${index + 1}`,
  pokedex_number: index + 1,
  attack: 118 + index * 8,
  defense: 111 + index * 3,
  stamina: 128 + index * 4,
  available: 1,
  cp40: 1000 + index * 150,
  cp50: 1200 + index * 180,
  type1_name: 'grass',
  type2_name: index === 0 ? 'poison' : null,
  image_url: `/${index + 1}.png`,
  moves: [fastMove(index), chargedMove(index)],
  raid_boss: index === 0 ? [{
    id: 1,
    pokemon_id: 1,
    name: 'Bulbasaur',
    form: 'Normal',
    type: 'one-star',
    boosted_weather: '',
    max_boosted_cp: 500,
    max_unboosted_cp: 400,
    min_boosted_cp: 300,
    min_unboosted_cp: 200,
    possible_shiny: 1,
    tier: '1',
  }] : [],
})) as unknown as BasePokemon[];

export const createNativeRaidFixture = () => {
  const boss = buildNativeRaidBosses(nativeRaidCatalog)[0];
  if (!boss) throw new Error('Native Raid fixture did not produce a boss.');
  const settings = { ...DEFAULT_NATIVE_RAID_SETTINGS };
  const scores = buildNativeRaidAttackers({
    boss,
    catalog: nativeRaidCatalog,
    scope: 'catalog',
    settings,
  });
  return { boss, catalog: nativeRaidCatalog, scores, settings, tier: boss.tier };
};
