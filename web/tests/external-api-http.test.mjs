import assert from "node:assert/strict";
import test from "node:test";

const baseURL = process.env.TICHU_TEST_URL ?? "http://localhost:3000";
const origin = new URL(baseURL).origin;
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname))
  throw new Error(
    "API integration tests must target a local development server.",
  );

// Uses local dev owner authentication. Never runs against production. Creates
// and revokes one local test key, but does not add/change/delete players or games.
test("local D1 HTTP routes enforce retry rollback, throttling, automatic revocation and persistent alerts", async () => {
  const ownerRequest = (body) =>
    fetch(`${origin}/api/access`, {
      method: body ? "POST" : "GET",
      headers: { origin, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const before = await (await fetch(`${origin}/api/state`)).json();
  const response = await ownerRequest({
    action: "create",
    name: "Local API verification",
  });
  assert.equal(response.status, 201);
  const issued = await response.json(); // Keep test credential in memory only.
  try {
    const headers = { authorization: `Bearer ${issued.key}` };
    for (const resource of ["leaderboard", "players", "games"]) {
      const read = await fetch(`${origin}/api/v1/${resource}`, { headers });
      assert.equal(read.status, 200);
      assert.doesNotMatch(
        await read.text(),
        /createdBy|created_by|hash|revokedAt/,
      );
    }
    const create = () =>
      fetch(`${origin}/api/v1/players`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "idempotency-key": "failed-operation",
        },
        body: JSON.stringify({
          code: before.players[0].code,
          name: "Duplicate code verification",
        }),
      });
    for (let attempt = 0; attempt < 10; attempt++) {
      const failed = await create();
      assert.equal(failed.status, 400); // Failed transaction must not leave an idempotency claim.
      assert.match((await failed.json()).error, /already in use/);
    }
    const throttled = await create();
    assert.equal(throttled.status, 429);
    assert.equal(throttled.headers.get("x-api-key-revoked"), "true");
    assert.equal(
      (await fetch(`${origin}/api/v1/games`, { headers })).status,
      401,
    );
    const access = await (await ownerRequest()).json();
    assert.ok(access.keys.find(({ id }) => id === issued.info.id)?.revokedAt);
    assert.ok(!JSON.stringify(access).includes(issued.key));
    const incident = access.incidents.find(({ sources }) =>
      sources.some(({ keyId }) => keyId === issued.info.id),
    );
    assert.ok(incident);
    assert.ok(incident.blockedCount >= 1);
    assert.equal(
      (await ownerRequest({ action: "acknowledge", bucket: incident.bucket }))
        .status,
      200,
    );
    assert.deepEqual(await (await fetch(`${origin}/api/state`)).json(), before);
  } finally {
    await ownerRequest({ action: "revoke", id: issued.info.id });
  }
});
