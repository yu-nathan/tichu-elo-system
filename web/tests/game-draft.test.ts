import assert from "node:assert/strict";
import test from "node:test";
import {
  clearGameDraft,
  gameDraftToInput,
  readGameDraft,
  saveGameDraft,
  type GameDraft,
} from "../lib/game-draft.ts";

const createStorage = () => {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
};

const draft: GameDraft = {
  teamAPlayer1Id: 4,
  teamAPlayer2Id: 2,
  teamBPlayer1Id: 6,
  teamBPlayer2Id: 1,
  scoreA: -205,
  scoreB: 1105,
  playedAt: "2026-09-07T12:30",
  callStats: Array.from({ length: 4 }, (_, index) => ({
    grandTichus: index + 1,
    successfulGrandTichus: index,
    tichus: index + 2,
    successfulTichus: index + 1,
  })),
};

test("text fields preserve partially typed values and convert to numbers on submission", () => {
  const storage = createStorage();
  for (const score of ["", "-", "-2", "-205", "0", "1105"]) {
    saveGameDraft({ ...draft, scoreA: score }, storage);
    assert.equal(readGameDraft(storage)?.scoreA, score);
  }
  assert.equal(gameDraftToInput({ ...draft, scoreA: "-205" }).scoreA, -205);
  assert.equal(gameDraftToInput({ ...draft, scoreA: "0" }).scoreA, 0);
  assert.equal(gameDraftToInput({ ...draft, scoreA: "1105" }).scoreA, 1105);
});

test("invalid text, decimals, and negative call counts cannot be submitted", () => {
  for (const score of ["-", "abc", "1.5", "1e3", "9007199254740992"]) {
    assert.throws(
      () => gameDraftToInput({ ...draft, scoreA: score }),
      /whole numbers/,
    );
  }
  assert.throws(
    () =>
      gameDraftToInput({
        ...draft,
        callStats: draft.callStats!.map((stat) => ({ ...stat, tichus: "-1" })),
      }),
    /cannot be negative/,
  );
});

test("blank scores and call counts survive draft restoration", () => {
  const storage = createStorage();
  const cleared: GameDraft = {
    ...draft,
    scoreA: "",
    scoreB: "",
    callStats: Array.from({ length: 4 }, () => ({
      grandTichus: "",
      successfulGrandTichus: "",
      tichus: "",
      successfulTichus: "",
    })),
  };
  saveGameDraft(cleared, storage);
  assert.deepEqual(readGameDraft(storage), cleared);
});

test("blank number fields are rejected instead of being submitted as zero", () => {
  for (const key of ["scoreA", "scoreB"]) {
    assert.throws(
      () => gameDraftToInput({ ...draft, [key]: "" }),
      /Enter a value/,
    );
  }
  for (const key of [
    "grandTichus",
    "successfulGrandTichus",
    "tichus",
    "successfulTichus",
  ]) {
    assert.throws(
      () =>
        gameDraftToInput({
          ...draft,
          callStats: draft.callStats!.map((stat, index) =>
            index === 2 ? { ...stat, [key]: "" } : stat,
          ),
        }),
      /Enter a value/,
    );
  }
});

test("complete drafts submit numeric values with calls assigned to the selected players", () => {
  const input = gameDraftToInput({ ...draft, scoreA: 0 });
  assert.equal(input.scoreA, 0);
  assert.equal(input.scoreB, 1105);
  assert.equal(gameDraftToInput(draft).scoreA, -205);
  assert.deepEqual(
    input.callStats?.map(({ playerId }) => playerId),
    [4, 2, 6, 1],
  );
  assert.equal(input.callStats?.[0].successfulGrandTichus, 0);
  assert.equal(gameDraftToInput({ ...draft, callStats: null }).callStats, null);
});

test("restores all game details after leaving and returning", () => {
  const storage = createStorage();
  assert.equal(readGameDraft(storage), null);
  assert.equal(saveGameDraft(draft, storage), true);
  assert.deepEqual(readGameDraft(storage), draft);

  const latest = { ...draft, scoreA: 950, playedAt: "" };
  assert.equal(saveGameDraft(latest, storage), true);
  assert.deepEqual(readGameDraft(storage), latest);
});

test("preserves an edit's game ID and games without call details", () => {
  const storage = createStorage();
  const edit = { ...draft, id: 12, callStats: null };
  saveGameDraft(edit, storage);
  assert.deepEqual(readGameDraft(storage), edit);
});

test("clearing a saved or canceled draft prevents it returning", () => {
  const storage = createStorage();
  saveGameDraft(draft, storage);
  assert.equal(clearGameDraft(storage), true);
  assert.equal(readGameDraft(storage), null);
  saveGameDraft({ ...draft, scoreA: 500 }, storage);
  assert.equal(readGameDraft(storage)?.scoreA, 500);
});

test("ignores corrupt or incompatible stored drafts", () => {
  for (const value of [
    "invalid JSON",
    "null",
    "{}",
    JSON.stringify({ ...draft, scoreA: {} }),
    JSON.stringify({ ...draft, callStats: [] }),
    JSON.stringify({ ...draft, callStats: [null, null, null, null] }),
  ]) {
    const storage = { ...createStorage(), getItem: () => value };
    assert.equal(readGameDraft(storage), null);
  }
});

test("storage errors do not prevent editing or saving the game", () => {
  const unavailable = () => {
    throw new Error("Storage unavailable");
  };
  const storage = {
    getItem: unavailable,
    setItem: unavailable,
    removeItem: unavailable,
  };
  assert.equal(readGameDraft(storage), null);
  assert.equal(saveGameDraft(draft, storage), false);
  assert.equal(clearGameDraft(storage), false);
});
