import type {
  PokemonPvPBattleFighter,
  PokemonPvPRankingMove,
} from '@pokemongonexus/shared-contracts/pokemon';

import type { PvPTeamCandidate } from './pvpTeamBuilder';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const hasPvPSimulationMoveData = (
  move: PokemonPvPRankingMove,
): boolean => {
  if (!isFiniteNumber(move.power) || move.power < 0) return false;
  if (!move.buff || !isFiniteNumber(move.buff.chance)) return false;
  if (move.kind === 'fast') {
    return (
      isFiniteNumber(move.energyGain) &&
      move.energyGain >= 0 &&
      isFiniteNumber(move.turns) &&
      move.turns >= 1
    );
  }
  return isFiniteNumber(move.energyCost) && move.energyCost > 0;
};

export const isPvPBattleCandidateReady = (
  candidate: PvPTeamCandidate,
): boolean => {
  const { entry } = candidate;
  const fastMoves = entry.moveset.filter((move) => move.kind === 'fast');
  const chargedMoves = entry.moveset.filter((move) => move.kind === 'charged');
  return (
    isFiniteNumber(entry.battleAttack) &&
    entry.battleAttack > 0 &&
    isFiniteNumber(entry.battleDefense) &&
    entry.battleDefense > 0 &&
    isFiniteNumber(entry.battleHp) &&
    entry.battleHp > 0 &&
    fastMoves.length === 1 &&
    chargedMoves.length >= 1 &&
    chargedMoves.length <= 2 &&
    entry.moveset.every(hasPvPSimulationMoveData)
  );
};

export const getPvPBattleCandidateLabel = (
  candidate: PvPTeamCandidate,
): string => candidate.nickname || candidate.entry.name;

export const buildPvPBattleFighter = (
  candidate: PvPTeamCandidate,
): PokemonPvPBattleFighter | null => {
  return buildPvPEntryFighter(
    candidate.entry,
    candidate.key,
    getPvPBattleCandidateLabel(candidate),
  );
};

export const buildPvPEntryFighter = (
  entry: PvPTeamCandidate['entry'],
  id: string,
  name = entry.name,
): PokemonPvPBattleFighter | null => {
  if (!isPvPBattleCandidateReady({ key: id, entry })) return null;
  const fastMove = entry.moveset.find((move) => move.kind === 'fast');
  const chargedMoves = entry.moveset
    .filter((move) => move.kind === 'charged')
    .slice(0, 2);
  if (!fastMove) return null;

  return {
    id,
    name,
    types: entry.types,
    attack: entry.battleAttack!,
    defense: entry.battleDefense!,
    hp: entry.battleHp!,
    shadow: entry.variantKind === 'shadow',
    fastMove,
    chargedMoves,
  };
};
