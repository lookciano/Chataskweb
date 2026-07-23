# Phase 0 — Safety checkpoint (membership prep)

## Goal
Prepare for room membership / invites **without changing app behavior** and **without losing data**.

## What Phase 0 does
1. Local **read-only backup** of critical tables → `backups/` (gitignored)
2. **Additive schema only**: `CREATE TABLE IF NOT EXISTS` for:
   - `roomInvites`
   - `roomMembers`
3. Idempotent bootstrap (same rules as production startup)
4. Verify row counts of existing tables stay stable

## What Phase 0 does **NOT** do
- No DROP / TRUNCATE / DELETE of users, messages, tasks, rooms
- No backfill of `roomMembers` yet (that is Phase 1)
- No API filter by membership yet
- No UI invite flow yet
- App behavior remains: everyone still sees all rooms until Phase 1

## Commands
```bash
# 1) Backup (safe, read-only)
pnpm db:phase0-backup

# 2) Ensure tables/columns (additive)
pnpm db:bootstrap
```

## Restore note
Restore is **manual** from `backups/phase0-backup-*.json` if ever needed.
Do not auto-import into production without review.

## Next: Phase 1
- Backfill `roomMembers` / ensure `chatRoomParticipants` for Grande Sertão
- Filter `chat.rooms` + lock messages/tasks APIs to members
- Admin add/remove participant UI
