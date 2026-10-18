import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const admins = sqliteTable("admins", {
  email: text("email").primaryKey(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

export const players = sqliteTable(
  "players",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    gender: text("gender", { enum: ["M", "F"] })
      .notNull()
      .default("M"),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_players_code").on(table.code),
    check("players_gender_check", sql`${table.gender} IN ('M', 'F')`),
  ],
);

export const games = sqliteTable(
  "games",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    teamAPlayer1Id: integer("team_a_player_1_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    teamAPlayer2Id: integer("team_a_player_2_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    scoreA: integer("score_a").notNull(),
    teamBPlayer1Id: integer("team_b_player_1_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    teamBPlayer2Id: integer("team_b_player_2_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    scoreB: integer("score_b").notNull(),
    playedAt: text("played_at").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_games_played_at_id").on(table.playedAt, table.id)],
);

export const gamePlayerStats = sqliteTable(
  "game_player_stats",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    grandTichus: integer("grand_tichus").notNull(),
    successfulGrandTichus: integer("successful_grand_tichus").notNull(),
    tichus: integer("tichus").notNull(),
    successfulTichus: integer("successful_tichus").notNull(),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.playerId] })],
);

export type PlayerRow = typeof players.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type GamePlayerStatRow = typeof gamePlayerStats.$inferSelect;

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  hash: text("hash").notNull().unique(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  lastUsedAt: integer("last_used_at"),
  revokedAt: integer("revoked_at"),
});

export const apiRateBuckets = sqliteTable("api_rate_buckets", {
  scope: text("scope").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull(),
});

export const apiWriteAttempts = sqliteTable(
  "api_write_attempts",
  {
    id: text("id").primaryKey(),
    keyId: text("key_id").notNull(),
    at: integer("at").notNull(),
  },
  (table) => [
    index("idx_api_attempts_at").on(table.at),
    index("idx_api_attempts_key_at").on(table.keyId, table.at),
  ],
);

export const apiIdempotency = sqliteTable(
  "api_idempotency",
  {
    keyId: text("key_id").notNull(),
    resource: text("resource").notNull(),
    tokenHash: text("token_hash").notNull(),
    payloadHash: text("payload_hash").notNull(),
    resourceId: integer("resource_id"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.keyId, table.resource, table.tokenHash] }),
    index("idx_api_idempotency_created").on(table.createdAt),
  ],
);

export const apiWrites = sqliteTable(
  "api_writes",
  {
    id: text("id").primaryKey(),
    keyId: text("key_id").notNull(),
    resource: text("resource").notNull(),
    at: integer("at").notNull(),
  },
  (table) => [index("idx_api_writes_at").on(table.at)],
);

export const apiIncidents = sqliteTable("api_incidents", {
  bucket: integer("bucket").primaryKey(),
  firstAt: integer("first_at").notNull(),
  lastAt: integer("last_at").notNull(),
  createdCount: integer("created_count").notNull(),
  blockedCount: integer("blocked_count").notNull(),
  acknowledgedAt: integer("acknowledged_at"),
});

export const apiIncidentSources = sqliteTable(
  "api_incident_sources",
  {
    bucket: integer("bucket")
      .notNull()
      .references(() => apiIncidents.bucket, { onDelete: "cascade" }),
    keyId: text("key_id").notNull(),
    keyName: text("key_name").notNull(),
    resource: text("resource").notNull(),
    createdCount: integer("created_count").notNull(),
    blockedCount: integer("blocked_count").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bucket, table.keyId, table.resource] }),
  ],
);

export const apiReadAttempts = sqliteTable(
  "api_read_attempts",
  {
    id: text("id").primaryKey(),
    keyId: text("key_id").notNull(),
    at: integer("at").notNull(),
  },
  (table) => [
    index("idx_api_reads_at").on(table.at),
    index("idx_api_reads_key_at").on(table.keyId, table.at),
  ],
);
