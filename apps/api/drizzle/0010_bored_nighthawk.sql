CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`url` text NOT NULL,
	`secret_enc` text NOT NULL,
	`events` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`last_status` integer,
	`last_delivery_at` integer,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `webhooks_board_idx` ON `webhooks` (`board_id`);