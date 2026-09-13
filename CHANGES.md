# What changed in this update

You already had most of the foundation (username/password login, roles &
permissions, task creator tracking) — it just wasn't fully wired up in the
UI. Here's what was added:

## 1. Admin adds team members with username/password
Already worked (`Users.jsx` → "+ Add Member"). Login uses the member's
**email as their username**. Left as-is, just clarified the label on the form.

## 2. See each member's completed vs pending tasks
- `server/src/controllers/user.controller.js` → `listUsers` now returns a
  `taskCounts: { total, completed, pending }` object per user.
- To make "completed" well-defined, `TaskStatus` (a board column) now has an
  `isDone` boolean. Any task sitting in a column marked "Done" counts as
  completed; everything else assigned to that person counts as pending.
- New projects seed with their "Done" column pre-marked. On any board, an
  Admin/Manager can toggle a column's Done flag with the ✓ button in the
  column header.
- `Users.jsx` → Team Members table now has a **Tasks** column showing
  "X completed · Y pending" per person.

## 3. Assign tasks with "assigned by whom" tracking
- `Task` now has `assignedById` + `assignedAt`, separate from `createdById`.
  Whoever sets/changes the assignee is recorded as the assigner, with a
  timestamp — so reassigning a task updates who's accountable for it.
- The Project Board's "+ Add task" was previously title-only even though the
  code had assignee/priority fields — there was no input for them. It's now
  a real mini-form: title, assignee dropdown, priority dropdown.
- Task cards on the board show the assignee and a small "Assigned by …" line.
- Clicking a task card opens a detail panel showing status, priority,
  created-by, assigned-by (+ when), the current assignee (reassignable from
  a dropdown if you have `tasks.assign`/`tasks.manage`), and comments.

## Applying this to your database
A new migration was added at
`server/prisma/migrations/20260831000000_task_assignment_tracking/`. Run:

```bash
cd server
npx prisma migrate deploy   # or `npx prisma migrate dev` in development
```

It adds the two new columns and backfills existing data (existing task
creators become the recorded assigner; any column literally named
"Done"/"Completed" gets `isDone = true`).

## Ideas for what's next
The original spec you shared covers a lot more (attendance/breaks, daily
work updates, client work-update timeline, notifications, workload %,
calendar, activity/audit log, client portal). This update focused on the
three things you specifically asked for. Happy to build out any of the rest
next — just say which piece.

## 4. Admin master dashboard
The home Dashboard now shows an "Organization Overview" section (visible to
anyone with `users.manage`, `projects.manage`, or `clients.manage` — Admin
and Manager roles by default) above the personal "My Tasks"/"Attendance"
widgets:

- Org-wide stat cards: total/active team members, clients, projects
  (total/active), tasks (total/completed/overdue).
- A **Team Workload** table listing every member with their role, project
  count, and completed/pending/overdue task counts at a glance.
- A **"+ Add Team Member"** button right there on the dashboard — expands an
  inline form (name, email/username, password, role) so you don't have to
  navigate to the Team & Roles page just to add someone.

New backend endpoint: `GET /api/dashboard/overview`
(`server/src/controllers/dashboard.controller.js` /
`server/src/routes/dashboard.routes.js`). No new migration needed — it only
reads existing data.

## 5. Notifications
- New `Notification` model + `GET/PUT /api/notifications`.
- Triggers automatically on: a task being assigned/reassigned to you,
  someone `@FirstName` mentioning you in a task comment, someone commenting
  on a task you're assigned to, a task going overdue (checked lazily when
  you open notifications — no cron job needed), a new chat message, and a
  complaint being raised (to Admin/Manager) or updated (back to whoever
  raised it).
- A 🔔 bell in the sidebar shows your unread count, polls every 30s, and
  clicking a notification marks it read and jumps you to the relevant page.

## 6. Chat — 1-on-1 + one group chat per project
- New `Conversation`/`ConversationParticipant`/`Message` models.
- New Projects auto-get a group chat for their team. Existing projects get
  one created on first visit (via the new "💬 Team Chat" button on the
  project board).
- Direct messages: pick anyone from Team Members in the Chat page's "+ New"
  panel to start a 1-on-1.
- **Design note**: this uses polling (the open chat refetches every 4
  seconds), not a websocket server. That means messages appear within a few
  seconds rather than instantly like real WhatsApp. It's simple, reliable,
  and needs no extra infrastructure — good for internal team use. If you
  want true instant delivery later, that's a Socket.io addition on top of
  this same data model, not a rebuild.

## 7. Complaints
- New `Complaint` model. Anyone can raise one (`POST /api/complaints`) —
  subject + description, tied to who raised it.
- Only Admin and roles with the `complaints.manage` permission can see the
  full list and change status (Open → In Review → Resolved → Closed) with
  an optional resolution note. Everyone can see their own complaints and
  any resolution note added to them.
- The seeded **Manager** role now includes `complaints.manage` by default.
  For an *existing* install (already seeded), grant it to a role manually:
  Team & Roles → find the role → check "complaints.manage" (it's now in the
  permission list there) — no reseed or redeploy needed, since permissions
  are just a JSON map on the role.

## Applying this update
1. Copy in the updated files (or replace the whole project folder).
2. `cd server && npx prisma migrate deploy` — adds the new tables. This is
   a fresh migration folder (`20260831120000_notifications_chat_complaints`)
   on top of the previous one; no need to touch earlier migrations.
3. Restart both `npm run dev` processes (server and client).
