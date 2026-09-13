# Phase 2 upgrade — what changed & how to run it

Builds on Phase 1. This batch covers:

1. Full employee CRUD (edit profile, avatar upload)
2. Employee profile pages with a performance drill-down
3. Daily work-update log
4. Visual role/permission matrix editor
5. Employee search & filter
6. Bulk actions (deactivate/reactivate/delete multiple)

## 1. Getting it running

```bash
# Server
cd server
npm install
npx prisma migrate deploy    # applies the new migration (profile fields + DailyUpdate table)
npm run dev

# Client
cd client
npm install
npm run dev
```

Avatars are stored on disk at `server/uploads/avatars/` (same pattern as
chat file uploads from Phase 1), served at `/uploads/avatars/...`.

## 2. Employee profile pages

Click any name in the Team Members table (or your own name/avatar at the
bottom of the sidebar) to open `/users/:id`. Shows:

- Avatar (click the 📷 badge to change it — you can always change your own;
  managers can change anyone's), bio, phone, job title, join date
- Editable inline (self can edit their own bio/phone/job title/name;
  role/status/email changes still require `users.manage`)
- Stat cards: total/completed/pending/overdue tasks, completion rate
- **12-week completed-tasks trend chart** — the performance drill-down
- Recent tasks list and assigned projects
- The daily work-update log (see below)

New endpoint: `GET /api/users/:id`. `PUT /api/users/:id` now accepts
`bio`, `phone`, `jobTitle` in addition to the existing fields, with
self-vs-manager permission logic. `PUT /api/users/:id/avatar` (multipart,
field name `avatar`) uploads a new photo.

## 3. Daily work-update log

On each profile page. If it's your own profile, you get a small form to
post "what I worked on today" (optional hours). One entry per day — posting
again today edits it rather than duplicating. Managers can view (not post)
anyone's log from that person's profile page.

New endpoints: `POST /api/work-updates` (upsert today's entry),
`GET /api/work-updates?userId=&limit=`, `DELETE /api/work-updates/:id`
(own entries only).

## 4. Visual permission matrix

On the Team & Roles page, creating a new role now shows a resource-by-action
table (Clients/Projects/Tasks/Team/Attendance/Complaints × their actions)
instead of a flat checkbox list, plus a clearly separated "Super Admin"
row for the `*` bypass-all flag. The underlying data format is unchanged —
still a flexible JSON permission map — so this is a pure UI improvement.

## 5. Search & filter

Team Members page now has a search box (name/email) plus dropdown filters
for role, status (active/inactive), and project. `GET /api/users` accepts
`?search=&roleId=&status=&projectId=`.

## 6. Bulk actions

Check any rows in the Team Members table (or the header checkbox to select
all) and an action bar appears: Deactivate / Reactivate / Delete selected.
Delete runs the same ownership-safety checks as the single-user permanent
delete — if some selected users are blocked (they own projects/clients/
tasks/messages), you'll get a summary of how many succeeded vs. were
blocked, rather than an all-or-nothing failure.

New endpoint: `POST /api/users/bulk` with `{ ids: [...], action: "deactivate" | "reactivate" | "delete" }`.

## Known limitations

- As with Phase 1, I couldn't run the migration against a live Postgres
  instance in this environment — please run `npx prisma migrate deploy` and
  test against your real database before deploying.
- The performance chart buckets by week using `updatedAt` on completed
  tasks as a proxy for "date completed" (same approach as the Phase 1
  dashboard's task trend) — accurate as long as tasks aren't edited again
  after being marked done. A dedicated `completedAt` timestamp would be a
  clean follow-up if you want it to be exact.

## What's next (Phase 3, on request)

- Chat: read receipts, typing indicator, message search, pin messages, emoji reactions
- UI polish: responsive pass, toast notifications, loading skeletons

Just say the word and I'll continue with Phase 3.
