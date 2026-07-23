/**
 * Phase 0 — read-only backup of critical TiDB tables.
 * Writes JSON under ./backups/ (gitignored). DOES NOT modify the database.
 */
import mysql from "mysql2/promise";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  try {
    const text = readFileSync(resolve(root, ".env.local"), "utf8");
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

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

async function main() {
  loadEnvLocal();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

  const outDir = resolve(root, "backups");
  mkdirSync(outDir, { recursive: true });
  const tag = stamp();
  const outPath = resolve(outDir, `phase0-backup-${tag}.json`);

  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    connectionLimit: 1,
  });
  const conn = await pool.getConnection();

  try {
    const tables = [
      "users",
      "chatRooms",
      "chatRoomParticipants",
      "messages",
      "tasks",
      "messageReactions",
      "roomInvites",
      "roomMembers",
    ];

    const payload = {
      meta: {
        phase: 0,
        purpose: "pre-membership safety checkpoint",
        exportedAt: new Date().toISOString(),
        note: "Read-only snapshot. No deletes. Restore would be manual/controlled.",
      },
      counts: {},
      tables: {},
    };

    for (const table of tables) {
      try {
        const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
        payload.tables[table] = rows;
        payload.counts[table] = rows.length;
        console.log(`[backup] ${table}: ${rows.length} rows`);
      } catch (error) {
        const msg = String(error?.message || error);
        payload.tables[table] = null;
        payload.counts[table] = null;
        payload.meta[`missing_${table}`] = msg.slice(0, 200);
        console.warn(`[backup] ${table}: SKIPPED (${msg.slice(0, 120)})`);
      }
    }

    // Lightweight integrity fingerprints (no secrets in log)
    const json = JSON.stringify(payload);
    const hash = createHash("sha256").update(json).digest("hex");
    payload.meta.sha256 = hash;
    // re-stringify with hash
    const finalJson = JSON.stringify(payload, null, 2);
    writeFileSync(outPath, finalJson, { mode: 0o600 });

    // summary beside it (no row payloads)
    const summaryPath = resolve(outDir, `phase0-backup-${tag}.summary.json`);
    writeFileSync(
      summaryPath,
      JSON.stringify(
        {
          exportedAt: payload.meta.exportedAt,
          counts: payload.counts,
          sha256: hash,
          file: outPath,
        },
        null,
        2
      ),
      { mode: 0o600 }
    );

    console.log("\n=== PHASE 0 BACKUP OK ===");
    console.log({ outPath, summaryPath, counts: payload.counts, sha256: hash });
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
