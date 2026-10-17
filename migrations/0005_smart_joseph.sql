ALTER TABLE `user` ADD `reminder_time` text;--> statement-breakpoint
ALTER TABLE `user` ADD `reminder_tz` text;--> statement-breakpoint
ALTER TABLE `user` ADD `telegram_notified_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `share_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_share_token_idx` ON `user` (`share_token`);