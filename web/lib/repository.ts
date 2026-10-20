import {
  getCurrentSeason,
  getSeason,
  getSeasons,
  isInSeason,
  rankedPlayers,
  sortRatings,
  type Season,
} from "./seasons.ts";
import { calculatePlayerProfile } from "./player-profile.ts";
import {
  decodeGameCursor,
  encodeGameCursor,
  GAME_PAGE_SIZE,
} from "./game-pagination.ts";
import {
  calculateRatings,
  createFairMatch,
  type EloGame,
  type GameCallStat,
} from "./elo.ts";
import type {
  AppData,
  DashboardData,
  GamePage,
  Game,
  Player,
} from "./models.ts";
import {
  cleanPlayerInput,
  gameInput,
  InputError,
  requireRecord,
} from "./input.ts";

const gameProjection = `SELECT
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
    JOIN players b2 ON b2.id = g.team_b_player_2_id`;

const isDuplicatePlayerCode = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes("UNIQUE constraint failed: players.code") ||
    isDuplicatePlayerCode(error.cause));

// Internal transaction hooks let API idempotency and auditing commit with the record.
export type CreationTransaction = {
  before: D1PreparedStatement[];
  after: D1PreparedStatement[];
};

export const createRepository = (
  db: Pick<D1Database, "prepare" | "batch">,
  clock: () => number = Date.now,
) => {
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
    const now = clock();
    const season = getCurrentSeason(now);
    const playerResult = await db
      .prepare(
        "SELECT id, code, name, gender, archived_at AS archivedAt FROM players ORDER BY name",
      )
      .all<Player>();
    const gameResult = await db
      .prepare(`${gameProjection} ORDER BY g.played_at, g.id`)
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
    const leaderboard = sortRatings(
      calculateRatings(
        players,
        games.filter((game) => isInSeason(game.playedAt, season)),
      ),
    );
    return {
      season,
      players,
      games,
      leaderboard,
      fairMatch: createFairMatch(leaderboard),
    };
  };

  const getGamePage = async (
    cursorValue: string | null = null,
    playerId: number | null = null,
    seasonId: number | null = null,
    now = clock(),
  ): Promise<GamePage> => {
    const season = seasonId === null ? null : getSeason(seasonId, now);
    const cursor = decodeGameCursor(cursorValue);
    if (playerId !== null && (!Number.isSafeInteger(playerId) || playerId <= 0))
      throw new InputError("Invalid game history player ID.");
    const conditions = [
      ...(season
        ? ["g.played_at < ?", ...(season.startsAt ? ["g.played_at >= ?"] : [])]
        : []),
      ...(cursor ? ["(g.played_at, g.id) < (?, ?)"] : []),
      ...(playerId !== null
        ? [
            "? IN (g.team_a_player_1_id, g.team_a_player_2_id, g.team_b_player_1_id, g.team_b_player_2_id)",
          ]
        : []),
    ];
    const result = await db
      .prepare(
        `${gameProjection}
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY g.played_at DESC, g.id DESC LIMIT ?`,
      )
      .bind(
        ...(season
          ? [season.endsAt, ...(season.startsAt ? [season.startsAt] : [])]
          : []),
        ...(cursor ? [cursor.playedAt, cursor.id] : []),
        ...(playerId !== null ? [playerId] : []),
        GAME_PAGE_SIZE + 1,
      )
      .all<Game>();
    const games = result.results.slice(0, GAME_PAGE_SIZE);
    if (games.length) {
      const stats = await db
        .prepare(
          `SELECT game_id AS gameId, player_id AS playerId,
        grand_tichus AS grandTichus, successful_grand_tichus AS successfulGrandTichus,
        tichus, successful_tichus AS successfulTichus FROM game_player_stats
        WHERE game_id IN (${games.map(() => "?").join(",")}) ORDER BY player_id`,
        )
        .bind(...games.map(({ id }) => id))
        .all<GameCallStat & { gameId: number }>();
      for (const game of games)
        game.callStats = stats.results
          .filter(({ gameId }) => gameId === game.id)
          .map(({ gameId: _gameId, ...stat }) => stat);
    }
    return {
      games,
      nextCursor:
        result.results.length > GAME_PAGE_SIZE
          ? encodeGameCursor(games.at(-1)!)
          : null,
    };
  };

  // Bound every replay and its call stats to the same season. All players remain
  // available so archived opponents still contribute to the Elo calculation.
  const getReplayData = async (season: Season) => {
    const where = `g.played_at < ?${season.startsAt ? " AND g.played_at >= ?" : ""}`;
    const bounds = [
      season.endsAt,
      ...(season.startsAt ? [season.startsAt] : []),
    ];
    const [players, games, stats] = await Promise.all([
      db
        .prepare(
          "SELECT id, code, name, gender, archived_at AS archivedAt FROM players ORDER BY name",
        )
        .all<Player>(),
      db
        .prepare(
          `SELECT g.id, team_a_player_1_id AS teamAPlayer1Id, team_a_player_2_id AS teamAPlayer2Id,
        score_a AS scoreA, team_b_player_1_id AS teamBPlayer1Id, team_b_player_2_id AS teamBPlayer2Id,
        score_b AS scoreB, played_at AS playedAt FROM games g WHERE ${where} ORDER BY played_at, g.id`,
        )
        .bind(...bounds)
        .all<EloGame>(),
      db
        .prepare(
          `SELECT s.game_id AS gameId, s.player_id AS playerId,
        s.grand_tichus AS grandTichus, s.successful_grand_tichus AS successfulGrandTichus,
        s.tichus, s.successful_tichus AS successfulTichus
        FROM game_player_stats s JOIN games g ON g.id = s.game_id WHERE ${where}`,
        )
        .bind(...bounds)
        .all<GameCallStat & { gameId: number }>(),
    ]);
    const byGame = new Map<number, GameCallStat[]>();
    for (const { gameId, ...stat } of stats.results) {
      const calls = byGame.get(gameId) ?? [];
      calls.push(stat);
      byGame.set(gameId, calls);
    }
    for (const game of games.results)
      game.callStats = byGame.get(game.id) ?? [];
    return { players: players.results, games: games.results };
  };

  const getPlayerRatings = async (season = getCurrentSeason(clock())) => {
    const { players, games } = await getReplayData(season);
    return sortRatings(calculateRatings(players, games));
  };

  const getSeasonStandings = async (seasonId: number | null = null) => {
    const now = clock();
    const season =
      seasonId === null ? getCurrentSeason(now) : getSeason(seasonId, now);
    return {
      season,
      seasons: getSeasons(now),
      leaderboard: rankedPlayers(await getPlayerRatings(season), season),
    };
  };

  const getDashboardData = async (): Promise<DashboardData> => {
    const now = clock();
    const season = getCurrentSeason(now);
    const [leaderboard, history] = await Promise.all([
      getPlayerRatings(season),
      getGamePage(null, null, season.id, now),
    ]);
    return { season, seasons: getSeasons(now), leaderboard, history };
  };

  const getPlayerProfile = async (
    playerId: number,
    seasonId: number | null = null,
  ) => {
    const now = clock();
    const season =
      seasonId === null ? getCurrentSeason(now) : getSeason(seasonId, now);
    const { players, games } = await getReplayData(season);
    const profile = calculatePlayerProfile(players, games, playerId);
    if (!profile) return null;
    const rankings = rankedPlayers(calculateRatings(players, games), season);
    const index = rankings.findIndex(({ id }) => id === playerId);
    return {
      ...profile,
      season,
      seasons: getSeasons(now),
      rank: index === -1 ? null : index + 1,
    };
  };

  const createPlayer = async (
    input: unknown,
    transaction?: CreationTransaction,
  ) => {
    const { code, name, gender } = cleanPlayerInput(input);
    const now = new Date().toISOString();
    try {
      const insert = db
        .prepare(
          "INSERT INTO players (code, name, gender, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(code, name, gender, now, now);
      const before = transaction?.before ?? [];
      const results = await db.batch([
        ...before,
        insert,
        ...(transaction?.after ?? []),
      ]);
      return results[before.length].meta.last_row_id;
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
        "SELECT code, name, gender, archived_at AS archivedAt FROM players WHERE id = ?",
      )
      .bind(id)
      .first<Player>();
    if (!existing) throw new InputError("Player not found.");
    const { code, name, gender } = cleanPlayerInput({
      code: data.code ?? existing.code,
      name: data.name ?? existing.name,
      gender: data.gender === undefined ? existing.gender : data.gender,
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
          "UPDATE players SET code = ?, name = ?, gender = ?, archived_at = ?, updated_at = ? WHERE id = ?",
        )
        .bind(code, name, gender, archivedAt, new Date().toISOString(), id)
        .run();
    } catch (error) {
      if (isDuplicatePlayerCode(error))
        throw new InputError("That player code is already in use.");
      throw error;
    }
  };

  const createGame = async (
    input: unknown,
    email: string,
    transaction?: CreationTransaction,
  ) => {
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
    const before = transaction?.before ?? [];
    const results = await db.batch([
      ...before,
      insert,
      callStatsStatement(callStats),
      ...(transaction?.after ?? []),
    ]);
    return results[before.length].meta.last_row_id;
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
    getDashboardData,
    getPlayerRatings,
    getSeasonStandings,
    getGamePage,
    getPlayerProfile,
    createPlayer,
    updatePlayer,
    createGame,
    updateGame,
    deleteGame,
  };
};
