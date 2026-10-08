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
  const games = [game(1), game(2), game(3)];
  for (const [id, teammate, wins, losses] of [
    [1, 2, 3, 0],
    [2, 1, 3, 0],
    [3, 4, 0, 3],
    [4, 3, 0, 3],
  ]) {
    const profile = calculatePlayerProfile(players, games, id)!;
    assert.equal(profile.wins, wins);
    assert.equal(profile.losses, losses);
    assert.deepEqual(
      profile.bestFriends.map(({ id }) => id),
      [teammate],
    );
    assert.equal(profile.carryingMe.length, wins ? 1 : 0);
    assert.equal(profile.draggingMeDown.length, losses ? 1 : 0);
  }
});

const partnershipGames = (
  records: Array<{ partnerId: number; games: number; wins: number }>,
) => {
  let id = 0;
  return records.flatMap((record) =>
    Array.from({ length: record.games }, (_, index) =>
      game(++id, [1, record.partnerId], [5, 6], index < record.wins),
    ),
  );
};

test("one or two games cannot earn outcome highlights; three games qualify", () => {
  for (const won of [true, false]) {
    for (const count of [1, 2, 3]) {
      const profile = calculatePlayerProfile(
        players,
        partnershipGames([
          { partnerId: 2, games: count, wins: won ? count : 0 },
        ]),
        1,
      )!;
      assert.equal(profile.hasEligiblePartners, count === 3);
      assert.equal(profile.carryingMe.length, count === 3 && won ? 1 : 0);
      assert.equal(profile.draggingMeDown.length, count === 3 && !won ? 1 : 0);
      assert.equal(profile.bestFriends[0].games, count);
    }
  }
});

test("all equally supported partners tie alphabetically, including archived partners", () => {
  const profile = calculatePlayerProfile(
    players,
    partnershipGames([
      { partnerId: 2, games: 4, wins: 2 },
      { partnerId: 3, games: 4, wins: 2 },
    ]),
    1,
  )!;
  for (const key of ["bestFriends", "carryingMe", "draggingMeDown"] as const) {
    assert.deepEqual(
      profile[key].map(({ name }) => name),
      ["Bea", "Zoe"],
    );
  }
});

test("established records outrank one-game and three-game perfect records for both outcomes", () => {
  for (const outcome of ["wins", "losses"] as const) {
    const key = outcome === "wins" ? "carryingMe" : "draggingMeDown";
    for (const smallCount of [1, 3]) {
      const profile = calculatePlayerProfile(
        players,
        partnershipGames([
          {
            partnerId: 2,
            games: smallCount,
            wins: outcome === "wins" ? smallCount : 0,
          },
          { partnerId: 3, games: 10, wins: outcome === "wins" ? 8 : 2 },
        ]),
        1,
      )!;
      assert.deepEqual(
        profile[key].map(({ id }) => id),
        [3],
      );
      // Displayed figures remain actual results, not the ranking score.
      assert.equal(
        formatPercentage(profile[key][0][outcome], profile[key][0].games),
        "80.0%",
      );
      assert.equal(
        formatRatio(profile[key][0][outcome], profile[key][0].games),
        "8/10",
      );
    }
  }
});

test("outcome rate still matters and cannot be replaced by games or outcome counts", () => {
  for (const outcome of ["wins", "losses"] as const) {
    const key = outcome === "wins" ? "carryingMe" : "draggingMeDown";
    const profile = calculatePlayerProfile(
      players,
      partnershipGames([
        { partnerId: 2, games: 10, wins: outcome === "wins" ? 8 : 2 },
        { partnerId: 3, games: 30, wins: outcome === "wins" ? 15 : 15 },
      ]),
      1,
    )!;
    assert.deepEqual(
      profile[key].map(({ id }) => id),
      [2],
    );
    assert.deepEqual(
      profile.bestFriends.map(({ id }) => id),
      [3],
    );
  }
});

test("equal outcome rates favor the larger sample", () => {
  const profile = calculatePlayerProfile(
    players,
    partnershipGames([
      { partnerId: 2, games: 4, wins: 2 },
      { partnerId: 3, games: 10, wins: 5 },
    ]),
    1,
  )!;
  for (const key of ["carryingMe", "draggingMeDown"] as const) {
    assert.deepEqual(
      profile[key].map(({ id }) => id),
      [3],
    );
  }
});

test("ineligible wins or losses do not award a zero-outcome eligible partner", () => {
  for (const wins of [0, 3]) {
    const profile = calculatePlayerProfile(
      players,
      partnershipGames([
        { partnerId: 2, games: 3, wins },
        { partnerId: 3, games: 1, wins: wins ? 0 : 1 },
      ]),
      1,
    )!;
    assert.equal(profile.hasEligiblePartners, true);
    assert.deepEqual(profile[wins ? "draggingMeDown" : "carryingMe"], []);
  }
});

test("rates are ranked before percentage rounding", () => {
  const games = Array.from({ length: 2001 }, (_, index) =>
    index < 1000
      ? game(index + 1, [1, 2], [3, 4], index < 500)
      : game(index + 1, [1, 3], [2, 4], index < 1500),
  );
  const profile = calculatePlayerProfile(players, games, 1)!;
  assert.equal(formatPercentage(500, 1000), formatPercentage(500, 1001));
  assert.deepEqual(
    profile.carryingMe.map(({ id }) => id),
    [2],
  );
  assert.deepEqual(
    profile.draggingMeDown.map(({ id }) => id),
    [3],
  );
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
  const original = partnershipGames([
    { partnerId: 2, games: 3, wins: 3 },
    { partnerId: 3, games: 3, wins: 3 },
  ]);
  const edited = original.map((entry) =>
    entry.id >= 4
      ? {
          ...entry,
          scoreA: 0,
          scoreB: 1000,
          playedAt: "2025-12-01T00:00:00.000Z",
        }
      : entry,
  );
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

test("partner Tichu ranking uses pooled regular-call rates only while together", () => {
  const games = [
    game(1),
    game(2, [2, 1]),
    game(3, [1, 3], [2, 4]),
    game(4, [2, 3], [4, 5]),
  ];
  const calls = (
    playerId: number,
    tichus: number,
    successfulTichus: number,
    grand = 0,
  ) => ({
    playerId,
    tichus,
    successfulTichus,
    grandTichus: 20,
    successfulGrandTichus: grand,
  });
  games[0].callStats = [calls(2, 1, 1, 20), calls(1, 10, 10)];
  games[1].callStats = [calls(2, 9, 4)];
  games[2].callStats = [calls(3, 3, 2), calls(2, 100, 100)];
  games[3].callStats = [calls(2, 100, 100)];
  games.push(game(5), game(6, [1, 3], [2, 4]), game(7, [1, 3], [2, 4]));
  const profile = calculatePlayerProfile(players, games, 1)!;
  assert.deepEqual(
    profile.imHisBitch.map(({ id }) => id),
    [3],
  );
  assert.equal(profile.imHisBitch[0].tichus, 3);
  assert.equal(profile.imHisBitch[0].successfulTichus, 2);
  assert.equal(profile.bestFriends.find(({ id }) => id === 2)!.tichus, 10);
  assert.equal(
    profile.bestFriends.find(({ id }) => id === 2)!.successfulTichus,
    5,
  );
});

test("partner Tichu ranking includes archived partners and alphabetical exact-rate ties", () => {
  const games = [game(1), game(2, [1, 3], [2, 4])];
  for (const [index, playerId, tichus, successfulTichus] of [
    [0, 2, 6, 4],
    [1, 3, 3, 2],
  ]) {
    games[index].callStats = [
      {
        playerId,
        tichus,
        successfulTichus,
        grandTichus: 0,
        successfulGrandTichus: 0,
      },
    ];
  }
  assert.deepEqual(
    calculatePlayerProfile(
      players,
      [
        ...games,
        game(3),
        game(4),
        game(5, [1, 3], [2, 4]),
        game(6, [1, 3], [2, 4]),
      ],
      1,
    )!.imHisBitch.map(({ name }) => name),
    ["Bea", "Zoe"],
  );
});

test("partner Tichu calls identify the teammate in all four team positions", () => {
  const played = game(1);
  played.callStats = players.slice(0, 4).map(({ id }) => ({
    playerId: id,
    tichus: id,
    successfulTichus: 1,
    grandTichus: 0,
    successfulGrandTichus: 0,
  }));
  for (const [id, teammate] of [
    [1, 2],
    [2, 1],
    [3, 4],
    [4, 3],
  ]) {
    const [partner] = calculatePlayerProfile(
      players,
      [played, game(2), game(3)],
      id,
    )!.imHisBitch;
    assert.equal(partner.id, teammate);
    assert.equal(partner.tichus, teammate);
  }
});

test("partner Tichu ranking excludes missing, grand-only, zero-success and small samples", () => {
  const games = [game(1), game(2), game(3)];
  games[0].callStats = [
    {
      playerId: 2,
      tichus: 0,
      successfulTichus: 0,
      grandTichus: 1,
      successfulGrandTichus: 1,
    },
  ];
  assert.deepEqual(calculatePlayerProfile(players, [], 1)!.imHisBitch, []);
  assert.deepEqual(calculatePlayerProfile(players, games, 1)!.imHisBitch, []);
  games[0].callStats[0].tichus = 2;
  assert.deepEqual(calculatePlayerProfile(players, games, 1)!.imHisBitch, []);
  games[0].callStats[0].successfulTichus = 1;
  for (const count of [1, 2])
    assert.deepEqual(
      calculatePlayerProfile(players, games.slice(0, count), 1)!.imHisBitch,
      [],
    );
  const [partner] = calculatePlayerProfile(players, games, 1)!.imHisBitch;
  assert.equal(
    formatPercentage(partner.successfulTichus, partner.tichus),
    "50.0%",
  );
  assert.equal(partner.tichus, 2);
});

test("partner Tichu ranking weights games rather than call counts and displays actual rates", () => {
  const games = partnershipGames([
    { partnerId: 2, games: 3, wins: 3 },
    { partnerId: 3, games: 10, wins: 10 },
  ]);
  games[0].callStats = [
    {
      playerId: 2,
      tichus: 100,
      successfulTichus: 100,
      grandTichus: 0,
      successfulGrandTichus: 0,
    },
  ];
  games[3].callStats = [
    {
      playerId: 3,
      tichus: 10,
      successfulTichus: 8,
      grandTichus: 0,
      successfulGrandTichus: 0,
    },
  ];
  const [partner] = calculatePlayerProfile(players, games, 1)!.imHisBitch;
  assert.equal(partner.id, 3);
  assert.equal(
    formatPercentage(partner.successfulTichus, partner.tichus),
    "80.0%",
  );
  games[3].callStats[0].successfulTichus = 1;
  assert.equal(calculatePlayerProfile(players, games, 1)!.imHisBitch[0].id, 2);
});
