CREATE TABLE `game_player_stats` (
	`game_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`grand_tichus` integer NOT NULL,
	`successful_grand_tichus` integer NOT NULL,
	`tichus` integer NOT NULL,
	`successful_tichus` integer NOT NULL,
	PRIMARY KEY(`game_id`, `player_id`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE restrict
);
