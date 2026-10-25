ALTER TABLE `program_reports` ADD `reporter_ip_hash` text;--> statement-breakpoint
CREATE INDEX `program_reports_ip_hash_created_at_idx` ON `program_reports` (`reporter_ip_hash`,`created_at`);