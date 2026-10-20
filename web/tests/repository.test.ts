import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createRepository } from "../lib/repository.ts";
import { InputError } from "../lib/input.ts";
import { createDatabase } from "./helpers/database.ts";

const input = {
  teamAPlayer1Id: 1,
  teamAPlayer2Id: 2,
  teamBPlayer1Id: 3,
  teamBPlayer2Id: 4,
  scoreA: 1000,
  scoreB: -100,
  playedAt: "2026-09-14T20:30:00.000Z",
  callStats: [1, 2, 3, 4].map((playerId) => ({
    playerId,
    grandTichus: 1,
    successfulGrandTichus: 1,
    tichus: 2,
    successfulTichus: 1,
  })),
};

test("gender migration preserves existing data and backfills Rebekah S. only", (context) => {
  const sqlite = new DatabaseSync(":memory:");
  context.after(() => sqlite.close());
  sqlite.exec("PRAGMA foreign_keys = ON");
  const directory = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(directory)
    .filter((file) => file.endsWith(".sql") && file < "0003")
    .sort()) {
    sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  }
  sqlite.exec("UPDATE players SET archived_at = '2026-10-01' WHERE code = 'R'");
  sqlite.exec(
    "INSERT INTO players (code, name, created_at, updated_at) VALUES ('NEW', 'Existing extra player', '2026-10-01', '2026-10-01')",
  );
  const beforePlayers = sqlite
    .prepare("SELECT * FROM players ORDER BY id")
    .all();
  const beforeGames = sqlite.prepare("SELECT * FROM games ORDER BY id").all();
  sqlite.exec(
    readFileSync(new URL("0003_player_gender.sql", directory), "utf8"),
  );
  const migrated = sqlite.prepare("SELECT * FROM players ORDER BY id").all();
  assert.deepEqual(
    migrated.map(({ gender: _gender, ...player }) => ({ ...player })),
    beforePlayers.map((player) => ({ ...player })),
  );
  assert.deepEqual(
    sqlite.prepare("SELECT * FROM games ORDER BY id").all(),
    beforeGames,
  );
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  for (const player of migrated)
    assert.equal(player.gender, player.name === "Rebekah S." ? "F" : "M");
  for (const gender of [null, "X", "", "female"])
    assert.throws(
      () =>
        sqlite
          .prepare("UPDATE players SET gender = ? WHERE id = 1")
          .run(gender),
      /constraint/i,
    );
});

test("player genders survive reads, creation, renames and archiving", async (context) => {
  const { db } = createDatabase(context);
  const repository = createRepository(db, () => Date.UTC(2026, 9, 19));
  const original = await repository.getAppData();
  assert.equal(
    original.players.find(({ name }) => name === "Rebekah S.")?.gender,
    "F",
  );
  assert.ok(
    original.players
      .filter(({ name }) => name !== "Rebekah S.")
      .every(({ gender }) => gender === "M"),
  );
  await repository.updatePlayer(4, {
    name: "Rebekah renamed",
    code: "RS",
    archived: true,
  });
  assert.equal((await repository.getPlayerProfile(4))?.player.gender, "F");
  await repository.createPlayer({ code: "NEW", name: "New Player" });
  await repository.createPlayer({
    code: "F",
    name: "New Female Player",
    gender: "F",
  });
  let data = await repository.getAppData();
  assert.equal(data.players.find(({ code }) => code === "NEW")?.gender, "M");
  assert.equal(data.players.find(({ code }) => code === "F")?.gender, "F");
  await repository.updatePlayer(1, { gender: "F" });
  data = await repository.getAppData();
  assert.equal(data.players.find(({ id }) => id === 1)?.gender, "F");
  assert.equal(
    (await repository.getDashboardData()).leaderboard.find(({ id }) => id === 1)
      ?.gender,
    "F",
  );
  for (const gender of [null, "X", "", "female", false]) {
    await assert.rejects(
      repository.createPlayer({ code: "BAD", name: "Bad", gender }),
      InputError,
    );
    await assert.rejects(repository.updatePlayer(4, { gender }), InputError);
  }
  assert.deepEqual(await repository.getAppData(), data);
});

test("deleted imported games stay deleted across reads and subsequent writes", async (context) => {
  const { db } = createDatabase(context);
  const repository = createRepository(db, () => Date.UTC(2026, 9, 19));
  await repository.deleteGame(1);
  assert.equal(
    (await repository.getAppData()).games.some(({ id }) => id === 1),
    false,
  );
  await repository.createPlayer({ code: "NEW", name: "New Player" });
  assert.equal((await repository.getAppData()).games.length, 8);
});

test("a deleted seed code can be reused without a read restoring its original owner", async (context) => {
  const { db } = createDatabase(context);
  const repository = createRepository(db, () => Date.UTC(2026, 9, 19));
  await repository.updatePlayer(1, { code: "CB" });
  await repository.createPlayer({ code: "C", name: "New C" });
  const data = await repository.getAppData();
  assert.equal(data.players.find(({ id }) => id === 1)?.code, "CB");
  assert.equal(data.players.find(({ code }) => code === "C")?.name, "New C");
});

test("creates, replaces and removes per-player stats with the game", async (context) => {
  const { db, sqlite } = createDatabase(context);
  const repository = createRepository(db, () => Date.UTC(2026, 9, 19));
  await repository.createGame(input, "owner@example.com");
  const game = (await repository.getAppData()).games.at(-1)!;
  assert.equal(game.callStats.length, 4);
  await repository.updateGame(game.id, {
    ...input,
    scoreA: 1100,
    callStats: input.callStats.map((stat) => ({ ...stat, tichus: 3 })),
  });
  assert.equal(
    (await repository.getAppData()).games.at(-1)?.callStats[0].tichus,
    3,
  );
  await repository.updateGame(game.id, { ...input, callStats: null });
  assert.deepEqual((await repository.getAppData()).games.at(-1)?.callStats, []);
  await repository.updateGame(game.id, input);
  await repository.deleteGame(game.id);
  assert.equal(
    sqlite.prepare("SELECT count(*) AS count FROM game_player_stats").get()
      ?.count,
    0,
  );
});

test("failed call-stat creation rolls back the game insert", async (context) => {
  const { db, sqlite } = createDatabase(context);
  const repository = createRepository(db, () => Date.UTC(2026, 9, 19));
  const before = await repository.getAppData();
  sqlite.exec(
    "CREATE TRIGGER fail_stats BEFORE INSERT ON game_player_stats BEGIN SELECT RAISE(ABORT, 'injected failure'); END",
  );
  await assert.rejects(
    repository.createGame(input, "owner@example.com"),
    /injected failure/,
  );
  assert.deepEqual(await repository.getAppData(), before);
});

test("failed call-stat replacement rolls back scores and existing call stats", async (context) => {
  const { db, sqlite } = createDatabase(context);
  const repository = createRepository(db, () => Date.UTC(2026, 9, 19));
  await repository.updateGame(1, input);
  const before = await repository.getAppData();
  sqlite.exec(
    "CREATE TRIGGER fail_stats BEFORE INSERT ON game_player_stats BEGIN SELECT RAISE(ABORT, 'injected failure'); END",
  );
  await assert.rejects(
    repository.updateGame(1, { ...input, scoreA: 1200 }),
    /injected failure/,
  );
  assert.deepEqual(await repository.getAppData(), before);
});

test("missing games and archived new-game players fail without changing stored data", async (context) => {
  const { db } = createDatabase(context);
  const repository = createRepository(db, () => Date.UTC(2026, 9, 19));
  await repository.updatePlayer(1, { archived: true });
  const before = await repository.getAppData();
  await assert.rejects(
    repository.createGame(input, "owner@example.com"),
    /active players/,
  );
  await assert.rejects(repository.updateGame(999, input), /Game not found/);
  assert.deepEqual(await repository.getAppData(), before);
  await repository.updateGame(1, input); // Historic games may keep archived participants.
});

test("duplicate player codes are validation errors, while DB faults remain server errors", async (context) => {
  const { db, sqlite } = createDatabase(context);
  const repository = createRepository(db, () => Date.UTC(2026, 9, 19));
  await assert.rejects(
    repository.createPlayer({ code: "C", name: "Duplicate" }),
    InputError,
  );
  await assert.rejects(repository.updatePlayer(2, { code: "C" }), InputError);
  sqlite.exec(
    "CREATE TRIGGER fail_player BEFORE INSERT ON players BEGIN SELECT RAISE(ABORT, 'database failure'); END",
  );
  await assert.rejects(
    repository.createPlayer({ code: "XX", name: "New" }),
    (error: unknown) =>
      error instanceof Error &&
      !(error instanceof InputError) &&
      /database failure/.test(error.message),
  );
});

test("history pages use chronological cursors, bounded call stats, and include games beyond ten", async (context) => {
  const { db, sqlite } = createDatabase(context);
  const repository = createRepository(db, () => Date.UTC(2026, 9, 19));
  for (let index = 0; index < 46; index += 1) {
    await repository.createGame(
      {
        ...input,
        playedAt:
          index < 25 ? "2026-09-14T20:30:00.000Z" : "2026-09-15T20:30:00.000Z",
      },
      "test",
    );
  }
  const expected = (await repository.getAppData()).games.slice().reverse();
  const seen = [];
  let cursor: string | null = null;
  do {
    const page = await repository.getGamePage(cursor);
    assert.ok(page.games.length <= 20);
    seen.push(...page.games);
    for (const game of page.games)
      assert.equal(game.callStats.length, game.id > 9 ? 4 : 0);
    cursor = page.nextCursor;
  } while (cursor);
  assert.deepEqual(
    seen.map(({ id }) => id),
    expected.map(({ id }) => id),
  );
  assert.equal(new Set(seen.map(({ id }) => id)).size, 55);
  const plan = sqlite
    .prepare(
      "EXPLAIN QUERY PLAN SELECT id FROM games WHERE (played_at, id) < (?, ?) ORDER BY played_at DESC, id DESC LIMIT 21",
    )
    .all("2026-09-15T20:30:00.000Z", 54);
  assert.match(JSON.stringify(plan), /idx_games_played_at_id/);
});

test("history cursors survive deleting their anchor and inserting newer games", async (context) => {
  const { db } = createDatabase(context);
  const repository = createRepository(db, () => Date.UTC(2026, 9, 19));
  for (let index = 0; index < 22; index += 1)
    await repository.createGame(input, "test");
  const first = await repository.getGamePage();
  const olderIds = (await repository.getAppData()).games
    .slice()
    .reverse()
    .slice(20)
    .map(({ id }) => id);
  await repository.deleteGame(first.games.at(-1)!.id);
  await repository.createGame(
    { ...input, playedAt: "2027-01-01T00:00:00.000Z" },
    "test",
  );
  assert.deepEqual(
    (await repository.getGamePage(first.nextCursor)).games.map(({ id }) => id),
    olderIds,
  );
});

test("dashboard payload is bounded while ratings and lazy profiles retain full history after edits and deletes", async (context) => {
  const { db } = createDatabase(context);
  const repository = createRepository(db, () => Date.UTC(2026, 9, 19));
  for (let index = 0; index < 24; index += 1)
    await repository.createGame(input, "test");
  const { calculatePlayerProfile } = await import("../lib/player-profile.ts");
  for (const action of [
    async () => {},
    async () =>
      repository.updateGame(10, { ...input, scoreA: 0, scoreB: 1000 }),
    async () => repository.deleteGame(12),
  ]) {
    await action();
    const full = await repository.getAppData();
    const dashboard = await repository.getDashboardData();
    assert.deepEqual(dashboard.leaderboard, full.leaderboard);
    assert.equal(dashboard.history.games.length, 20);
    assert.equal("games" in dashboard, false);
    assert.equal("players" in dashboard, false);
    for (const player of full.players) {
      const result = await repository.getPlayerProfile(player.id);
      const { season, seasons, rank, ...profile } = result!;
      assert.equal(season.id, 1);
      assert.equal(seasons.length, 1);
      assert.ok(rank === null || rank > 0);
      assert.deepEqual(
        profile,
        calculatePlayerProfile(full.players, full.games, player.id),
      );
    }
  }
  assert.equal(await repository.getPlayerProfile(999), null);
});

test("history pagination rejects malformed cursors and handles empty and exact-size pages", async (context) => {
  const { db, sqlite } = createDatabase(context);
  const repository = createRepository(db, () => Date.UTC(2026, 9, 19));
  for (const cursor of [
    "",
    "bad",
    btoa("null"),
    btoa(JSON.stringify({ id: -1, playedAt: "2026-01-01" })),
    btoa(JSON.stringify({ id: 1, playedAt: "bad" })),
    "a".repeat(257),
  ])
    await assert.rejects(
      repository.getGamePage(cursor),
      /Invalid game history cursor/,
    );
  sqlite.exec("DELETE FROM games");
  assert.deepEqual(await repository.getGamePage(), {
    games: [],
    nextCursor: null,
  });
  for (let index = 0; index < 20; index += 1)
    await repository.createGame(input, "test");
  assert.equal((await repository.getGamePage()).nextCursor, null);
});

test("player history filters every seat before pagination, including archived players", async (context) => {
  const { db } = createDatabase(context);
  const repository = createRepository(db, () => Date.UTC(2026, 9, 19));
  const seats = [
    "teamAPlayer1Id",
    "teamAPlayer2Id",
    "teamBPlayer1Id",
    "teamBPlayer2Id",
  ] as const;
  for (let index = 0; index < 48; index += 1) {
    const ids = [2, 3, 4, 5];
    if (index % 2 === 0) ids[(index / 2) % 4] = 1;
    await repository.createGame(
      {
        ...input,
        ...Object.fromEntries(seats.map((seat, i) => [seat, ids[i]])),
        callStats: ids.map((playerId) => ({ ...input.callStats[0], playerId })),
      },
      "test",
    );
  }
  await repository.updatePlayer(1, { archived: true });
  const expected = (await repository.getAppData()).games
    .filter((game) => seats.some((seat) => game[seat] === 1))
    .reverse();
  const seen = [];
  let cursor: string | null = null;
  do {
    const page = await repository.getGamePage(cursor, 1);
    assert.ok(page.games.length <= 20);
    seen.push(...page.games);
    cursor = page.nextCursor;
  } while (cursor);
  assert.ok(seen.length > 20);
  for (const game of expected)
    game.callStats.sort((a, b) => a.playerId - b.playerId);
  assert.deepEqual(seen, expected);
  assert.deepEqual(await repository.getGamePage(null, 999), {
    games: [],
    nextCursor: null,
  });
  for (const playerId of [0, -1, 1.5, NaN, Infinity])
    await assert.rejects(
      repository.getGamePage(null, playerId),
      /Invalid game history player ID/,
    );
});
