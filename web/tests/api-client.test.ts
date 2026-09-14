import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchAppData,
  saveGame,
  deleteGame,
  createPlayer,
  updatePlayer,
  addAdmin,
} from "../lib/api-client.ts";
import { mutateAndRefresh } from "../lib/mutation.ts";

const data = { players: [], games: [], leaderboard: [], fairMatch: null };
const input = {
  teamAPlayer1Id: 1,
  teamAPlayer2Id: 2,
  teamBPlayer1Id: 3,
  teamBPlayer2Id: 4,
  scoreA: 1000,
  scoreB: 100,
  playedAt: "2026-09-14T20:00:00Z",
  callStats: null,
};

test("API client sends the correct methods, JSON bodies and no-store reads", async (context) => {
  const requests: { url: unknown; options?: RequestInit }[] = [];
  context.mock.method(
    globalThis,
    "fetch",
    async (url: unknown, options?: RequestInit) => {
      requests.push({ url, options });
      return Response.json(
        url === "/api/state"
          ? data
          : url === "/api/admins"
            ? { admins: [{ email: "friend@example.com", role: "admin" }] }
            : { ok: true },
      );
    },
  );
  assert.deepEqual(await fetchAppData(), data);
  await saveGame(input);
  await saveGame(input, 9);
  await deleteGame(9);
  await createPlayer({ code: "NEW", name: "New Player" });
  await updatePlayer(2, { archived: true });
  assert.equal(
    (await addAdmin("friend@example.com"))[0].email,
    "friend@example.com",
  );
  assert.deepEqual(
    requests.map(({ url, options }) => [url, options?.method]),
    [
      ["/api/state", "GET"],
      ["/api/games", "POST"],
      ["/api/games/9", "PATCH"],
      ["/api/games/9", "DELETE"],
      ["/api/players", "POST"],
      ["/api/players/2", "PATCH"],
      ["/api/admins", "POST"],
    ],
  );
  assert.equal(requests[0].options?.cache, "no-store");
  assert.equal(requests[0].options?.body, undefined);
  assert.deepEqual(JSON.parse(requests[1].options!.body as string), input);
});

test("failed or malformed state responses never replace usable app data", async (context) => {
  const fetch = context.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "Unavailable" }, { status: 503 }),
  );
  await assert.rejects(fetchAppData(), /Unavailable/);
  fetch.mock.mockImplementation(
    async () => new Response("bad gateway", { status: 502 }),
  );
  await assert.rejects(fetchAppData(), /request failed/);
  fetch.mock.mockImplementation(async () =>
    Response.json({ error: "Bad payload" }),
  );
  await assert.rejects(fetchAppData(), /Could not load/);
});

test("a successful save with a failed refresh stays successful and is never retried", async () => {
  let saves = 0;
  const result = await mutateAndRefresh(
    async () => {
      saves += 1;
    },
    async () => {
      throw new Error("read failed");
    },
  );
  assert.equal(saves, 1);
  assert.equal(result.saved, true);
  assert.ok(result.saved && result.warning?.includes("was saved"));
  assert.ok(result.saved && result.data === undefined);
});

test("mutation failures preserve inputs and skip the refresh", async () => {
  let reads = 0;
  const result = await mutateAndRefresh(
    async () => {
      throw new Error("Invalid score");
    },
    async () => {
      reads += 1;
      return data;
    },
  );
  assert.deepEqual(result, { saved: false, error: "Invalid score" });
  assert.equal(reads, 0);
  assert.deepEqual(
    await mutateAndRefresh(
      async () => {},
      async () => data,
    ),
    { saved: true, data },
  );
});
