import type { Season, SeasonSettings } from "./seasons.ts";
import type {
  EloPlayer,
  EloGame,
  GameCallStat,
  RatingEntry,
  FairMatch,
  PlayerGender,
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
  seasonSettings: SeasonSettings;
  season: Season;
  players: Player[];
  games: Game[];
  leaderboard: RatingEntry[];
  fairMatch: FairMatch | null;
};

export type PlayerInput = { code: string; name: string; gender?: PlayerGender };
export type PlayerUpdate = Partial<PlayerInput> & { archived?: boolean };

export type GamePage = { games: Game[]; nextCursor: string | null };
export type DashboardData = {
  season: Season;
  seasons: Season[];
  leaderboard: RatingEntry[];
  history: GamePage;
};
export type SeasonStandings = {
  season: Season;
  seasons: Season[];
  leaderboard: RatingEntry[];
};
