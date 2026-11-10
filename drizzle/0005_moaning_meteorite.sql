CREATE TABLE `external_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_identity_unique` ON `external_identities` (`provider`,`subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `external_owner_provider_unique` ON `external_identities` (`owner_id`,`provider`);--> statement-breakpoint
CREATE TABLE `oauth_flows` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`browser_hash` text NOT NULL,
	`provider` text NOT NULL,
	`verifier` text NOT NULL,
	`nonce` text NOT NULL,
	`intent` text NOT NULL,
	`link_owner` text DEFAULT '' NOT NULL,
	`link_session_hash` text DEFAULT '' NOT NULL,
	`return_to` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `phone_challenges` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`verification_sid` text NOT NULL,
	`intent` text NOT NULL,
	`link_owner` text DEFAULT '' NOT NULL,
	`link_session_hash` text DEFAULT '' NOT NULL,
	`return_to` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_email_unique` ON `profiles` (lower(trim("email"))) WHERE length(trim("profiles"."email")) > 0;