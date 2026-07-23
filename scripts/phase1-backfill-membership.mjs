/**
 * Phase 1 — data-preserving membership backfill.
 * Mirrors chatRoomParticipants + historic senders/assignees into roomMembers(approved).
 * Never deletes users/messages/tasks.
 */
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  try {
    const text = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx);
      let value = trimmed.slice(idx + 1);
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

async function ensureParticipant(conn, chatRoomId, userId) {
  const [rows] = await conn.query(
    `SELECT id FROM chatRoomParticipants WHERE chatRoomId = ? AND userId = ? LIMIT 1`,
    [chatRoomId, userId]
  );
  if (rows.length) return false;
  await conn.query(
    `INSERT INTO chatRoomParticipants (chatRoomId, userId, joinedAt) VALUES (?, ?, NOW())`,
    [chatRoomId, userId]
  );
  return true;
}

async function ensureMember(conn, chatRoomId, userId, isAdmin) {
  const [rows] = await conn.query(
    `SELECT id, status, isAdmin FROM roomMembers WHERE chatRoomId = ? AND userId = ? LIMIT 1`,
    [chatRoomId, userId]
  );
  if (rows.length) {
    await conn.query(
      `UPDATE roomMembers
       SET status = 'approved',
           joinedAt = COALESCE(joinedAt, NOW()),
           isAdmin = CASE WHEN ? = 1 THEN 1 ELSE isAdmin END
       WHERE id = ?`,
      [isAdmin ? 1 : 0, rows[0].id]
    );
    return false;
  }
  await conn.query(
    `INSERT INTO roomMembers (chatRoomId, userId, isAdmin, status, joinedAt, createdAt)
     VALUES (?, ?, ?, 'approved', NOW(), NOW())`,
    [chatRoomId, userId, isAdmin ? 1 : 0]
  );
  return true;
}

async function main() {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    connectionLimit: 1,
  });
  const conn = await pool.getConnection();

  try {
    // Ensure tables exist (phase 0)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS roomMembers (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        chatRoomId INT NOT NULL,
        userId INT NOT NULL,
        isAdmin TINYINT(1) NOT NULL DEFAULT 0,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        joinedAt TIMESTAMP NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_roomMembers_room_user (chatRoomId, userId),
        KEY idx_roomMembers_userId (userId),
        KEY idx_roomMembers_chatRoomId (chatRoomId)
      )
    `);

    const [rooms] = await conn.query(`SELECT id, name, createdBy FROM chatRooms`);
    let participantsAdded = 0;
    let membersCreated = 0;
    let membersTouched = 0;

    for (const room of rooms) {
      const ids = new Set();
      if (room.createdBy) ids.add(Number(room.createdBy));

      const [parts] = await conn.query(
        `SELECT userId FROM chatRoomParticipants WHERE chatRoomId = ?`,
        [room.id]
      );
      for (const p of parts) ids.add(Number(p.userId));

      const [senders] = await conn.query(
        `SELECT DISTINCT senderId AS userId FROM messages WHERE chatRoomId = ? AND senderId IS NOT NULL`,
        [room.id]
      );
      for (const s of senders) ids.add(Number(s.userId));

      const [taskUsers] = await conn.query(
        `SELECT DISTINCT creatorId AS userId FROM tasks WHERE chatRoomId = ? AND creatorId IS NOT NULL
         UNION
         SELECT DISTINCT assignedToId AS userId FROM tasks WHERE chatRoomId = ? AND assignedToId IS NOT NULL`,
        [room.id, room.id]
      );
      for (const t of taskUsers) ids.add(Number(t.userId));

      console.log(`[phase1] room "${room.name}" (#${room.id}) candidates:`, [...ids]);

      for (const userId of ids) {
        if (!Number.isFinite(userId) || userId <= 0) continue;
        const [u] = await conn.query(`SELECT id, role FROM users WHERE id = ? LIMIT 1`, [userId]);
        if (!u.length) {
          console.warn(`[phase1] skip missing user ${userId}`);
          continue;
        }
        const isAdmin = u[0].role === "admin" || userId === Number(room.createdBy);
        if (await ensureParticipant(conn, room.id, userId)) participantsAdded += 1;
        if (await ensureMember(conn, room.id, userId, isAdmin)) membersCreated += 1;
        else membersTouched += 1;
      }
    }

    const [afterParts] = await conn.query(`SELECT COUNT(*) c FROM chatRoomParticipants`);
    const [afterMembers] = await conn.query(
      `SELECT COUNT(*) c FROM roomMembers WHERE status = 'approved'`
    );
    const [users] = await conn.query(`SELECT COUNT(*) c FROM users`);
    const [messages] = await conn.query(`SELECT COUNT(*) c FROM messages`);
    const [tasks] = await conn.query(`SELECT COUNT(*) c FROM tasks`);

    console.log("\n=== PHASE 1 BACKFILL OK ===");
    console.log({
      rooms: rooms.length,
      participantsAdded,
      membersCreated,
      membersTouched,
      chatRoomParticipants: afterParts[0].c,
      roomMembersApproved: afterMembers[0].c,
      users: users[0].c,
      messages: messages[0].c,
      tasks: tasks[0].c,
    });
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
