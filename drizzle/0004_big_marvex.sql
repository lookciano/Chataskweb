CREATE TABLE `chatRoomParticipants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatRoomId` int NOT NULL,
	`userId` int NOT NULL,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatRoomParticipants_id` PRIMARY KEY(`id`)
);
