import assert from "node:assert/strict";
import test from "node:test";
import { createDatabase } from "./helpers/database.ts";
import { createRepository } from "../lib/repository.ts";
import type { DashboardTimings } from "../lib/dashboard-cache.ts";

const start = Date.parse("2026-10-21T12:00:00Z");
const game = {
  teamAPlayer1Id: 1,
  teamAPlayer2Id: 2,
  teamBPlayer1Id: 3,
  teamBPlayer2Id: 4,
  scoreA: 1000,
  scoreB: -100,
  playedAt: "2026-10-21T12:00:00Z",
  callStats: [1, 2, 3, 4].map((playerId) => ({
    playerId,
    grandTichus: 0,
    successfulGrandTichus: 0,
    tichus: 1,
    successfulTichus: 1,
  })),
};

test("snapshot hits avoid replay, expire after five minutes, and return independent objects", async (context) => {
  const { db, sqlite } = createDatabase(context);
  let now = start;
  const repo = createRepository(db, () => now);
  const first = await repo.getDashboardData();
  let timing: DashboardTimings = {};
  const second = await repo.getDashboardData((value) => (timing = value));
  assert.deepEqual(second, first);
  assert.equal(timing.cache_hit, 1);
  assert.equal(timing.replay_read, undefined);
  second.leaderboard.length = 0;
  assert.deepEqual(await repo.getDashboardData(), first);
  now += 300_000;
  await repo.getDashboardData((value) => (timing = value));
  assert.equal(timing.cache_hit, 0);
  assert.ok(timing.replay_read !== undefined);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS n FROM dashboard_snapshot").get()?.n,
    1,
  );
});

test("all relevant writes invalidate and rolled-back changes do not", async (context) => {
  const { db, sqlite } = createDatabase(context);
  const repo = createRepository(db, () => start);
  await repo.getDashboardData();
  const id = await repo.createGame(game, "owner@example.com");
  const after = await repo.getDashboardData();
  assert.equal(after.history.games[0].id, id);
  await repo.updateGame(id, { ...game, scoreA: -100, scoreB: 1000 });
  assert.equal((await repo.getDashboardData()).history.games[0].scoreA, -100);
  await repo.updatePlayer(1, { name: "Renamed", code: "REN" });
  assert.equal(
    (await repo.getDashboardData()).leaderboard.find((p) => p.id === 1)?.name,
    "Renamed",
  );
  await repo.updatePlayer(1, { archived: true });
  assert.ok(
    (await repo.getDashboardData()).leaderboard.find((p) => p.id === 1)
      ?.archivedAt,
  );
  const newId = await repo.createPlayer({ name: "New player", code: "NEW" });
  assert.ok(
    (await repo.getDashboardData()).leaderboard.some((p) => p.id === newId),
  );
  await repo.deleteGame(id);
  assert.ok(
    !(await repo.getDashboardData()).history.games.some((g) => g.id === id),
  );
  const revision = () =>
    sqlite.prepare("SELECT revision FROM dashboard_revision").get()?.revision;
  const before = revision();
  await assert.rejects(
    db.batch([
      db.prepare("UPDATE players SET name = 'Should roll back' WHERE id = 1"),
      db.prepare(
        "INSERT INTO players (code,name,created_at,updated_at) VALUES ('REN','Duplicate','','')",
      ),
    ]),
  );
  assert.equal(revision(), before);
  let timing: DashboardTimings = {};
  await repo.getDashboardData((value) => (timing = value));
  assert.equal(timing.cache_hit, 1);
  sqlite
    .prepare(
      "INSERT INTO game_player_stats (game_id, player_id, grand_tichus, successful_grand_tichus, tichus, successful_tichus) VALUES ((SELECT MIN(id) FROM games), 1, 0, 0, 1, 1) ON CONFLICT(game_id, player_id) DO UPDATE SET tichus = tichus + 1",
    )
    .run();
  await repo.getDashboardData((value) => (timing = value));
  assert.equal(timing.cache_hit, 0);
});

test("settings changes and exact season rollover reject prior snapshots", async (context) => {
  const { db, sqlite } = createDatabase(context);
  let now = Date.parse("2026-12-31T23:59:00-08:00");
  const repo = createRepository(db, () => now);
  const old = await repo.getDashboardData();
  assert.equal(
    sqlite.prepare("SELECT expires_at AS expiry FROM dashboard_snapshot").get()
      ?.expiry,
    Date.parse(old.season.endsAt),
  );
  now = Date.parse(old.season.endsAt);
  const next = await repo.getDashboardData();
  assert.notEqual(next.season.id, old.season.id);
  const { seasonSettings } = await repo.getSeasonData();
  await repo.updateSeasonSettings({
    cadenceMonths: 1,
    revision: seasonSettings.revision,
  });
  const changed = await repo.getDashboardData();
  assert.notEqual(changed.season.endsAt, next.season.endsAt);
});

test("concurrent readers deduplicate rebuilds and a racing write cannot publish old results", async (context) => {
  const { db, sqlite } = createDatabase(context);
  let builds = 0;
  let raced = false;
  const observed = {
    ...db,
    prepare: (sql: string) => {
      if (sql.includes("FROM players ORDER BY name")) builds++;
      if (sql.startsWith("INSERT INTO dashboard_snapshot") && !raced) {
        raced = true;
        sqlite
          .prepare("UPDATE players SET name = 'Concurrent rename' WHERE id = 1")
          .run();
      }
      return db.prepare(sql);
    },
  };
  const repo = createRepository(observed, () => start);
  const values = await Promise.all(
    Array.from({ length: 8 }, () => repo.getDashboardData()),
  );
  assert.equal(builds, 2);
  for (const value of values)
    assert.equal(
      value.leaderboard.find((p) => p.id === 1)?.name,
      "Concurrent rename",
    );
  const row = sqlite
    .prepare(
      "SELECT data_revision AS cached, revision AS current FROM dashboard_snapshot CROSS JOIN dashboard_revision",
    )
    .get();
  assert.equal(row?.cached, row?.current);
});

test("rollover during a rebuild, corrupt payloads, and schema changes rebuild safely", async (context) => {
  const { db, sqlite } = createDatabase(context);
  let now = Date.parse("2026-12-31T23:59:59-08:00");
  let crossed = false;
  const observed = {
    ...db,
    prepare: (sql: string) => {
      if (sql.includes("FROM players ORDER BY name") && !crossed) {
        crossed = true;
        now += 1000;
      }
      return db.prepare(sql);
    },
  };
  const repo = createRepository(observed, () => now);
  assert.equal((await repo.getDashboardData()).season.id, 2);
  for (const statement of [
    "UPDATE dashboard_snapshot SET payload = 'broken'",
    "UPDATE dashboard_snapshot SET schema_version = 0",
  ]) {
    sqlite.exec(statement);
    let timing: DashboardTimings = {};
    assert.equal(
      (await repo.getDashboardData((value) => (timing = value))).season.id,
      2,
    );
    assert.equal(timing.cache_hit, 0);
  }
});

test("database bindings remain isolated and failed rebuilds can retry", async (context) => {
  const a = createDatabase(context);
  const b = createDatabase(context);
  b.sqlite.exec("UPDATE players SET name = 'Other database' WHERE id = 1");
  const [first, second] = await Promise.all([
    createRepository(a.db, () => start).getDashboardData(),
    createRepository(b.db, () => start).getDashboardData(),
  ]);
  assert.notEqual(
    first.leaderboard.find((p) => p.id === 1)?.name,
    second.leaderboard.find((p) => p.id === 1)?.name,
  );
  let fail = true;
  const observed = {
    ...a.db,
    prepare: (sql: string) => {
      if (sql.includes("FROM players ORDER BY name") && fail)
        throw new Error("Database unavailable");
      return a.db.prepare(sql);
    },
  };
  a.sqlite.exec("DELETE FROM dashboard_snapshot");
  const repo = createRepository(observed, () => start);
  await assert.rejects(repo.getDashboardData(), /Database unavailable/);
  fail = false;
  assert.deepEqual(await repo.getDashboardData(), first);
});

test("continuous mutations fail closed after bounded retries instead of returning stale standings", async (context) => {
  const { db, sqlite } = createDatabase(context);
  let attempts = 0;
  const observed = {
    ...db,
    prepare: (sql: string) => {
      if (sql.startsWith("INSERT INTO dashboard_snapshot")) {
        attempts++;
        sqlite.prepare("UPDATE players SET name = name WHERE id = 1").run();
      }
      return db.prepare(sql);
    },
  };
  await assert.rejects(
    createRepository(observed, () => start).getDashboardData(),
    /changed during calculation/,
  );
  assert.equal(attempts, 3);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS n FROM dashboard_snapshot").get()?.n,
    0,
  );
});
