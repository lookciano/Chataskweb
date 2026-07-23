# Phase 2 — Invite links for new people

## Goal
Let admins/creators invite **new people** into a **single room** via link, without giving access to every room. Preserve all existing users, messages and tasks.

## How it works
1. Admin/creator opens **Participantes** → **Gerar link**
2. Link shape: `https://chataskweb.onrender.com/convite/<token>` (expires in 14 days by default)
3. Guest opens the link → informs name (email optional) → is created as a local user (`loginMethod=invite`) and added **only** to that room
4. Session cookie is set; they land on the chat seeing only authorized rooms
5. Admin can **Copiar** or **Revogar** active invites

## Safety
- No DROP/TRUNCATE of historical data
- Does not auto-join other rooms
- Existing users accepting a link with an already-used e-mail are **reused** (same id), not duplicated
- Removing a participant still does **not** delete the user account

## API
- `chat.createInvite` / `chat.listInvites` / `chat.revokeInvite` (manage)
- `chat.invitePreview` / `chat.acceptInvite` (public accept flow)

## Notes
- Phase 1 membership guards remain in force
- Identity picker lists approved room members (so invitees appear after join)
