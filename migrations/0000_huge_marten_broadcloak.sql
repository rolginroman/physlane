CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`phase` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`start_weight_kg` real,
	`target_rate_kg_per_week` real,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cycles_user_idx` ON `cycles` (`user_id`);--> statement-breakpoint
CREATE TABLE `daily_intake` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`kcal` integer NOT NULL,
	`protein_g` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_intake_user_date_idx` ON `daily_intake` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`taken_at` integer NOT NULL,
	`weight_kg` real,
	`neck_cm` real,
	`chest_cm` real,
	`waist_cm` real,
	`hips_cm` real,
	`arm_left_cm` real,
	`arm_right_cm` real,
	`thigh_left_cm` real,
	`thigh_right_cm` real,
	`calf_cm` real,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `measurements_user_taken_idx` ON `measurements` (`user_id`,`taken_at`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`taken_at` integer NOT NULL,
	`pose` text DEFAULT 'front' NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text DEFAULT 'image/jpeg' NOT NULL,
	`bytes` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `photos_user_taken_idx` ON `photos` (`user_id`,`taken_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`unit_system` text DEFAULT 'metric' NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`on_glp1` integer DEFAULT false NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`plan_current_period_end` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_idx` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
