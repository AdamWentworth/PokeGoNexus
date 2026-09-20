import type {
  PokemonPvPBattleFighter,
  PokemonPvPBattleMechanics,
  PokemonPvPBattleRequest,
  PokemonPvPBattleResponse,
  PokemonPvPRosterEvaluationOpponent,
  PokemonPvPRosterEvaluationResponse,
} from "@pokemongonexus/shared-contracts/pokemon";

export type PvPRosterEvaluationCandidate = {
  fighter: PokemonPvPBattleFighter;
  referenceFighter: PokemonPvPBattleFighter;
  sourceScore: number;
  sourceCategoryScores: number[];
};

export type PvPRosterWorkerRequest = {
  kind: "evaluate";
  mechanics: PokemonPvPBattleMechanics;
  candidates: PvPRosterEvaluationCandidate[];
  opponents: PokemonPvPRosterEvaluationOpponent[];
};

export type PvPBattleWorkerRequest = {
  kind: "battle";
  request: PokemonPvPBattleRequest;
};

export type PvPTeamRole = "lead" | "switch" | "closer";

export type PvPTeamEvaluationMember = {
  fighter: PokemonPvPBattleFighter;
  role: PvPTeamRole;
};

export type PvPTeamEvaluationMemberResult = {
  fighterId: string;
  role: PvPTeamRole;
  averageRating: number;
  wins: number;
  draws: number;
  losses: number;
};

export type PvPTeamEvaluationOpponentResult = {
  fighterId: string;
  memberRatings: number[];
  bestMemberId: string;
  bestRating: number;
  covered: boolean;
};

export type PvPTeamEvaluationResponse = {
  mechanics: PokemonPvPBattleMechanics;
  fieldSize: number;
  coverageCount: number;
  members: PvPTeamEvaluationMemberResult[];
  opponents: PvPTeamEvaluationOpponentResult[];
};

export type PvPTeamWorkerRequest = {
  kind: "team";
  mechanics: PokemonPvPBattleMechanics;
  members: PvPTeamEvaluationMember[];
  opponents: PokemonPvPRosterEvaluationOpponent[];
};

export type PvPTeamSwitchPolicy = "fixed" | "adaptive";

export type PvPTeamBattleRequest = {
  kind: "team-battle";
  mechanics: PokemonPvPBattleMechanics;
  teams: [
    [PokemonPvPBattleFighter, PokemonPvPBattleFighter, PokemonPvPBattleFighter],
    [PokemonPvPBattleFighter, PokemonPvPBattleFighter, PokemonPvPBattleFighter],
  ];
  shields: [number, number];
  startingEnergy: [number, number];
  switchPolicy?: PvPTeamSwitchPolicy;
};

export type PvPTeamBattleMemberResult = {
  fighterId: string;
  hp: number;
  maxHp: number;
  energy: number;
  fainted: boolean;
  knockouts: number;
  switches: number;
};

export type PvPTeamBattleMatchupResult = {
  index: number;
  fighterIds: [string, string];
  winner: number;
  turns: number;
  timeMs: number;
  ratings: [number, number];
  hpAfter: [number, number];
  energyAfter: [number, number];
  shieldsAfter: [number, number];
  startedAtMs: number;
  endedAtMs: number;
  endedBy: "knockout" | "switch" | "timeout" | "stall";
};

export type PvPTeamBattleSwitchEvent = {
  index: number;
  side: number;
  atMs: number;
  fromFighterId: string;
  toFighterId: string;
  reason: "adaptive" | "forced";
  switchReadyAtMs: number;
};

export type PvPTeamBattleResponse = {
  mechanics: PokemonPvPBattleMechanics;
  switchPolicy: PvPTeamSwitchPolicy;
  switchClockMs: number;
  winner: number;
  turns: number;
  timeMs: number;
  endReason: "knockout" | "timeout" | "stall";
  shields: [number, number];
  teams: [
    [
      PvPTeamBattleMemberResult,
      PvPTeamBattleMemberResult,
      PvPTeamBattleMemberResult,
    ],
    [
      PvPTeamBattleMemberResult,
      PvPTeamBattleMemberResult,
      PvPTeamBattleMemberResult,
    ],
  ];
  matchups: PvPTeamBattleMatchupResult[];
  switches: PvPTeamBattleSwitchEvent[];
};

export type PvPTeamGauntletOpponent = {
  id: string;
  label: string;
  team: [
    PokemonPvPBattleFighter,
    PokemonPvPBattleFighter,
    PokemonPvPBattleFighter,
  ];
};

export type PvPTeamGauntletRequest = {
  kind: "team-gauntlet";
  mechanics: PokemonPvPBattleMechanics;
  team: [
    PokemonPvPBattleFighter,
    PokemonPvPBattleFighter,
    PokemonPvPBattleFighter,
  ];
  opponents: PvPTeamGauntletOpponent[];
  shields: number;
  switchPolicy: PvPTeamSwitchPolicy;
};

export type PvPTeamGauntletResult = {
  opponentId: string;
  opponentLabel: string;
  result: PvPTeamBattleResponse;
};

export type PvPTeamGauntletResponse = {
  mechanics: PokemonPvPBattleMechanics;
  switchPolicy: PvPTeamSwitchPolicy;
  wins: number;
  draws: number;
  losses: number;
  results: PvPTeamGauntletResult[];
};

export type PvPWorkerRequest =
  | PvPRosterWorkerRequest
  | PvPBattleWorkerRequest
  | PvPTeamWorkerRequest
  | PvPTeamBattleRequest
  | PvPTeamGauntletRequest;

export type PvPWorkerResponse =
  | {
      kind: "evaluation";
      response: PokemonPvPRosterEvaluationResponse;
    }
  | {
      kind: "battle";
      response: PokemonPvPBattleResponse;
    }
  | {
      kind: "team";
      response: PvPTeamEvaluationResponse;
    }
  | {
      kind: "team-battle";
      response: PvPTeamBattleResponse;
    }
  | {
      kind: "team-gauntlet";
      response: PvPTeamGauntletResponse;
    }
  | {
      error: string;
    };
