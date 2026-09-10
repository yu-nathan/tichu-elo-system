import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";
import {
  addAdmin,
  hasAdminAccess,
  isOwner,
  listAdmins,
  OWNER_EMAIL,
} from "../lib/admin-access.ts";

const createDatabase = (context: TestContext) => {
  const sqlite = new DatabaseSync(":memory:");
  context.after(() => sqlite.close());
  const directory = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(directory)
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  }
  const db = {
    prepare: (sql: string) => {
      const statement = sqlite.prepare(sql);
      let parameters: string[] = [];
      const query = {
        bind: (...values: string[]) => {
          parameters = values;
          return query;
        },
        first: async () => statement.get(...parameters) ?? null,
        all: async () => ({ results: statement.all(...parameters) }),
        run: async () => ({
          meta: { changes: Number(statement.run(...parameters).changes) },
        }),
      };
      return query;
    },
  } as unknown as Pick<D1Database, "prepare">;
  return { db, sqlite };
};

test("the existing owner retains access without a database entry", async (context) => {
  const { db } = createDatabase(context);
  assert.equal(isOwner(` ${OWNER_EMAIL.toUpperCase()} `), true);
  assert.equal(await hasAdminAccess(OWNER_EMAIL, db), true);
  assert.deepEqual(await listAdmins(db), [
    { email: OWNER_EMAIL, role: "owner" },
  ]);
});

test("adding an admin grants access with a normalized email and records the owner", async (context) => {
  const { db, sqlite } = createDatabase(context);
  assert.equal(await hasAdminAccess("friend@example.com", db), false);
  await addAdmin(" Friend@Example.com ", OWNER_EMAIL, db);
  assert.equal(await hasAdminAccess(" FRIEND@example.com ", db), true);
  assert.equal(isOwner("friend@example.com"), false);
  assert.equal(await hasAdminAccess("stranger@example.com", db), false);
  assert.equal(await hasAdminAccess("' OR 1=1 --", db), false);
  assert.deepEqual(await listAdmins(db), [
    { email: OWNER_EMAIL, role: "owner" },
    { email: "friend@example.com", role: "admin" },
  ]);
  const row = sqlite.prepare("SELECT created_by, created_at FROM admins").get();
  assert.equal(row?.created_by, OWNER_EMAIL);
  assert.ok(Number.isFinite(Date.parse(String(row?.created_at))));
});

test("other admins and visitors cannot grant admin access", async (context) => {
  const { db } = createDatabase(context);
  await addAdmin("friend@example.com", OWNER_EMAIL, db);
  for (const actor of ["friend@example.com", "stranger@example.com", ""]) {
    await assert.rejects(
      addAdmin("new@example.com", actor, db),
      /Owner access required/,
    );
  }
  assert.equal(await hasAdminAccess("new@example.com", db), false);
});

test("duplicate and invalid accounts cannot be added", async (context) => {
  const { db } = createDatabase(context);
  await addAdmin("friend@example.com", OWNER_EMAIL, db);
  await assert.rejects(
    addAdmin(" FRIEND@example.com ", OWNER_EMAIL, db),
    /already an admin/,
  );
  await assert.rejects(
    addAdmin(OWNER_EMAIL, OWNER_EMAIL, db),
    /already the owner/,
  );
  for (const email of [
    null,
    {},
    "",
    "invalid",
    "a@b",
    "a b@example.com",
    `${"a".repeat(255)}@example.com`,
  ]) {
    await assert.rejects(addAdmin(email, OWNER_EMAIL, db), /valid email/);
  }
  assert.equal((await listAdmins(db)).length, 2);
});

test("concurrent requests only create one grant", async (context) => {
  const { db } = createDatabase(context);
  const results = await Promise.allSettled([
    addAdmin("friend@example.com", OWNER_EMAIL, db),
    addAdmin("FRIEND@example.com", OWNER_EMAIL, db),
  ]);
  assert.equal(
    results.filter(({ status }) => status === "fulfilled").length,
    1,
  );
  assert.equal((await listAdmins(db)).length, 2);
});
