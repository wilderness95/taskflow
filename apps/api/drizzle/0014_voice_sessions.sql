CREATE TABLE `voice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`board_id` text,
	`started_at` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`end_reason` text NOT NULL,
	`interruptions` integer DEFAULT 0 NOT NULL,
	`tool_calls` integer DEFAULT 0 NOT NULL,
	`tool_errors` integer DEFAULT 0 NOT NULL,
	`audio_in_ms` integer DEFAULT 0 NOT NULL,
	`audio_out_ms` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `voice_sessions_started_idx` ON `voice_sessions` (`started_at`);--> statement-breakpoint
CREATE INDEX `voice_sessions_user_idx` ON `voice_sessions` (`user_id`);