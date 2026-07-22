import { eq, desc, and, gte, lte, or, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool, type PoolConnection } from "mysql2/promise";
import {
  InsertUser,
  users,
  chatRooms,
  messages,
  tasks,
  chatRoomParticipants,
  InsertChatRoom,
  InsertMessage,
  InsertTask,
  InsertChatRoomParticipant,
  User,
} from "../drizzle/schema";

import { ENV } from "./_core/env";
import { ensureProductionSchema } from "./_core/schemaBootstrap";
import { normalizeName } from "../shared/normalizeNames";

// Keep DB handle loosely typed: mysql2 callback Pool vs promise Pool type mismatch in drizzle generics.
let _db: any = null;
let _pool: Pool | null = null;
let _schemaReady: Promise<void> | null = null;

function buildPool() {
  if (_pool) return _pool;
  if (!process.env.DATABASE_URL) return null;

  _pool = createPool({
    uri: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: true,
    },
    connectionLimit: 10,
    waitForConnections: true,
    enableKeepAlive: true,
  });
  return _pool;
}

async function ensureSchemaOnce() {
  if (_schemaReady) return _schemaReady;
  _schemaReady = (async () => {
    const pool = buildPool();
    if (!pool) return;
    const conn = await pool.getConnection();
    try {
      await ensureProductionSchema(conn);
    } finally {
      conn.release();
    }
  })().catch((error) => {
    console.warn("[Database] Schema bootstrap failed:", error);
    _schemaReady = null;
  });
  return _schemaReady;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
// TiDB Cloud requires SSL connection.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = buildPool();
      if (!pool) return null;
      await ensureSchemaOnce();
      // drizzle's Pool typing expects mysql2 callback pool; promise pool works at runtime.
      _db = drizzle(pool as any);
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

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

function userLabel(user: User): string {
  return (user.displayName || user.name || `User ${user.id}`).trim();
}

/**
 * Existing team members only — never fabricates new users.
 * Prefers chat participants so the same responsible people keep their IDs.
 */
export async function listSelectableUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const participantRows = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
    })
    .from(chatRoomParticipants)
    .innerJoin(users, eq(chatRoomParticipants.userId, users.id));

  // Deduplicate client-side (MySQL/TiDB GROUP BY quirks)
  const byId = new Map<number, (typeof participantRows)[number]>();
  for (const row of participantRows) byId.set(row.id, row);

  let source = Array.from(byId.values());
  if (source.length === 0) {
    source = await db
      .select({
        id: users.id,
        openId: users.openId,
        name: users.name,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(or(isNotNull(users.displayName), isNotNull(users.name)));
  }

  const filtered = source.filter((u: any) => {
    const openId = u.openId || "";
    if (openId.startsWith("test-user-") && source.length > 2) return false;
    const label = (u.displayName || u.name || "").trim();
    return Boolean(label);
  });

  filtered.sort((a: any, b: any) =>
    (a.displayName || a.name || "").localeCompare(b.displayName || b.name || "", "pt-BR")
  );

  return filtered.map((u: any) => ({
    id: u.id,
    openId: u.openId,
    name: u.name,
    displayName: u.displayName || u.name || `User ${u.id}`,
    email: u.email,
    role: u.role,
    label: (u.displayName || u.name || `User ${u.id}`).trim(),
  }));
}

export async function findUserByIdentityName(identityName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const needle = normalizeName(identityName);
  if (!needle) return undefined;

  const all = await db.select().from(users);
  const ranked = all
    .map((u: any) => ({ user: u, label: userLabel(u), norm: normalizeName(userLabel(u)) }))
    .filter((x: any) => x.norm);

  const exact =
    ranked.find((x: any) => x.norm === needle && !(x.user.openId || "").startsWith("test-user-")) ||
    ranked.find((x: any) => x.norm === needle);
  if (exact) return exact.user;

  const first = needle.split(/[\s._-]+/).filter(Boolean)[0];
  if (first && first.length >= 2) {
    const partial = ranked.find((x: any) => {
      if ((x.user.openId || "").startsWith("test-user-")) return false;
      const words = x.norm.split(/[\s._-]+/).filter(Boolean);
      return words.some((w: any) => w === first || w.startsWith(first));
    });
    if (partial) return partial.user;
  }
  return undefined;
}

export async function touchUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ lastSignedIn: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export function resolveUserDisplayName(user: User | null | undefined): string {
  if (!user) return "Usuário";
  return userLabel(user);
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

  return participants.map((p: any) => ({
    ...p,
    displayName: p.displayName || p.userName || `User ${p.userId}`,
  }));
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

  // Keep historical assignedToName text and try to bind existing user id without renaming people.
  const matched = await findUserByIdentityName(assignedToName);
  await db
    .update(tasks)
    .set({
      assignedToName,
      assignedToId: matched?.id,
      updatedAt: new Date(),
    })
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
