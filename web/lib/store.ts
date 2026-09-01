import { env } from "cloudflare:workers";
import {
  calculateRatings,
  createFairMatch,
  type EloGame,
  type GameCallStat,
  type EloPlayer,
  type RatingEntry,
} from "@/lib/elo";

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
  fairMatch: ReturnType<typeof createFairMatch>;
};

const playerSeed = [
  [1, "C", "Chanzo B."],
  [2, "Y", "Yash S."],
  [3, "S", "Sreekar M."],
  [4, "R", "Rebekah S."],
  [5, "N", "Nathan Y."],
  [6, "J", "Jet M."],
] as const;
const gameSeed = [
  [1, 1, 2, 595, 5, 3, 1005],
  [2, 5, 1, 1035, 4, 3, 365],
  [3, 5, 2, 1105, 3, 1, -205],
  [4, 3, 2, 1020, 1, 5, 180],
  [5, 5, 3, 1020, 2, 1, 480],
  [6, 5, 2, 1175, 1, 3, 925],
  [7, 2, 3, 1030, 1, 5, 670],
  [8, 5, 1, 1100, 3, 6, -600],
  [9, 5, 6, 340, 3, 1, 555],
] as const;

export const ensureDatabase = async () => {
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_a_player_1_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
      team_a_player_2_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
      score_a INTEGER NOT NULL,
      team_b_player_1_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
      team_b_player_2_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
      score_b INTEGER NOT NULL,
      played_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS game_player_stats (
      game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
      grand_tichus INTEGER NOT NULL,
      successful_grand_tichus INTEGER NOT NULL,
      tichus INTEGER NOT NULL,
      successful_tichus INTEGER NOT NULL,
      PRIMARY KEY (game_id, player_id)
    )`),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_games_played_at_id ON games(played_at, id)",
    ),
  ]);
  const now = "2026-08-30T12:00:00.000Z";
  await db.batch(
    playerSeed.map(([id, code, name]) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO players (id, code, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(id, code, name, now, now),
    ),
  );
  await db.batch(
    gameSeed.map(([id, a1, a2, scoreA, b1, b2, scoreB], index) => {
      const playedAt = new Date(Date.parse(now) + index * 60_000).toISOString();
      return db
        .prepare(
          `INSERT OR IGNORE INTO games
      (id, team_a_player_1_id, team_a_player_2_id, score_a, team_b_player_1_id, team_b_player_2_id, score_b, played_at, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, a1, a2, scoreA, b1, b2, scoreB, playedAt, "import", now, now);
    }),
  );
  await db.prepare("PRAGMA optimize").run();
};

export const getAppData = async (): Promise<AppData> => {
  await ensureDatabase();
  const playerResult = await env.DB.prepare(
    "SELECT id, code, name, archived_at AS archivedAt FROM players ORDER BY name",
  ).all<Player>();
  const gameResult = await env.DB.prepare(
    `SELECT
      g.id, g.team_a_player_1_id AS teamAPlayer1Id, g.team_a_player_2_id AS teamAPlayer2Id,
      g.score_a AS scoreA, g.team_b_player_1_id AS teamBPlayer1Id, g.team_b_player_2_id AS teamBPlayer2Id,
      g.score_b AS scoreB, g.played_at AS playedAt, g.created_by AS createdBy,
      a1.name AS teamAPlayer1Name, a2.name AS teamAPlayer2Name,
      b1.name AS teamBPlayer1Name, b2.name AS teamBPlayer2Name,
      a1.code || a2.code AS teamACode, b1.code || b2.code AS teamBCode
    FROM games g
    JOIN players a1 ON a1.id = g.team_a_player_1_id
    JOIN players a2 ON a2.id = g.team_a_player_2_id
    JOIN players b1 ON b1.id = g.team_b_player_1_id
    JOIN players b2 ON b2.id = g.team_b_player_2_id
    ORDER BY g.played_at, g.id`,
  ).all<Game>();
  const players = playerResult.results;
  const games = gameResult.results;
  const statResult = await env.DB.prepare(
    `SELECT game_id AS gameId, player_id AS playerId,
      grand_tichus AS grandTichus, successful_grand_tichus AS successfulGrandTichus,
      tichus, successful_tichus AS successfulTichus
    FROM game_player_stats`,
  ).all<GameCallStat & { gameId: number }>();
  const statsByGame = new Map<number, GameCallStat[]>();
  for (const { gameId, ...stat } of statResult.results) {
    const stats = statsByGame.get(gameId) ?? [];
    stats.push(stat);
    statsByGame.set(gameId, stats);
  }
  for (const game of games) game.callStats = statsByGame.get(game.id) ?? [];
  const leaderboard = calculateRatings(players, games).sort(
    (a, b) => b.rating - a.rating || a.name.localeCompare(b.name),
  );
  return {
    players,
    games,
    leaderboard,
    fairMatch: createFairMatch(leaderboard),
  };
};

const cleanPlayerInput = (input: unknown) => {
  const data = input as Record<string, unknown>;
  const code = (typeof data.code === "string" ? data.code : "")
    .trim()
    .toUpperCase();
  const name = (typeof data.name === "string" ? data.name : "").trim();
  if (!/^[A-Z0-9]{1,3}$/.test(code))
    throw new Error("Player code must be 1–3 letters or numbers.");
  if (!name || name.length > 40)
    throw new Error("Player name must be 1–40 characters.");
  return { code, name };
};

export const createPlayer = async (input: unknown) => {
  await ensureDatabase();
  const { code, name } = cleanPlayerInput(input);
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      "INSERT INTO players (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    )
      .bind(code, name, now, now)
      .run();
  } catch {
    throw new Error("That player code is already in use.");
  }
};

export const updatePlayer = async (id: number, input: unknown) => {
  await ensureDatabase();
  const data = input as Record<string, unknown>;
  const existing = await env.DB.prepare(
    "SELECT code, name, archived_at AS archivedAt FROM players WHERE id = ?",
  )
    .bind(id)
    .first<Player>();
  if (!existing) throw new Error("Player not found.");
  const { code, name } = cleanPlayerInput({
    code: data.code ?? existing.code,
    name: data.name ?? existing.name,
  });
  const archivedAt =
    data.archived === true
      ? new Date().toISOString()
      : data.archived === false
        ? null
        : existing.archivedAt;
  await env.DB.prepare(
    "UPDATE players SET code = ?, name = ?, archived_at = ?, updated_at = ? WHERE id = ?",
  )
    .bind(code, name, archivedAt, new Date().toISOString(), id)
    .run();
};

const gameInput = (input: unknown) => {
  const data = input as Record<string, unknown>;
  const ids = [
    "teamAPlayer1Id",
    "teamAPlayer2Id",
    "teamBPlayer1Id",
    "teamBPlayer2Id",
  ].map((key) => Number(data[key]));
  const scoreA = Number(data.scoreA);
  const scoreB = Number(data.scoreB);
  const playedAt = new Date(
    typeof data.playedAt === "string" ? data.playedAt : "",
  ).toISOString();
  if (ids.some((id) => !Number.isInteger(id)) || new Set(ids).size !== 4)
    throw new Error("A game requires four distinct players.");
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB))
    throw new Error("Scores must be whole numbers.");
  if (scoreA === scoreB) throw new Error("Tied games are not supported.");
  const callStatsInput = data.callStats;
  let callStats: GameCallStat[] = [];
  if (callStatsInput !== null && callStatsInput !== undefined) {
    if (!Array.isArray(callStatsInput) || callStatsInput.length !== 4)
      throw new Error("Call stats require one entry for each player.");
    callStats = callStatsInput.map((value) => {
      const stat = value as Record<string, unknown>;
      const parsed = {
        playerId: Number(stat.playerId),
        grandTichus: Number(stat.grandTichus),
        successfulGrandTichus: Number(stat.successfulGrandTichus),
        tichus: Number(stat.tichus),
        successfulTichus: Number(stat.successfulTichus),
      };
      if (
        !Object.values(parsed).every(Number.isInteger) ||
        parsed.grandTichus < 0 ||
        parsed.successfulGrandTichus < 0 ||
        parsed.tichus < 0 ||
        parsed.successfulTichus < 0
      )
        throw new Error("Call counts must be non-negative whole numbers.");
      if (
        parsed.successfulGrandTichus > parsed.grandTichus ||
        parsed.successfulTichus > parsed.tichus
      )
        throw new Error("Successful calls cannot exceed total calls.");
      return parsed;
    });
    const statIds = callStats
      .map(({ playerId }) => playerId)
      .sort((a, b) => a - b);
    if (statIds.join(",") !== [...ids].sort((a, b) => a - b).join(","))
      throw new Error("Call stats must match the four selected players.");
  }
  return { ids, scoreA, scoreB, playedAt, callStats };
};

const saveCallStats = async (gameId: number, callStats: GameCallStat[]) => {
  const db = env.DB;
  await db
    .prepare("DELETE FROM game_player_stats WHERE game_id = ?")
    .bind(gameId)
    .run();
  if (!callStats.length) return;
  await db.batch(
    callStats.map((stat) =>
      db
        .prepare(
          `INSERT INTO game_player_stats
        (game_id, player_id, grand_tichus, successful_grand_tichus, tichus, successful_tichus)
        VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          gameId,
          stat.playerId,
          stat.grandTichus,
          stat.successfulGrandTichus,
          stat.tichus,
          stat.successfulTichus,
        ),
    ),
  );
};

export const createGame = async (input: unknown, email: string) => {
  await ensureDatabase();
  const { ids, scoreA, scoreB, playedAt, callStats } = gameInput(input);
  const rows = await env.DB.prepare(
    `SELECT id FROM players WHERE id IN (?, ?, ?, ?) AND archived_at IS NULL`,
  )
    .bind(...ids)
    .all();
  if (rows.results.length !== 4)
    throw new Error("New games may only use active players.");
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO games
    (team_a_player_1_id, team_a_player_2_id, score_a, team_b_player_1_id, team_b_player_2_id, score_b, played_at, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      ids[0],
      ids[1],
      scoreA,
      ids[2],
      ids[3],
      scoreB,
      playedAt,
      email,
      now,
      now,
    )
    .run();
  await saveCallStats(Number(result.meta.last_row_id), callStats);
};

export const updateGame = async (id: number, input: unknown) => {
  await ensureDatabase();
  const { ids, scoreA, scoreB, playedAt, callStats } = gameInput(input);
  const rows = await env.DB.prepare(
    "SELECT id FROM players WHERE id IN (?, ?, ?, ?)",
  )
    .bind(...ids)
    .all();
  if (rows.results.length !== 4)
    throw new Error("Every selected player must exist.");
  const result = await env.DB.prepare(
    `UPDATE games SET team_a_player_1_id = ?, team_a_player_2_id = ?, score_a = ?,
    team_b_player_1_id = ?, team_b_player_2_id = ?, score_b = ?, played_at = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(
      ids[0],
      ids[1],
      scoreA,
      ids[2],
      ids[3],
      scoreB,
      playedAt,
      new Date().toISOString(),
      id,
    )
    .run();
  if (!result.meta.changes) throw new Error("Game not found.");
  await saveCallStats(id, callStats);
};

export const deleteGame = async (id: number) => {
  await ensureDatabase();
  const result = await env.DB.prepare("DELETE FROM games WHERE id = ?")
    .bind(id)
    .run();
  if (!result.meta.changes) throw new Error("Game not found.");
};
