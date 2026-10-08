import assert from "node:assert/strict";
import test from "node:test";
import { discordHistory } from "../lib/discord.ts";
import type { Game } from "../lib/models.ts";

test("Discord history labels and copies only the newest ten regardless of loaded order", () => {
  const games = Array.from(
    { length: 25 },
    (_, index) =>
      ({
        id: index + 1,
        playedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
        teamACode: "AB",
        teamBCode: "CD",
        scoreA: 1000,
        scoreB: 0,
      }) as Game,
  );
  for (const loaded of [games, [...games].reverse()]) {
    const copy = discordHistory({ games: loaded });
    assert.match(copy, /Last 10 games/);
    const rows = [...copy.matchAll(/║\s+(\d+) ║ AB/g)].map((match) =>
      Number(match[1]),
    );
    assert.deepEqual(rows, [16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
  }
});
