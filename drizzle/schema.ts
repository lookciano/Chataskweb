import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  displayName: varchar("displayName", { length: 255 }), // Custom name for chat display
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const chatRooms = mysqlTable("chatRooms", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdBy: int("createdBy").notNull(),
  invitePassword: varchar("invitePassword", { length: 255 }), // Senha para convidar novos usuários
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatRoom = typeof chatRooms.$inferSelect;
export type InsertChatRoom = typeof chatRooms.$inferInsert;

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  chatRoomId: int("chatRoomId").notNull(),
  senderId: int("senderId").notNull(),
  senderName: varchar("senderName", { length: 255 }), // Display name of sender at time of message
  content: text("content").notNull(),
  replyToId: int("replyToId"), // Reference to parent message for replies
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/** Lightweight reactions on chat messages (currently only thumbs-up / joinha). */
export const messageReactions = mysqlTable(
  "messageReactions",
  {
    id: int("id").autoincrement().primaryKey(),
    messageId: int("messageId").notNull(),
    userId: int("userId").notNull(),
    /** Stable key — e.g. "thumbsup". */
    emoji: varchar("emoji", { length: 32 }).default("thumbsup").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("uq_message_user_emoji").on(table.messageId, table.userId, table.emoji)]
);

export type MessageReaction = typeof messageReactions.$inferSelect;
export type InsertMessageReaction = typeof messageReactions.$inferInsert;

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  chatRoomId: int("chatRoomId").notNull(),
  creatorId: int("creatorId").notNull(),
  assignedToId: int("assignedToId"),
  assignedToName: varchar("assignedToName", { length: 255 }), // Store name for quick access
  taskNumber: int("taskNumber").notNull(), // Sequential number per room (1, 2, 3...)
  description: text("description").notNull(),
  dueDate: timestamp("dueDate"),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "cancelled"]).default("pending").notNull(),
  lastResponseMessageId: int("lastResponseMessageId"), // Link to last response that updated status
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** Set when status becomes completed; cleared if reopened. */
  completedAt: timestamp("completedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

export const chatRoomParticipants = mysqlTable("chatRoomParticipants", {
  id: int("id").autoincrement().primaryKey(),
  chatRoomId: int("chatRoomId").notNull(),
  userId: int("userId").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type ChatRoomParticipant = typeof chatRoomParticipants.$inferSelect;
export type InsertChatRoomParticipant = typeof chatRoomParticipants.$inferInsert;

// Tabela para gerenciar convites de salas
export const roomInvites = mysqlTable("roomInvites", {
  id: int("id").autoincrement().primaryKey(),
  chatRoomId: int("chatRoomId").notNull(),
  inviteToken: varchar("inviteToken", { length: 64 }).notNull().unique(), // Token único para o link
  createdBy: int("createdBy").notNull(), // Admin que criou o convite
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // Opcional: data de expiração
});

export type RoomInvite = typeof roomInvites.$inferSelect;
export type InsertRoomInvite = typeof roomInvites.$inferInsert;

// Tabela para gerenciar membros de salas com status de aprovação
export const roomMembers = mysqlTable("roomMembers", {
  id: int("id").autoincrement().primaryKey(),
  chatRoomId: int("chatRoomId").notNull(),
  userId: int("userId").notNull(),
  isAdmin: boolean("isAdmin").default(false).notNull(), // Se é admin da sala
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(), // Status do convite
  joinedAt: timestamp("joinedAt"), // Data de aprovação
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RoomMember = typeof roomMembers.$inferSelect;
export type InsertRoomMember = typeof roomMembers.$inferInsert;

/**
 * Per-user last-read cursor for a room (WhatsApp-style unread badges).
 * Additive only — does not affect messages/tasks.
 */
export const roomReadState = mysqlTable(
  "roomReadState",
  {
    id: int("id").autoincrement().primaryKey(),
    chatRoomId: int("chatRoomId").notNull(),
    userId: int("userId").notNull(),
    /** Highest message id the user has seen in this room (0 = nothing marked yet). */
    lastReadMessageId: int("lastReadMessageId").default(0).notNull(),
    lastReadAt: timestamp("lastReadAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("uq_roomReadState_room_user").on(table.chatRoomId, table.userId)]
);

export type RoomReadState = typeof roomReadState.$inferSelect;
export type InsertRoomReadState = typeof roomReadState.$inferInsert;
