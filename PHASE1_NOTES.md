# Phase 1 upgrade — what changed & how to run it

This covers the first batch of the 45-feature plan:

1. Employee delete (permanent) + deactivate/reactivate
2. Dark/light theme toggle (whole app)
3. Chat: file/image sharing + custom group chats
4. Full graphical Admin Analytics Dashboard

## 1. Getting it running

```bash
# Server
cd server
npm install                  # installs multer (new) along with existing deps
npx prisma migrate deploy    # applies the new migration (group chats + file fields)
npm run dev

# Client
cd client
npm install                  # installs recharts (new) along with existing deps
npm run dev
```

No changes to `.env` are required. Uploaded chat files are stored on disk at
`server/uploads/chat/` and served at `http://localhost:5000/uploads/chat/...`
— that folder is gitignored so it won't bloat your repo.

## 2. Employee deletion

- **Deactivate** (Users page → "Deactivate"): the safe default. Blocks login,
  keeps all history (tasks, comments, attendance). Reversible via
  "Reactivate".
- **Delete** (Users page → "Delete"): permanently removes the user record.
  This is **blocked** if the person still owns projects, clients, tasks, or
  chat messages they created/sent — those are required links in the
  database, so deleting through them would corrupt history. You'll get a
  clear message telling you what to reassign first. If they don't own
  anything, delete cleans up their attendance, notifications, project
  memberships, and comments, then removes them.

New endpoints: `DELETE /api/users/:id` (deactivate), `PUT /api/users/:id/reactivate`,
`DELETE /api/users/:id/permanent`.

## 3. Dark theme

Toggle button (🌙/☀️) is in the top-right of the sidebar. Preference is saved
per-browser (localStorage) and applied instantly. It defaults to your OS
preference on first visit. This was done as a global CSS layer so every
existing page picks up dark mode automatically — no per-page rewrite needed.

## 4. Chat — groups & files

- **"+ Group"** in the Chat page sidebar: name it, pick any members, create.
  The creator is the group admin and can rename the group, add/remove
  members. Anyone can leave a group they're in.
- **📎 attach button** next to the message box: attach any file (images
  preview inline, other files show as a downloable chip with name + size).
  25MB limit per file; a short list of executable extensions is blocked.

New endpoints: `POST /api/chat/conversations/group`, `PUT .../:id/rename`,
`POST .../:id/members`, `DELETE .../:id/members/:memberId`,
`POST .../:id/leave`. Sending a message now accepts `multipart/form-data`
with an optional `file` field alongside `body`.

## 5. Analytics Dashboard

Shows automatically on the Dashboard for Admin/Manager roles, below the
existing Organization Overview:

- Task completion trend (created vs. completed, 7/30/90-day toggle)
- Attendance / average work-hours trend
- Project progress (% tasks done per project)
- Project status breakdown (pie)
- Workload distribution (open tasks per person)
- Overdue tasks by employee
- Complaints by status
- Employee performance leaderboard (completion rate, on-time rate, overdue
  count, composite score) — this is the foundation Phase 2's deeper
  performance-tracking features will build on

New endpoint: `GET /api/dashboard/analytics?days=7|30|90`.

## Known limitations / things to know

- The client build was verified (`vite build` completes cleanly), but I
  couldn't run this against a live Postgres database in this environment —
  there's no DB connection available here — so please test the migration
  and new endpoints against your actual database before deploying.
- Chat file storage is local disk, which is fine for a single-server
  internal tool. If you ever move to multiple server instances or a
  container platform with ephemeral disks, swap `upload.middleware.js`'s
  storage engine for S3 or similar — nothing else needs to change since
  controllers only ever hand back a URL.
- Dark mode's global CSS override approach retrofits the *existing* pages
  automatically. Any new pages you build later should ideally use explicit
  Tailwind `dark:` classes for a cleaner result, though the fallback will
  still make them usable.

## What's next (Phase 2, on request)

- Full employee CRUD (edit profile, avatar, bio) + profile/detail pages
- Per-employee performance drill-down page with history graph
- Daily work-update log
- Visual role/permission matrix editor
- Bulk actions on employee list

Just say the word and I'll continue with Phase 2.
