CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`seller` text NOT NULL,
	`phone` text NOT NULL,
	`telegram` text NOT NULL,
	`city` text NOT NULL,
	`brand` text NOT NULL,
	`name` text NOT NULL,
	`gender` text NOT NULL,
	`size` integer NOT NULL,
	`remaining` integer NOT NULL,
	`price` integer NOT NULL,
	`condition` text NOT NULL,
	`description` text NOT NULL,
	`photos` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL
);
