# Phase 4 upgrade — what changed & how to run it (final phase)

Builds on Phases 1–3. This is the last batch of the 45-feature plan:

1. Global search (Ctrl+K command palette)
2. Calendar view for tasks/deadlines
3. Task file attachments (separate from chat)
4. Activity/audit log
5. Client portal (read-only, no-login project status page)
6. Notification preferences per user
7. Keyboard shortcuts (Ctrl+K)
8. CSV export

## 1. Getting it running

```bash
# Server
cd server
npm install
npx prisma migrate deploy    # applies the final migration (attachments, audit log, portal, notif prefs)
npm run dev

# Client
cd client
npm install
npm run dev
```

No new npm packages this round.

## 2. Global search & keyboard shortcuts

Press **Ctrl+K** (or **Cmd+K** on Mac) anywhere in the app, or click the
"🔍 Search…" box at the top of the sidebar. Type to search people, projects,
tasks, and clients simultaneously, or just start typing a page name
("dashboard", "chat", "calendar"...) to jump straight there. Esc closes it.
Search results are filtered server-side by what your role can actually see
— e.g. someone without `clients.view` never gets client results back.

New endpoint: `GET /api/search?q=`.

## 3. Calendar view

New "Calendar" nav item. Month grid showing every task with a due date that
month, color-coded by priority. Click a day to see the full list of tasks
due then, each linking back to its project board.

New endpoint: `GET /api/tasks/calendar?start=&end=` (ISO dates; defaults to
the current month).

## 4. Task file attachments

Open any task's detail panel on a project board — there's now an
"Attachments" section separate from the comments, with a "+ Add file"
button. Anyone who can view the task can download attachments; only the
uploader or someone with `tasks.manage` can delete one.

New endpoints: `GET/POST /api/tasks/:id/attachments`,
`DELETE /api/tasks/:id/attachments/:attachmentId`. Files land in
`server/uploads/tasks/`, served at `/uploads/tasks/...` (same pattern as
chat/avatar uploads).

## 5. Activity / audit log

New "Activity Log" nav item (visible to anyone with `users.manage`,
`projects.manage`, or `clients.manage`). Shows a chronological feed of who
did what — created/updated/deleted projects, tasks, clients, and team
members — filterable by entity type. This isn't instrumented on *every*
possible write (that would be noise); it covers the actions that matter
for an audit trail. If you want additional actions logged, call
`logActivity()` from `server/src/utils/activityLog.js` at the relevant
controller point — it's a two-line addition per call site.

New endpoint: `GET /api/activity-log?entityType=&entityId=&limit=`.

## 6. Client portal

On any project board (if you have `projects.manage`), click "🔗 Client
Portal" to generate a shareable link. Anyone with that link can view a
read-only status page — no login required — showing progress %, status,
timeline, and task titles by column. It deliberately does **not** show
assignees, comments, internal notes, or any other clients' data. Disable
the link any time from the same panel; disabling doesn't delete the token,
so re-enabling restores the same URL.

New endpoint (unauthenticated): `GET /api/portal/:token`. Management
endpoints: `POST /api/projects/:id/portal-link` (generate/rotate),
`DELETE /api/projects/:id/portal-link` (disable). Public page at
`/portal/:token` in the client, outside the normal login-gated layout.

## 7. Notification preferences

On your own profile page, a new "Notification Preferences" card lets you
toggle off specific notification types (task assigned, mentions, comments,
overdue reminders, chat messages, complaint updates) without affecting
anyone else's settings. A type with no preference saved yet defaults to on,
so nobody's notifications silently changed when this shipped.

New endpoint: `PUT /api/users/:id/notification-preferences` (self only).
`notify()` in `server/src/utils/notify.js` now checks this before creating
any notification.

## 8. CSV export

"⬇ Export CSV" buttons on the Team Members page (exports the currently
filtered list) and the Dashboard's Performance Leaderboard. Pure client-side
CSV generation from data already loaded — no server round-trip.

## Known limitations

- As with every prior phase, I couldn't run the migration against a live
  Postgres instance in this environment — run `npx prisma migrate deploy`
  and test against your real database before deploying.
- The activity log covers create/update/delete on Users, Projects, Tasks,
  and Clients — not chat, attendance, or complaints. Extending it further is
  a small, mechanical addition per controller if you want full coverage.
- The client portal link is a bearer token in the URL (like most "share
  link" features) — anyone who has the link can view it. Disable/rotate it
  if a link is shared somewhere you didn't intend.

## Wrapping up — the full 45-feature build

All four phases are complete:

- **Phase 1**: Employee delete, dark theme, chat file sharing + groups, full analytics dashboard
- **Phase 2**: Full employee CRUD, profile/performance pages, daily work updates, visual permission matrix, search & filter, bulk actions
- **Phase 3**: Chat read receipts/typing/search/pin/reactions, toast notifications, loading skeletons, responsive layout
- **Phase 4**: Global search/command palette, calendar, task attachments, activity log, client portal, notification preferences, keyboard shortcuts, CSV export

Every phase's zip included its own notes file — this one supersedes them
only in scope, not content; keep all four `PHASE*_NOTES.md` files if you
want the full history of what was added and why.

If you want to keep going past the original 45 — code-splitting the client
bundle (it's grown to ~830KB, a `manualChunks` config would help), full
audit coverage, or real-time chat via websockets instead of polling — just
ask.
