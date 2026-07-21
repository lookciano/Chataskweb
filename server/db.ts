import { eq, desc, and, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createConnection } from "mysql2";
import { InsertUser, users, chatRooms, messages, tasks, chatRoomParticipants, InsertChatRoom, InsertMessage, InsertTask, InsertChatRoomParticipant } from "../drizzle/schema";

import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
// TiDB Cloud requires SSL connection.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const connection = createConnection({
        uri: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: true,
        },
      });
      _db = drizzle(connection);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Chat Room queries
export async function createChatRoom(input: InsertChatRoom) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(chatRooms).values(input);
  return result;
}

export async function getChatRooms() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(chatRooms).orderBy(chatRooms.updatedAt);
}

export async function deleteChatRoom(chatRoomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete all messages in the room first
  await db.delete(messages).where(eq(messages.chatRoomId, chatRoomId));
  
  // Delete all participants in the room
  await db.delete(chatRoomParticipants).where(eq(chatRoomParticipants.chatRoomId, chatRoomId));
  
  // Delete all tasks in the room
  await db.delete(tasks).where(eq(tasks.chatRoomId, chatRoomId));
  
  // Delete the room
  const result = await db.delete(chatRooms).where(eq(chatRooms.id, chatRoomId));
  return result;
}

// Message queries
export async function createMessage(input: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(messages).values(input);
  return result;
}

export async function getMessagesByChatRoom(chatRoomId: number, limitValue = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(messages)
    .where(eq(messages.chatRoomId, chatRoomId))
    .orderBy(desc(messages.createdAt))
    .limit(limitValue);
}

// Task queries
export async function createTask(input: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get the next task number for this room
  const existingTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.chatRoomId, input.chatRoomId))
    .orderBy(desc(tasks.taskNumber));
  
  const nextTaskNumber = (existingTasks[0]?.taskNumber || 0) + 1;
  
  const result = await db.insert(tasks).values({
    ...input,
    taskNumber: nextTaskNumber,
  });
  return result;
}

export async function getTasksByChatRoom(chatRoomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(tasks)
    .where(eq(tasks.chatRoomId, chatRoomId))
    .orderBy(tasks.createdAt);
}

export async function getTasksByUser(userId: number, status?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (status) {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.assignedToId, userId), eq(tasks.status, status as any)))
      .orderBy(tasks.dueDate);
  }
  
  return await db
    .select()
    .from(tasks)
    .where(eq(tasks.assignedToId, userId))
    .orderBy(tasks.dueDate);
}

export async function getAllTasks(status?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (status) {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.status, status as any))
      .orderBy(tasks.dueDate);
  }
  
  return await db
    .select()
    .from(tasks)
    .orderBy(tasks.dueDate);
}

export async function updateTaskStatus(taskId: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .update(tasks)
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

export async function updateTaskStatusAndResponse(taskId: number, status: string, responseMessageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .update(tasks)
    .set({ status: status as any, lastResponseMessageId: responseMessageId, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

export async function updateTaskDescription(taskId: number, description: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .update(tasks)
    .set({ description: description, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
}

// Get message with replies
export async function getMessageWithReplies(messageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(messages)
    .where(eq(messages.replyToId, messageId))
    .orderBy(messages.createdAt);
}

// Get message by ID
export async function getMessageById(messageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  
  return result[0];
}

// Get task by ID
export async function getTaskById(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  
  return result[0];
}

// Get all tasks for a chat room with full details
export async function getTasksWithDetails(chatRoomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(tasks)
    .where(eq(tasks.chatRoomId, chatRoomId))
    .orderBy(desc(tasks.createdAt));
}


// Update user profile
export async function updateUserProfile(userId: number, displayName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

// Participants queries
export async function addParticipant(chatRoomId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if already a participant
  const existing = await db
    .select()
    .from(chatRoomParticipants)
    .where(and(eq(chatRoomParticipants.chatRoomId, chatRoomId), eq(chatRoomParticipants.userId, userId)))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  return await db.insert(chatRoomParticipants).values({
    chatRoomId,
    userId,
  });
}

export async function getParticipants(chatRoomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const participants = await db
    .select({
      id: chatRoomParticipants.id,
      userId: chatRoomParticipants.userId,
      userName: users.name,
      displayName: users.displayName,
      email: users.email,
      joinedAt: chatRoomParticipants.joinedAt,
    })
    .from(chatRoomParticipants)
    .innerJoin(users, eq(chatRoomParticipants.userId, users.id))
    .where(eq(chatRoomParticipants.chatRoomId, chatRoomId))
    .orderBy(chatRoomParticipants.joinedAt);
  
  return participants;
}

export async function removeParticipant(chatRoomId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .delete(chatRoomParticipants)
    .where(and(eq(chatRoomParticipants.chatRoomId, chatRoomId), eq(chatRoomParticipants.userId, userId)));
}


// Get task by taskNumber in a specific chat room
export async function getTaskByNumber(chatRoomId: number, taskNumber: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.chatRoomId, chatRoomId), eq(tasks.taskNumber, taskNumber)))
    .limit(1);
  
  return result[0];
}

// Get recent messages for context (last 10 messages)
export async function getRecentMessagesContext(chatRoomId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(messages)
    .where(eq(messages.chatRoomId, chatRoomId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  
  return result.reverse(); // Return in chronological order
}


// Delete a task
export async function deleteTask(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(tasks)
    .where(eq(tasks.id, taskId));
  
  return { success: true };
}

// Update task assignee
export async function updateTaskAssignee(taskId: number, assignedToName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(tasks)
    .set({ assignedToName })
    .where(eq(tasks.id, taskId));
  
  return { success: true };
}


// Get tasks for the week
export async function getWeeklyTasks(chatRoomId: number, weekStart: Date, weekEnd: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.chatRoomId, chatRoomId),
        gte(tasks.createdAt, weekStart),
        lte(tasks.createdAt, weekEnd)
      )
    );
  
  return result;
}

// Get all tasks for a room (for weekly summary)
export async function getTasksForSummary(chatRoomId: number, weekStart: Date, weekEnd: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get tasks created in the week
  const weeklyTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.chatRoomId, chatRoomId),
        gte(tasks.createdAt, weekStart),
        lte(tasks.createdAt, weekEnd)
      )
    );
  
  return weeklyTasks;
}


// Get chat room by ID
export async function getChatRoomById(chatRoomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(chatRooms)
    .where(eq(chatRooms.id, chatRoomId))
    .limit(1);
  
  return result[0];
}
