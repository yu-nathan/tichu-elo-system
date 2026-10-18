CREATE TABLE `api_idempotency` (
	`key_id` text NOT NULL,
	`resource` text NOT NULL,
	`token_hash` text NOT NULL,
	`payload_hash` text NOT NULL,
	`resource_id` integer,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`key_id`, `resource`, `token_hash`)
);
--> statement-breakpoint
CREATE INDEX `idx_api_idempotency_created` ON `api_idempotency` (`created_at`);--> statement-breakpoint
CREATE TABLE `api_incident_sources` (
	`bucket` integer NOT NULL,
	`key_id` text NOT NULL,
	`key_name` text NOT NULL,
	`resource` text NOT NULL,
	`created_count` integer NOT NULL,
	`blocked_count` integer NOT NULL,
	PRIMARY KEY(`bucket`, `key_id`, `resource`),
	FOREIGN KEY (`bucket`) REFERENCES `api_incidents`(`bucket`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_incidents` (
	`bucket` integer PRIMARY KEY NOT NULL,
	`first_at` integer NOT NULL,
	`last_at` integer NOT NULL,
	`created_count` integer NOT NULL,
	`blocked_count` integer NOT NULL,
	`acknowledged_at` integer
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_hash_unique` ON `api_keys` (`hash`);--> statement-breakpoint
CREATE TABLE `api_rate_buckets` (
	`scope` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `api_write_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`key_id` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_api_attempts_at` ON `api_write_attempts` (`at`);--> statement-breakpoint
CREATE INDEX `idx_api_attempts_key_at` ON `api_write_attempts` (`key_id`,`at`);--> statement-breakpoint
CREATE TABLE `api_writes` (
	`id` text PRIMARY KEY NOT NULL,
	`key_id` text NOT NULL,
	`resource` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_api_writes_at` ON `api_writes` (`at`);