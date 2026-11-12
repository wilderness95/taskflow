CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_key` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_storage_key_unique` ON `attachments` (`storage_key`);--> statement-breakpoint
CREATE INDEX `attachments_card_idx` ON `attachments` (`card_id`);--> statement-breakpoint
ALTER TABLE `cards` ADD `cover_attachment_id` text;