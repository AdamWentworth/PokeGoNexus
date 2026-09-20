import type { PokemonVariant } from "../../../types/pokemonVariants";
import { cpMultipliers } from "./constants";
import type { RaidCounterSettings } from "./raidTypes";

type RaidIvSet = {
  attack: number;
  defense: number;
  stamina: number;
};

const clampIv = (value: unknown): number => {
  if (value == null || value === "") return 15;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(15, Math.max(0, parsed)) : 15;
};

export const getRaidAttackerIvs = (attacker: PokemonVariant): RaidIvSet => ({
  attack: clampIv(attacker.instanceData?.attack_iv),
  defense: clampIv(attacker.instanceData?.defense_iv),
  stamina: clampIv(attacker.instanceData?.stamina_iv),
});

const getClosestLevelKey = (level: number): keyof typeof cpMultipliers => {
  const keys = Object.keys(cpMultipliers) as Array<keyof typeof cpMultipliers>;
  return keys.reduce((closest, candidate) =>
    Math.abs(Number(candidate) - level) < Math.abs(Number(closest) - level)
      ? candidate
      : closest,
  );
};

const calculateCp = (
  attacker: PokemonVariant,
  level: keyof typeof cpMultipliers,
): number => {
  const multiplier = cpMultipliers[level];
  const ivs = getRaidAttackerIvs(attacker);
  return Math.max(
    10,
    Math.floor(
      ((attacker.attack + ivs.attack) *
        Math.sqrt(attacker.defense + ivs.defense) *
        Math.sqrt(attacker.stamina + ivs.stamina) *
        multiplier ** 2) /
        10,
    ),
  );
};

const inferLevelFromCp = (
  attacker: PokemonVariant,
): keyof typeof cpMultipliers | null => {
  const cp = Number(attacker.instanceData?.cp);
  if (!Number.isFinite(cp) || cp <= 0) return null;

  const levels = Object.keys(cpMultipliers) as Array<keyof typeof cpMultipliers>;
  return levels.reduce((closest, candidate) =>
    Math.abs(calculateCp(attacker, candidate) - cp) <
    Math.abs(calculateCp(attacker, closest) - cp)
      ? candidate
      : closest,
  );
};

export const resolveRaidAttackerLevel = (
  attacker: PokemonVariant,
  fallback: RaidCounterSettings["attackerLevel"],
): keyof typeof cpMultipliers => {
  const recordedLevel = Number(attacker.instanceData?.level);
  if (Number.isFinite(recordedLevel) && recordedLevel > 0) {
    return getClosestLevelKey(recordedLevel);
  }

  return inferLevelFromCp(attacker) ?? fallback;
};

export const calculateRaidAttackerCp = (
  attacker: PokemonVariant,
  fallbackLevel: RaidCounterSettings["attackerLevel"],
): number => {
  const recordedCp = Number(attacker.instanceData?.cp);
  if (
    attacker.raidRoster?.cpSource !== "calculated" &&
    Number.isFinite(recordedCp) &&
    recordedCp > 0
  ) {
    return Math.round(recordedCp);
  }

  return calculateCp(
    attacker,
    resolveRaidAttackerLevel(attacker, fallbackLevel),
  );
};

export const getRaidAttackerLevelLabel = (
  attacker: PokemonVariant,
  fallback: RaidCounterSettings["attackerLevel"],
): string =>
  String(Number(resolveRaidAttackerLevel(attacker, fallback))).replace(
    /\.0$/,
    "",
  );

export const getRaidAttackerIvPercent = (
  attacker: PokemonVariant,
): number | null => {
  if (attacker.raidRoster?.ivSource !== "recorded") return null;
  const ivs = getRaidAttackerIvs(attacker);
  return Math.round(((ivs.attack + ivs.defense + ivs.stamina) / 45) * 100);
};
