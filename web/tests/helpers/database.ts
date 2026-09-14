import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { TestContext } from "node:test";

// Exercise the real migration and query SQL with D1's transactional batch behavior.
export const createDatabase = (context: TestContext) => {
  const sqlite = new DatabaseSync(":memory:");
  context.after(() => sqlite.close());
  sqlite.exec("PRAGMA foreign_keys = ON");
  const directory = new URL("../../drizzle/", import.meta.url);
  for (const file of readdirSync(directory)
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  }
  const prepare = (sql: string) => {
    const statement = sqlite.prepare(sql);
    let parameters: SQLInputValue[] = [];
    const query = {
      bind: (...values: SQLInputValue[]) => {
        parameters = values;
        return query;
      },
      first: async () => statement.get(...parameters) ?? null,
      all: async () => ({ results: statement.all(...parameters) }),
      execute: () => {
        const result = statement.run(...parameters);
        return {
          meta: {
            changes: Number(result.changes),
            last_row_id: Number(result.lastInsertRowid),
          },
        };
      },
      run: async () => query.execute(),
    };
    return query;
  };
  const db = {
    prepare,
    batch: async (statements: ReturnType<typeof prepare>[]) => {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.execute());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as Pick<D1Database, "prepare" | "batch">;
  return { db, sqlite };
};
