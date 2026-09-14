import assert from "node:assert/strict";
import test from "node:test";
import { gameInput, cleanPlayerInput, InputError } from "../lib/input.ts";
import { apiErrorResponse, parseRecordId } from "../lib/api-errors.ts";

const valid = {
  teamAPlayer1Id: 1,
  teamAPlayer2Id: 2,
  teamBPlayer1Id: 3,
  teamBPlayer2Id: 4,
  scoreA: 1000,
  scoreB: -100,
  playedAt: "2026-09-14T20:00:00Z",
  callStats: null,
};

test("game and player parsers reject non-object requests as validation errors", () => {
  for (const input of [null, undefined, [], "", 12, true]) {
    assert.throws(() => gameInput(input), InputError);
    assert.throws(() => cleanPlayerInput(input), InputError);
  }
});

test("empty, boolean and unsafe scores or IDs cannot be coerced into a game", () => {
  for (const field of ["scoreA", "scoreB", "teamAPlayer1Id"]) {
    for (const value of [
      null,
      true,
      false,
      "",
      " ",
      [],
      {},
      1.5,
      "1e3",
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      assert.throws(() => gameInput({ ...valid, [field]: value }), InputError);
    }
  }
  assert.equal(gameInput({ ...valid, scoreB: "-205" }).scoreB, -205);
  assert.throws(() => gameInput({ ...valid, teamAPlayer1Id: 0 }), InputError);
  assert.throws(() => gameInput({ ...valid, scoreB: 1000 }), /Tied/);
  assert.throws(
    () => gameInput({ ...valid, playedAt: "invalid" }),
    /valid played-at/,
  );
});

test("call stats require four matching players and valid successes", () => {
  const stats = [1, 2, 3, 4].map((playerId) => ({
    playerId,
    grandTichus: 1,
    successfulGrandTichus: 1,
    tichus: 1,
    successfulTichus: 0,
  }));
  for (const invalid of [
    null,
    { ...stats[0], tichus: "" },
    { ...stats[0], grandTichus: -1 },
    { ...stats[0], successfulTichus: 2 },
    { ...stats[0], playerId: 2 },
  ]) {
    assert.throws(
      () => gameInput({ ...valid, callStats: [invalid, ...stats.slice(1)] }),
      InputError,
    );
  }
  assert.throws(() => gameInput({ ...valid, callStats: [] }), InputError);
  assert.deepEqual(gameInput({ ...valid, callStats: stats }).callStats, stats);
});

test("record IDs must be positive safe integers in decimal form", () => {
  for (const id of ["", "0", "-1", "1.5", "1e2", "0x10", "9007199254740992"])
    assert.throws(() => parseRecordId(id), InputError);
  assert.equal(parseRecordId("12"), 12);
});

test("API errors distinguish validation from infrastructure and hide internal details", async (context) => {
  context.mock.method(console, "error", () => {});
  assert.equal(apiErrorResponse(new InputError("Invalid score")).status, 400);
  assert.equal(apiErrorResponse(new SyntaxError("parse failed")).status, 400);
  const response = apiErrorResponse(new Error("private SQL details"));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private SQL/);
});
