import assert from "node:assert/strict";
import test from "node:test";
import {
  currentSeasonId,
  getCurrentSeason,
  getSeason,
  getSeasons,
  isInSeason,
  parseSeasonId,
} from "../lib/seasons.ts";
import { calculateRatings } from "../lib/elo.ts";
import { createRepository } from "../lib/repository.ts";
import { createDatabase } from "./helpers/database.ts";

const january = Date.parse("2027-01-01T08:00:00.000Z");
const july = Date.parse("2027-07-01T07:00:00.000Z");
const game = (playedAt: string) => ({
  teamAPlayer1Id: 1,
  teamAPlayer2Id: 2,
  teamBPlayer1Id: 3,
  teamBPlayer2Id: 4,
  scoreA: 1000,
  scoreB: 100,
  playedAt,
  callStats: [1, 2, 3, 4].map((playerId) => ({
    playerId,
    grandTichus: 2,
    successfulGrandTichus: 1,
    tichus: 3,
    successfulTichus: 2,
  })),
});

test("season boundaries use Pacific midnight with winter and summer offsets", () => {
  for (const [instant, id] of [
    [january, 2],
    [july, 3],
    [Date.parse("2028-01-01T08:00:00Z"), 4],
  ] as const) {
    assert.equal(currentSeasonId(instant - 1), id - 1);
    assert.equal(currentSeasonId(instant), id);
    assert.equal(
      getCurrentSeason(instant).startsAt,
      new Date(instant).toISOString(),
    );
    assert.equal(
      getSeason(id - 1, instant).endsAt,
      new Date(instant).toISOString(),
    );
  }
  assert.equal(getSeason(1, january).startsAt, null);
  assert.deepEqual(
    getSeasons(july).map(({ id }) => id),
    [3, 2, 1],
  );
  assert.equal(
    isInSeason("2020-01-01T00:00:00.000Z", getSeason(1, january)),
    true,
  );
  assert.equal(
    isInSeason(new Date(january).toISOString(), getSeason(1, january)),
    false,
  );
  assert.equal(
    isInSeason(new Date(january).toISOString(), getSeason(2, january)),
    true,
  );
  assert.equal(parseSeasonId(null, january), null);
  for (const id of [
    "",
    "0",
    "-1",
    "01",
    "1e0",
    "1.5",
    " 1",
    "3",
    "9007199254740992",
  ])
    assert.throws(() => parseSeasonId(id, january), /season/i);
});

test("Season 1 preserves all existing stats, rollover resets everyone without changing records", async (context) => {
  const { db, sqlite } = createDatabase(context);
  let now = january - 1;
  const repository = createRepository(db, () => now);
  await repository.createGame(game("2026-12-31T23:59:59-08:00"), "test");
  const original = await repository.getAppData();
  const expected = calculateRatings(original.players, original.games).sort(
    (a, b) => a.id - b.id,
  );
  assert.deepEqual(
    [...original.leaderboard].sort((a, b) => a.id - b.id),
    expected,
  );
  const records = sqlite.prepare("SELECT * FROM games ORDER BY id").all();
  now = january;
  const dashboard = await repository.getDashboardData();
  assert.equal(dashboard.season.id, 2);
  assert.equal(dashboard.history.games.length, 0);
  for (const entry of dashboard.leaderboard) {
    assert.equal(entry.rating, 1000);
    for (const field of [
      "gamesPlayed",
      "grandTichus",
      "successfulGrandTichus",
      "tichus",
      "successfulTichus",
    ] as const)
      assert.equal(entry[field], 0);
    const profile = (await repository.getPlayerProfile(entry.id))!;
    assert.equal(profile.wins, 0);
    assert.equal(profile.losses, 0);
    assert.equal(profile.history.length, 1);
    for (const field of [
      "bestFriends",
      "carryingMe",
      "draggingMeDown",
      "imHisBitch",
      "nemesis",
      "curbstomped",
    ] as const)
      assert.deepEqual(profile[field], []);
  }
  assert.deepEqual(
    sqlite.prepare("SELECT * FROM games ORDER BY id").all(),
    records,
  );
  assert.deepEqual(
    (await repository.getSeasonStandings(1)).leaderboard,
    original.leaderboard.filter(({ gamesPlayed }) => gamesPlayed > 0),
  );
  assert.deepEqual((await repository.getAppData()).games, original.games);
});

test("backdated corrections, date moves and deletion remain isolated to their seasons", async (context) => {
  const { db, sqlite } = createDatabase(context);
  sqlite.exec("DELETE FROM games");
  const repository = createRepository(db, () => january);
  const pastId = await repository.createGame(
    game("2026-12-31T23:59:59-08:00"),
    "test",
  );
  const newId = await repository.createGame(
    game("2027-01-01T00:00:00-08:00"),
    "test",
  );
  assert.equal((await repository.getPlayerProfile(1))?.player.rating, 1016);
  const current = await repository.getPlayerRatings();
  const history = await repository.getPlayerProfile(1, 1);
  assert.equal(history?.player.rating, 1016);
  await repository.updateGame(pastId, {
    ...game("2026-12-31T23:59:59-08:00"),
    scoreA: 0,
    scoreB: 1000,
  });
  assert.deepEqual(await repository.getPlayerRatings(), current);
  assert.equal((await repository.getPlayerProfile(1, 1))?.player.rating, 984);
  await repository.updateGame(pastId, game("2027-01-01T00:01:00-08:00"));
  assert.equal(
    (await repository.getPlayerProfile(1, 1))?.player.gamesPlayed,
    0,
  );
  assert.equal((await repository.getPlayerProfile(1))?.player.gamesPlayed, 2);
  await repository.deleteGame(pastId);
  assert.deepEqual(await repository.getPlayerRatings(), current);
  await repository.deleteGame(newId);
  assert.equal((await repository.getPlayerProfile(1))?.player.rating, 1000);
});

test("historical rankings retain archived participants and exclude nonparticipants", async (context) => {
  const { db, sqlite } = createDatabase(context);
  sqlite.exec("DELETE FROM games");
  const repository = createRepository(db, () => july);
  await repository.createGame(game("2027-01-02T08:00:00Z"), "test");
  const newPlayer = await repository.createPlayer({
    name: "New player",
    code: "NEW",
  });
  await repository.updatePlayer(1, { archived: true });
  const past = await repository.getSeasonStandings(2);
  assert.equal(past.leaderboard.length, 4);
  assert.ok(past.leaderboard.some(({ id }) => id === 1));
  assert.ok(!past.leaderboard.some(({ id }) => id === newPlayer));
  assert.equal((await repository.getPlayerProfile(newPlayer, 2))?.rank, null);
  assert.ok((await repository.getPlayerProfile(1, 2))?.rank);
  assert.ok(
    !(await repository.getSeasonStandings()).leaderboard.some(
      ({ id }) => id === 1,
    ),
  );
  assert.equal((await repository.getSeasonStandings(1)).leaderboard.length, 0);
});

test("season and player filters apply before pagination with stable ties and no leakage", async (context) => {
  const { db, sqlite } = createDatabase(context);
  sqlite.exec("DELETE FROM games");
  const repository = createRepository(db, () => july);
  for (let index = 0; index < 23; index += 1) {
    await repository.createGame(game("2026-12-31T23:59:59-08:00"), "test");
    await repository.createGame(game("2027-01-01T00:00:00-08:00"), "test");
  }
  await repository.createGame(game("2027-07-01T00:00:00-07:00"), "test");
  const first = await repository.getGamePage(null, 1, 2);
  const second = await repository.getGamePage(first.nextCursor, 1, 2);
  assert.equal(first.games.length, 20);
  assert.equal(second.games.length, 3);
  assert.equal(second.nextCursor, null);
  const all = [...first.games, ...second.games];
  assert.equal(new Set(all.map(({ id }) => id)).size, 23);
  assert.ok(
    all.every(({ playedAt }) => playedAt === "2027-01-01T08:00:00.000Z"),
  );
  assert.equal((await repository.getGamePage(null, 999, 2)).games.length, 0);
  assert.equal((await repository.getGamePage(null, null, 3)).games.length, 1);
  assert.ok(
    (await repository.getGamePage()).games.some(
      ({ playedAt }) => playedAt === "2027-07-01T07:00:00.000Z",
    ),
  );
  await assert.rejects(repository.getGamePage(null, null, 4), /season/);
  await assert.rejects(repository.getPlayerProfile(1, 4), /season/);
});

test("each aggregate captures its season once even if the clock crosses midnight during reads", async (context) => {
  const { db } = createDatabase(context);
  let calls = 0;
  const repository = createRepository(db, () =>
    calls++ === 0 ? january - 1 : january,
  );
  const dashboard = await repository.getDashboardData();
  assert.equal(calls, 1);
  assert.equal(dashboard.season.id, 1);
  assert.ok(dashboard.leaderboard.some(({ gamesPlayed }) => gamesPlayed > 0));
  assert.ok(dashboard.history.games.length > 0);
});
