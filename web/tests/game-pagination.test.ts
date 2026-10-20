import assert from "node:assert/strict";
import test from "node:test";
import { parseHistoryPlayerId } from "../lib/game-pagination.ts";

test("history player query accepts only positive safe integer IDs", () => {
  assert.equal(parseHistoryPlayerId(null), null);
  assert.equal(parseHistoryPlayerId("12"), 12);
  for (const value of [
    "",
    "0",
    "-1",
    "1.5",
    "1e2",
    " 1",
    "01",
    "NaN",
    "9007199254740992",
    "1 OR 1=1",
  ])
    assert.throws(
      () => parseHistoryPlayerId(value),
      /Invalid game history player ID/,
    );
});
