import assert from "node:assert/strict";
import test from "node:test";
import { createDatabase } from "./helpers/database.ts";
import { createRepository } from "../lib/repository.ts";
import { createSeasonSettingsHandler } from "../lib/season-settings-api.ts";
import { OWNER_EMAIL } from "../lib/admin-access.ts";
import {
  getCurrentSeason,
  getSeason,
  SEASON_CADENCES,
  SeasonSettingsConflict,
} from "../lib/seasons.ts";
import { calculateRatings, createFairMatch } from "../lib/elo.ts";

const now = Date.parse("2027-05-15T12:00:00Z");
const origin = "https://tichu.example";
const owner = { userId: "owner", email: OWNER_EMAIL };
const game = (playedAt: string, win = true) => ({
  teamAPlayer1Id: 1,
  teamAPlayer2Id: 2,
  teamBPlayer1Id: 3,
  teamBPlayer2Id: 4,
  scoreA: win ? 1000 : 0,
  scoreB: win ? 0 : 1000,
  playedAt,
  callStats: [1, 2, 3, 4].map((playerId) => ({
    playerId,
    tichus: 2,
    successfulTichus: 1,
    grandTichus: 1,
    successfulGrandTichus: 1,
  })),
});

test("every cadence rolls over exactly at Pacific midnight, including DST and leap years", () => {
  const future = Date.parse("2030-01-01T08:00:00Z");
  for (const { months } of SEASON_CADENCES) {
    const end = getCurrentSeason(future, months).id;
    for (let id = 2; id <= end; id++) {
      const season = getSeason(id, future, months);
      const boundary = Date.parse(season.startsAt!);
      assert.equal(getCurrentSeason(boundary - 1, months).id, id - 1);
      assert.equal(getCurrentSeason(boundary, months).id, id);
      assert.equal(getSeason(id - 1, future, months).endsAt, season.startsAt);
    }
    assert.equal(getSeason(1, future, months).startsAt, null);
  }
  assert.equal(
    getCurrentSeason(Date.parse("2028-02-29T12:00:00Z"), 1).endsAt,
    "2028-03-01T08:00:00.000Z",
  );
  assert.equal(
    getCurrentSeason(Date.parse("2028-03-31T12:00:00Z"), 1).endsAt,
    "2028-04-01T07:00:00.000Z",
  );
});

test("changing cadence replays current and historical standings, profiles, calls and matchmaking without changing records", async (context) => {
  const { db, sqlite } = createDatabase(context);
  sqlite.exec("DELETE FROM games");
  const repository = createRepository(db, () => now);
  for (const [date, win] of [
    ["2026-06-01T12:00:00Z", true],
    ["2026-12-01T12:00:00Z", false],
    ["2027-01-01T08:00:00Z", true],
    ["2027-04-01T07:00:00Z", false],
    ["2027-05-01T07:00:00Z", true],
  ] as const)
    await repository.createGame(game(date, win), "test");
  const original = await repository.getAppData();
  const rawGames = sqlite.prepare("SELECT * FROM games").all();
  const rawStats = sqlite.prepare("SELECT * FROM game_player_stats").all();
  const rawPlayers = sqlite.prepare("SELECT * FROM players").all();
  for (const cadence of [1, 3, 12, 6] as const) {
    await repository.updateSeasonSettings({
      ...(await repository.getSeasonSettings()),
      cadenceMonths: cadence,
    });
    // A new repository must see the persisted setting, too.
    const fresh = createRepository(db, () => now);
    const data = await fresh.getAppData();
    const expectedCurrentCount = { 1: 1, 3: 2, 6: 3, 12: 5 }[cadence];
    assert.equal(
      data.leaderboard.find(({ id }) => id === 1)?.gamesPlayed,
      expectedCurrentCount,
    );
    assert.deepEqual(data.fairMatch, createFairMatch(data.leaderboard));
    const summary = await fresh.getSeasonData();
    const seen: number[] = [];
    for (const season of summary.seasons) {
      const history = await fresh.getGamePage(null, null, season.id);
      seen.push(...history.games.map(({ id }) => id));
      const standings = await fresh.getSeasonStandings(season.id);
      const expected = calculateRatings(data.players, history.games)
        .filter((player) =>
          season.status === "current"
            ? !player.archivedAt
            : player.gamesPlayed > 0,
        )
        .sort(
          (a, b) =>
            b.rating - a.rating || a.name.localeCompare(b.name) || a.id - b.id,
        );
      assert.deepEqual(standings.leaderboard, expected);
      const profile = (await fresh.getPlayerProfile(1, season.id))!;
      assert.equal(
        profile.player.rating,
        expected.find(({ id }) => id === 1)?.rating ?? 1000,
      );
      assert.equal(profile.player.tichus, history.games.length * 2);
      assert.equal(profile.player.successfulGrandTichus, history.games.length);
      assert.equal(profile.wins + profile.losses, history.games.length);
    }
    assert.deepEqual(seen.sort(), original.games.map(({ id }) => id).sort());
    assert.deepEqual(
      (await fresh.getDashboardData()).leaderboard,
      data.leaderboard,
    );
    assert.deepEqual(sqlite.prepare("SELECT * FROM games").all(), rawGames);
    assert.deepEqual(
      sqlite.prepare("SELECT * FROM game_player_stats").all(),
      rawStats,
    );
    assert.deepEqual(sqlite.prepare("SELECT * FROM players").all(), rawPlayers);
  }
  assert.deepEqual(
    (await repository.getAppData()).leaderboard,
    original.leaderboard,
  );
});

test("invalid settings and stale concurrent saves preserve the last committed cadence", async (context) => {
  const { db } = createDatabase(context);
  const repository = createRepository(db, () => now);
  for (const cadenceMonths of [0, -1, 2, 1.5, "3", null, 100000]) {
    await assert.rejects(
      repository.updateSeasonSettings({ cadenceMonths, revision: 0 }),
      /cadence/,
    );
  }
  for (const body of [
    { cadenceMonths: 3 },
    { cadenceMonths: 3, revision: -1 },
    { cadenceMonths: 3, revision: 0, extra: 1 },
  ])
    await assert.rejects(repository.updateSeasonSettings(body), /settings/);
  const results = await Promise.allSettled([
    repository.updateSeasonSettings({ cadenceMonths: 1, revision: 0 }),
    repository.updateSeasonSettings({ cadenceMonths: 12, revision: 0 }),
  ]);
  assert.equal(
    results.filter(({ status }) => status === "fulfilled").length,
    1,
  );
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(
    rejected?.status === "rejected" &&
      rejected.reason instanceof SeasonSettingsConflict,
  );
  assert.deepEqual(await repository.getSeasonSettings(), {
    cadenceMonths: 1,
    revision: 1,
  });
});

test("an in-flight dashboard retries with a consistent cadence after an owner changes settings", async (context) => {
  const { db, sqlite } = createDatabase(context);
  let changed = false;
  const wrapped = {
    ...db,
    prepare: (sql: string) => {
      const statement = db.prepare(sql);
      if (sql.includes("FROM dashboard_revision r") && !changed) {
        const first = statement.first.bind(statement);
        statement.first = (async () => {
          const settings = await first();
          changed = true;
          sqlite.exec(
            "UPDATE season_settings SET cadence_months = 1, revision = 1",
          );
          return settings;
        }) as typeof statement.first;
      }
      return statement;
    },
  };
  const data = await createRepository(wrapped, () => now).getDashboardData();
  assert.deepEqual(data.season, getCurrentSeason(now, 1));
  assert.equal(data.seasons.length, 11);
  assert.equal(
    (await createRepository(db, () => now).getDashboardData()).season.id,
    11,
  );
});

test("settings writes require the owner session and same origin, and reject bearer credentials", async (context) => {
  const { db } = createDatabase(context);
  const request = (
    headers: Record<string, string> = {},
    body: unknown = { cadenceMonths: 3, revision: 0 },
  ) =>
    new Request(`${origin}/api/seasons/settings`, {
      method: "PATCH",
      headers: { origin, "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  for (const [user, status] of [
    [null, 401],
    [{ userId: "admin", email: "admin@example.com" }, 403],
    [owner, 200],
  ] as const) {
    const handle = createSeasonSettingsHandler(db, async () => user);
    assert.equal((await handle(request())).status, status);
  }
  const handle = createSeasonSettingsHandler(db, async () => owner);
  for (const headers of [
    { origin: "https://attacker.example" },
    { origin: "" },
    { authorization: "Bearer test" },
  ] as Record<string, string>[])
    assert.ok([401, 403].includes((await handle(request(headers))).status));
  assert.equal((await handle(request())).status, 409);
  assert.equal(
    (await handle(request({}, { cadenceMonths: 2, revision: 1 }))).status,
    400,
  );
  assert.equal(
    (await handle(request({ "content-type": "text/plain" }))).status,
    415,
  );
  assert.deepEqual(await createRepository(db).getSeasonSettings(), {
    cadenceMonths: 3,
    revision: 1,
  });
});
