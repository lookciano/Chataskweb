import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Inline ensureProductionSchema (JS) so we don't depend on tsx/TS path.
async function ensureProductionSchema(connection) {
  console.log("[SchemaBootstrap] Ensuring required columns/tables exist...");

  const statements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS displayName VARCHAR(255) NULL`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS senderName VARCHAR(255) NULL`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignedToName VARCHAR(255) NULL`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS taskNumber INT NULL`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lastResponseMessageId INT NULL`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completedAt TIMESTAMP NULL`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS replyToId INT NULL`,
    `ALTER TABLE chatRooms ADD COLUMN IF NOT EXISTS invitePassword VARCHAR(255) NULL`,
    `CREATE TABLE IF NOT EXISTS messageReactions (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      messageId INT NOT NULL,
      userId INT NOT NULL,
      emoji VARCHAR(32) NOT NULL DEFAULT 'thumbsup',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_message_user_emoji (messageId, userId, emoji),
      KEY idx_messageReactions_messageId (messageId)
    )`,
    `CREATE TABLE IF NOT EXISTS roomInvites (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      chatRoomId INT NOT NULL,
      inviteToken VARCHAR(64) NOT NULL,
      createdBy INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expiresAt TIMESTAMP NULL,
      UNIQUE KEY uq_roomInvites_token (inviteToken),
      KEY idx_roomInvites_chatRoomId (chatRoomId)
    )`,
    `CREATE TABLE IF NOT EXISTS roomMembers (
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
    )`,
    `CREATE TABLE IF NOT EXISTS roomReadState (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      chatRoomId INT NOT NULL,
      userId INT NOT NULL,
      lastReadMessageId INT NOT NULL DEFAULT 0,
      lastReadAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_roomReadState_room_user (chatRoomId, userId),
      KEY idx_roomReadState_userId (userId)
    )`,
  ];

  for (const sql of statements) {
    try {
      await connection.execute(sql);
    } catch (error) {
      const msg = String(error?.message || error);
      if (
        msg.includes("Duplicate column") ||
        msg.includes("already exists") ||
        error?.code === "ER_DUP_FIELDNAME" ||
        error?.errno === 1060
      ) {
        continue;
      }
      if (sql.includes("ADD COLUMN IF NOT EXISTS")) {
        const fallback = sql.replace("ADD COLUMN IF NOT EXISTS", "ADD COLUMN");
        try {
          await connection.execute(fallback);
        } catch (fallbackError) {
          const fmsg = String(fallbackError?.message || fallbackError);
          if (
            fmsg.includes("Duplicate column") ||
            fmsg.includes("already exists") ||
            fallbackError?.code === "ER_DUP_FIELDNAME" ||
            fallbackError?.errno === 1060
          ) {
            continue;
          }
          console.warn("[SchemaBootstrap] Warning:", fmsg);
        }
        continue;
      }
      console.warn("[SchemaBootstrap] Warning:", msg);
    }
  }

  try {
    await connection.execute(`
      UPDATE messages m
      INNER JOIN users u ON u.id = m.senderId
      SET m.senderName = COALESCE(NULLIF(u.displayName, ''), NULLIF(u.name, ''), CONCAT('User ', u.id))
      WHERE m.senderName IS NULL OR m.senderName = ''
    `);
  } catch (error) {
    console.warn("[SchemaBootstrap] senderName backfill skipped:", error.message || error);
  }

  try {
    await connection.execute(`
      UPDATE users
      SET displayName = name
      WHERE (displayName IS NULL OR displayName = '')
        AND name IS NOT NULL
        AND name != ''
    `);
  } catch (error) {
    console.warn("[SchemaBootstrap] displayName backfill skipped:", error.message || error);
  }

  try {
    await connection.execute(`
      UPDATE tasks t
      INNER JOIN users u ON (
        u.displayName = t.assignedToName
        OR u.name = t.assignedToName
      )
      SET t.assignedToId = u.id
      WHERE t.assignedToName IS NOT NULL
        AND t.assignedToName != ''
        AND (t.assignedToId IS NULL OR t.assignedToId = 0)
    `);
  } catch (error) {
    console.warn("[SchemaBootstrap] assignedToId backfill skipped:", error.message || error);
  }

  try {
    await connection.execute(`
      UPDATE tasks
      SET completedAt = updatedAt
      WHERE status = 'completed'
        AND completedAt IS NULL
        AND updatedAt IS NOT NULL
    `);
  } catch (error) {
    console.warn("[SchemaBootstrap] completedAt backfill skipped:", error.message || error);
  }

  console.log("[SchemaBootstrap] Done (data-preserving).");
}

function loadEnvLocal() {
  const envPath = resolve(__dirname, "../.env.local");
  try {
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx);
      const value = trimmed.slice(idx + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const pool = mysql.createPool({
    uri: url,
    ssl: { rejectUnauthorized: true },
    connectionLimit: 2,
  });
  const conn = await pool.getConnection();
  try {
    await ensureProductionSchema(conn);
    const [senderNull] = await conn.query(
      "SELECT COUNT(*) c FROM messages WHERE senderName IS NULL OR senderName = ''"
    );
    const [users] = await conn.query("SELECT COUNT(*) c FROM users");
    const [tasks] = await conn.query("SELECT COUNT(*) c FROM tasks");
    const [messages] = await conn.query("SELECT COUNT(*) c FROM messages");
    const [withSender] = await conn.query(
      "SELECT COUNT(*) c FROM messages WHERE senderName IS NOT NULL AND senderName != ''"
    );
    console.log({
      users: users[0].c,
      tasks: tasks[0].c,
      messages: messages[0].c,
      messagesWithSenderName: withSender[0].c,
      senderNullLeft: senderNull[0].c,
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
