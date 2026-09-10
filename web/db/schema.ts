import {
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
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("idx_players_code").on(table.code)],
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
