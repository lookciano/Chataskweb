import type { Connection } from "mysql2/promise";

/**
 * Idempotent schema ensure for production deploys.
 * NEVER drops/truncates data — only ADD COLUMN / CREATE TABLE IF NOT EXISTS.
 * Preserves existing users, tasks, messages and responsible names.
 */
export async function ensureProductionSchema(connection: Connection): Promise<void> {
  console.log("[SchemaBootstrap] Ensuring required columns/tables exist...");

  const statements = [
    // users.displayName used by chat identity and task ownership UI
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS displayName VARCHAR(255) NULL`,
    // Snapshot of sender display name at message time (fixes multi-user bubbles)
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS senderName VARCHAR(255) NULL`,
    // Task responsibility fields already relied on by the app
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignedToName VARCHAR(255) NULL`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS taskNumber INT NULL`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lastResponseMessageId INT NULL`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completedAt TIMESTAMP NULL`,
    // Reply threading
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS replyToId INT NULL`,
    // Room invite password (optional legacy)
    `ALTER TABLE chatRooms ADD COLUMN IF NOT EXISTS invitePassword VARCHAR(255) NULL`,
    // Thumbs-up / joinha reactions (new table — no impact on existing rows)
    `CREATE TABLE IF NOT EXISTS messageReactions (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      messageId INT NOT NULL,
      userId INT NOT NULL,
      emoji VARCHAR(32) NOT NULL DEFAULT 'thumbsup',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_message_user_emoji (messageId, userId, emoji),
      KEY idx_messageReactions_messageId (messageId)
    )`,
  ];

  for (const sql of statements) {
    try {
      await connection.execute(sql);
    } catch (error: any) {
      const msg = String(error?.message || error);
      // TiDB/MySQL variants without IF NOT EXISTS for columns
      if (
        msg.includes("Duplicate column") ||
        msg.includes("already exists") ||
        error?.code === "ER_DUP_FIELDNAME" ||
        error?.errno === 1060
      ) {
        continue;
      }
      // Fallback: try without IF NOT EXISTS
      if (sql.includes("ADD COLUMN IF NOT EXISTS")) {
        const fallback = sql.replace("ADD COLUMN IF NOT EXISTS", "ADD COLUMN");
        try {
          await connection.execute(fallback);
        } catch (fallbackError: any) {
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

  // Backfill senderName from users when missing (preserve authorship without changing IDs)
  try {
    await connection.execute(`
      UPDATE messages m
      INNER JOIN users u ON u.id = m.senderId
      SET m.senderName = COALESCE(NULLIF(u.displayName, ''), NULLIF(u.name, ''), CONCAT('User ', u.id))
      WHERE m.senderName IS NULL OR m.senderName = ''
    `);
  } catch (error) {
    console.warn("[SchemaBootstrap] senderName backfill skipped:", error);
  }

  // Keep displayName filled from name when empty (same people, stable labels)
  try {
    await connection.execute(`
      UPDATE users
      SET displayName = name
      WHERE (displayName IS NULL OR displayName = '')
        AND name IS NOT NULL
        AND name != ''
    `);
  } catch (error) {
    console.warn("[SchemaBootstrap] displayName backfill skipped:", error);
  }

  // Link tasks.assignedToId from assignedToName when possible (no rename/overwrite of names)
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
    console.warn("[SchemaBootstrap] assignedToId backfill skipped:", error);
  }

  // Historical completed tasks: approximate completion time with updatedAt once.
  try {
    await connection.execute(`
      UPDATE tasks
      SET completedAt = updatedAt
      WHERE status = 'completed'
        AND completedAt IS NULL
        AND updatedAt IS NOT NULL
    `);
  } catch (error) {
    console.warn("[SchemaBootstrap] completedAt backfill skipped:", error);
  }

  console.log("[SchemaBootstrap] Done (data-preserving).");
}
