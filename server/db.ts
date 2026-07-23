import { eq, desc, and, gte, lte, or, isNotNull, lt, gt, asc, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2/promise";
import {
  InsertUser,
  users,
  chatRooms,
  messages,
  tasks,
  chatRoomParticipants,
  messageReactions,
  roomMembers,
  roomInvites,
  InsertChatRoom,
  InsertMessage,
  InsertTask,
  InsertChatRoomParticipant,
  User,
} from "../drizzle/schema";
import { randomBytes } from "crypto";

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
 * Platform admins only (bootstrap / identity switch gate for owners).
 * Never fabricates users — filters existing account rows by role.
 */
export async function listPlatformAdmins() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.role, "admin"));

  return rows
    .filter((u: any) => Boolean((u.displayName || u.name || "").trim()))
    .sort((a: any, b: any) =>
      (a.displayName || a.name || "").localeCompare(b.displayName || b.name || "", "pt-BR")
    )
    .map((u: any) => ({
      id: u.id,
      openId: u.openId,
      name: u.name,
      displayName: u.displayName || u.name || `User ${u.id}`,
      email: u.email,
      role: u.role,
      label: (u.displayName || u.name || `User ${u.id}`).trim(),
    }));
}

/**
 * Existing team members only — never fabricates new users.
 * Prefers chat participants + approved room members so invitees also appear
 * in the identity picker after accepting a link.
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

  let memberRows: typeof participantRows = [];
  try {
    memberRows = await db
      .select({
        id: users.id,
        openId: users.openId,
        name: users.name,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
      })
      .from(roomMembers)
      .innerJoin(users, eq(roomMembers.userId, users.id))
      .where(eq(roomMembers.status, "approved"));
  } catch {
    memberRows = [];
  }

  // Deduplicate client-side (MySQL/TiDB GROUP BY quirks)
  const byId = new Map<number, (typeof participantRows)[number]>();
  for (const row of participantRows) byId.set(row.id, row);
  for (const row of memberRows) byId.set(row.id, row);

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
  const insertId = Number((result as any)?.[0]?.insertId ?? (result as any)?.insertId ?? 0);
  return { ...(result as any), insertId, id: insertId };
}

/**
 * Return rooms a user may open.
 * - Global admin: all rooms
 * - Others: rooms where they are in chatRoomParticipants OR roomMembers(approved)
 */
export async function getChatRoomsForUser(userId: number, isGlobalAdmin = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (isGlobalAdmin) {
    return await db.select().from(chatRooms).orderBy(desc(chatRooms.updatedAt));
  }

  const participantRooms = await db
    .select({ chatRoomId: chatRoomParticipants.chatRoomId })
    .from(chatRoomParticipants)
    .where(eq(chatRoomParticipants.userId, userId));

  const memberRooms = await db
    .select({ chatRoomId: roomMembers.chatRoomId })
    .from(roomMembers)
    .where(and(eq(roomMembers.userId, userId), eq(roomMembers.status, "approved")));

  const ids = Array.from(
    new Set([
      ...participantRooms.map((r: { chatRoomId: number }) => r.chatRoomId),
      ...memberRooms.map((r: { chatRoomId: number }) => r.chatRoomId),
    ])
  );

  if (!ids.length) return [];

  const rooms = await db.select().from(chatRooms).orderBy(desc(chatRooms.updatedAt));
  return rooms.filter((r: { id: number }) => ids.includes(r.id));
}

export async function getChatRooms() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(chatRooms).orderBy(chatRooms.updatedAt);
}

/** True if user may access room content (member or global admin). */
export async function isRoomMember(
  chatRoomId: number,
  userId: number,
  opts?: { isGlobalAdmin?: boolean }
): Promise<boolean> {
  if (opts?.isGlobalAdmin) return true;
  const db = await getDb();
  if (!db) return false;

  const asParticipant = await db
    .select({ id: chatRoomParticipants.id })
    .from(chatRoomParticipants)
    .where(
      and(
        eq(chatRoomParticipants.chatRoomId, chatRoomId),
        eq(chatRoomParticipants.userId, userId)
      )
    )
    .limit(1);
  if (asParticipant[0]) return true;

  const asMember = await db
    .select({ id: roomMembers.id })
    .from(roomMembers)
    .where(
      and(
        eq(roomMembers.chatRoomId, chatRoomId),
        eq(roomMembers.userId, userId),
        eq(roomMembers.status, "approved")
      )
    )
    .limit(1);
  return Boolean(asMember[0]);
}

/**
 * Ensure membership mirrored in both chatRoomParticipants and roomMembers(approved).
 * Does not create users. Safe to call repeatedly.
 */
export async function ensureRoomMembership(
  chatRoomId: number,
  userId: number,
  opts?: { isAdmin?: boolean }
) {
  await addParticipant(chatRoomId, userId);

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(roomMembers)
    .where(and(eq(roomMembers.chatRoomId, chatRoomId), eq(roomMembers.userId, userId)))
    .limit(1);

  const now = new Date();
  if (existing[0]) {
    await db
      .update(roomMembers)
      .set({
        status: "approved",
        joinedAt: existing[0].joinedAt || now,
        isAdmin: opts?.isAdmin ? true : existing[0].isAdmin,
      })
      .where(eq(roomMembers.id, existing[0].id));
    return existing[0];
  }

  await db.insert(roomMembers).values({
    chatRoomId,
    userId,
    isAdmin: Boolean(opts?.isAdmin),
    status: "approved",
    joinedAt: now,
  });
}

/**
 * Phase 1 backfill (data-preserving):
 * - Keep all existing chatRoomParticipants
 * - Add missing participants discovered from message senders / task parties in each room
 * - Mirror everyone into roomMembers as approved
 * Never deletes users/messages/tasks.
 */
export async function backfillRoomMembershipPhase1(): Promise<{
  rooms: number;
  participantsAdded: number;
  membersMirrored: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rooms = await db.select({ id: chatRooms.id, createdBy: chatRooms.createdBy }).from(chatRooms);
  let participantsAdded = 0;
  let membersMirrored = 0;

  for (const room of rooms as Array<{ id: number; createdBy: number }>) {
    const roomId = room.id;
    const userIds = new Set<number>();

    if (room.createdBy) userIds.add(room.createdBy);

    const parts = await db
      .select({ userId: chatRoomParticipants.userId })
      .from(chatRoomParticipants)
      .where(eq(chatRoomParticipants.chatRoomId, roomId));
    for (const p of parts as Array<{ userId: number }>) userIds.add(p.userId);

    const senders = await db
      .select({ senderId: messages.senderId })
      .from(messages)
      .where(eq(messages.chatRoomId, roomId));
    for (const s of senders as Array<{ senderId: number }>) {
      if (s.senderId) userIds.add(s.senderId);
    }

    const roomTasks = await db
      .select({
        creatorId: tasks.creatorId,
        assignedToId: tasks.assignedToId,
      })
      .from(tasks)
      .where(eq(tasks.chatRoomId, roomId));
    for (const t of roomTasks as Array<{ creatorId: number; assignedToId: number | null }>) {
      if (t.creatorId) userIds.add(t.creatorId);
      if (t.assignedToId) userIds.add(t.assignedToId);
    }

    // Validate users exist
    for (const uid of Array.from(userIds)) {
      const u = await getUserById(uid);
      if (!u) {
        userIds.delete(uid);
        continue;
      }
      const before = await db
        .select({ id: chatRoomParticipants.id })
        .from(chatRoomParticipants)
        .where(
          and(eq(chatRoomParticipants.chatRoomId, roomId), eq(chatRoomParticipants.userId, uid))
        )
        .limit(1);
      await ensureRoomMembership(roomId, uid, {
        isAdmin: u.role === "admin" || uid === room.createdBy,
      });
      if (!before[0]) participantsAdded += 1;
      membersMirrored += 1;
    }
  }

  return { rooms: rooms.length, participantsAdded, membersMirrored };
}

export async function deleteChatRoom(chatRoomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete all messages in the room first
  await db.delete(messages).where(eq(messages.chatRoomId, chatRoomId));
  
  // Delete all participants in the room
  await db.delete(chatRoomParticipants).where(eq(chatRoomParticipants.chatRoomId, chatRoomId));

  // Membership / invites (phase 0/1 tables)
  try {
    await db.delete(roomMembers).where(eq(roomMembers.chatRoomId, chatRoomId));
  } catch {
    // table might not exist on very old deploys
  }
  
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
  const page = await getMessagesPage({ chatRoomId, limit: limitValue });
  // Legacy shape: newest-first (previous behaviour).
  return [...page.items].reverse();
}

export type MessagesPage = {
  /** Chronological order (oldest → newest) for the requested page. */
  items: Array<typeof messages.$inferSelect>;
  hasMore: boolean;
  /** Oldest message id in this page (use as beforeId to load older). */
  nextBeforeId: number | null;
  nextBeforeCreatedAt: Date | null;
};

/**
 * Cursor pagination for chat history.
 * - Default: latest `limit` messages
 * - beforeId+beforeCreatedAt: older page (infinite scroll up)
 * - afterId+afterCreatedAt: newer messages only (polling)
 */
export async function getMessagesPage(params: {
  chatRoomId: number;
  limit?: number;
  beforeId?: number;
  beforeCreatedAt?: Date;
  afterId?: number;
  afterCreatedAt?: Date;
}): Promise<MessagesPage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const roomClause = eq(messages.chatRoomId, params.chatRoomId);

  // Polling path: only messages newer than cursor
  if (params.afterId != null && params.afterCreatedAt) {
    const afterAt = params.afterCreatedAt;
    const afterId = params.afterId;
    const rows = await db
      .select()
      .from(messages)
      .where(
        and(
          roomClause,
          or(
            gt(messages.createdAt, afterAt),
            and(eq(messages.createdAt, afterAt), gt(messages.id, afterId))
          )
        )
      )
      .orderBy(asc(messages.createdAt), asc(messages.id))
      .limit(limit);

    return {
      items: rows,
      hasMore: false,
      nextBeforeId: rows[0]?.id ?? null,
      nextBeforeCreatedAt: rows[0]?.createdAt ?? null,
    };
  }

  // Initial or older page: fetch newest-first then reverse to chronological
  const filters: any[] = [roomClause];
  if (params.beforeId != null && params.beforeCreatedAt) {
    const beforeAt = params.beforeCreatedAt;
    const beforeId = params.beforeId;
    filters.push(
      or(
        lt(messages.createdAt, beforeAt),
        and(eq(messages.createdAt, beforeAt), lt(messages.id, beforeId))
      )
    );
  }

  const rowsDesc = await db
    .select()
    .from(messages)
    .where(and(...filters))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit + 1);

  const hasMore = rowsDesc.length > limit;
  const pageDesc = hasMore ? rowsDesc.slice(0, limit) : rowsDesc;
  const items = [...pageDesc].reverse();
  const oldest = items[0];

  return {
    items,
    hasMore,
    nextBeforeId: oldest?.id ?? null,
    nextBeforeCreatedAt: oldest?.createdAt ?? null,
  };
}

export const THUMBS_UP = "thumbsup" as const;

export type MessageReactionSummary = {
  messageId: number;
  count: number;
  reactedByMe: boolean;
  /** Display names of people who reacted (capped). */
  users: string[];
};

/** Batch reaction summaries for a list of message ids (thumbsup only for now). */
export async function getThumbsUpSummaries(
  messageIds: number[],
  viewerUserId?: number | null
): Promise<Map<number, MessageReactionSummary>> {
  const map = new Map<number, MessageReactionSummary>();
  if (!messageIds.length) return map;

  const db = await getDb();
  if (!db) return map;

  const rows = await db
    .select({
      messageId: messageReactions.messageId,
      userId: messageReactions.userId,
      displayName: users.displayName,
      name: users.name,
    })
    .from(messageReactions)
    .leftJoin(users, eq(users.id, messageReactions.userId))
    .where(
      and(
        eq(messageReactions.emoji, THUMBS_UP),
        inArray(messageReactions.messageId, messageIds)
      )
    );

  for (const id of messageIds) {
    map.set(id, { messageId: id, count: 0, reactedByMe: false, users: [] });
  }

  for (const row of rows as Array<{
    messageId: number;
    userId: number;
    displayName: string | null;
    name: string | null;
  }>) {
    const entry = map.get(row.messageId);
    if (!entry) continue;
    entry.count += 1;
    if (viewerUserId && row.userId === viewerUserId) entry.reactedByMe = true;
    const label =
      (row.displayName && row.displayName.trim()) ||
      (row.name && String(row.name).trim()) ||
      `User ${row.userId}`;
    if (entry.users.length < 12) entry.users.push(label);
  }

  return map;
}

/** Toggle joinha (thumbsup). Returns current summary for that message. */
export async function toggleThumbsUp(messageId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Ensure message exists
  const existingMsg = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  if (!existingMsg[0]) throw new Error("Mensagem não encontrada");

  const existing = await db
    .select()
    .from(messageReactions)
    .where(
      and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, THUMBS_UP)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .delete(messageReactions)
      .where(eq(messageReactions.id, existing[0].id));
  } else {
    try {
      await db.insert(messageReactions).values({
        messageId,
        userId,
        emoji: THUMBS_UP,
      });
    } catch (error: any) {
      // Unique race: treat as already reacted
      const msg = String(error?.message || error);
      if (!msg.includes("Duplicate") && error?.code !== "ER_DUP_ENTRY") throw error;
    }
  }

  const summaries = await getThumbsUpSummaries([messageId], userId);
  return (
    summaries.get(messageId) || {
      messageId,
      count: 0,
      reactedByMe: false,
      users: [] as string[],
    }
  );
}

/** Reactions for a whole room page (used by client after loading messages). */
export async function listThumbsUpForRoom(params: {
  chatRoomId: number;
  messageIds?: number[];
  viewerUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let ids = params.messageIds?.filter((n) => Number.isFinite(n)) || [];
  if (!ids.length) {
    // fallback: latest 100 message ids in room
    const rows = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.chatRoomId, params.chatRoomId))
      .orderBy(desc(messages.createdAt))
      .limit(200);
    ids = rows.map((r: { id: number }) => r.id);
  }
  const map = await getThumbsUpSummaries(ids, params.viewerUserId);
  return Array.from(map.values()).filter((s) => s.count > 0 || s.reactedByMe);
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

  const now = new Date();
  const isCompleted = status === "completed";
  return await db
    .update(tasks)
    .set({
      status: status as any,
      updatedAt: now,
      // Only stamp completion time when completing; clear if reopened.
      completedAt: isCompleted ? now : null,
    })
    .where(eq(tasks.id, taskId));
}

export async function updateTaskStatusAndResponse(taskId: number, status: string, responseMessageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const isCompleted = status === "completed";
  return await db
    .update(tasks)
    .set({
      status: status as any,
      lastResponseMessageId: responseMessageId,
      updatedAt: now,
      completedAt: isCompleted ? now : null,
    })
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
  
  // Remove membership only — never delete the user row or message/task history
  await db
    .delete(chatRoomParticipants)
    .where(and(eq(chatRoomParticipants.chatRoomId, chatRoomId), eq(chatRoomParticipants.userId, userId)));

  try {
    await db
      .delete(roomMembers)
      .where(and(eq(roomMembers.chatRoomId, chatRoomId), eq(roomMembers.userId, userId)));
  } catch {
    // ignore if table missing
  }

  return { success: true as const, chatRoomId, userId };
}

// ——— Phase 2: room invite links ——————————————————————————————

function makeInviteToken(): string {
  return randomBytes(24).toString("base64url"); // URL-safe, ~32 chars
}

export async function createRoomInvite(params: {
  chatRoomId: number;
  createdBy: number;
  expiresInDays?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const room = (
    await db.select().from(chatRooms).where(eq(chatRooms.id, params.chatRoomId)).limit(1)
  )[0];
  if (!room) throw new Error("Sala não encontrada");

  const token = makeInviteToken();
  let expiresAt: Date | null = null;
  if (params.expiresInDays != null && params.expiresInDays > 0) {
    expiresAt = new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000);
  }

  await db.insert(roomInvites).values({
    chatRoomId: params.chatRoomId,
    inviteToken: token,
    createdBy: params.createdBy,
    expiresAt: expiresAt,
  });

  return {
    token,
    chatRoomId: params.chatRoomId,
    roomName: room.name as string,
    expiresAt,
    path: `/convite/${token}`,
  };
}

export async function listRoomInvites(chatRoomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      id: roomInvites.id,
      chatRoomId: roomInvites.chatRoomId,
      inviteToken: roomInvites.inviteToken,
      createdBy: roomInvites.createdBy,
      createdAt: roomInvites.createdAt,
      expiresAt: roomInvites.expiresAt,
      creatorName: users.displayName,
    })
    .from(roomInvites)
    .leftJoin(users, eq(users.id, roomInvites.createdBy))
    .where(eq(roomInvites.chatRoomId, chatRoomId))
    .orderBy(desc(roomInvites.createdAt));

  const now = Date.now();
  return rows.map((r: any) => {
    const exp = r.expiresAt ? new Date(r.expiresAt).getTime() : null;
    const expired = exp != null && exp < now;
    return {
      id: r.id,
      chatRoomId: r.chatRoomId,
      token: r.inviteToken,
      createdBy: r.createdBy,
      creatorName: r.creatorName || null,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      expired,
      path: `/convite/${r.inviteToken}`,
    };
  });
}

export async function revokeRoomInvite(inviteId: number, chatRoomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(roomInvites)
    .where(and(eq(roomInvites.id, inviteId), eq(roomInvites.chatRoomId, chatRoomId)));
  return { success: true as const };
}

export async function getInvitePreview(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      id: roomInvites.id,
      chatRoomId: roomInvites.chatRoomId,
      inviteToken: roomInvites.inviteToken,
      expiresAt: roomInvites.expiresAt,
      createdAt: roomInvites.createdAt,
      roomName: chatRooms.name,
      roomDescription: chatRooms.description,
    })
    .from(roomInvites)
    .innerJoin(chatRooms, eq(chatRooms.id, roomInvites.chatRoomId))
    .where(eq(roomInvites.inviteToken, token))
    .limit(1);

  const invite = rows[0];
  if (!invite) return null;

  const exp = invite.expiresAt ? new Date(invite.expiresAt).getTime() : null;
  const expired = exp != null && exp < Date.now();
  return {
    token: invite.inviteToken,
    chatRoomId: invite.chatRoomId,
    roomName: invite.roomName,
    roomDescription: invite.roomDescription,
    expiresAt: invite.expiresAt,
    expired,
    valid: !expired,
  };
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return undefined;
  const result = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return result[0];
}

/**
 * Create a brand-new local user for invite acceptance.
 * Never overwrites existing historical users.
 */
export async function createInvitedUser(params: {
  displayName: string;
  email?: string | null;
}): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const displayName = params.displayName.trim();
  if (!displayName) throw new Error("Nome é obrigatório");

  const email = params.email?.trim().toLowerCase() || null;
  if (!email) {
    throw new Error("E-mail é obrigatório para cadastro na plataforma");
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    // Keep historical id; refresh display name if blank, never wipe other fields
    if (!existing.displayName || existing.displayName.trim() === "") {
      await db
        .update(users)
        .set({ displayName, updatedAt: new Date() })
        .where(eq(users.id, existing.id));
      const refreshed = await getUserById(existing.id);
      if (refreshed) return refreshed;
    }
    return existing;
  }

  const openId = `invite-${randomBytes(16).toString("hex")}`;
  const now = new Date();
  const result = await db.insert(users).values({
    openId,
    name: displayName,
    displayName,
    email: email,
    loginMethod: "invite",
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  } as any);

  const insertId = Number((result as any)?.[0]?.insertId ?? (result as any)?.insertId ?? 0);
  if (!insertId) {
    const byOpen = await getUserByOpenId(openId);
    if (!byOpen) throw new Error("Falha ao criar usuário convidado");
    return byOpen;
  }
  const created = await getUserById(insertId);
  if (!created) throw new Error("Falha ao carregar usuário convidado");
  return created;
}

/**
 * Accept invite: attach existing or brand-new user to the room and return membership result.
 * Does not delete/alter unrelated rooms or history.
 */
export async function acceptRoomInvite(params: {
  token: string;
  displayName: string;
  email?: string | null;
  existingUserId?: number | null;
}): Promise<{ user: User; chatRoomId: number; roomName: string; alreadyMember: boolean }> {
  const preview = await getInvitePreview(params.token);
  if (!preview) throw new Error("Convite inválido ou expirado");
  if (!preview.valid) throw new Error("Este convite expirou");

  let user: User | undefined;
  if (params.existingUserId) {
    user = await getUserById(params.existingUserId);
  }
  if (!user) {
    user = await createInvitedUser({
      displayName: params.displayName,
      email: params.email,
    });
  }

  const already = await isRoomMember(preview.chatRoomId, user.id, { isGlobalAdmin: false });
  if (!already) {
    await ensureRoomMembership(preview.chatRoomId, user.id);
  }

  await touchUserLastSignedIn(user.id);

  return {
    user,
    chatRoomId: preview.chatRoomId,
    roomName: preview.roomName,
    alreadyMember: already,
  };
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
