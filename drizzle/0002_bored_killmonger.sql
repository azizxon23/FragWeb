CREATE INDEX `listings_owner_idx` ON `listings` (`owner_id`);--> statement-breakpoint
CREATE INDEX `listings_catalog_idx` ON `listings` (`status`,`moderation_status`,`created_at`);