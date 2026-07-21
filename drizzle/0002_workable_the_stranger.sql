ALTER TABLE `messages` ADD `replyToId` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD `assignedToName` varchar(255);--> statement-breakpoint
ALTER TABLE `tasks` ADD `lastResponseMessageId` int;