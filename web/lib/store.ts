import { env } from "cloudflare:workers";
import { createRepository } from "./repository";

// Schema and initial imports are owned by drizzle migrations, never by reads.
export const getAppData = () => createRepository(env.DB).getAppData();
export const createPlayer = (input: unknown) =>
  createRepository(env.DB).createPlayer(input);
export const updatePlayer = (id: number, input: unknown) =>
  createRepository(env.DB).updatePlayer(id, input);
export const createGame = (input: unknown, email: string) =>
  createRepository(env.DB).createGame(input, email);
export const updateGame = (id: number, input: unknown) =>
  createRepository(env.DB).updateGame(id, input);
export const deleteGame = (id: number) =>
  createRepository(env.DB).deleteGame(id);

export const getDashboardData = () =>
  createRepository(env.DB).getDashboardData();
export const getGamePage = (
  cursor: string | null = null,
  playerId: number | null = null,
  seasonId: number | null = null,
) => createRepository(env.DB).getGamePage(cursor, playerId, seasonId);
export const getPlayerProfile = (id: number, seasonId: number | null = null) =>
  createRepository(env.DB).getPlayerProfile(id, seasonId);
export const getSeasonStandings = (seasonId: number | null = null) =>
  createRepository(env.DB).getSeasonStandings(seasonId);
