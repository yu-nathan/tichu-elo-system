import { calculateRatings, createFairMatch, type GameCallStat } from "./elo.ts";
import type { AppData, Game, Player } from "./models.ts";
import {
  cleanPlayerInput,
  gameInput,
  InputError,
  requireRecord,
} from "./input.ts";

const isDuplicatePlayerCode = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes("UNIQUE constraint failed: players.code") ||
    isDuplicatePlayerCode(error.cause));

export const createRepository = (db: Pick<D1Database, "prepare" | "batch">) => {
  const callStatsStatement = (stats: GameCallStat[], gameId?: number) =>
    db
      .prepare(
        `
    INSERT INTO game_player_stats (game_id, player_id, grand_tichus, successful_grand_tichus, tichus, successful_tichus)
    SELECT games.id, json_extract(value, '$.playerId'), json_extract(value, '$.grandTichus'),
      json_extract(value, '$.successfulGrandTichus'), json_extract(value, '$.tichus'), json_extract(value, '$.successfulTichus')
    FROM games, json_each(?) WHERE games.id = ${gameId === undefined ? "(SELECT MAX(id) FROM games)" : "?"}
  `,
      )
      .bind(JSON.stringify(stats), ...(gameId === undefined ? [] : [gameId]));

  const getAppData = async (): Promise<AppData> => {
    const playerResult = await db
      .prepare(
        "SELECT id, code, name, archived_at AS archivedAt FROM players ORDER BY name",
      )
      .all<Player>();
    const gameResult = await db
      .prepare(
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
      )
      .all<Game>();
    const players = playerResult.results;
    const games = gameResult.results;
    const statResult = await db
      .prepare(
        `SELECT game_id AS gameId, player_id AS playerId,
      grand_tichus AS grandTichus, successful_grand_tichus AS successfulGrandTichus,
      tichus, successful_tichus AS successfulTichus
    FROM game_player_stats`,
      )
      .all<GameCallStat & { gameId: number }>();
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

  const createPlayer = async (input: unknown) => {
    const { code, name } = cleanPlayerInput(input);
    const now = new Date().toISOString();
    try {
      await db
        .prepare(
          "INSERT INTO players (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
        )
        .bind(code, name, now, now)
        .run();
    } catch (error) {
      if (isDuplicatePlayerCode(error))
        throw new InputError("That player code is already in use.");
      throw error;
    }
  };

  const updatePlayer = async (id: number, input: unknown) => {
    const data = requireRecord(input);
    const existing = await db
      .prepare(
        "SELECT code, name, archived_at AS archivedAt FROM players WHERE id = ?",
      )
      .bind(id)
      .first<Player>();
    if (!existing) throw new InputError("Player not found.");
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
    try {
      await db
        .prepare(
          "UPDATE players SET code = ?, name = ?, archived_at = ?, updated_at = ? WHERE id = ?",
        )
        .bind(code, name, archivedAt, new Date().toISOString(), id)
        .run();
    } catch (error) {
      if (isDuplicatePlayerCode(error))
        throw new InputError("That player code is already in use.");
      throw error;
    }
  };

  const createGame = async (input: unknown, email: string) => {
    const { ids, scoreA, scoreB, playedAt, callStats } = gameInput(input);
    const rows = await db
      .prepare(
        `SELECT id FROM players WHERE id IN (?, ?, ?, ?) AND archived_at IS NULL`,
      )
      .bind(...ids)
      .all();
    if (rows.results.length !== 4)
      throw new InputError("New games may only use active players.");
    const now = new Date().toISOString();
    const insert = db
      .prepare(
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
      );
    // D1 batches are transactional. MAX(id) identifies the game just inserted
    // within this same batch; no other writer can interleave between statements.
    await db.batch([insert, callStatsStatement(callStats)]);
  };

  const updateGame = async (id: number, input: unknown) => {
    const { ids, scoreA, scoreB, playedAt, callStats } = gameInput(input);
    const rows = await db
      .prepare("SELECT id FROM players WHERE id IN (?, ?, ?, ?)")
      .bind(...ids)
      .all();
    if (rows.results.length !== 4)
      throw new InputError("Every selected player must exist.");
    const update = db
      .prepare(
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
      );
    const [result] = await db.batch([
      update,
      db.prepare("DELETE FROM game_player_stats WHERE game_id = ?").bind(id),
      callStatsStatement(callStats, id),
    ]);
    if (!result.meta.changes) throw new InputError("Game not found.");
  };

  const deleteGame = async (id: number) => {
    const result = await db
      .prepare("DELETE FROM games WHERE id = ?")
      .bind(id)
      .run();
    if (!result.meta.changes) throw new InputError("Game not found.");
  };

  return {
    getAppData,
    createPlayer,
    updatePlayer,
    createGame,
    updateGame,
    deleteGame,
  };
};
