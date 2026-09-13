# TeamFlow — Team Management System

React + Node/Express + PostgreSQL (Prisma) team management system: dynamic Kanban
project boards, client management, and attendance/break tracking, all gated by a
**fully dynamic role & permission system**.

## Why it's "dynamic"

1. **Roles aren't hardcoded.** `Role.permissions` is a JSON map (`{ "tasks.manage": true, ... }`).
   You can create a "Sales" or "HR" role tomorrow with any combination of permissions,
   from the Roles admin screen — no code changes, no redeploy.
2. **Board columns are per-project, not a fixed enum.** Each project gets its own
   `TaskStatus` rows. One project can run To Do → In Progress → Done, another can run
   Backlog → Design → Dev → QA → Live. Add, rename, reorder, or delete columns per project.
3. **Break types are free text**, not a fixed list — add "Prayer Break", "Standup", whatever
   your office uses.

## Project structure

```
team-management-system/
  server/     Express API + Prisma (PostgreSQL)
  client/     React (Vite) frontend
```

## Backend setup

```bash
cd server
cp .env.example .env        # edit DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run seed                 # creates Admin/Manager/Employee roles + admin@company.com / Admin@123
npm run dev                  # http://localhost:5000
```

To use MySQL instead of PostgreSQL: change `provider = "postgresql"` to `"mysql"` in
`prisma/schema.prisma` and update `DATABASE_URL` accordingly, then re-run migrate.

## Frontend setup

```bash
cd client
cp .env.example .env
npm install
npm run dev                  # http://localhost:5173
```

Log in with `admin@company.com` / `Admin@123` (change this immediately — create a
real admin user and deactivate/delete the seed one in production).

## Core permission keys already wired into the UI/API

- `clients.view`, `clients.manage`
- `projects.view`, `projects.manage`
- `tasks.view`, `tasks.manage`, `tasks.assign`
- `users.manage`
- `attendance.manage_own`, `attendance.view_all`

A role with `"*": true` bypasses all permission checks (used for Admin).

## What's included

- JWT auth (register/login/me)
- Dynamic role & permission management (create custom roles from the UI)
- Client CRUD
- Project CRUD with team members
- Per-project dynamic Kanban board (drag-and-drop via `@hello-pangea/dnd`), custom
  columns, task priority, assignees, comments (API ready; comment UI not wired into
  the board yet — see "Next steps")
- Attendance check-in/check-out + break start/end, with a team-wide view for managers

## Next steps you may want to add

- A task detail modal (currently tasks are created inline; `GET /tasks/:id` and the
  comments endpoint are ready on the backend for you to build this out)
- Email notifications (task assigned, due date reminders)
- File attachments on tasks
- Reporting/analytics dashboard (hours worked, tasks completed per sprint)
