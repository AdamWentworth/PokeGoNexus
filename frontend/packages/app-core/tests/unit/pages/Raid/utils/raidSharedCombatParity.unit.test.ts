import { describe, expect, it } from 'vitest';
import type { Move } from '@shared-contracts/pokemon';
import type { PokemonVariant } from '@shared-contracts/variants';
import {
  calculateSharedEffectiveRaidDps,
  calculateSharedRaidAttackerBattleStats,
  calculateSharedRaidAttackerCp,
  calculateSharedRaidBossCp,
  calculateSharedRaidBossMoveDamage,
  calculateSharedRaidBossStats,
  calculateSharedRaidIncomingPressure,
  calculateSharedRaidMoveDamage,
  buildSharedRaidIncomingPressureScenarios,
  getSharedRaidAttackerIvPercent,
  getSharedRaidAttackerLevelLabel,
  getSharedProcessedRaidMoveSeconds,
  type SharedRaidCounterSettings,
} from '@pokemongonexus/shared-domain/raid-combat';
import { RAID_TIER_PRESETS } from '@pokemongonexus/shared-domain/raid-rules';
import {
  calculateEffectiveRaidDps,
  calculateRaidBossCp,
  calculateRaidBossMoveDamage,
  calculateRaidBossStats,
  calculateRaidIncomingPressure,
  calculateRaidMoveDamage,
  buildRaidIncomingPressureScenarios,
  getProcessedRaidMoveSeconds,
} from '@/pages/Raid/utils/raidCombat';
import {
  calculateRaidAttackerBattleStats,
} from '@/pages/Raid/utils/raidTargetModel';
import {
  calculateRaidAttackerCp,
  getRaidAttackerIvPercent,
  getRaidAttackerLevelLabel,
} from '@/pages/Raid/utils/raidAttackerModel';
import type { RaidCounterSettings } from '@/pages/Raid/utils/raidTypes';

const fastMove = {
  is_fast: 1,
  name: 'Confusion',
  raid_cooldown: 1600,
  raid_energy: 15,
  raid_power: 20,
  type: 'psychic',
  type_name: 'psychic',
} as Move;
const chargedMove = {
  ...fastMove,
  is_fast: 0,
  name: 'Psystrike',
  raid_cooldown: 2300,
  raid_energy: -50,
  raid_power: 95,
} as Move;
const attacker = {
  attack: 300,
  backgrounds: [],
  currentImage: '',
  defense: 182,
  fusion_id: null,
  image_url: '',
  moves: [fastMove, chargedMove],
  name: 'Mewtwo',
  pokemon_id: 150,
  pokedex_number: 150,
  raid_boss: [],
  species_name: 'Mewtwo',
  stamina: 214,
  type1_name: 'psychic',
  type2_name: 'none',
  variant_id: '150-default',
  variantType: 'default',
} as unknown as PokemonVariant;
const boss = {
  ...attacker,
  attack: 240,
  defense: 200,
  name: 'Raid Boss',
  species_name: 'Raid Boss',
  type1_name: 'fighting',
  variant_id: 'boss-default',
} as PokemonVariant;
const settings = {
  attackerLevel: '50.0',
  bossMovesetMode: 'expected',
  dodgeStrategy: 'none',
  friendship: 'best',
  megaAllyBonus: 'matching',
  partyPower: 'party2',
  relobbySeconds: 10,
  shadowBossMode: 'normal',
  weatherBoostedType: 'psychic',
} satisfies RaidCounterSettings;

describe('shared Raid combat primitives', () => {
  it('matches canonical web CP and battle stat calculations', () => {
    expect(calculateSharedRaidAttackerCp(attacker, settings.attackerLevel))
      .toBe(calculateRaidAttackerCp(attacker, settings.attackerLevel));
    expect(calculateSharedRaidAttackerBattleStats(
      attacker,
      settings as SharedRaidCounterSettings,
    )).toEqual(calculateRaidAttackerBattleStats(attacker, settings));
    expect(calculateSharedRaidBossCp(boss, RAID_TIER_PRESETS.legendary.bossHp))
      .toBe(calculateRaidBossCp(boss, RAID_TIER_PRESETS.legendary.bossHp));
    expect(calculateSharedRaidBossStats(boss, RAID_TIER_PRESETS.legendary, 'normal'))
      .toEqual(calculateRaidBossStats(boss, RAID_TIER_PRESETS.legendary, 'normal'));
  });

  it('matches canonical discrete move damage and timing', () => {
    const attackerStats = calculateRaidAttackerBattleStats(attacker, settings);
    const bossStats = calculateRaidBossStats(boss, RAID_TIER_PRESETS.legendary, 'normal');
    const sharedSettings = settings as SharedRaidCounterSettings;
    expect(getSharedProcessedRaidMoveSeconds(chargedMove))
      .toBe(getProcessedRaidMoveSeconds(chargedMove));
    expect(calculateSharedRaidMoveDamage({
      attacker,
      attackerAttack: attackerStats.attack,
      bossDefense: bossStats.defense,
      bossTypes: ['fighting'],
      charged: true,
      move: chargedMove,
      settings: sharedSettings,
    })).toBe(calculateRaidMoveDamage({
      attacker,
      attackerAttack: attackerStats.attack,
      bossDefense: bossStats.defense,
      bossTypes: ['fighting'],
      charged: true,
      move: chargedMove,
      settings,
    }));
    expect(calculateSharedRaidBossMoveDamage({
      attacker,
      attackerDefense: attackerStats.defense,
      boss,
      bossAttack: bossStats.attack,
      dodged: true,
      move: chargedMove,
      weatherBoostedType: settings.weatherBoostedType,
    })).toBe(calculateRaidBossMoveDamage({
      attacker,
      attackerDefense: attackerStats.defense,
      boss,
      bossAttack: bossStats.attack,
      dodged: true,
      move: chargedMove,
      weatherBoostedType: settings.weatherBoostedType,
    }));
  });

  it('matches canonical relobby-adjusted DPS', () => {
    expect(calculateSharedEffectiveRaidDps({ dps: 42, relobbySeconds: 10, tdo: 520 }))
      .toBe(calculateEffectiveRaidDps({ dps: 42, relobbySeconds: 10, tdo: 520 }));
  });

  it('matches canonical attacker labels and incoming boss pressure', () => {
    expect(getSharedRaidAttackerLevelLabel(attacker, settings.attackerLevel))
      .toBe(getRaidAttackerLevelLabel(attacker, settings.attackerLevel));
    expect(getSharedRaidAttackerIvPercent(attacker))
      .toBe(getRaidAttackerIvPercent(attacker));
    const sharedScenarios = buildSharedRaidIncomingPressureScenarios({
      attackerTypes: ['psychic'],
      boss,
      bossAttack: 240,
      weatherBoostedType: '',
    });
    const webScenarios = buildRaidIncomingPressureScenarios({
      attackerTypes: ['psychic'],
      boss,
      bossAttack: 240,
      weatherBoostedType: '',
    });
    expect(sharedScenarios).toEqual(webScenarios);
    expect(calculateSharedRaidIncomingPressure(sharedScenarios, 200, 'expected'))
      .toEqual(calculateRaidIncomingPressure(webScenarios, 200, 'expected'));
    expect(calculateSharedRaidIncomingPressure(sharedScenarios, 200, 'hostile'))
      .toEqual(calculateRaidIncomingPressure(webScenarios, 200, 'hostile'));
  });
});
