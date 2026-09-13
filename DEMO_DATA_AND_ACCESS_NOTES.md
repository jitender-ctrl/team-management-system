# Update — demo team data, password-only login, own-client scoping

## 1. Your account + demo team hierarchy

The seed script now creates **you** as Admin, plus a small demo hierarchy so
you can log in as each person and see what their dashboard/access looks
like. Run (or re-run) it with:

```bash
cd server
npx prisma migrate deploy
npm run seed
```

**Temporary login credentials** (change these after you've explored —
each person can do this themselves from Settings once logged in):

| Role | Name | Email | Password |
|---|---|---|---|
| Admin / Team Lead | Jitender (you) | jitender@glocalassist.com | Jitender@2026 |
| Manager | Priya Sharma | priya.manager@glocalassist.com | Manager@2026 |
| Team Lead | Aman Verma | aman.teamlead@glocalassist.com | TeamLead@2026 |
| Employee | Riya Kapoor | riya.employee@glocalassist.com | Employee@2026 |
| Employee | Kabir Singh | kabir.employee@glocalassist.com | Employee@2026 |

Reporting hierarchy is pre-set: Riya and Kabir report to Aman (Team Lead),
who reports to Priya (Manager), who reports to you. This means Aman can
only assign tasks to Riya/Kabir/himself, Priya can assign to Aman/Riya/
Kabir/herself, and you (Admin) can assign to anyone — you can see this in
action by logging in as each one and trying to assign a task to someone
outside their chain (it'll be rejected).

Also seeded: **2 demo clients** (Acme Retail — handled by Aman, Full Time;
Bright Path Consulting — handled by Priya, Part Time) and **1 demo project**
("Website Redesign") with 4 tasks assigned across the team, so every
dashboard has real data to look at instead of empty states.

The seed script is safe to re-run — it won't duplicate existing users,
clients, or the demo project if they're already there.

## 2. Password-only login (quick-login removed)

The "Continue as Admin (no password)" button is gone from the login page,
along with its backend endpoint (`/api/auth/admin-quick-login`) and the
`adminQuickLogin` function in `AuthContext`. Everyone — including you —
now logs in with email + password only, no exceptions.

## 3. "Own client" access

Clients are now scoped by role:

- **Admin** and anyone with the **Manager** role (which includes
  `clients.manage`) can see and manage **every** client.
- **Team Lead** and **Employee** roles only see clients where they are the
  **Handled By** person — set on the Clients page. This applies everywhere
  a client list appears, including the "Invite clients" picker in the
  meeting-booking modal, so a Team Lead scheduling a meeting only sees
  their own clients to choose from (Admins/Managers still see the full
  list there).

This directly supports what you described: every team member can already
schedule a meeting and invite their own client alongside internal people
(Admin, Manager, Team Lead, anyone) — that part had no restriction and
still doesn't. What's new is that the *client list itself* is now scoped
so people only see clients relevant to them, rather than the entire company's
client roster.

## What to do next

1. Run the migration + seed as shown above.
2. Log in as `jitender@glocalassist.com` / `Jitender@2026`.
3. Go to **Settings** and change your password to something only you know.
4. Log into each demo account to see their dashboard/permissions, then
   either keep them as ongoing test accounts or delete them once your real
   team members are added (Users page → Delete — remember, per the earlier
   change, anything they "own" gets transferred to you automatically, not
   blocked).
