import type { PokemonVariant } from "../../../types/pokemonVariants";
import type { Move } from "../../../types/pokemonSubTypes";
import {
  calculateRaidBossMoveDamage,
  calculateRaidBossStats,
  calculateRaidMoveDamage,
  getProcessedRaidMoveSeconds,
  getRaidMoveEnergy,
} from "./raidCombat";
import { getVariantTypeNames, normalizeTypeName } from "./raidCatalog";
import {
  PARTY_POWER_ACTIVATION_DELAY_SECONDS,
  PARTY_POWER_ACTIVE_CHARGED_MULTIPLIER,
  PARTY_POWER_METER_MAX,
  PARTY_POWER_POINTS_PER_MOVE,
  RAID_MONTE_CARLO_MAX_SAMPLES,
  RAID_MONTE_CARLO_MIN_SAMPLES,
  RAID_PARTY_MAX_TRAINERS,
  RAID_SIMULATION_ATTACKER_SWAP_SECONDS,
  RAID_SIMULATION_BOSS_ACTION_DELAY_SECONDS,
  RAID_SIMULATION_BOSS_DELAY_OPTIONS_SECONDS,
  RAID_SIMULATION_DODGE_SECONDS,
  RAID_SIMULATION_ENERGY_CAP,
} from "./raidRules";
import {
  buildRaidSimulationDistribution,
  createRaidSeededRandom,
  getRaidBossMovesets,
  summarizeRaidSimulationOutcomes,
} from "./raidSimulation";
import {
  activatesPartyPowerWhenMeterFills,
  shouldActivatePartyPowerForChargedMove,
} from "./raidPartyPower";
import { calculateRaidAttackerBattleStats } from "./raidTargetModel";
import { variantUsesRaidMegaSlot } from "./raidTeamSelection";
import {
  canBreakSuperMegaShield,
  getSuperMegaShieldRules,
} from "./superMegaRaid";
import type {
  MegaAllyBonusKey,
  RaidPartySimulationResult,
  RaidPartyTrainer,
  RaidPartyTrainerResult,
  RaidSimulationTeamMember,
  RaidTierPreset,
} from "./raidTypes";

type PartySimulationActor =
  "trainer-start" | "trainer-hit" | "trainer-spawn" | "boss-start" | "boss-hit";

type PartySimulationEvent = {
  actor: PartySimulationActor;
  time: number;
  sequence: number;
  trainerIndex?: number;
  trainerGeneration?: number;
  move?: Move;
  partyPowered?: boolean;
  dodgeAttempts?: number[];
  dodgeOutcomes?: Record<number, boolean>;
};

type TrainerMemberProfile = {
  member: RaidSimulationTeamMember;
  attack: number;
  defense: number;
  hp: number;
  chargedCost: number;
  chargedDamage: number;
  bossFastDamage: number;
  bossChargedDamage: number;
  dodgedBossChargedDamage: number;
  canBreakSuperMegaShield: boolean;
};

type TrainerState = {
  trainer: RaidPartyTrainer;
  profiles: TrainerMemberProfile[];
  teamPosition: number;
  generation: number;
  active: boolean;
  hp: number;
  energy: number;
  reservedDodgeHitTime: number | null;
  partyPowerMeter: number;
  partyPowerReadyAt: number | null;
  damageDealt: number;
  faints: number;
  relobbies: number;
  dodges: number;
  attackerChargedMoves: number;
  partyPoweredChargedMoves: number;
  superMegaShieldBreakUsed: boolean;
};

type PartySimulationRandomness = {
  shouldBossUseCharged?: () => boolean;
  shouldDodgeSucceed?: (trainerIndex: number) => boolean;
  getBossActionDelaySeconds?: () => number;
};

const roundToRaidTurn = (seconds: number): number =>
  Math.round(seconds * 2) / 2;

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

const getCurrentProfile = (state: TrainerState): TrainerMemberProfile =>
  state.profiles[state.teamPosition];

const getMegaBoostedTypes = (variant: PokemonVariant): string[] => {
  const name = (variant.species_name || variant.name).toLowerCase();
  if (name.includes("groudon") && variant.primal) {
    return ["fire", "grass", "ground"];
  }
  if (name.includes("kyogre") && variant.primal) {
    return ["water", "electric", "bug"];
  }
  if (name.includes("rayquaza") && variantUsesRaidMegaSlot(variant)) {
    return ["flying", "psychic", "dragon"];
  }
  return getVariantTypeNames(variant);
};

const getStrongerMegaBonus = (
  current: MegaAllyBonusKey,
  candidate: MegaAllyBonusKey,
): MegaAllyBonusKey => {
  const rank: Record<MegaAllyBonusKey, number> = {
    none: 0,
    general: 1,
    matching: 2,
  };
  return rank[candidate] > rank[current] ? candidate : current;
};

const resolveActiveMegaBonus = (
  trainerIndex: number,
  move: Move,
  states: TrainerState[],
): MegaAllyBonusKey => {
  let bonus = states[trainerIndex].trainer.settings.megaAllyBonus;
  const moveType = normalizeTypeName(move.type_name || move.type);

  states.forEach((state, index) => {
    if (index === trainerIndex || !state.active) return;
    const activeVariant = getCurrentProfile(state).member.attacker;
    if (!variantUsesRaidMegaSlot(activeVariant)) return;
    const candidate = getMegaBoostedTypes(activeVariant).includes(moveType)
      ? "matching"
      : "general";
    bonus = getStrongerMegaBonus(bonus, candidate);
  });

  return bonus;
};

const buildTrainerProfiles = ({
  trainer,
  boss,
  bossFastMove,
  bossChargedMove,
  bossAttack,
  bossDefense,
  bossTypes,
}: {
  trainer: RaidPartyTrainer;
  boss: PokemonVariant;
  bossFastMove: Move;
  bossChargedMove: Move;
  bossAttack: number;
  bossDefense: number;
  bossTypes: string[];
}): TrainerMemberProfile[] =>
  trainer.team.map((member) => {
    const attackerStats = calculateRaidAttackerBattleStats(
      member.attacker,
      trainer.settings,
    );
    return {
      member,
      attack: attackerStats.attack,
      defense: attackerStats.defense,
      hp: attackerStats.hp,
      chargedCost: Math.max(1, Math.abs(getRaidMoveEnergy(member.chargedMove))),
      chargedDamage: calculateRaidMoveDamage({
        move: member.chargedMove,
        attacker: member.attacker,
        attackerAttack: attackerStats.attack,
        bossDefense,
        bossTypes,
        settings: trainer.settings,
        charged: true,
        partyPowerMultiplierOverride: 1,
      }),
      bossFastDamage: calculateRaidBossMoveDamage({
        move: bossFastMove,
        boss,
        bossAttack,
        attacker: member.attacker,
        attackerDefense: attackerStats.defense,
        weatherBoostedType: trainer.settings.weatherBoostedType,
      }),
      bossChargedDamage: calculateRaidBossMoveDamage({
        move: bossChargedMove,
        boss,
        bossAttack,
        attacker: member.attacker,
        attackerDefense: attackerStats.defense,
        weatherBoostedType: trainer.settings.weatherBoostedType,
      }),
      dodgedBossChargedDamage: calculateRaidBossMoveDamage({
        move: bossChargedMove,
        boss,
        bossAttack,
        attacker: member.attacker,
        attackerDefense: attackerStats.defense,
        weatherBoostedType: trainer.settings.weatherBoostedType,
        dodged: true,
      }),
      canBreakSuperMegaShield: canBreakSuperMegaShield(member.attacker),
    };
  });

const buildTrainerResult = (
  state: TrainerState,
  elapsedSeconds: number,
  totalDamage: number,
): RaidPartyTrainerResult => ({
  id: state.trainer.id,
  label: state.trainer.label,
  damageDealt: state.damageDealt,
  damageShare: totalDamage > 0 ? state.damageDealt / totalDamage : 0,
  dps: elapsedSeconds > 0 ? state.damageDealt / elapsedSeconds : 0,
  faints: state.faints,
  relobbies: state.relobbies,
  dodges: state.dodges,
  attackerChargedMoves: state.attackerChargedMoves,
  partyPoweredChargedMoves: state.partyPoweredChargedMoves,
});

export const simulateHeterogeneousRaidPartyBattle = ({
  trainers,
  boss,
  bossFastMove,
  bossChargedMove,
  tier,
  chargedDecisionOffset = 0,
  shouldBossUseCharged,
  shouldDodgeSucceed,
  getBossActionDelaySeconds,
}: {
  trainers: RaidPartyTrainer[];
  boss: PokemonVariant;
  bossFastMove: Move;
  bossChargedMove: Move;
  tier: RaidTierPreset;
  chargedDecisionOffset?: 0 | 1;
} & PartySimulationRandomness): RaidPartySimulationResult => {
  if (
    trainers.length === 0 ||
    trainers.some((trainer) => trainer.team.length === 0)
  ) {
    throw new Error(
      "Every raid party Trainer requires at least one team member.",
    );
  }
  if (trainers.length > RAID_PARTY_MAX_TRAINERS) {
    throw new Error(
      `Raid parties support up to ${RAID_PARTY_MAX_TRAINERS} Trainers.`,
    );
  }

  const globalSettings = trainers[0].settings;
  const bossStats = calculateRaidBossStats(
    boss,
    tier,
    globalSettings.shadowBossMode,
  );
  const superMegaRules = getSuperMegaShieldRules(boss, tier);
  const bossTypes = getVariantTypeNames(boss);
  const states: TrainerState[] = trainers.map((trainer) => {
    const profiles = buildTrainerProfiles({
      trainer,
      boss,
      bossFastMove,
      bossChargedMove,
      bossAttack: bossStats.attack,
      bossDefense: bossStats.defense,
      bossTypes,
    });
    return {
      trainer,
      profiles,
      teamPosition: 0,
      generation: 0,
      active: true,
      hp: profiles[0].hp,
      energy: 0,
      reservedDodgeHitTime: null,
      partyPowerMeter: 0,
      partyPowerReadyAt: null,
      damageDealt: 0,
      faints: 0,
      relobbies: 0,
      dodges: 0,
      attackerChargedMoves: 0,
      partyPoweredChargedMoves: 0,
      superMegaShieldBreakUsed: false,
    };
  });
  const bossChargedCost = Math.max(
    1,
    Math.abs(getRaidMoveEnergy(bossChargedMove)),
  );
  const events: PartySimulationEvent[] = [];
  let sequence = 0;
  let bossHp = bossStats.hp;
  let bossEnergy = 0;
  let bossChargedOpportunity = 0;
  let bossChargedMoves = 0;
  let damageDealt = 0;
  let winTime: number | null = null;
  let superMegaShieldActive = false;
  let superMegaShieldsBroken = 0;
  const eligibleMegaTrainers = states.filter((state) =>
    state.profiles.some((profile) => profile.canBreakSuperMegaShield),
  ).length;

  const enqueue = (event: Omit<PartySimulationEvent, "sequence">) => {
    events.push({
      ...event,
      time: roundToRaidTurn(event.time),
      sequence: sequence++,
    });
  };
  const takeNextEvent = (): PartySimulationEvent | undefined => {
    let selectedIndex = -1;
    events.forEach((candidate, index) => {
      const selected = selectedIndex < 0 ? undefined : events[selectedIndex];
      if (
        !selected ||
        candidate.time < selected.time ||
        (candidate.time === selected.time &&
          candidate.sequence < selected.sequence)
      ) {
        selectedIndex = index;
      }
    });
    return selectedIndex < 0 ? undefined : events.splice(selectedIndex, 1)[0];
  };
  const nextBossActionDelay = () =>
    getBossActionDelaySeconds?.() ?? RAID_SIMULATION_BOSS_ACTION_DELAY_SECONDS;
  const activateSuperMegaShield = (time: number) => {
    superMegaShieldActive = true;
    states.forEach((state, trainerIndex) => {
      if (!state.active) return;
      const megaIndex = state.profiles.findIndex(
        (profile) => profile.canBreakSuperMegaShield,
      );
      if (megaIndex < 0) return;

      const alreadyActive = state.teamPosition === megaIndex;
      state.teamPosition = megaIndex;
      state.generation += 1;
      state.hp = alreadyActive ? state.hp : state.profiles[megaIndex].hp;
      state.energy = Math.max(
        state.energy,
        state.profiles[megaIndex].chargedCost,
      );
      state.reservedDodgeHitTime = null;
      enqueue({
        actor: "trainer-start",
        time: time + Math.max(0, state.trainer.actionDelaySeconds),
        trainerIndex,
        trainerGeneration: state.generation,
      });
    });
  };

  states.forEach((state, trainerIndex) => {
    enqueue({
      actor: "trainer-start",
      time: Math.max(0, state.trainer.actionDelaySeconds),
      trainerIndex,
      trainerGeneration: state.generation,
    });
  });
  enqueue({ actor: "boss-start", time: nextBossActionDelay() });

  while (events.length > 0) {
    const event = takeNextEvent();
    if (!event || event.time > bossStats.timeLimitSeconds || winTime != null)
      break;

    if (event.trainerIndex != null) {
      const state = states[event.trainerIndex];
      if (
        !state ||
        event.trainerGeneration !== state.generation ||
        (event.actor !== "trainer-spawn" && !state.active)
      ) {
        continue;
      }
    }

    if (event.actor === "trainer-start") {
      const trainerIndex = event.trainerIndex!;
      const state = states[trainerIndex];
      const profile = getCurrentProfile(state);
      const useCharged = state.energy >= profile.chargedCost;
      if (
        state.partyPowerReadyAt == null &&
        shouldActivatePartyPowerForChargedMove({
          settings: state.trainer.settings,
          meterFull: state.partyPowerMeter >= PARTY_POWER_METER_MAX,
          chargedAvailable: useCharged,
          currentChargedDamage: profile.chargedDamage,
          strongestChargedDamage: Math.max(
            ...state.profiles.map((candidate) => candidate.chargedDamage),
          ),
        })
      ) {
        state.partyPowerReadyAt = roundToRaidTurn(
          event.time + PARTY_POWER_ACTIVATION_DELAY_SECONDS,
        );
        enqueue({
          actor: "trainer-start",
          time: state.partyPowerReadyAt,
          trainerIndex,
          trainerGeneration: state.generation,
        });
        continue;
      }
      const move = useCharged
        ? profile.member.chargedMove
        : profile.member.fastMove;
      const hitTime = roundToRaidTurn(
        event.time + getProcessedRaidMoveSeconds(move),
      );
      if (
        state.reservedDodgeHitTime != null &&
        hitTime > state.reservedDodgeHitTime
      ) {
        enqueue({
          actor: "trainer-start",
          time:
            state.reservedDodgeHitTime +
            RAID_SIMULATION_DODGE_SECONDS +
            Math.max(0, state.trainer.actionDelaySeconds),
          trainerIndex,
          trainerGeneration: state.generation,
        });
        continue;
      }
      state.energy = useCharged
        ? Math.max(0, state.energy - profile.chargedCost)
        : Math.min(
            RAID_SIMULATION_ENERGY_CAP,
            state.energy +
              Math.max(0, getRaidMoveEnergy(profile.member.fastMove)),
          );
      const partyPowered =
        useCharged &&
        state.partyPowerReadyAt != null &&
        event.time >= state.partyPowerReadyAt;
      if (partyPowered) {
        state.partyPowerMeter = 0;
        state.partyPowerReadyAt = null;
      }
      enqueue({
        actor: "trainer-hit",
        time: hitTime,
        trainerIndex,
        trainerGeneration: state.generation,
        move,
        partyPowered,
      });
      continue;
    }

    if (event.actor === "trainer-hit") {
      const trainerIndex = event.trainerIndex!;
      const state = states[trainerIndex];
      const profile = getCurrentProfile(state);
      const charged = event.move === profile.member.chargedMove;
      const megaAllyBonus = resolveActiveMegaBonus(
        trainerIndex,
        event.move!,
        states,
      );
      const damage = calculateRaidMoveDamage({
        move: event.move!,
        attacker: profile.member.attacker,
        attackerAttack: profile.attack,
        bossDefense: bossStats.defense,
        bossTypes,
        settings: { ...state.trainer.settings, megaAllyBonus },
        charged,
        partyPowerMultiplierOverride:
          charged && event.partyPowered
            ? PARTY_POWER_ACTIVE_CHARGED_MULTIPLIER
            : 1,
      });
      if (charged) state.attackerChargedMoves += 1;
      if (event.partyPowered) state.partyPoweredChargedMoves += 1;
      const shieldedForHit = superMegaShieldActive;
      if (
        shieldedForHit &&
        charged &&
        profile.canBreakSuperMegaShield &&
        !state.superMegaShieldBreakUsed &&
        superMegaRules
      ) {
        state.superMegaShieldBreakUsed = true;
        superMegaShieldsBroken = Math.min(
          superMegaRules.shieldCount,
          superMegaShieldsBroken + 1,
        );
        if (superMegaShieldsBroken >= superMegaRules.shieldCount) {
          superMegaShieldActive = false;
        }
      }
      const bossHpBeforeDamage = bossHp;
      const phaseDamage = shieldedForHit
        ? Math.max(
            1,
            Math.floor(damage / superMegaRules!.shieldedDefenseMultiplier),
          )
        : damage;
      bossHp = Math.max(0, bossHp - phaseDamage);
      const appliedDamage = Math.min(phaseDamage, bossHpBeforeDamage);
      state.damageDealt += appliedDamage;
      damageDealt += appliedDamage;
      bossEnergy = Math.min(
        RAID_SIMULATION_ENERGY_CAP,
        bossEnergy + Math.ceil(phaseDamage / 2),
      );

      states.forEach((partyState) => {
        if (
          !partyState.active ||
          partyState.partyPowerReadyAt != null ||
          partyState.partyPowerMeter >= PARTY_POWER_METER_MAX
        ) {
          return;
        }
        const points =
          PARTY_POWER_POINTS_PER_MOVE[partyState.trainer.settings.partyPower];
        if (points <= 0) return;
        partyState.partyPowerMeter = Math.min(
          PARTY_POWER_METER_MAX,
          partyState.partyPowerMeter + points,
        );
        if (
          partyState.partyPowerMeter >= PARTY_POWER_METER_MAX &&
          activatesPartyPowerWhenMeterFills(partyState.trainer.settings)
        ) {
          partyState.partyPowerReadyAt =
            event.time + PARTY_POWER_ACTIVATION_DELAY_SECONDS;
        }
      });

      const superMegaTriggered = Boolean(
        superMegaRules &&
        !superMegaShieldActive &&
        superMegaShieldsBroken === 0 &&
        bossHp > 0 &&
        bossHp <= bossStats.hp * superMegaRules.triggerHpFraction,
      );
      if (superMegaTriggered) {
        activateSuperMegaShield(event.time);
      }

      if (bossHp <= 0) {
        winTime = event.time;
      } else if (!superMegaTriggered) {
        enqueue({
          actor: "trainer-start",
          time: event.time + Math.max(0, state.trainer.actionDelaySeconds),
          trainerIndex,
          trainerGeneration: state.generation,
        });
      }
      continue;
    }

    if (event.actor === "boss-start") {
      const chargedAvailable = bossEnergy >= bossChargedCost;
      const chargedDecision = chargedAvailable
        ? shouldBossUseCharged?.()
        : undefined;
      const useCharged =
        chargedAvailable &&
        (chargedDecision ??
          (bossChargedOpportunity++ + chargedDecisionOffset) % 2 === 1);
      const move = useCharged ? bossChargedMove : bossFastMove;
      bossEnergy = useCharged
        ? Math.max(0, bossEnergy - bossChargedCost)
        : Math.min(
            RAID_SIMULATION_ENERGY_CAP,
            bossEnergy + Math.max(0, getRaidMoveEnergy(bossFastMove)),
          );
      const hitTime = roundToRaidTurn(
        event.time + getProcessedRaidMoveSeconds(move),
      );
      const dodgeAttempts: number[] = [];
      const dodgeOutcomes: Record<number, boolean> = {};
      states.forEach((state, trainerIndex) => {
        if (!state.active) return;
        const committed = events.some(
          (queued) =>
            queued.actor === "trainer-hit" &&
            queued.trainerIndex === trainerIndex &&
            queued.trainerGeneration === state.generation &&
            queued.time > hitTime,
        );
        const willDodge =
          useCharged &&
          state.trainer.settings.dodgeStrategy === "charged" &&
          !committed;
        if (!willDodge) return;
        state.reservedDodgeHitTime = hitTime;
        dodgeAttempts.push(trainerIndex);
        if (shouldDodgeSucceed) {
          dodgeOutcomes[trainerIndex] = shouldDodgeSucceed(trainerIndex);
        }
      });
      enqueue({
        actor: "boss-hit",
        time: hitTime,
        move,
        dodgeAttempts,
        dodgeOutcomes: shouldDodgeSucceed ? dodgeOutcomes : undefined,
      });
      continue;
    }

    if (event.actor === "boss-hit") {
      const charged = event.move === bossChargedMove;
      if (charged) bossChargedMoves += 1;
      states.forEach((state, trainerIndex) => {
        if (!state.active) return;
        const profile = getCurrentProfile(state);
        const attemptedDodge =
          event.dodgeAttempts?.includes(trainerIndex) ?? false;
        const sampledDodge = event.dodgeOutcomes?.[trainerIndex];
        const dodgeRate = clampUnit(
          state.trainer.settings.dodgeSuccessRate ?? 1,
        );
        const expectedDodgedDamage = Math.round(
          profile.dodgedBossChargedDamage * dodgeRate +
            profile.bossChargedDamage * (1 - dodgeRate),
        );
        const damage = charged
          ? attemptedDodge
            ? sampledDodge == null
              ? expectedDodgedDamage
              : sampledDodge
                ? profile.dodgedBossChargedDamage
                : profile.bossChargedDamage
            : profile.bossChargedDamage
          : profile.bossFastDamage;
        if (attemptedDodge) {
          state.dodges +=
            sampledDodge == null ? dodgeRate : sampledDodge ? 1 : 0;
        }
        if (state.reservedDodgeHitTime === event.time) {
          state.reservedDodgeHitTime = null;
        }
        const appliedBossDamage = superMegaShieldActive
          ? Math.max(
              1,
              Math.round(damage * superMegaRules!.enragedAttackMultiplier),
            )
          : damage;
        state.hp -= appliedBossDamage;
        state.energy = Math.min(
          RAID_SIMULATION_ENERGY_CAP,
          state.energy + Math.ceil(appliedBossDamage / 2),
        );

        if (state.hp > 0) return;
        state.faints += 1;
        state.active = false;
        state.teamPosition = (state.teamPosition + 1) % state.profiles.length;
        state.generation += 1;
        const needsRelobby = state.teamPosition === 0;
        if (needsRelobby) state.relobbies += 1;
        enqueue({
          actor: "trainer-spawn",
          time:
            event.time +
            (needsRelobby
              ? Math.max(0, state.trainer.settings.relobbySeconds)
              : RAID_SIMULATION_ATTACKER_SWAP_SECONDS),
          trainerIndex,
          trainerGeneration: state.generation,
        });
      });
      enqueue({
        actor: "boss-start",
        time: event.time + nextBossActionDelay(),
      });
      continue;
    }

    const trainerIndex = event.trainerIndex!;
    const state = states[trainerIndex];
    state.active = true;
    state.hp = getCurrentProfile(state).hp;
    state.energy = 0;
    enqueue({
      actor: "trainer-start",
      time: event.time + Math.max(0, state.trainer.actionDelaySeconds),
      trainerIndex,
      trainerGeneration: state.generation,
    });
  }

  const elapsedSeconds = winTime ?? bossStats.timeLimitSeconds;
  const dps = elapsedSeconds > 0 ? damageDealt / elapsedSeconds : 0;
  const trainerResults = states.map((state) =>
    buildTrainerResult(state, elapsedSeconds, damageDealt),
  );
  const baseResult = {
    damageDealt,
    elapsedSeconds,
    dps,
    projectedTimeToWinSeconds:
      winTime ?? (dps > 0 ? bossStats.hp / dps : Number.POSITIVE_INFINITY),
    faints: trainerResults.reduce((sum, trainer) => sum + trainer.faints, 0),
    relobbies: trainerResults.reduce(
      (sum, trainer) => sum + trainer.relobbies,
      0,
    ),
    attackerChargedMoves: trainerResults.reduce(
      (sum, trainer) => sum + trainer.attackerChargedMoves,
      0,
    ),
    bossChargedMoves,
    dodges: trainerResults.reduce((sum, trainer) => sum + trainer.dodges, 0),
    partyPoweredChargedMoves: trainerResults.reduce(
      (sum, trainer) => sum + trainer.partyPoweredChargedMoves,
      0,
    ),
    won: winTime != null,
  };
  return {
    ...baseResult,
    distribution: buildRaidSimulationDistribution([baseResult]),
    trainers: trainerResults,
    superMega: superMegaRules
      ? {
          shieldCount: superMegaRules.shieldCount,
          shieldsBroken: superMegaShieldsBroken,
          eligibleMegaTrainers,
          triggerHpFraction: superMegaRules.triggerHpFraction,
          shieldCountSource: superMegaRules.shieldCountSource,
          shieldCleared: superMegaShieldsBroken >= superMegaRules.shieldCount,
        }
      : undefined,
  };
};

const averagePartyResults = (
  results: RaidPartySimulationResult[],
): RaidPartySimulationResult => {
  const divisor = Math.max(1, results.length);
  const average = (select: (result: RaidPartySimulationResult) => number) =>
    results.reduce((sum, result) => sum + select(result), 0) / divisor;
  const outcome = summarizeRaidSimulationOutcomes(results);
  const trainerIds = results[0]?.trainers.map((trainer) => trainer.id) ?? [];
  const trainers = trainerIds.map((id) => {
    const samples = results.flatMap((result) =>
      result.trainers.filter((trainer) => trainer.id === id),
    );
    const averageTrainer = (
      select: (trainer: RaidPartyTrainerResult) => number,
    ) => samples.reduce((sum, trainer) => sum + select(trainer), 0) / divisor;
    return {
      id,
      label: samples[0]?.label ?? id,
      damageDealt: averageTrainer((trainer) => trainer.damageDealt),
      damageShare: averageTrainer((trainer) => trainer.damageShare),
      dps: averageTrainer((trainer) => trainer.dps),
      faints: averageTrainer((trainer) => trainer.faints),
      relobbies: averageTrainer((trainer) => trainer.relobbies),
      dodges: averageTrainer((trainer) => trainer.dodges),
      attackerChargedMoves: averageTrainer(
        (trainer) => trainer.attackerChargedMoves,
      ),
      partyPoweredChargedMoves: averageTrainer(
        (trainer) => trainer.partyPoweredChargedMoves,
      ),
    };
  });
  const superMegaSamples = results.flatMap((result) =>
    result.superMega ? [result.superMega] : [],
  );
  const superMega = superMegaSamples[0]
    ? {
        shieldCount: superMegaSamples[0].shieldCount,
        shieldsBroken:
          superMegaSamples.reduce(
            (sum, result) => sum + result.shieldsBroken,
            0,
          ) / superMegaSamples.length,
        eligibleMegaTrainers: superMegaSamples[0].eligibleMegaTrainers,
        triggerHpFraction: superMegaSamples[0].triggerHpFraction,
        shieldCountSource: superMegaSamples[0].shieldCountSource,
        shieldCleared:
          superMegaSamples.filter((result) => result.shieldCleared).length >=
          superMegaSamples.length / 2,
      }
    : undefined;

  return {
    damageDealt: average((result) => result.damageDealt),
    elapsedSeconds: average((result) => result.elapsedSeconds),
    dps: average((result) => result.dps),
    projectedTimeToWinSeconds: outcome.projectedTimeToWinSeconds,
    faints: average((result) => result.faints),
    relobbies: average((result) => result.relobbies),
    attackerChargedMoves: average((result) => result.attackerChargedMoves),
    bossChargedMoves: average((result) => result.bossChargedMoves),
    dodges: average((result) => result.dodges),
    partyPoweredChargedMoves: average(
      (result) => result.partyPoweredChargedMoves,
    ),
    won: outcome.won,
    distribution: outcome.distribution,
    trainers,
    superMega,
  };
};

const selectPartyMovesetResult = (
  resultsByMoveset: RaidPartySimulationResult[][],
  mode: RaidPartyTrainer["settings"]["bossMovesetMode"],
): RaidPartySimulationResult => {
  if (mode === "expected") return averagePartyResults(resultsByMoveset.flat());
  return resultsByMoveset
    .map(averagePartyResults)
    .reduce((selected, candidate) => {
      const difference =
        candidate.projectedTimeToWinSeconds -
        selected.projectedTimeToWinSeconds;
      if (difference !== 0) {
        const wins = mode === "favorable" ? difference < 0 : difference > 0;
        return wins ? candidate : selected;
      }
      const wins =
        mode === "favorable"
          ? candidate.faints < selected.faints
          : candidate.faints > selected.faints;
      return wins ? candidate : selected;
    });
};

export const simulateHeterogeneousRaidPartyAcrossBossMovesets = ({
  trainers,
  boss,
  tier,
}: {
  trainers: RaidPartyTrainer[];
  boss: PokemonVariant;
  tier: RaidTierPreset;
}): RaidPartySimulationResult | null => {
  const movesets = getRaidBossMovesets(boss);
  if (movesets.length === 0 || trainers.length === 0) return null;
  const mode = trainers[0].settings.bossMovesetMode;

  if (mode === "monte-carlo") {
    const sampleCount = Math.min(
      RAID_MONTE_CARLO_MAX_SAMPLES,
      Math.max(RAID_MONTE_CARLO_MIN_SAMPLES, movesets.length * 2),
    );
    const partySeed = trainers
      .map((trainer) =>
        [
          trainer.id,
          trainer.actionDelaySeconds,
          trainer.settings.dodgeSuccessRate ?? 1,
          ...trainer.team.map(
            ({ attacker, fastMove, chargedMove }) =>
              `${attacker.variant_id}:${fastMove.name}:${chargedMove.name}`,
          ),
        ].join(":"),
      )
      .join("|");
    const results = Array.from({ length: sampleCount }, (_, sampleIndex) => {
      const moveset = movesets[sampleIndex % movesets.length];
      const random = createRaidSeededRandom(
        `${boss.variant_id}|${tier.key}|${partySeed}|${sampleIndex}`,
      );
      return simulateHeterogeneousRaidPartyBattle({
        trainers,
        boss,
        bossFastMove: moveset.fastMove,
        bossChargedMove: moveset.chargedMove,
        tier,
        shouldBossUseCharged: () => random() < 0.5,
        shouldDodgeSucceed: (trainerIndex) =>
          random() <
          clampUnit(trainers[trainerIndex].settings.dodgeSuccessRate ?? 1),
        getBossActionDelaySeconds: () => {
          const index = Math.min(
            RAID_SIMULATION_BOSS_DELAY_OPTIONS_SECONDS.length - 1,
            Math.floor(
              random() * RAID_SIMULATION_BOSS_DELAY_OPTIONS_SECONDS.length,
            ),
          );
          return RAID_SIMULATION_BOSS_DELAY_OPTIONS_SECONDS[index];
        },
      });
    });
    return averagePartyResults(results);
  }

  const resultsByMoveset = movesets.map(({ fastMove, chargedMove }) =>
    ([0, 1] as const).map((chargedDecisionOffset) =>
      simulateHeterogeneousRaidPartyBattle({
        trainers,
        boss,
        bossFastMove: fastMove,
        bossChargedMove: chargedMove,
        tier,
        chargedDecisionOffset,
      }),
    ),
  );
  return selectPartyMovesetResult(resultsByMoveset, mode);
};
