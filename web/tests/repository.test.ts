import assert from "node:assert/strict";
import test from "node:test";
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

test("deleted imported games stay deleted across reads and subsequent writes", async (context) => {
  const { db } = createDatabase(context);
  const repository = createRepository(db);
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
  const repository = createRepository(db);
  await repository.updatePlayer(1, { code: "CB" });
  await repository.createPlayer({ code: "C", name: "New C" });
  const data = await repository.getAppData();
  assert.equal(data.players.find(({ id }) => id === 1)?.code, "CB");
  assert.equal(data.players.find(({ code }) => code === "C")?.name, "New C");
});

test("creates, replaces and removes per-player stats with the game", async (context) => {
  const { db, sqlite } = createDatabase(context);
  const repository = createRepository(db);
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
  const repository = createRepository(db);
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
  const repository = createRepository(db);
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
  const repository = createRepository(db);
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
  const repository = createRepository(db);
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
  const repository = createRepository(db);
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
  const repository = createRepository(db);
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
  const repository = createRepository(db);
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
    for (const player of full.players)
      assert.deepEqual(
        await repository.getPlayerProfile(player.id),
        calculatePlayerProfile(full.players, full.games, player.id),
      );
  }
  assert.equal(await repository.getPlayerProfile(999), null);
});

test("history pagination rejects malformed cursors and handles empty and exact-size pages", async (context) => {
  const { db, sqlite } = createDatabase(context);
  const repository = createRepository(db);
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
