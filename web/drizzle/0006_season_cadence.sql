CREATE TABLE `season_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`cadence_months` integer DEFAULT 6 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "season_settings_singleton" CHECK("season_settings"."id" = 1),
	CONSTRAINT "season_settings_cadence" CHECK("season_settings"."cadence_months" IN (1, 3, 6, 12)),
	CONSTRAINT "season_settings_revision" CHECK("season_settings"."revision" >= 0)
);
--> statement-breakpoint
INSERT INTO `season_settings` (`id`, `cadence_months`, `revision`) VALUES (1, 6, 0);
