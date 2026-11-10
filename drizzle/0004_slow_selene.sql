CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `marketplace_accounts` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marketplace_accounts_email_unique` ON `marketplace_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `marketplace_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketplace_sessions_owner_idx` ON `marketplace_sessions` (`owner_id`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `avatar` text DEFAULT '' NOT NULL;