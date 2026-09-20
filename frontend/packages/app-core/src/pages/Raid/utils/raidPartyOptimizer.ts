import {
  RAID_PARTY_OPTIMIZER_MAX_BEAM_WIDTH,
  RAID_PARTY_OPTIMIZER_MAX_EVALUATIONS,
  RAID_PARTY_OPTIMIZER_MAX_TEAM_OPTIONS,
} from "./raidRules";
import { simulateHeterogeneousRaidPartyAcrossBossMovesets } from "./raidPartySimulation";
import {
  preserveLegalRaidTeamOrder,
  usesRaidMegaSlot,
  variantUsesRaidMegaSlot,
} from "./raidTeamSelection";
import type {
  RaidCounterScore,
  RaidPartyOptimizationResult,
  RaidPartySimulationResult,
  RaidPartyTrainer,
  RaidSimulationTeamMember,
  RaidTierPreset,
} from "./raidTypes";
import type { PokemonVariant } from "../../../types/pokemonVariants";

type RaidPartyEvaluator = (request: {
  trainers: RaidPartyTrainer[];
  boss: PokemonVariant;
  tier: RaidTierPreset;
}) => RaidPartySimulationResult | null;

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

const scoreToMember = ({
  variant,
  fastMove,
  chargedMove,
}: RaidCounterScore): RaidSimulationTeamMember => ({
  attacker: variant,
  fastMove,
  chargedMove,
});

const teamKey = (team: RaidSimulationTeamMember[]): string =>
  team
    .map(
      ({ attacker, fastMove, chargedMove }) =>
        `${attacker.variant_id}:${fastMove.name}:${chargedMove.name}`,
    )
    .join("|");

const lineupKey = (trainers: RaidPartyTrainer[]): string =>
  trainers.map((trainer) => `${trainer.id}=${teamKey(trainer.team)}`).join("|");

const lineupCompositionKey = (trainers: RaidPartyTrainer[]): string =>
  trainers
    .map((trainer) => {
      const members = trainer.team
        .map(
          ({ attacker, fastMove, chargedMove }) =>
            `${attacker.variant_id}:${fastMove.name}:${chargedMove.name}`,
        )
        .sort()
        .join(",");
      return `${trainer.id}=${members}`;
    })
    .join("|");

const buildForcedLeadTeam = (
  lead: RaidCounterScore,
  scores: RaidCounterScore[],
): RaidCounterScore[] =>
  preserveLegalRaidTeamOrder([
    lead,
    ...scores.filter(
      (score) => score.variant.variant_id !== lead.variant.variant_id,
    ),
  ]);

const addCandidate = (
  candidates: RaidSimulationTeamMember[][],
  seen: Set<string>,
  scores: RaidCounterScore[],
) => {
  const legal = preserveLegalRaidTeamOrder(scores);
  if (legal.length === 0) return;
  const team = legal.map(scoreToMember);
  const key = teamKey(team);
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push(team);
};

export const buildRaidPartyTeamCandidates = (
  currentTeam: RaidSimulationTeamMember[],
  scores: RaidCounterScore[],
  limit = RAID_PARTY_OPTIMIZER_MAX_TEAM_OPTIONS,
): RaidSimulationTeamMember[][] => {
  const candidates: RaidSimulationTeamMember[][] = [];
  const seen = new Set<string>();
  const cappedScores = scores.slice(0, 48);
  const scoreByMemberKey = new Map(
    cappedScores.map((score) => [teamKey([scoreToMember(score)]), score]),
  );
  const currentScores = currentTeam
    .map((member) => scoreByMemberKey.get(teamKey([member])))
    .filter((score): score is RaidCounterScore => Boolean(score));

  addCandidate(candidates, seen, currentScores);
  addCandidate(candidates, seen, cappedScores);
  addCandidate(
    candidates,
    seen,
    [...cappedScores].sort(
      (a, b) =>
        finiteOr(a.faints, 999) - finiteOr(b.faints, 999) || b.dps - a.dps,
    ),
  );
  addCandidate(
    candidates,
    seen,
    [...cappedScores].sort(
      (a, b) =>
        finiteOr(a.relobbies, 999) - finiteOr(b.relobbies, 999) ||
        b.dps - a.dps,
    ),
  );

  const forcedLeads = [
    ...cappedScores.filter(usesRaidMegaSlot).slice(0, 5),
    ...cappedScores.slice(0, 5),
  ];
  forcedLeads.forEach((lead) =>
    addCandidate(candidates, seen, buildForcedLeadTeam(lead, cappedScores)),
  );

  const baseline = preserveLegalRaidTeamOrder(cappedScores);
  for (
    let rotation = 1;
    rotation < Math.min(4, baseline.length);
    rotation += 1
  ) {
    addCandidate(candidates, seen, [
      ...baseline.slice(rotation),
      ...baseline.slice(0, rotation),
    ]);
  }

  return candidates.slice(0, Math.max(1, limit));
};

export const compareRaidPartyResults = (
  candidate: RaidPartySimulationResult,
  current: RaidPartySimulationResult,
): number => {
  const winRateDifference =
    candidate.distribution.winRate - current.distribution.winRate;
  if (Math.abs(winRateDifference) > 0.0001) return winRateDifference;

  const timeDifference =
    finiteOr(current.projectedTimeToWinSeconds, Number.MAX_SAFE_INTEGER) -
    finiteOr(candidate.projectedTimeToWinSeconds, Number.MAX_SAFE_INTEGER);
  if (Math.abs(timeDifference) > 0.05) return timeDifference;

  const p90Difference =
    finiteOr(
      current.distribution.timeToWinSeconds.p90,
      Number.MAX_SAFE_INTEGER,
    ) -
    finiteOr(
      candidate.distribution.timeToWinSeconds.p90,
      Number.MAX_SAFE_INTEGER,
    );
  if (Math.abs(p90Difference) > 0.05) return p90Difference;

  const relobbyDifference = current.relobbies - candidate.relobbies;
  if (Math.abs(relobbyDifference) > 0.01) return relobbyDifference;

  const faintDifference = current.faints - candidate.faints;
  if (Math.abs(faintDifference) > 0.01) return faintDifference;

  return candidate.dps - current.dps;
};

const withExpectedSearchMode = (
  trainers: RaidPartyTrainer[],
): RaidPartyTrainer[] =>
  trainers.map((trainer) => ({
    ...trainer,
    settings: {
      ...trainer.settings,
      bossMovesetMode:
        trainer.settings.bossMovesetMode === "monte-carlo"
          ? "expected"
          : trainer.settings.bossMovesetMode,
    },
  }));

type RaidPartyBeamState = {
  trainers: RaidPartyTrainer[];
  result: RaidPartySimulationResult;
};

const sortBestFirst = (a: RaidPartyBeamState, b: RaidPartyBeamState): number =>
  compareRaidPartyResults(b.result, a.result);

const teamUsesMegaSlot = (team: RaidSimulationTeamMember[]): boolean =>
  team.some(({ attacker }) => variantUsesRaidMegaSlot(attacker));

const explainTrainerChanges = (
  baselineTrainers: RaidPartyTrainer[],
  optimizedTrainers: RaidPartyTrainer[],
  baselineResult: RaidPartySimulationResult,
  optimizedResult: RaidPartySimulationResult,
): RaidPartyOptimizationResult["trainerChanges"] => {
  const baselineResults = new Map(
    baselineResult.trainers.map((trainer) => [trainer.id, trainer]),
  );
  const optimizedResults = new Map(
    optimizedResult.trainers.map((trainer) => [trainer.id, trainer]),
  );

  return optimizedTrainers.flatMap((trainer, index) => {
    const baselineTrainer = baselineTrainers[index];
    if (
      !baselineTrainer ||
      teamKey(trainer.team) === teamKey(baselineTrainer.team)
    ) {
      return [];
    }

    const before = baselineResults.get(trainer.id);
    const after = optimizedResults.get(trainer.id);
    const reasons: string[] = [];
    if (after && before && after.dps > before.dps + 0.05) {
      reasons.push("Higher damage");
    }
    if (after && before && after.faints < before.faints - 0.05) {
      reasons.push("Fewer faints");
    }
    if (after && before && after.relobbies < before.relobbies - 0.05) {
      reasons.push("Fewer relobbies");
    }
    if (
      after &&
      before &&
      after.partyPoweredChargedMoves > before.partyPoweredChargedMoves + 0.05
    ) {
      reasons.push("Better Party Power timing");
    }
    if (
      teamUsesMegaSlot(trainer.team) !== teamUsesMegaSlot(baselineTrainer.team)
    ) {
      reasons.push("Mega/Primal coverage");
    }
    if (reasons.length === 0) reasons.push("Better lobby coordination");

    return [{ trainerId: trainer.id, label: trainer.label, reasons }];
  });
};

export const optimizeRaidParty = (
  {
    trainers,
    scores,
    boss,
    tier,
  }: {
    trainers: RaidPartyTrainer[];
    scores: RaidCounterScore[];
    boss: PokemonVariant;
    tier: RaidTierPreset;
  },
  evaluate: RaidPartyEvaluator = simulateHeterogeneousRaidPartyAcrossBossMovesets,
): RaidPartyOptimizationResult | null => {
  if (trainers.length === 0 || scores.length === 0) return null;

  const baselineResult = evaluate({ trainers, boss, tier });
  if (!baselineResult) return null;

  let evaluatedLineups = 1;
  const searchTrainers = withExpectedSearchMode(trainers);
  const searchUsesExpectedFallback = searchTrainers.some(
    (trainer, index) =>
      trainer.settings.bossMovesetMode !==
      trainers[index].settings.bossMovesetMode,
  );
  const searchBaselineResult = searchUsesExpectedFallback
    ? evaluate({ trainers: searchTrainers, boss, tier })
    : baselineResult;
  if (!searchBaselineResult) return null;
  if (searchUsesExpectedFallback) evaluatedLineups += 1;

  const remainingSearchBudget = Math.max(
    1,
    RAID_PARTY_OPTIMIZER_MAX_EVALUATIONS - evaluatedLineups - 1,
  );
  const beamWidth = Math.max(
    2,
    Math.min(
      RAID_PARTY_OPTIMIZER_MAX_BEAM_WIDTH,
      Math.floor(Math.sqrt(remainingSearchBudget / trainers.length)),
    ),
  );
  const optionLimit = Math.max(
    2,
    Math.min(
      RAID_PARTY_OPTIMIZER_MAX_TEAM_OPTIONS,
      1 + Math.floor(remainingSearchBudget / (trainers.length * beamWidth)),
    ),
  );
  const optionsByTrainer = searchTrainers.map((trainer) => {
    const candidates = buildRaidPartyTeamCandidates(
      trainer.team,
      scores,
      optionLimit,
    );
    const seen = new Set<string>();
    return [trainer.team, ...candidates].filter((team) => {
      const key = teamKey(team);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
  const evaluated = new Map<string, RaidPartySimulationResult>([
    [lineupKey(searchTrainers), searchBaselineResult],
  ]);
  let beam: RaidPartyBeamState[] = [
    { trainers: searchTrainers, result: searchBaselineResult },
  ];
  let bestSearchState = beam[0];

  for (
    let trainerIndex = 0;
    trainerIndex < searchTrainers.length;
    trainerIndex += 1
  ) {
    const expanded = [...beam];
    let budgetReached = false;
    for (const state of beam) {
      for (const team of optionsByTrainer[trainerIndex]) {
        if (teamKey(team) === teamKey(state.trainers[trainerIndex].team))
          continue;
        if (evaluatedLineups >= RAID_PARTY_OPTIMIZER_MAX_EVALUATIONS - 1) {
          budgetReached = true;
          break;
        }

        const trialTrainers = state.trainers.map((trainer, index) =>
          index === trainerIndex ? { ...trainer, team } : trainer,
        );
        const key = lineupKey(trialTrainers);
        let trialResult = evaluated.get(key);
        if (!trialResult) {
          trialResult =
            evaluate({ trainers: trialTrainers, boss, tier }) ?? undefined;
          evaluatedLineups += 1;
          if (trialResult) evaluated.set(key, trialResult);
        }
        if (trialResult)
          expanded.push({ trainers: trialTrainers, result: trialResult });
      }
      if (budgetReached) break;
    }

    const unique = new Map<string, RaidPartyBeamState>();
    expanded.sort(sortBestFirst).forEach((state) => {
      const key = lineupKey(state.trainers);
      if (!unique.has(key)) unique.set(key, state);
    });
    const uniqueStates = [...unique.values()];
    const diverse = new Map<string, RaidPartyBeamState>();
    uniqueStates.forEach((state) => {
      const key = lineupCompositionKey(state.trainers);
      if (!diverse.has(key)) diverse.set(key, state);
    });
    beam = [...diverse.values()].slice(0, beamWidth);
    if (beam.length < beamWidth) {
      const selected = new Set(beam.map((state) => lineupKey(state.trainers)));
      beam.push(
        ...uniqueStates
          .filter((state) => !selected.has(lineupKey(state.trainers)))
          .slice(0, beamWidth - beam.length),
      );
      beam.sort(sortBestFirst);
    }
    if (
      beam[0] &&
      compareRaidPartyResults(beam[0].result, bestSearchState.result) > 0
    ) {
      bestSearchState = beam[0];
    }
    if (budgetReached) break;
  }

  const optimizedTrainers = bestSearchState.trainers.map((trainer, index) => ({
    ...trainer,
    settings: trainers[index].settings,
  }));
  const optimizedResult = evaluate({ trainers: optimizedTrainers, boss, tier });
  evaluatedLineups += 1;
  const useOptimized =
    optimizedResult != null &&
    compareRaidPartyResults(optimizedResult, baselineResult) > 0;
  const finalTrainers = useOptimized ? optimizedTrainers : trainers;
  const finalResult = useOptimized ? optimizedResult : baselineResult;

  return {
    trainers: finalTrainers,
    result: finalResult,
    baselineResult,
    evaluatedLineups,
    changedTrainerCount: finalTrainers.reduce(
      (count, trainer, index) =>
        count +
        (teamKey(trainer.team) === teamKey(trainers[index].team) ? 0 : 1),
      0,
    ),
    timeSavedSeconds: Math.max(
      0,
      finiteOr(baselineResult.projectedTimeToWinSeconds, 0) -
        finiteOr(finalResult.projectedTimeToWinSeconds, 0),
    ),
    faintReduction: Math.max(0, baselineResult.faints - finalResult.faints),
    relobbyReduction: Math.max(
      0,
      baselineResult.relobbies - finalResult.relobbies,
    ),
    searchStrategy: "bounded-beam",
    beamWidth,
    trainerChanges: explainTrainerChanges(
      trainers,
      finalTrainers,
      baselineResult,
      finalResult,
    ),
  };
};
