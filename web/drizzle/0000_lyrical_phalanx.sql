CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_a_player_1_id` integer NOT NULL,
	`team_a_player_2_id` integer NOT NULL,
	`score_a` integer NOT NULL,
	`team_b_player_1_id` integer NOT NULL,
	`team_b_player_2_id` integer NOT NULL,
	`score_b` integer NOT NULL,
	`played_at` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`team_a_player_1_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`team_a_player_2_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`team_b_player_1_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`team_b_player_2_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_games_played_at_id` ON `games` (`played_at`,`id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_players_code` ON `players` (`code`);--> statement-breakpoint
INSERT INTO `players` (`id`, `code`, `name`, `created_at`, `updated_at`) VALUES
  (1, 'C', 'Chanzo B.', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z'),
  (2, 'Y', 'Yash S.', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z'),
  (3, 'S', 'Sreekar M.', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z'),
  (4, 'R', 'Rebekah S.', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z'),
  (5, 'N', 'Nathan Y.', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z'),
  (6, 'J', 'Jet M.', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z');--> statement-breakpoint
INSERT INTO `games` (`id`, `team_a_player_1_id`, `team_a_player_2_id`, `score_a`, `team_b_player_1_id`, `team_b_player_2_id`, `score_b`, `played_at`, `created_by`, `created_at`, `updated_at`) VALUES
  (1, 1, 2, 595, 5, 3, 1005, '2026-08-30T12:00:00.000Z', 'import', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z'),
  (2, 5, 1, 1035, 4, 3, 365, '2026-08-30T12:01:00.000Z', 'import', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z'),
  (3, 5, 2, 1105, 3, 1, -205, '2026-08-30T12:02:00.000Z', 'import', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z'),
  (4, 3, 2, 1020, 1, 5, 180, '2026-08-30T12:03:00.000Z', 'import', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z'),
  (5, 5, 3, 1020, 2, 1, 480, '2026-08-30T12:04:00.000Z', 'import', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z'),
  (6, 5, 2, 1175, 1, 3, 925, '2026-08-30T12:05:00.000Z', 'import', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z'),
  (7, 2, 3, 1030, 1, 5, 670, '2026-08-30T12:06:00.000Z', 'import', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z'),
  (8, 5, 1, 1100, 3, 6, -600, '2026-08-30T12:07:00.000Z', 'import', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z'),
  (9, 5, 6, 340, 3, 1, 555, '2026-08-30T12:08:00.000Z', 'import', '2026-08-30T12:00:00.000Z', '2026-08-30T12:00:00.000Z');--> statement-breakpoint
PRAGMA optimize;
