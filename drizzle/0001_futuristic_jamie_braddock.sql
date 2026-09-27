CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recurring` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`account_id` text NOT NULL,
	`to_account_id` text,
	`category` text NOT NULL,
	`note` text NOT NULL,
	`next_date` text NOT NULL,
	`frequency` text NOT NULL,
	`anchor_day` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
