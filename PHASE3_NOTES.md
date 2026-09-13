# Phase 3 upgrade — what changed & how to run it

Builds on Phases 1–2. This batch covers:

1. Chat: read receipts, typing indicator, message search, pin messages, emoji reactions
2. UI polish: responsive layout, toast notifications, loading skeletons

## 1. Getting it running

```bash
# Server
cd server
npm install
npx prisma migrate deploy    # applies the new migration (pin fields + MessageReaction table)
npm run dev

# Client
cd client
npm install
npm run dev
```

No new npm packages this round — everything is built on what Phases 1–2
already installed.

## 2. Chat upgrades

- **Read receipts**: opening a conversation (and every 4s poll while it's
  open) marks it read for you. Your own last message shows "· Seen" once
  another participant has read past it.
- **Typing indicator**: as you type, a throttled signal (at most once every
  2s) tells the other participant(s) you're typing; it shows as "X is
  typing…" under the message list and clears automatically after ~5s of
  inactivity. This is in-memory on the server (not stored in the database)
  since it's inherently ephemeral — restarting the server just clears it.
- **Message search**: the 🔍 Search button in a conversation's header opens
  an in-thread search box. Results are clickable and scroll/highlight the
  matching message.
- **Pin messages**: hover a message to reveal a 📌 button. Pinned messages
  show a small badge inline and are listed under the header's 📌 count —
  click any pinned entry to jump to it.
- **Emoji reactions**: hover a message to reveal a 😊 button with a quick
  picker (👍❤️😂😮😢🙏). Reacting again with the same emoji removes it.
  Reaction chips appear under the message with counts.

New endpoints: `POST/GET .../conversations/:id/typing`,
`POST .../conversations/:id/read`, `GET .../conversations/:id/messages/search?q=`,
`GET .../conversations/:id/pinned`, `PUT .../messages/:id/pin`,
`POST .../messages/:id/reactions`. `GET .../conversations/:id/messages` now
returns `{ messages, readReceipts }` instead of a bare array — messages
include a grouped `reactions` array per message.

## 3. UI polish

- **Toast notifications**: replaced `alert()` popups everywhere (API errors,
  bulk-action results, delete confirmations) with non-blocking toasts in the
  bottom-right corner. Errors are red, confirmations green, info messages
  neutral. Built as a tiny pub-sub (`utils/toast.js`) so the axios
  interceptor can trigger them without needing to be inside a React
  component.
- **Loading skeletons**: the Team Members table and the Dashboard's stat
  cards/charts now show pulsing placeholder shapes while data loads,
  instead of a blank screen.
- **Responsive layout**: below the `md` breakpoint, the sidebar becomes an
  off-canvas drawer opened with a ☰ button in a new mobile top bar, and
  closes automatically on navigation or when tapping outside it. Above
  `md`, the layout is unchanged.

## Known limitations

- As with Phases 1–2, run `npx prisma migrate deploy` against your real
  database — no live Postgres was available to test against here.
- The typing indicator resets if the server restarts (by design — it's
  intentionally not persisted). If you run multiple server instances behind
  a load balancer, typing signals won't cross instances; a small Redis-
  backed store would fix that if you scale out later.
- Toasts are global (not per-page), which is standard behavior but worth
  knowing if you build a page that fires many rapid API calls — you may
  want to batch/suppress toasts there.

## What's next (Phase 4, on request)

- Global search across employees/projects/tasks/clients
- Calendar view for tasks/deadlines
- Task file attachments (separate from chat)
- Activity/audit log
- Client portal (read-only project status view)
- Notification preferences per user
- Keyboard shortcuts
- CSV data export

Just say the word and I'll continue with Phase 4 — the last batch of the 45.
