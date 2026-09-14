import type {
  EloPlayer,
  EloGame,
  GameCallStat,
  RatingEntry,
  FairMatch,
} from "./elo.ts";

export type Player = EloPlayer;
export type Game = EloGame & {
  teamAPlayer1Name: string;
  teamAPlayer2Name: string;
  teamBPlayer1Name: string;
  teamBPlayer2Name: string;
  teamACode: string;
  teamBCode: string;
  createdBy: string;
  callStats: GameCallStat[];
};
export type AppData = {
  players: Player[];
  games: Game[];
  leaderboard: RatingEntry[];
  fairMatch: FairMatch | null;
};

export type PlayerInput = { code: string; name: string };
export type PlayerUpdate = Partial<PlayerInput> & { archived?: boolean };
