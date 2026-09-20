import type { PokemonPvPRankingEntry } from '@pokemongonexus/shared-contracts/pokemon';

export type PvPTeamCandidate = {
  key: string;
  entry: PokemonPvPRankingEntry;
  cp?: number;
  nickname?: string | null;
};

export type PvPTeamThreat = {
  speciesId: string;
  affectedKeys: string[];
  coveredByKeys: string[];
  worstRating: number;
};

export type PvPTeamRecommendation = {
  candidate: PvPTeamCandidate;
  covers: string[];
};

export type PvPTeamReplacement = PvPTeamRecommendation & {
  replaceKey: string;
  improvement: number;
  exposedAfter: number;
};

export type PvPTeamAnalysis = {
  threats: PvPTeamThreat[];
  exposedThreats: PvPTeamThreat[];
  coveredThreats: PvPTeamThreat[];
  recommendations: PvPTeamRecommendation[];
  replacements: PvPTeamReplacement[];
};

export type PvPRepresentativeMetaTeam = {
  id: string;
  label: string;
  members: [PvPTeamCandidate, PvPTeamCandidate, PvPTeamCandidate];
};

const matchupSpecies = (
  entry: PokemonPvPRankingEntry,
  kind: 'matchups' | 'counters',
): Set<string> =>
  new Set((entry[kind] ?? []).map((matchup) => matchup.speciesId));

const analyzeThreats = (team: readonly PvPTeamCandidate[]) => {
  const threatsBySpecies = new Map<string, PvPTeamThreat>();

  for (const member of team) {
    for (const counter of member.entry.counters ?? []) {
      const threat = threatsBySpecies.get(counter.speciesId) ?? {
        speciesId: counter.speciesId,
        affectedKeys: [],
        coveredByKeys: [],
        worstRating: counter.rating,
      };
      threat.affectedKeys.push(member.key);
      threat.worstRating = Math.min(threat.worstRating, counter.rating);
      threatsBySpecies.set(counter.speciesId, threat);
    }
  }

  for (const threat of threatsBySpecies.values()) {
    for (const member of team) {
      if (matchupSpecies(member.entry, 'matchups').has(threat.speciesId)) {
        threat.coveredByKeys.push(member.key);
      }
    }
  }

  const threats = [...threatsBySpecies.values()].sort(
    (left, right) =>
      right.affectedKeys.length - left.affectedKeys.length ||
      left.coveredByKeys.length - right.coveredByKeys.length ||
      left.worstRating - right.worstRating ||
      left.speciesId.localeCompare(right.speciesId),
  );

  return {
    threats,
    exposedThreats: threats.filter(
      (threat) => threat.coveredByKeys.length === 0,
    ),
    coveredThreats: threats.filter(
      (threat) => threat.coveredByKeys.length > 0,
    ),
  };
};

export const formatPvPSpeciesName = (speciesId: string): string =>
  speciesId
    .replace(/_shadow$/, ' Shadow')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const rankPvPTeamCandidates = (
  candidates: readonly PvPTeamCandidate[],
): PvPTeamCandidate[] =>
  [...candidates].sort((left, right) => (
    right.entry.score - left.entry.score ||
    left.entry.rank - right.entry.rank ||
    left.entry.name.localeCompare(right.entry.name) ||
    left.key.localeCompare(right.key)
  ));

const scoreForTeamRole = (
  candidate: PvPTeamCandidate,
  scoreIndex: number,
): number =>
  candidate.entry.categoryScores[scoreIndex] ?? candidate.entry.score;

const roleRankedCandidates = (
  candidates: readonly PvPTeamCandidate[],
  scoreIndex: number,
): PvPTeamCandidate[] =>
  [...candidates].sort((left, right) =>
    scoreForTeamRole(right, scoreIndex) - scoreForTeamRole(left, scoreIndex) ||
    right.entry.score - left.entry.score ||
    left.entry.rank - right.entry.rank ||
    left.key.localeCompare(right.key));

export const buildRepresentativePvPMetaTeams = (
  candidates: readonly PvPTeamCandidate[],
  limit = 6,
): PvPRepresentativeMetaTeam[] => {
  if (candidates.length < 3 || limit < 1) return [];
  const rolePools = [
    roleRankedCandidates(candidates, 0),
    roleRankedCandidates(candidates, 2),
    roleRankedCandidates(candidates, 1),
  ];
  const results: PvPRepresentativeMetaTeam[] = [];
  const seen = new Set<string>();
  const poolLimit = Math.min(candidates.length, Math.max(limit * 3, 12));

  for (let seed = 0; seed < poolLimit && results.length < limit; seed += 1) {
    const picked: PvPTeamCandidate[] = [];
    for (let role = 0; role < rolePools.length; role += 1) {
      const pool = rolePools[role].slice(0, poolLimit);
      const offset = (seed * (role + 1) + role * limit) % pool.length;
      const candidate = Array.from(
        { length: pool.length },
        (_, step) => pool[(offset + step) % pool.length],
      ).find((entry) => !picked.some((current) => current.key === entry.key));
      if (candidate) picked.push(candidate);
    }
    if (picked.length !== 3) continue;
    const id = picked.map((candidate) => candidate.key).join('|');
    if (seen.has(id)) continue;
    seen.add(id);
    results.push({
      id,
      label: picked.map((candidate) => candidate.entry.name).join(' / '),
      members: picked as [
        PvPTeamCandidate,
        PvPTeamCandidate,
        PvPTeamCandidate,
      ],
    });
  }

  return results;
};

export const analyzePvPTeam = (
  team: PvPTeamCandidate[],
  candidates: PvPTeamCandidate[],
): PvPTeamAnalysis => {
  const {
    threats,
    exposedThreats,
    coveredThreats,
  } = analyzeThreats(team);
  const selectedKeys = new Set(team.map((member) => member.key));
  const exposedIds = new Set(exposedThreats.map((threat) => threat.speciesId));
  const recommendations = candidates
    .filter((candidate) => !selectedKeys.has(candidate.key))
    .map((candidate) => ({
      candidate,
      covers: [...matchupSpecies(candidate.entry, 'matchups')]
        .filter((speciesId) => exposedIds.has(speciesId)),
    }))
    .filter((recommendation) => recommendation.covers.length > 0)
    .sort(
      (left, right) =>
        right.covers.length - left.covers.length ||
        right.candidate.entry.score - left.candidate.entry.score ||
        left.candidate.entry.rank - right.candidate.entry.rank,
    )
    .slice(0, 5);
  const replacements = team.length < 3
    ? []
    : candidates
      .filter((candidate) => !selectedKeys.has(candidate.key))
      .flatMap((candidate) =>
        team.map((member) => {
          const trialTeam = team.map((current) =>
            current.key === member.key ? candidate : current);
          const trial = analyzeThreats(trialTeam);
          return {
            candidate,
            replaceKey: member.key,
            covers: [...matchupSpecies(candidate.entry, 'matchups')]
              .filter((speciesId) => exposedIds.has(speciesId)),
            improvement: exposedThreats.length - trial.exposedThreats.length,
            exposedAfter: trial.exposedThreats.length,
          };
        }))
      .filter((replacement) => replacement.improvement > 0)
      .sort((left, right) =>
        right.improvement - left.improvement ||
        right.covers.length - left.covers.length ||
        right.candidate.entry.score - left.candidate.entry.score ||
        left.candidate.entry.rank - right.candidate.entry.rank)
      .slice(0, 5);

  return {
    threats,
    exposedThreats,
    coveredThreats,
    recommendations,
    replacements,
  };
};
