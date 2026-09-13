# Update — task limits, employee scoping, break alerts, performance reports

## 1. Employees can no longer assign tasks — Team Lead+ only

The `tasks.assign` permission is gone from the Employee role, replaced with
a narrower **`tasks.update_own`**:

- **Employees** can move their own assigned task between columns (drag &
  drop), comment, and log time — but cannot create tasks, and cannot
  assign or reassign work to anyone, including themselves.
- **Team Lead, Manager, Admin** (all hold `tasks.manage`) can create tasks
  and assign to anyone within their hierarchy, same as before.

This is enforced on the backend (`PUT /tasks/:id/move` checks the task is
actually assigned to you if you don't have `tasks.manage`), not just hidden
in the UI.

**Board view**: Employees now only see their **own** task cards on a
project board — other people's cards don't render at all for them. The
"+ Add task" button and form are hidden entirely for Employees.

If you already ran the seed script before, **run it again** — the role
upserts now properly refresh permissions on existing roles (they didn't
before), so your existing Employee accounts will pick up this change.

## 2. Hard workload cap

Each task priority carries a weight — LOW=1, MEDIUM=2, HIGH=3, URGENT=4 —
and nobody can be assigned open (not-done) work totalling more than **9
points** (roughly 3 HIGH-priority tasks' worth). This directly matches what
you described: 3 HIGH tasks maxes someone out; 1 HIGH task still leaves
room for a couple of MEDIUM/LOW ones.

**This is a hard block, no override** — per your call. If an assignment
would push someone over the cap, it's rejected outright with a message
like:

> Can't assign — Kabir Singh is already at their workload limit (9/9
> points). Reassign or complete some of their existing tasks first.

This applies to both creating a new task with an assignee and reassigning
an existing task. The demo data (see below) deliberately sets one person to
exactly the cap so you can see this in action immediately.

If you'd rather tune the weights or the cap itself, they're in one place:
`server/src/utils/workload.js`.

## 3. Break alert (>1 hour/day)

Total break time is now tracked per day. Cross **60 minutes** and:

- The employee's Attendance page shows a **red banner** with the exact
  total, right after ending the break that crossed the limit.
- Their **Team Lead and Manager** (walking up to 2 levels of the reporting
  chain) get an in-app notification.
- The Team Attendance table (visible to anyone with `attendance.view_all`)
  highlights that day's row in red with the total break time shown.

The alert only fires once per day per person (won't spam on every
subsequent break).

## 4. Own-client meeting scheduling

No change needed here — this was already in place from earlier work.
Every team member can already schedule a meeting and invite their own
client (the one they're the "Handled By" person for) alongside any
internal team member (Admin, Manager, Team Lead, anyone). The client
picker in the meeting modal already only shows clients relevant to the
person scheduling it.

## 5. Cross-project assignment for Manager/Team Lead/Admin

Also already true — nothing restricts a Manager or Team Lead from
assigning a task in *any* project to one of their reports, regardless of
which project that person is normally associated with. The only
restrictions are the reporting hierarchy (§1 above, pre-existing) and the
new workload cap (§2).

## 6. Employee performance & client-history report

New section on every profile page: **Client History & Performance
Report**, with an Export CSV button. Shows:

- **Currently working with** — clients tied to their open tasks on active
  projects
- **Previously worked with** — clients from completed tasks or
  completed/cancelled projects
- Completion rate, on-time rate, average time-to-complete (hours), and
  count of currently-overdue open tasks

Visible to the person themself, or anyone with a Team Lead/Manager/Admin
permission level. New endpoint: `GET /api/users/:id/report`.

## 7. Expanded demo data

The seed script now creates:
- **5 clients** total (up from 2), each with a different handler and
  engagement type
- **3 projects**: Website Redesign (Acme Retail), Mobile App Revamp
  (Nimbus Cloud), and Internal CRM Tool (no client — internal work)
- Tasks spread across the whole team with varying priorities

**Kabir Singh's workload is deliberately set to exactly 9 points** (the
cap) across two of the projects — try assigning him one more task (as
Jitender, Priya, or Aman) to see the hard block fire immediately.

Run:
```bash
cd server
npx prisma migrate deploy
npm run seed
```
Safe to re-run — it won't duplicate existing data, and will refresh role
permissions if they're out of date from an earlier seed run.

## Known limitations

- As always, run `npx prisma migrate deploy` against your real database.
- The workload cap and break-alert threshold are both simple constants
  right now (not per-role or per-org configurable via the UI) — easy to
  expose as a settings screen later if you want them tunable without a
  code change.
- "Previous client" is inferred from task/project status, not an explicit
  "this engagement ended" flag — if you later want a client relationship
  to be marked as formally ended independent of project status, that's a
  small additional field on `Client` or `ProjectMember`.
