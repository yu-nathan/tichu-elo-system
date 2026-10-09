-- Add the constrained column in place to preserve player IDs and game references.
ALTER TABLE `players` ADD `gender` text DEFAULT 'M' NOT NULL
  CONSTRAINT `players_gender_check` CHECK (`gender` IN ('M', 'F'));
--> statement-breakpoint
UPDATE `players` SET `gender` = 'F' WHERE `code` = 'R' AND `name` = 'Rebekah S.';
