CREATE TABLE `roomInvites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatRoomId` int NOT NULL,
	`inviteToken` varchar(64) NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `roomInvites_id` PRIMARY KEY(`id`),
	CONSTRAINT `roomInvites_inviteToken_unique` UNIQUE(`inviteToken`)
);
--> statement-breakpoint
CREATE TABLE `roomMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatRoomId` int NOT NULL,
	`userId` int NOT NULL,
	`isAdmin` boolean NOT NULL DEFAULT false,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`joinedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `roomMembers_id` PRIMARY KEY(`id`)
);
