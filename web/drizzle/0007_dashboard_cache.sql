CREATE TABLE `dashboard_revision` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "dashboard_revision_singleton" CHECK("dashboard_revision"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `dashboard_snapshot` (
	`id` integer PRIMARY KEY NOT NULL,
	`data_revision` integer NOT NULL,
	`schema_version` integer NOT NULL,
	`season_id` integer NOT NULL,
	`settings_revision` integer NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT "dashboard_snapshot_singleton" CHECK("dashboard_snapshot"."id" = 1)
);

--> statement-breakpoint
INSERT INTO dashboard_revision (id, revision) VALUES (1, 0);
--> statement-breakpoint
CREATE TRIGGER dashboard_revision_players_insert AFTER INSERT ON players
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER dashboard_revision_players_update AFTER UPDATE ON players
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER dashboard_revision_players_delete AFTER DELETE ON players
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER dashboard_revision_games_insert AFTER INSERT ON games
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER dashboard_revision_games_update AFTER UPDATE ON games
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER dashboard_revision_games_delete AFTER DELETE ON games
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER dashboard_revision_game_player_stats_insert AFTER INSERT ON game_player_stats
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER dashboard_revision_game_player_stats_update AFTER UPDATE ON game_player_stats
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER dashboard_revision_game_player_stats_delete AFTER DELETE ON game_player_stats
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER dashboard_revision_season_settings_insert AFTER INSERT ON season_settings
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER dashboard_revision_season_settings_update AFTER UPDATE ON season_settings
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;
--> statement-breakpoint
CREATE TRIGGER dashboard_revision_season_settings_delete AFTER DELETE ON season_settings
BEGIN
  UPDATE dashboard_revision SET revision = revision + 1 WHERE id = 1;
END;
