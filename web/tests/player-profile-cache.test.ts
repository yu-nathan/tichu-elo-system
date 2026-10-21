import assert from "node:assert/strict";
import test from "node:test";
import { createPlayerProfileCache } from "../lib/player-profile-cache.ts";
import {
  calculatePlayerProfile,
  type SeasonalPlayerProfile,
} from "../lib/player-profile.ts";
import { getSeason } from "../lib/seasons.ts";

const profileFor = (playerId: number, seasonId: number | null) => {
  const now = Date.parse("2027-02-01T00:00:00Z");
  return {
    ...calculatePlayerProfile(
      [
        {
          id: playerId,
          code: "A",
          name: "Alex",
          gender: "M",
          archivedAt: null,
        },
      ],
      [],
      playerId,
    )!,
    season: getSeason(seasonId ?? 2, now),
    seasons: [getSeason(2, now), getSeason(1, now)],
    rank: null,
  };
};

test("profiles are reused by player and season across subscribers and tab changes", async () => {
  const calls: [number, number | null][] = [];
  const cache = createPlayerProfileCache(
    async (playerId, _signal, seasonId = null) => {
      calls.push([playerId, seasonId]);
      return profileFor(playerId, seasonId);
    },
  );
  const unsubscribe = cache.subscribe(() => {});
  await cache.load(1, null);
  const current = cache.get(1, null);
  unsubscribe();
  await cache.load(1, 1);
  await cache.load(2, null);
  await cache.load(1, null);
  await cache.load(1, 1);
  assert.equal(cache.get(1, null), current);
  assert.equal(cache.get(1, 1).profile?.season.id, 1);
  assert.equal(cache.get(2, null).profile?.player.id, 2);
  assert.deepEqual(calls, [
    [1, null],
    [1, 1],
    [2, null],
  ]);
});

test("concurrent consumers reuse a pending request and late seasons stay isolated", async () => {
  let resolve!: (profile: SeasonalPlayerProfile) => void;
  let calls = 0;
  const cache = createPlayerProfileCache(
    async (id, _signal, seasonId = null) => {
      calls++;
      return seasonId === 1
        ? new Promise<SeasonalPlayerProfile>((done) => {
            resolve = done;
          })
        : profileFor(id, seasonId);
    },
  );
  const historic = cache.load(1, 1);
  await cache.load(1, 1);
  await cache.load(1, null);
  resolve(profileFor(1, 1));
  await historic;
  assert.equal(calls, 2);
  assert.equal(cache.get(1, null).profile?.season.id, 2);
  assert.equal(cache.get(1, 1).profile?.season.id, 1);
});

test("refresh keeps visible stats and rejects an older in-flight response", async () => {
  let resolve!: (profile: SeasonalPlayerProfile) => void;
  let signal!: AbortSignal;
  let calls = 0;
  const cache = createPlayerProfileCache(
    async (id, nextSignal, seasonId = null) => {
      calls++;
      if (calls === 2) {
        signal = nextSignal;
        return new Promise<SeasonalPlayerProfile>((done) => {
          resolve = done;
        });
      }
      return { ...profileFor(id, seasonId), wins: calls };
    },
  );
  await cache.load(1, null);
  cache.invalidate();
  assert.equal(cache.get(1, null).profile?.wins, 1);
  const older = cache.load(1, null);
  cache.invalidate();
  assert.equal(signal.aborted, true);
  await cache.load(1, null);
  resolve({ ...profileFor(1, null), wins: 2 });
  await older;
  assert.equal(cache.get(1, null).profile?.wins, 3);
});

test("failures can be retried without a request loop or clearing cached stats", async () => {
  let fail = false;
  let calls = 0;
  const cache = createPlayerProfileCache(
    async (id, _signal, seasonId = null) => {
      calls++;
      if (fail) throw new Error("Unavailable");
      return profileFor(id, seasonId);
    },
  );
  await cache.load(1, null);
  fail = true;
  cache.invalidate();
  await cache.load(1, null);
  await cache.load(1, null);
  assert.equal(calls, 2);
  assert.equal(cache.get(1, null).error, "Unavailable");
  assert.ok(cache.get(1, null).profile);
  fail = false;
  await cache.load(1, null, true);
  assert.equal(cache.get(1, null).error, null);
  assert.equal(calls, 3);
});

test("hover prefetch shares data with opening, keeps failures silent, and retries on demand", async () => {
  let calls = 0;
  let fail = true;
  const cache = createPlayerProfileCache(
    async (id, _signal, seasonId = null) => {
      calls++;
      if (fail) throw new Error("Offline");
      return profileFor(id, seasonId);
    },
  );
  await cache.prefetch(1, null);
  assert.equal(cache.get(1, null).error, null);
  assert.equal(cache.get(1, null).stale, true);
  fail = false;
  await cache.load(1, null);
  await cache.prefetch(1, null);
  assert.equal(calls, 2);
  cache.invalidate();
  await cache.prefetch(1, null);
  assert.equal(calls, 3);
  await cache.load(1, null);
  assert.equal(calls, 3);
});

test("opening a pending prefetch promotes failures to the visible retry UI", async () => {
  let reject!: (error: Error) => void;
  const cache = createPlayerProfileCache(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const pending = cache.prefetch(1, null);
  await cache.load(1, null);
  reject(new Error("Connection lost"));
  await pending;
  assert.equal(cache.get(1, null).error, "Connection lost");
  assert.equal(cache.get(1, null).stale, false);
});
