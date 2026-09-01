import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRatings,
  createFairMatch,
  type EloGame,
  type EloPlayer,
} from "../lib/elo.ts";

const players: EloPlayer[] = ["C", "Y", "S", "R", "N", "J"].map(
  (code, index) => ({
    id: index + 1,
    code,
    name: code,
    archivedAt: null,
  }),
);

const game = (
  id: number,
  scoreA: number,
  scoreB: number,
  playedAt = `2026-01-01T00:0${id}:00.000Z`,
): EloGame => ({
  id,
  teamAPlayer1Id: 1,
  teamAPlayer2Id: 2,
  scoreA,
  teamBPlayer1Id: 3,
  teamBPlayer2Id: 4,
  scoreB,
  playedAt,
});

test("uses wins and losses without point differential", () => {
  const close = calculateRatings(players, [game(1, 1000, 999)]);
  const blowout = calculateRatings(players, [game(1, 2000, -500)]);
  assert.deepEqual(
    close.map(({ rating }) => rating),
    blowout.map(({ rating }) => rating),
  );
  assert.equal(close[0].rating, 1016);
  assert.equal(close[2].rating, 984);
});

test("uses half K when both scores are under 1000, including negatives", () => {
  const result = calculateRatings(players, [game(1, -10, -20)]);
  assert.equal(result[0].rating, 1008);
  assert.equal(result[2].rating, 992);
});

test("processes by played-at timestamp and then record id", () => {
  const games = [
    game(2, 1000, 0, "2026-01-02T00:00:00.000Z"),
    game(1, 0, 1000, "2026-01-01T00:00:00.000Z"),
  ];
  assert.deepEqual(
    calculateRatings(players, games).map(({ rating }) => rating),
    calculateRatings(players, games.slice().reverse()).map(
      ({ rating }) => rating,
    ),
  );
});

test("matches the known seeded leaderboard ratings", () => {
  const rows = [
    [1, 1, 2, 595, 5, 3, 1005],
    [2, 5, 1, 1035, 4, 3, 365],
    [3, 5, 2, 1105, 3, 1, -205],
    [4, 3, 2, 1020, 1, 5, 180],
    [5, 5, 3, 1020, 2, 1, 480],
    [6, 5, 2, 1175, 1, 3, 925],
    [7, 2, 3, 1030, 1, 5, 670],
    [8, 5, 1, 1100, 3, 6, -600],
    [9, 5, 6, 340, 3, 1, 555],
  ];
  const games = rows.map(([id, a1, a2, scoreA, b1, b2, scoreB], index) => ({
    id,
    teamAPlayer1Id: a1,
    teamAPlayer2Id: a2,
    scoreA,
    teamBPlayer1Id: b1,
    teamBPlayer2Id: b2,
    scoreB,
    playedAt: new Date(Date.UTC(2026, 7, 30, 12, index)).toISOString(),
  }));
  const ratings = Object.fromEntries(
    calculateRatings(players, games).map((entry) => [entry.code, entry.rating]),
  );
  assert.ok(Math.abs(ratings.N - 1052.367524156831) < 1e-9);
  assert.ok(Math.abs(ratings.C - 949.3052280071869) < 1e-9);
});

test("builds a match only from the selected players", () => {
  const ratings = calculateRatings(players, [game(1, 1000, 0)]);
  const match = createFairMatch(
    ratings.filter(({ id }) => [1, 2, 3, 5].includes(id)),
  );
  assert.ok(match);
  assert.deepEqual(
    [...match.teamA, ...match.teamB].map(({ id }) => id).sort((a, b) => a - b),
    [1, 2, 3, 5],
  );
});
