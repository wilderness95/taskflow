CREATE INDEX `api_keys_user_idx` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE INDEX `board_members_user_idx` ON `board_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `board_stars_user_idx` ON `board_stars` (`user_id`);--> statement-breakpoint
CREATE INDEX `boards_workspace_idx` ON `boards` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `card_labels_label_idx` ON `card_labels` (`label_id`);--> statement-breakpoint
CREATE INDEX `cards_column_idx` ON `cards` (`column_id`);--> statement-breakpoint
CREATE INDEX `checklist_items_checklist_idx` ON `checklist_items` (`checklist_id`);--> statement-breakpoint
CREATE INDEX `checklists_card_idx` ON `checklists` (`card_id`);--> statement-breakpoint
CREATE INDEX `columns_board_idx` ON `columns` (`board_id`);--> statement-breakpoint
CREATE INDEX `labels_board_idx` ON `labels` (`board_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `workspace_members_user_idx` ON `workspace_members` (`user_id`);