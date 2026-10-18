ALTER TABLE `user` ADD `last_digest_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `target_prompt_last_applied_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `target_prompt_last_dismissed_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `target_prompt_applied_kcal` integer;