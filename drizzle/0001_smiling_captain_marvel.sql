CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text NOT NULL,
	`telegram` text NOT NULL,
	`city` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_owner_unique` ON `profiles` (`owner_id`);--> statement-breakpoint
ALTER TABLE `listings` ADD `moderation_status` text DEFAULT 'visible' NOT NULL;