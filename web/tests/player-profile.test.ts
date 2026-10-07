import assert from "node:assert/strict";
import test from "node:test";
import { calculateRatings, type EloGame, type EloPlayer } from "../lib/elo.ts";
import { calculatePlayerProfile } from "../lib/player-profile.ts";
import { formatPercentage, formatRatio } from "../lib/format.ts";

const players: EloPlayer[] = [
  "Alex",
  "Zoe",
  "Bea",
  "Cam",
  "Dee",
  "Eli",
  "Fin",
  "Gia",
].map((name, index) => ({
  id: index + 1,
  code: name[0],
  name,
  archivedAt: index === 1 ? "2026-01-01" : null,
}));

const game = (
  id: number,
  teamA: [number, number] = [1, 2],
  teamB: [number, number] = [3, 4],
  won = true,
): EloGame => ({
  id,
  teamAPlayer1Id: teamA[0],
  teamAPlayer2Id: teamA[1],
  teamBPlayer1Id: teamB[0],
  teamBPlayer2Id: teamB[1],
  scoreA: won ? 1000 : 0,
  scoreB: won ? 0 : 1000,
  playedAt: new Date(Date.UTC(2026, 0, 1, 0, id)).toISOString(),
});

test("profiles show separate call ratios and wins on either team", () => {
  const games = [
    game(1),
    game(2, [3, 4], [2, 1], false),
    game(3, [2, 1], [3, 4], false),
  ];
  games[0].callStats = [
    {
      playerId: 1,
      tichus: 3,
      successfulTichus: 2,
      grandTichus: 2,
      successfulGrandTichus: 1,
    },
  ];
  const profile = calculatePlayerProfile(players, games, 1)!;
  assert.equal(profile.wins, 2);
  assert.equal(profile.losses, 1);
  assert.equal(
    formatPercentage(profile.wins, profile.player.gamesPlayed),
    "66.7%",
  );
  assert.equal(
    formatRatio(profile.player.successfulTichus, profile.player.tichus),
    "2/3",
  );
  assert.equal(
    formatPercentage(profile.player.successfulTichus, profile.player.tichus),
    "66.7%",
  );
  assert.equal(
    formatRatio(
      profile.player.successfulGrandTichus,
      profile.player.grandTichus,
    ),
    "1/2",
  );
  assert.equal(
    formatPercentage(
      profile.player.successfulGrandTichus,
      profile.player.grandTichus,
    ),
    "50.0%",
  );
  assert.deepEqual(
    profile.history.map(({ result }) => result),
    [null, "Win", "Win", "Loss"],
  );
});

test("empty profiles have a baseline and no invented rates or partner winners", () => {
  const profile = calculatePlayerProfile(players, [], 1)!;
  assert.equal(profile.player.rating, 1000);
  assert.equal(profile.history.length, 1);
  assert.deepEqual(profile.history[0], {
    gameNumber: 0,
    gameId: null,
    playedAt: null,
    rating: 1000,
    delta: 0,
    result: null,
  });
  assert.equal(formatPercentage(0, 0), "N/A");
  assert.equal(formatRatio(0, 0), "N/A");
  assert.equal(formatPercentage(0, 2), "0.0%");
  assert.deepEqual(
    [profile.bestFriends, profile.carryingMe, profile.draggingMeDown],
    [[], [], []],
  );
  assert.equal(calculatePlayerProfile(players, [], 99), null);
  const missingCalls = calculatePlayerProfile(players, [game(1)], 1)!;
  assert.equal(
    formatPercentage(
      missingCalls.player.successfulTichus,
      missingCalls.player.tichus,
    ),
    "N/A",
  );
});

test("each team position identifies only its teammate and the right outcome", () => {
  const games = [game(1)];
  for (const [id, teammate, wins, losses] of [
    [1, 2, 1, 0],
    [2, 1, 1, 0],
    [3, 4, 0, 1],
    [4, 3, 0, 1],
  ]) {
    const profile = calculatePlayerProfile(players, games, id)!;
    assert.equal(profile.wins, wins);
    assert.equal(profile.losses, losses);
    assert.deepEqual(
      profile.bestFriends.map(({ id }) => id),
      [teammate],
    );
    assert.equal(profile.carryingMe.length, wins);
    assert.equal(profile.draggingMeDown.length, losses);
  }
});

test("all tied partners are alphabetical, including archived partners", () => {
  const profile = calculatePlayerProfile(
    players,
    [
      game(1),
      game(2, [1, 3], [2, 4]),
      game(3, [1, 2], [3, 4], false),
      game(4, [1, 3], [2, 4], false),
    ],
    1,
  )!;
  for (const key of ["bestFriends", "carryingMe", "draggingMeDown"] as const) {
    assert.deepEqual(
      profile[key].map(({ name }) => name),
      ["Bea", "Zoe"],
    );
  }
  assert.equal(profile.bestFriends[0].games, 2);
  assert.equal(profile.carryingMe[0].wins, 1);
  assert.equal(profile.draggingMeDown[0].losses, 1);
});

test("partner rankings use counts rather than win or loss percentages", () => {
  const games = [
    game(1),
    game(2),
    game(3, [1, 2], [3, 4], false),
    game(4, [1, 2], [3, 4], false),
    game(5, [1, 3], [2, 4]),
    game(6, [1, 4], [2, 3], false),
  ];
  const profile = calculatePlayerProfile(players, games, 1)!;
  assert.deepEqual(
    profile.bestFriends.map(({ id }) => id),
    [2],
  );
  assert.deepEqual(
    profile.carryingMe.map(({ id }) => id),
    [2],
  );
  assert.deepEqual(
    profile.draggingMeDown.map(({ id }) => id),
    [2],
  );
  assert.equal(profile.bestFriends[0].games, 4);
  assert.equal(profile.carryingMe[0].wins, 2);
  assert.equal(profile.draggingMeDown[0].losses, 2);
});

test("history includes opponent activity, timestamp/id ordering, and half K", () => {
  const games = [
    game(1, [3, 4], [5, 6]),
    game(2),
    game(3, [3, 4], [1, 2], false),
    game(4, [3, 4], [7, 8]),
    game(5),
  ];
  games[2].playedAt = games[1].playedAt;
  games[4].scoreA = -10;
  games[4].scoreB = -20;
  const profile = calculatePlayerProfile(players, [...games].reverse(), 1)!;
  assert.deepEqual(
    profile.history.map(({ gameId }) => gameId),
    [null, 2, 3, 5],
  );
  assert.deepEqual(
    profile.history.map(({ gameNumber }) => gameNumber),
    [0, 1, 2, 3],
  );
  assert.ok(
    profile.history[1].rating > 1016,
    "Opponents' earlier win must affect expected score",
  );
  for (const point of profile.history.slice(1)) {
    const prefix = games.slice(
      0,
      games.findIndex(({ id }) => id === point.gameId) + 1,
    );
    assert.equal(
      point.rating,
      calculateRatings(players, prefix).find(({ id }) => id === 1)!.rating,
    );
    assert.ok(
      Math.abs(
        point.rating -
          profile.history[point.gameNumber - 1].rating -
          point.delta,
      ) < 1e-9,
    );
  }
  const fullK = calculatePlayerProfile(
    players,
    games.map((g) => (g.id === 5 ? { ...g, scoreA: 1000, scoreB: 0 } : g)),
    1,
  )!;
  assert.equal(profile.history.at(-1)!.delta * 2, fullK.history.at(-1)!.delta);
});

test("history and partner stats recompute correctly after edits or deletion", () => {
  const original = [game(1), game(2, [1, 3], [2, 4])];
  const edited = [
    original[0],
    {
      ...original[1],
      scoreA: 0,
      scoreB: 1000,
      playedAt: "2025-12-01T00:00:00.000Z",
    },
  ];
  for (const games of [original, edited, original.slice(0, 1)]) {
    const before = structuredClone({ players, games });
    const ratings = calculateRatings(players, games);
    for (const player of players) {
      const profile = calculatePlayerProfile(players, games, player.id)!;
      assert.equal(
        profile.history.at(-1)!.rating,
        ratings.find(({ id }) => id === player.id)!.rating,
      );
    }
    assert.deepEqual({ players, games }, before);
  }
  assert.deepEqual(
    calculatePlayerProfile(players, edited, 1)!.draggingMeDown.map(
      ({ id }) => id,
    ),
    [3],
  );
  assert.deepEqual(
    calculatePlayerProfile(players, original.slice(0, 1), 1)!.bestFriends.map(
      ({ id }) => id,
    ),
    [2],
  );
});
