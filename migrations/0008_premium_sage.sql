CREATE TABLE `author_slug_history` (
	`from_slug` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exercise_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`exercise_id` text NOT NULL,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exercise_assets_exercise_sort_idx` ON `exercise_assets` (`exercise_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text,
	`name` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`muscle_primary` text NOT NULL,
	`muscle_secondary` text DEFAULT '[]' NOT NULL,
	`equipment` text NOT NULL,
	`form_note` text,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `exercises_name_idx` ON `exercises` (`name`);--> statement-breakpoint
CREATE INDEX `exercises_owner_user_id_idx` ON `exercises` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `program_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`exercise_id` text NOT NULL,
	`group_tag` text,
	`sets` integer NOT NULL,
	`reps_type` text NOT NULL,
	`reps_value` integer,
	`load_type` text NOT NULL,
	`load_value` real,
	`intensity_type` text NOT NULL,
	`intensity_value` real,
	`rest_seconds` integer,
	`cues` text,
	`ref_url` text
);
--> statement-breakpoint
CREATE INDEX `program_entries_session_order_idx` ON `program_entries` (`session_id`,`order_index`);--> statement-breakpoint
CREATE TABLE `program_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text,
	`reported_user_id` text,
	`reporter_user_id` text,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`handled_at` integer
);
--> statement-breakpoint
CREATE TABLE `program_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`week_number` integer NOT NULL,
	`order_index` integer NOT NULL,
	`title` text NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `program_sessions_program_week_order_idx` ON `program_sessions` (`program_id`,`week_number`,`order_index`);--> statement-breakpoint
CREATE TABLE `program_slug_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`from_slug` text NOT NULL,
	`program_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `program_slug_history_user_from_slug_idx` ON `program_slug_history` (`user_id`,`from_slug`);--> statement-breakpoint
CREATE TABLE `programs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`slug` text,
	`visibility` text DEFAULT 'draft' NOT NULL,
	`weeks` integer NOT NULL,
	`goal` text NOT NULL,
	`level` text NOT NULL,
	`days_per_week` integer NOT NULL,
	`equipment_tags` text DEFAULT '[]' NOT NULL,
	`share_token` text,
	`forked_from_program_id` text,
	`fork_source_label` text,
	`forkable` integer DEFAULT true NOT NULL,
	`hidden_at` integer,
	`revision` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `programs_user_visibility_deleted_idx` ON `programs` (`user_id`,`visibility`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `programs_visibility_deleted_idx` ON `programs` (`visibility`,`deleted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `programs_user_slug_idx` ON `programs` (`user_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `programs_share_token_idx` ON `programs` (`share_token`);--> statement-breakpoint
ALTER TABLE `user` ADD `slug` text;--> statement-breakpoint
ALTER TABLE `user` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `user` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `user` ADD `profile_hidden_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `user_slug_idx` ON `user` (`slug`);