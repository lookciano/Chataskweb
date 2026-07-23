# Phase 1 — Room membership isolation

## Goal
Only authorized people see/use each room. Preserve all existing users, messages, tasks.

## What changed
1. **Backfill** (`pnpm db:phase1-backfill`):
   - Keeps existing `chatRoomParticipants`
   - Adds missing participants seen as message senders / task creators / assignees
   - Mirrors everyone into `roomMembers` with `status=approved`
2. **API guards**:
   - `chat.rooms` → only rooms where user is member (admin sees all)
   - messages / tasks / participants require membership
   - **No auto-join** on message send
3. **Admin / creator UI**:
   - Participants modal: **Add** existing user, **Remove** from room
   - Remove does **not** delete the user account or history

## Commands
```bash
pnpm db:phase0-backup   # optional extra snapshot
pnpm db:phase1-backfill  # safe, idempotent
```

## Phase 2 (later)
Invite links for brand-new external users.
