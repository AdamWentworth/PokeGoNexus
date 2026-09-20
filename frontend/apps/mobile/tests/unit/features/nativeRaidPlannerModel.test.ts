import { estimateRaidGroup, simulateRaidGroupAtTrainerCount } from '@pokemongonexus/app-core/raid-model';
import { buildRaidPartyTrainers } from '@pokemongonexus/app-core/raid-party';
import { optimizeRaidParty } from '@pokemongonexus/app-core/raid-party-optimizer';
import { simulateHeterogeneousRaidPartyAcrossBossMovesets } from '@pokemongonexus/app-core/raid-party-simulation';
import type { NativeRaidBossEntry } from '../../../src/features/tools/nativeBattleModels';
import { canonicalNativeRaidSettings } from '../../../src/features/tools/nativeBattleModels';
import {
  createNativeRaidParty,
  estimateNativeRaidGroup,
  getNativeRaidTeam,
  optimizeNativeRaidParty,
  resolveNativeRaidTier,
  simulateNativeRaidLobby,
  simulateNativeRaidParty,
} from '../../../src/features/tools/nativeRaidPlannerModel';
import { createNativeRaidFixture } from '../../nativeRaidFixtures';

const fallbackBoss = (tier: string) => ({ boss: { tier, type: tier } }) as NativeRaidBossEntry;

describe('native raid planner canonical adapter', () => {
  it('maps public raid tier labels to the canonical battle presets', () => {
    expect(resolveNativeRaidTier(fallbackBoss('one-star'))).toMatchObject({ bossHp: 600, timeLimitSeconds: 180 });
    expect(resolveNativeRaidTier(fallbackBoss('shadow legendary'))).toMatchObject({ bossHp: 15000, key: 'shadow-legendary' });
    expect(resolveNativeRaidTier(fallbackBoss('4'))).toMatchObject({ bossHp: 9000, key: 'community-day' });
    expect(resolveNativeRaidTier(fallbackBoss('elite'))).toMatchObject({ bossHp: 20000, key: 'elite' });
    expect(resolveNativeRaidTier(fallbackBoss('super_mega'))).toMatchObject({ bossHp: 25000, key: 'super-mega' });
  });

  it('uses the same legal default team and group estimate as Vite', () => {
    const { boss, scores, settings, tier } = createNativeRaidFixture();
    const canonicalScores = scores.flatMap((entry) => entry.raidCounterScore ? [entry.raidCounterScore] : []);
    expect(new Set(getNativeRaidTeam(scores).map((entry) => entry.variantId)).size).toBe(getNativeRaidTeam(scores).length);
    expect(estimateNativeRaidGroup(scores, boss, settings, tier)).toEqual(
      estimateRaidGroup(canonicalScores, boss.variant, tier, canonicalNativeRaidSettings(settings)),
    );
  });

  it('returns the exact canonical fixed-lobby simulation', () => {
    const { boss, scores, settings, tier } = createNativeRaidFixture();
    const canonicalScores = scores.flatMap((entry) => entry.raidCounterScore ? [entry.raidCounterScore] : []);
    expect(simulateNativeRaidLobby(scores, boss, settings, 2, tier)).toEqual(
      simulateRaidGroupAtTrainerCount(canonicalScores, boss.variant, tier, canonicalNativeRaidSettings(settings), 2),
    );
  });

  it('returns the exact canonical heterogeneous-party simulation', () => {
    const { boss, scores, settings, tier } = createNativeRaidFixture();
    const drafts = createNativeRaidParty(scores, settings, 2);
    drafts[1] = { ...drafts[1], actionDelaySeconds: 1, dodgeStrategy: 'charged' };
    const canonicalScores = scores.flatMap((entry) => entry.raidCounterScore ? [entry.raidCounterScore] : []);
    const trainers = buildRaidPartyTrainers(drafts, canonicalScores, canonicalNativeRaidSettings(settings));
    expect(simulateNativeRaidParty({ boss, drafts, scores, settings, tier })).toEqual(
      simulateHeterogeneousRaidPartyAcrossBossMovesets({ trainers, boss: boss.variant, tier }),
    );
  });

  it('returns the exact canonical bounded-beam optimization', () => {
    const { boss, scores, settings, tier } = createNativeRaidFixture();
    const drafts = createNativeRaidParty(scores, settings, 2);
    const canonicalScores = scores.flatMap((entry) => entry.raidCounterScore ? [entry.raidCounterScore] : []);
    const trainers = buildRaidPartyTrainers(drafts, canonicalScores, canonicalNativeRaidSettings(settings));
    expect(optimizeNativeRaidParty({ boss, drafts, scores, settings, tier })).toEqual(
      optimizeRaidParty({ trainers, scores: canonicalScores.slice(0, 80), boss: boss.variant, tier }),
    );
  });
});
