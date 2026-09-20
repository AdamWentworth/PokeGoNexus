import type { PokemonVariant } from "../../../types/pokemonVariants";
import type { RaidCounterScore } from "./raidTypes";
import { RAID_ATTACKER_TEAM_SIZE } from "./raidRules";
import {
  compareRaidCounterScores,
  getRaidCounterSustainedDps,
} from "./raidCounterRanking";
import { canBreakSuperMegaShield } from "./superMegaRaid";

const compareCounterDps = (a: RaidCounterScore, b: RaidCounterScore): number =>
  compareRaidCounterScores(a, b) ||
  a.variant.variant_id.localeCompare(b.variant.variant_id);

export const variantUsesRaidMegaSlot = (variant: PokemonVariant): boolean => {
  if (variant.raidRoster?.formSource === "mega") return true;
  const variantType = (variant.variantType ?? "").toLowerCase();
  return (
    Boolean(variant.primal) ||
    variantType.includes("mega") ||
    variantType.includes("primal")
  );
};

export const usesRaidMegaSlot = (score: RaidCounterScore): boolean =>
  variantUsesRaidMegaSlot(score.variant);

export const getRaidRosterSlotKey = (score: RaidCounterScore): string => {
  const instanceId = score.variant.raidRoster?.instanceId;
  return instanceId
    ? `caught:${instanceId}`
    : `catalog:${score.variant.variant_id}`;
};

const selectRegularMembers = (
  scores: RaidCounterScore[],
  limit: number,
  excludedRosterSlot?: string,
): RaidCounterScore[] => {
  const selected: RaidCounterScore[] = [];
  const usedRosterSlots = new Set<string>();

  for (const score of scores) {
    if (selected.length >= limit) break;
    if (usesRaidMegaSlot(score)) continue;
    const rosterSlot = getRaidRosterSlotKey(score);
    if (rosterSlot === excludedRosterSlot || usedRosterSlots.has(rosterSlot)) {
      continue;
    }
    usedRosterSlots.add(rosterSlot);
    selected.push(score);
  }

  return selected;
};

const sumTeamDps = (team: RaidCounterScore[]): number =>
  team.reduce((sum, member) => sum + member.dps, 0);

const sumTeamSustainedDps = (team: RaidCounterScore[]): number =>
  team.reduce((sum, member) => sum + getRaidCounterSustainedDps(member), 0);

const compareTeams = (a: RaidCounterScore[], b: RaidCounterScore[]): number =>
  sumTeamDps(b) - sumTeamDps(a) ||
  sumTeamSustainedDps(b) - sumTeamSustainedDps(a) ||
  b.length - a.length ||
  a
    .map((member) => member.variant.variant_id)
    .join("|")
    .localeCompare(b.map((member) => member.variant.variant_id).join("|"));

export const selectLegalRaidTeamCounters = (
  scores: RaidCounterScore[],
  limit = RAID_ATTACKER_TEAM_SIZE,
  options: { requireSuperMegaShieldBreaker?: boolean } = {},
): RaidCounterScore[] => {
  const teamSize = Math.max(1, Math.floor(limit));
  const sorted = [...scores].sort(compareCounterDps);
  const scenarios: RaidCounterScore[][] = [
    selectRegularMembers(sorted, teamSize),
  ];
  const seenMegaSlots = new Set<string>();

  for (const mega of sorted) {
    if (!usesRaidMegaSlot(mega)) continue;
    const rosterSlot = getRaidRosterSlotKey(mega);
    if (seenMegaSlots.has(rosterSlot)) continue;
    seenMegaSlots.add(rosterSlot);
    scenarios.push([
      mega,
      ...selectRegularMembers(sorted, teamSize - 1, rosterSlot),
    ]);
  }

  const eligibleScenarios = options.requireSuperMegaShieldBreaker
    ? scenarios.filter((team) =>
        team.some((member) => canBreakSuperMegaShield(member.variant)),
      )
    : scenarios;

  return eligibleScenarios.sort(compareTeams)[0] ?? [];
};

export const preserveLegalRaidTeamOrder = (
  scores: RaidCounterScore[],
  limit = RAID_ATTACKER_TEAM_SIZE,
): RaidCounterScore[] => {
  const selected: RaidCounterScore[] = [];
  const usedRosterSlots = new Set<string>();
  let megaSlotUsed = false;

  for (const score of scores) {
    if (selected.length >= Math.max(1, Math.floor(limit))) break;
    const rosterSlot = getRaidRosterSlotKey(score);
    const usesMega = usesRaidMegaSlot(score);
    if (usedRosterSlots.has(rosterSlot) || (usesMega && megaSlotUsed)) continue;
    usedRosterSlots.add(rosterSlot);
    if (usesMega) megaSlotUsed = true;
    selected.push(score);
  }

  return selected;
};
