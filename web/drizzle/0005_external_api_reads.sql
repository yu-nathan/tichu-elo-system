CREATE TABLE `api_read_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`key_id` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_api_reads_at` ON `api_read_attempts` (`at`);--> statement-breakpoint
CREATE INDEX `idx_api_reads_key_at` ON `api_read_attempts` (`key_id`,`at`);