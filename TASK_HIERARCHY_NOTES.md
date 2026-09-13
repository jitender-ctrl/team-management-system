# Update — detailed task creation, file attachments at creation, and reporting hierarchy

Builds on everything so far.

## 1. Detailed task creation

The "+ Add task" form on each project board column now includes:
- **Description** — full details, requirements, links, whatever the task needs
- **Due date**
- **File attachment** — attach an asset right when creating the task (spec
  doc, reference image, whatever). It uploads immediately after the task is
  created, so it shows up in that task's Attachments section right away —
  same place you'd add more files later, or download them when you need them.

No new endpoints — this reuses the existing task-creation and
attachment-upload endpoints, just wires them together from one form instead
of two separate steps.

## 2. Reporting hierarchy — who can assign tasks to whom

New concept: every team member can have a **manager** (who they report to).
Set this on the **Team Members** page — a new "Reports To" column, editable
by anyone with `users.manage` (Admin).

**The assignment rule, enforced on the backend (not just hidden in the UI):**
- **Admin** (anyone with the `*` or `users.manage` permission) can assign a
  task to anyone.
- **Everyone else** who's allowed to assign tasks at all (Manager, Team
  Lead — anyone with `tasks.manage` or `tasks.assign`) can only assign to
  **themselves or their own direct/indirect reports** — never sideways to a
  peer, and never upward to their own manager.
- Regular employees without an assign permission still can't assign tasks
  to anyone, same as before.

This is enforced in `POST /tasks/project/:id` and `PUT /tasks/:id` — even
if someone crafted a request directly, the backend rejects an assignment
outside the hierarchy with a 403.

The task-assignment dropdown itself (`GET /api/users/assignable`) now only
ever shows people the *current* logged-in user is allowed to assign to, so
a Team Lead simply won't see other teams' members in the list at all.

## 3. Assignment notifications now show name *and* role

When someone gets assigned a task, the notification now reads like:

> **Priya (Team Lead) assigned you a task: "Fix login bug"**

instead of just the name — so it's clear at a glance whether it came from
their direct lead, a manager, or an Admin.

## Migration

```bash
cd server
npx prisma migrate deploy
```

Adds `User.managerId` (nullable, self-referencing) — the reporting-hierarchy
link. Existing users start with no manager set (`managerId = null`), which
means: they have no direct reports counted against them, and only an Admin
can currently assign tasks to them until you set up the hierarchy on the
Team Members page.

## Setting up your hierarchy (one-time)

1. Go to **Team Members**.
2. For each Manager/Team Lead's direct reports, set their **Reports To**
   dropdown to that Manager/Team Lead.
3. That's it — the assignment restriction applies immediately. A Manager
   with 3 reports set will now only be able to assign tasks to those 3
   people (or sub-reports under them) plus themselves.

## Known limitations

- As always, run `npx prisma migrate deploy` against your real database —
  no live Postgres was available to test against here.
- The hierarchy walk (`getSubordinateIds`) does a breadth-first lookup with
  a handful of queries — fine for a normal-sized team, not optimized for
  thousands of employees. If you ever get that large, it's a straightforward
  swap to a recursive SQL query instead.
- Moving a task between columns (drag-and-drop) doesn't touch the assignee,
  so it isn't subject to the hierarchy check — only actually assigning/
  reassigning someone is.
