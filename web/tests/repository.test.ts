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
