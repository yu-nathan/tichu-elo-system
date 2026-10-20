import type { RatingEntry } from "../lib/elo.ts";
import type { Season } from "../lib/seasons.ts";
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createDatabase } from "./helpers/database.ts";
import { createExternalApi } from "../lib/external-api.ts";
import { createApiStore } from "../lib/external-api-store.ts";
import { createApiAccessHandler } from "../lib/api-access.ts";
import {
  API_POLICY as P,
  ApiFailure,
  hashSecret,
  readApiJson,
} from "../lib/external-api-policy.ts";
import { createRepository } from "../lib/repository.ts";

const start = Date.UTC(2026, 9, 18, 12);
const origin = "https://tichu.example";
const game = {
  teamAPlayer1Id: 1,
  teamAPlayer2Id: 2,
  teamBPlayer1Id: 3,
  teamBPlayer2Id: 4,
  scoreA: 1000,
  scoreB: -100,
  playedAt: "2026-10-18T12:00:00Z",
  callStats: [1, 2, 3, 4].map((playerId) => ({
    playerId,
    grandTichus: 1,
    successfulGrandTichus: 1,
    tichus: 2,
    successfulTichus: 1,
  })),
};
const fixture = async (context: TestContext) => {
  const { db, sqlite } = createDatabase(context);
  let now = start;
  const store = createApiStore(db);
  const issued = await store.generateKey("Scorekeeper", now);
  const handle = createExternalApi(db, () => now);
  const request = (
    path: string,
    options: {
      body?: unknown;
      method?: string;
      key?: string | null;
      token?: string;
      headers?: Record<string, string>;
    } = {},
  ) => {
    const headers = new Headers({
      authorization: `Bearer ${options.key ?? issued.key}`,
      ...options.headers,
    });
    if (options.key === null) headers.delete("authorization");
    if (options.body !== undefined) {
      headers.set("content-type", "application/json");
      headers.set("idempotency-key", options.token ?? crypto.randomUUID());
    }
    return handle(
      new Request(origin + path, {
        method: options.method ?? (options.body === undefined ? "GET" : "POST"),
        headers,
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
      }),
    );
  };
  return {
    db,
    sqlite,
    store,
    issued,
    handle,
    request,
    setTime: (value: number) => {
      now = value;
    },
  };
};

test("keys are random, hash-only, capped, and expire at exactly 365 days", async (context) => {
  const f = await fixture(context);
  assert.match(f.issued.key, /^tichu_[a-f0-9]{64}$/);
  assert.equal(f.issued.info.expiresAt - start, 365 * 86_400_000);
  assert.equal(
    f.sqlite.prepare("SELECT hash FROM api_keys").get()?.hash,
    await hashSecret(f.issued.key),
  );
  assert.ok(
    !JSON.stringify(f.sqlite.prepare("SELECT * FROM api_keys").all()).includes(
      f.issued.key,
    ),
  );
  const keys = await Promise.all(
    Array.from({ length: 9 }, (_, i) => f.store.generateKey(`Key ${i}`, start)),
  );
  assert.equal(new Set([f.issued.key, ...keys.map(({ key }) => key)]).size, 10);
  await assert.rejects(
    f.store.generateKey("Extra", start + P.hourMs),
    /at most 10/i,
  );
  f.setTime(start + P.keyLifetimeMs - 1);
  assert.equal((await f.request("/api/v1/players")).status, 200);
  f.setTime(start + P.keyLifetimeMs);
  assert.equal((await f.request("/api/v1/players")).status, 401);
});

test("only trusted owner sessions can list, create, revoke, and acknowledge; bearer and cross-origin requests are denied", async (context) => {
  const { db, issued } = await fixture(context);
  for (const user of [
    null,
    { userId: "friend", email: "friend@example.com" },
    { userId: "", email: "nyu1997@gmail.com" },
  ]) {
    const handle = createApiAccessHandler(
      db,
      async () => user,
      () => start,
    );
    for (const method of ["GET", "POST"]) {
      const response = await handle(
        new Request(origin + "/api/access", {
          method,
          headers: {
            origin,
            "oai-authenticated-user-email": "nyu1997@gmail.com",
            "oai-authenticated-user-id": "forged",
            ...(method === "POST"
              ? { "content-type": "application/json" }
              : {}),
          },
          ...(method === "POST"
            ? { body: JSON.stringify({ action: "create", name: "Bad" }) }
            : {}),
        }),
      );
      assert.equal(response.status, user?.userId ? 403 : 401);
    }
  }
  const owner = createApiAccessHandler(
    db,
    async () => ({ userId: "trusted-owner", email: "nyu1997@gmail.com" }),
    () => start,
  );
  for (const action of [
    { action: "create", name: "Bad" },
    { action: "revoke", id: issued.info.id },
    { action: "acknowledge", bucket: start },
  ]) {
    assert.equal(
      (
        await owner(
          new Request(origin + "/api/access", {
            method: "POST",
            headers: {
              origin,
              authorization: `Bearer ${issued.key}`,
              "content-type": "application/json",
            },
            body: JSON.stringify(action),
          }),
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await owner(
          new Request(origin + "/api/access", {
            method: "POST",
            headers: {
              origin: "https://evil.example",
              "content-type": "application/json",
            },
            body: JSON.stringify(action),
          }),
        )
      ).status,
      403,
    );
  }
  const generated = await owner(
    new Request(origin + "/api/access", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ action: "create", name: "Owner key" }),
    }),
  );
  assert.equal(generated.status, 201);
  const body = (await generated.json()) as { key: string };
  const listed = await owner(new Request(origin + "/api/access"));
  assert.equal(listed.headers.get("cache-control"), "no-store");
  const text = await listed.text();
  assert.ok(!text.includes(body.key));
  assert.ok(!text.includes(await hashSecret(body.key)));
});

test("external reads require a valid key and expose only game data, never identity or secrets", async (context) => {
  const f = await fixture(context);
  for (const key of [null, "wrong", "tichu_" + "a".repeat(64)]) {
    assert.equal(
      (
        await f.request("/api/v1/games", {
          key,
          headers: { "oai-authenticated-user-email": "nyu1997@gmail.com" },
        })
      ).status,
      401,
    );
  }
  for (const path of ["players", "games", "leaderboard"]) {
    const response = await f.request(`/api/v1/${path}`);
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.doesNotMatch(body, /createdBy|created_by|@|hash|revokedAt|gender/);
    assert.ok(!body.includes(f.issued.key));
  }
  assert.equal((await f.request("/api/v1/players?cursor=bad")).status, 400);
  assert.equal((await f.request("/api/v1/games?cursor=bad")).status, 400);
});

test("external methods, admin paths, overrides and injected update fields cannot modify existing records", async (context) => {
  const f = await fixture(context);
  const before = await createRepository(f.db, () => start).getAppData();
  for (const method of ["PATCH", "PUT", "DELETE", "OPTIONS", "HEAD"]) {
    assert.equal((await f.request("/api/v1/games", { method })).status, 405);
    assert.equal((await f.request("/api/v1/games/1", { method })).status, 404);
  }
  for (const path of ["/api/v1/admins", "/api/v1/access", "/api/v1/keys"])
    assert.equal(
      (await f.request(path, { body: { action: "create" } })).status,
      404,
    );
  for (const header of ["x-http-method-override", "x-method-override"])
    assert.equal(
      (await f.request("/api/v1/games", { headers: { [header]: "DELETE" } }))
        .status,
      400,
    );
  assert.equal((await f.request("/api/v1/games?_method=DELETE")).status, 400);
  assert.equal(
    (
      await f.request("/api/v1/players", {
        body: { code: "ABC", name: "New", id: 1, archived: true },
      })
    ).status,
    400,
  );
  assert.deepEqual(
    await createRepository(f.db, () => start).getAppData(),
    before,
  );
});

test("create responses return IDs; concurrent retries create exactly one player and game, including call stats", async (context) => {
  const f = await fixture(context);
  for (const [resource, body] of [
    ["players", { code: "NEW", name: "New" }],
    ["games", game],
  ] as const) {
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        f.request(`/api/v1/${resource}`, { body, token: "same" }),
      ),
    );
    assert.deepEqual(
      responses.map((response) => response.status),
      [201, 201, 201, 201],
    );
    const ids = await Promise.all(
      responses.map(
        async (response) => ((await response.json()) as { id: number }).id,
      ),
    );
    assert.equal(new Set(ids).size, 1);
  }
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*) AS n FROM players WHERE code = 'NEW'")
      .get()?.n,
    1,
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM games").get()?.n,
    10,
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM game_player_stats").get()?.n,
    4,
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM api_writes").get()?.n,
    2,
  );
  assert.equal(
    (
      await f.request("/api/v1/games", {
        body: { ...game, scoreA: 1200 },
        token: "same",
      })
    ).status,
    409,
  );
});

test("idempotency ignores object field order, expires after 24 hours, and remains scoped to each key", async (context) => {
  const f = await fixture(context);
  const original = (await (
    await f.request("/api/v1/games", { body: game, token: "example" })
  ).json()) as { id: number };
  const reversed = Object.fromEntries(Object.entries(game).reverse());
  assert.deepEqual(
    await (
      await f.request("/api/v1/games", { body: reversed, token: "example" })
    ).json(),
    original,
  );
  const secondKey = await f.store.generateKey("Another", start);
  assert.notEqual(
    (
      (await (
        await f.request("/api/v1/games", {
          body: game,
          token: "example",
          key: secondKey.key,
        })
      ).json()) as { id: number }
    ).id,
    original.id,
  );
  f.setTime(start + P.idempotencyMs);
  assert.notEqual(
    (
      (await (
        await f.request("/api/v1/games", { body: game, token: "example" })
      ).json()) as { id: number }
    ).id,
    original.id,
  );
});

test("failed game/stat or alert writes roll back records and idempotency together", async (context) => {
  const f = await fixture(context);
  for (const table of ["game_player_stats", "api_writes"]) {
    const before = await createRepository(f.db, () => start).getAppData();
    f.sqlite.exec(
      `CREATE TRIGGER failure BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'injected sensitive failure'); END`,
    );
    const response = await f.request("/api/v1/games", {
      body: game,
      token: "rollback",
    });
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /sensitive/);
    assert.deepEqual(
      await createRepository(f.db, () => start).getAppData(),
      before,
    );
    assert.equal(
      f.sqlite.prepare("SELECT COUNT(*) AS n FROM api_idempotency").get()?.n,
      0,
    );
    f.sqlite.exec("DROP TRIGGER failure");
  }
  assert.equal(
    (await f.request("/api/v1/games", { body: game, token: "rollback" }))
      .status,
    201,
  );
});

test("10 creation attempts per rolling hour include invalid bodies; the next attempt revokes the key and alerts the owner", async (context) => {
  const f = await fixture(context);
  for (let i = 0; i < 10; i++) {
    f.setTime(start + i * P.minuteMs);
    assert.equal(
      (await f.request("/api/v1/players", { body: {} })).status,
      400,
    );
  }
  f.setTime(start + 59 * P.minuteMs);
  const denied = await f.request("/api/v1/players", {
    body: { code: "NEW", name: "New" },
  });
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get("x-api-key-revoked"), "true");
  assert.ok(denied.headers.has("retry-after"));
  const data = await f.store.listAccess();
  assert.ok(data.keys[0].revokedAt);
  assert.equal(data.incidents[0].blockedCount, 1);
  assert.equal(data.incidents[0].sources[0].keyName, "Scorekeeper");
  f.setTime(start + 2 * P.hourMs);
  assert.equal((await f.request("/api/v1/players")).status, 401);
});

test("rolling creation quota frees capacity at the exact hour boundary, not at a clock-hour boundary", async (context) => {
  const f = await fixture(context);
  for (let i = 0; i < 10; i++)
    await f.store.admitWrite(f.issued.info, "players", start + 30 * P.minuteMs);
  await assert.rejects(
    f.store.admitWrite(f.issued.info, "players", start + P.hourMs),
    (e: unknown) => e instanceof ApiFailure && e.status === 429,
  );
  await f.store.admitWrite(f.issued.info, "players", start + 90 * P.minuteMs);
});

test("300 reads per rolling hour are independent of writes and excess reads revoke the key", async (context) => {
  const f = await fixture(context);
  for (let i = 0; i < 300; i++)
    await f.store.admitRead(f.issued.info.id, start);
  // Writes do not consume the read allowance.
  assert.equal(
    (await f.request("/api/v1/players", { body: { code: "NEW", name: "New" } }))
      .status,
    201,
  );
  f.setTime(start + 59 * P.minuteMs);
  const denied = await f.request("/api/v1/games");
  assert.equal(denied.status, 429);
  assert.ok((await f.store.listAccess()).keys[0].revokedAt);
  assert.equal((await f.request("/api/v1/players")).status, 401);
});

test("rolling read quotas recover exactly at one hour and reject concurrent overflow", async (context) => {
  const f = await fixture(context);
  const attempts = await Promise.allSettled(
    Array.from({ length: 310 }, () =>
      f.store.admitRead(f.issued.info.id, start + 30 * P.minuteMs),
    ),
  );
  assert.equal(
    attempts.filter((result) => result.status === "fulfilled").length,
    300,
  );
  await assert.rejects(
    f.store.admitRead(f.issued.info.id, start + P.hourMs),
    /Read limit/,
  );
  await f.store.admitRead(f.issued.info.id, start + 90 * P.minuteMs);
});

test("global rolling quotas hold across keys and concurrency", async (context) => {
  const f = await fixture(context);
  const keys = [
    f.issued,
    ...(await Promise.all(
      Array.from({ length: 9 }, (_, i) =>
        f.store.generateKey(`Key ${i}`, start),
      ),
    )),
  ];
  const concurrent = await Promise.allSettled(
    keys.flatMap(({ info }) =>
      Array.from({ length: 3 }, () => f.store.admitWrite(info, "games", start)),
    ),
  );
  assert.equal(
    concurrent.filter(({ status }) => status === "fulfilled").length,
    20,
  );
  // Fill each key's remaining hourly allowance, spaced to respect the global minute cap.
  for (let i = 0; i < keys.length; i++) {
    const count = Number(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM api_write_attempts WHERE key_id = ?",
        )
        .get(keys[i].info.id)?.n,
    );
    for (let j = count; j < 10; j++)
      await f.store.admitWrite(
        keys[i].info,
        "games",
        start + (i + 1) * P.minuteMs,
      );
  }
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM api_write_attempts").get()?.n,
    100,
  );
  await assert.rejects(
    f.store.admitWrite(
      { ...f.issued.info, id: "another" },
      "games",
      start + 30 * P.minuteMs,
    ),
    /Creation limit/,
  );
});

test("global request throttles also revoke identifiable keys; unknown traffic cannot create per-attacker rows", async (context) => {
  for (const scope of ["pre-auth", "authenticated"]) {
    const f = await fixture(context);
    const limit = scope === "pre-auth" ? P.preAuthPerMinute : P.requestsGlobal;
    for (let i = 0; i < limit; i++) await f.store.consume(scope, limit, start);
    const response = await f.request("/api/v1/players");
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("x-api-key-revoked"), "true");
    assert.ok((await f.store.listAccess()).keys[0].revokedAt);
    for (let i = 0; i < 10; i++)
      await f.request("/api/v1/players", { key: "invalid" + i });
    assert.ok(
      Number(
        f.sqlite.prepare("SELECT COUNT(*) AS n FROM api_rate_buckets").get()?.n,
      ) <= 3,
    );
  }
});

test("five actual writes alert; retries do not inflate counts; incidents aggregate and become unread on new activity", async (context) => {
  const f = await fixture(context);
  for (let i = 0; i < 4; i++)
    assert.equal(
      (await f.request("/api/v1/games", { body: game, token: `game-${i}` }))
        .status,
      201,
    );
  assert.equal((await f.store.listAccess()).incidents.length, 0);
  await f.request("/api/v1/games", { body: game, token: "game-0" });
  assert.equal((await f.store.listAccess()).incidents.length, 0);
  await f.request("/api/v1/players", { body: { code: "NEW", name: "New" } });
  let data = await f.store.listAccess();
  assert.equal(data.incidents.length, 1);
  assert.equal(data.incidents[0].createdCount, 5);
  assert.equal(data.incidents[0].sources.length, 2);
  await f.store.acknowledge(data.incidents[0].bucket, start + 1);
  assert.ok((await f.store.listAccess()).incidents[0].acknowledgedAt);
  f.setTime(start + 2);
  await f.request("/api/v1/games", { body: game });
  data = await f.store.listAccess();
  assert.equal(data.incidents.length, 1);
  assert.equal(data.incidents[0].createdCount, 6);
  assert.equal(data.incidents[0].acknowledgedAt, null);
  assert.ok(!JSON.stringify(data).includes(f.issued.key));
});

test("revocation during body reading cannot commit a record", async (context) => {
  const f = await fixture(context);
  let release: (value: Uint8Array) => void = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      release = (value) => {
        controller.enqueue(value);
        controller.close();
      };
    },
  });
  const request = new Request(origin + "/api/v1/games", {
    method: "POST",
    headers: {
      authorization: `Bearer ${f.issued.key}`,
      "content-type": "application/json",
      "idempotency-key": "late",
    },
    body,
    duplex: "half",
  } as RequestInit);
  const pending = f.handle(request);
  await f.store.revoke(f.issued.info.id, start);
  release(new TextEncoder().encode(JSON.stringify(game)));
  assert.equal((await pending).status, 401);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM games").get()?.n, 9);
});

test("creation transaction checks revocation atomically even after initial authentication", async (context) => {
  const f = await fixture(context);
  const hooks = f.store.creationTransaction(
    f.issued.info.id,
    "games",
    "token-hash",
    "payload-hash",
    start,
  );
  await f.store.revoke(f.issued.info.id, start);
  await assert.rejects(
    createRepository(f.db, () => start).createGame(game, "api-key", hooks),
  );
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM games").get()?.n, 9);
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM api_idempotency").get()?.n,
    0,
  );
});

test("body parser bounds declared and streamed size, malformed UTF-8, JSON, and deadlines", async (context) => {
  for (const [body, headers, status] of [
    ["{}", { "content-length": "999999" }, 413],
    ["x".repeat(P.maxBodyBytes + 1), {}, 413],
    ["{", {}, 400],
    ["{}", { "content-type": "text/plain" }, 415],
  ] as const) {
    await assert.rejects(
      readApiJson(
        new Request(origin, {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body,
        }),
      ),
      (error: unknown) =>
        error instanceof ApiFailure && error.status === status,
    );
  }
  await assert.rejects(
    readApiJson(
      new Request(origin, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: new Uint8Array([255]),
      }),
    ),
    /Invalid JSON/,
  );
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = readApiJson(
    new Request(origin, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new ReadableStream(),
      duplex: "half",
    } as RequestInit),
  );
  const rejection = assert.rejects(
    pending,
    (error: unknown) => error instanceof ApiFailure && error.status === 408,
  );
  context.mock.timers.tick(P.bodyTimeoutMs);
  await rejection;
});

test("storage errors fail closed and cleanup preserves leaderboard records", async (context) => {
  const f = await fixture(context);
  f.sqlite.exec("DROP TABLE api_rate_buckets");
  assert.equal((await f.request("/api/v1/games", { body: game })).status, 503);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM games").get()?.n, 9);
  const second = await fixture(context);
  const before = await createRepository(second.db, () => start).getAppData();
  await second.store.admitRead(second.issued.info.id, start);
  await second.store.admitWrite(second.issued.info, "games", start);
  await second.store.recordBlocked(second.issued.info, "games", start);
  await second.store.cleanup(start + P.retentionMs + 1);
  assert.equal(
    second.sqlite.prepare("SELECT COUNT(*) AS n FROM api_incidents").get()?.n,
    0,
  );
  assert.equal(
    second.sqlite
      .prepare("SELECT COUNT(*) AS n FROM api_incident_sources")
      .get()?.n,
    0,
  );
  assert.equal(
    second.sqlite.prepare("SELECT COUNT(*) AS n FROM api_keys").get()?.n,
    0,
  );
  assert.equal(
    second.sqlite.prepare("SELECT COUNT(*) AS n FROM api_read_attempts").get()
      ?.n,
    0,
  );
  assert.equal(
    second.sqlite.prepare("SELECT COUNT(*) AS n FROM api_write_attempts").get()
      ?.n,
    0,
  );
  assert.deepEqual(
    await createRepository(second.db, () => start).getAppData(),
    before,
  );
});

test("alerts include all triggering writes across a 15-minute incident boundary", async (context) => {
  const f = await fixture(context);
  f.setTime(start + P.incidentWindowMs - 1);
  for (let i = 0; i < 4; i++) await f.request("/api/v1/games", { body: game });
  f.setTime(start + P.incidentWindowMs + 1);
  await f.request("/api/v1/games", { body: game });
  const alert = (await f.store.listAccess()).incidents[0];
  assert.equal(alert.createdCount, 5);
  assert.equal(alert.sources[0].createdCount, 5);
  assert.equal(alert.firstAt, start + P.incidentWindowMs - 1);
});

test("automatic revocation survives a failure to persist the alert", async (context) => {
  const f = await fixture(context);
  f.sqlite.exec(
    "CREATE TRIGGER fail_alert BEFORE INSERT ON api_incidents BEGIN SELECT RAISE(ABORT, 'alert unavailable'); END",
  );
  for (let i = 0; i < 10; i++)
    await f.store.admitWrite(f.issued.info, "games", start);
  assert.equal((await f.request("/api/v1/games", { body: game })).status, 503);
  assert.ok((await f.store.listAccess()).keys[0].revokedAt);
  f.setTime(start + 2 * P.hourMs);
  assert.equal((await f.request("/api/v1/players")).status, 401);
});

test("player reads include identity and current Elo, including new and archived players", async (context) => {
  const f = await fixture(context);
  const repository = createRepository(f.db, () => start);
  const newId = await repository.createPlayer({
    code: "NEW",
    name: "New Player",
  });
  const readPlayers = async () => {
    const response = await f.request("/api/v1/players");
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      players: {
        id: number;
        name: string;
        code: string;
        rating: number;
        archivedAt: string | null;
      }[];
    };
    return body.players;
  };
  const before = await readPlayers();
  assert.deepEqual(
    before.find(({ id }) => id === newId),
    {
      id: newId,
      name: "New Player",
      code: "NEW",
      rating: 1000,
      archivedAt: null,
    },
  );
  assert.equal((await f.request("/api/v1/games", { body: game })).status, 201);
  await repository.updatePlayer(1, { archived: true });
  const after = await readPlayers();
  const { leaderboard } = await repository.getDashboardData();
  assert.deepEqual(
    after,
    leaderboard
      .sort((a, b) => a.id - b.id)
      .map(({ id, name, code, rating, archivedAt }) => ({
        id,
        name,
        code,
        rating,
        archivedAt,
      })),
  );
  assert.notEqual(
    after.find(({ id }) => id === 1)!.rating,
    before.find(({ id }) => id === 1)!.rating,
  );
  assert.ok(after.find(({ id }) => id === 1)!.archivedAt);
});

test("player pagination is bounded and stable without exposing internal fields", async (context) => {
  const f = await fixture(context);
  const repository = createRepository(f.db, () => start);
  for (let index = 0; index < 55; index++)
    await repository.createPlayer({
      code: `X${index}`,
      name: `Example ${index}`,
    });
  const expected = f.sqlite
    .prepare("SELECT id FROM players ORDER BY id")
    .all()
    .map(({ id }) => id);
  const seen: number[] = [];
  let cursor: string | null = null;
  do {
    const response = await f.request(
      `/api/v1/players${cursor === null ? "" : `?cursor=${cursor}`}`,
    );
    assert.equal(response.status, 200);
    const page = (await response.json()) as {
      players: { id: number; name: string; code: string; rating: number }[];
      nextCursor: string | null;
    };
    assert.ok(page.players.length <= 50);
    for (const player of page.players) {
      assert.equal(typeof player.name, "string");
      assert.equal(typeof player.code, "string");
      assert.equal(typeof player.rating, "number");
      if (player.code.startsWith("X")) assert.equal(player.rating, 1000);
    }
    seen.push(...page.players.map(({ id }) => id));
    cursor = page.nextCursor;
  } while (cursor !== null);
  assert.deepEqual(seen, expected);
});

test("API rejects duplicate player codes after normalization, including archived players", async (context) => {
  const f = await fixture(context);
  const repository = createRepository(f.db, () => start);
  const original = await repository.getAppData();
  const player = original.players.find(({ id }) => id === 1)!;
  for (const code of [
    player.code,
    player.code.toLowerCase(),
    ` ${player.code} `,
    ` ${player.code.toLowerCase()} `,
  ]) {
    const response = await f.request("/api/v1/players", {
      body: { code, name: "Must not replace the existing player", gender: "F" },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "That player code is already in use.",
    });
  }
  assert.deepEqual(await repository.getAppData(), original);
  await repository.updatePlayer(player.id, { archived: true });
  const archived = await repository.getAppData();
  const duplicate = await f.request("/api/v1/players", {
    body: {
      code: player.code.toLowerCase(),
      name: "Must not reuse an archived code",
    },
  });
  assert.equal(duplicate.status, 400);
  assert.deepEqual(await repository.getAppData(), archived);
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM api_idempotency").get()?.n,
    0,
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM api_writes").get()?.n,
    0,
  );
});

test("concurrent API requests with different keys cannot create duplicate normalized player codes", async (context) => {
  const f = await fixture(context);
  const second = await f.store.generateKey("Other scorekeeper", start);
  const before = await createRepository(f.db, () => start).getAppData();
  const responses = await Promise.all(
    [
      { code: "z9", key: f.issued.key },
      { code: " Z9 ", key: second.key },
      { code: "Z9", key: f.issued.key },
    ].map(({ code, key }, index) =>
      f.request("/api/v1/players", {
        key,
        token: `distinct-operation-${index}`,
        body: { code, name: `New player ${index}` },
      }),
    ),
  );
  assert.deepEqual(
    responses.map(({ status }) => status).sort(),
    [201, 400, 400],
  );
  for (const response of responses.filter(({ status }) => status === 400))
    assert.deepEqual(await response.json(), {
      error: "That player code is already in use.",
    });
  const after = await createRepository(f.db, () => start).getAppData();
  const created = after.players.filter(({ code }) => code === "Z9");
  assert.equal(created.length, 1);
  assert.equal(after.players.length, before.players.length + 1);
  assert.deepEqual(after.games, before.games);
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM api_idempotency").get()?.n,
    1,
  );
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM api_writes").get()?.n,
    1,
  );
  const successful = responses.find(({ status }) => status === 201)!;
  assert.deepEqual(await successful.json(), { id: created[0].id });
});

test("external stats switch at Pacific midnight, agree across endpoints, and isolate historical corrections", async (context) => {
  const f = await fixture(context);
  f.sqlite.exec("DELETE FROM games");
  type Standings = { season: Season; leaderboard: RatingEntry[] };
  type Players = { season: Season; players: RatingEntry[] };
  const boundary = Date.parse("2027-01-01T08:00:00.000Z");
  const repository = createRepository(f.db, () => boundary);
  const oldId = await repository.createGame(
    { ...game, playedAt: "2026-12-31T23:59:59-08:00" },
    "test",
  );
  f.setTime(boundary - 1);
  const before = (await (
    await f.request("/api/v1/leaderboard")
  ).json()) as Standings;
  assert.equal(before.season.id, 1);
  assert.equal(
    before.leaderboard.find((p: { id: number }) => p.id === 1)!.rating,
    1016,
  );
  f.setTime(boundary);
  const reset = (await (
    await f.request("/api/v1/leaderboard")
  ).json()) as Standings;
  const players = (await (
    await f.request("/api/v1/players")
  ).json()) as Players;
  assert.equal(reset.season.id, 2);
  assert.deepEqual(players.season, reset.season);
  assert.ok(
    players.players.every((p: { rating: number }) => p.rating === 1000),
  );
  for (const p of reset.leaderboard) {
    assert.equal(p.rating, 1000);
    for (const key of [
      "gamesPlayed",
      "grandTichus",
      "successfulGrandTichus",
      "tichus",
      "successfulTichus",
    ] as const)
      assert.equal(p[key], 0);
  }
  await repository.updateGame(oldId, { ...game, scoreA: 0, scoreB: 1000 });
  assert.deepEqual(
    await (await f.request("/api/v1/leaderboard")).json(),
    reset,
  );
  const created = await f.request("/api/v1/games", {
    body: { ...game, playedAt: "2027-01-01T00:00:00-08:00" },
  });
  assert.equal(created.status, 201);
  const live = (await (
    await f.request("/api/v1/leaderboard")
  ).json()) as Standings;
  const player = live.leaderboard.find((p: { id: number }) => p.id === 1)!;
  const profile = (await repository.getPlayerProfile(1))!;
  assert.equal(player.rating, profile.player.rating);
  assert.equal(player.gamesPlayed, 1);
  assert.equal(player.tichus, 2);
  assert.equal(player.successfulTichus, 1);
  assert.equal(player.grandTichus, 1);
  assert.equal(player.successfulGrandTichus, 1);
  assert.equal(
    (await repository.getDashboardData()).leaderboard.find(({ id }) => id === 1)
      ?.rating,
    player.rating,
  );
  const list = (await (
    await f.request("/api/v1/players?seasonId=1")
  ).json()) as Players;
  assert.equal(list.season.id, 2);
  assert.equal(
    list.players.find((p: { id: number }) => p.id === 1)!.rating,
    player.rating,
  );
  const games = (await (await f.request("/api/v1/games")).json()) as {
    games: unknown[];
  };
  assert.equal(games.games.length, 2);
  // A correction crossing the boundary now updates current-season statistics.
  await repository.updateGame(oldId, {
    ...game,
    playedAt: "2027-01-01T00:01:00-08:00",
  });
  const moved = (await (
    await f.request("/api/v1/leaderboard")
  ).json()) as Standings;
  assert.equal(
    moved.leaderboard.find((p: { id: number }) => p.id === 1)!.gamesPlayed,
    2,
  );
});
