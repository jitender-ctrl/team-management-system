# Update — client handler history (transfers/terminations) + much more demo data

## 1. Client handler history — transfers and terminations, with reasons

Every time a client's "Handled By" person changes, it's now logged with a
**required reason**. On the Clients page, each row has two new icons:

- **↔ Transfer / End Engagement** (Admin/Manager only): pick a new handler
  (or "No one — end this engagement"), type a reason, submit. This is now
  the *only* way to change who handles a client — the regular Edit form no
  longer lets you change the handler silently, specifically so this is
  always auditable.
- **🕐 History** (everyone who can see the client): shows every handler
  change for that client — who it went from, who it went to (or
  "Engagement ended" if nobody), the reason, who made the change, and when.

**On each employee's profile page**, the Performance Report now includes a
"Client Handling Changes" section listing every client that was
transferred away from them or had its engagement terminated while they
were the handler — with the reason, date, and who made the call. This is
the direct answer to "let me monitor termination" — it surfaces on the
person's own report, not buried in a separate audit log.

New endpoints: `PUT /api/clients/:id/handler` (transfer/terminate, reason
required), `GET /api/clients/:id/handler-history`. `GET /api/users/:id/report`
now also returns `clientHandlingChanges`.

## 2. Migration

```bash
cd server
npx prisma migrate deploy
npm run seed
```

Adds the `ClientHandlerHistory` table. Re-running the seed is safe (skips
anything already created) and adds the new demo people/clients/projects
below.

## 3. Expanded demo data

**Team — now 9 people:**

| Role | Name | Email | Password |
|---|---|---|---|
| Admin/Team Lead | Jitender (you) | jitender@glocalassist.com | Jitender@2026 |
| Manager | Priya Sharma | priya.manager@glocalassist.com | Manager@2026 |
| Team Lead | Aman Verma | aman.teamlead@glocalassist.com | TeamLead@2026 |
| Team Lead | Neha Gupta *(new)* | neha.teamlead@glocalassist.com | TeamLead@2026 |
| Employee | Riya Kapoor | riya.employee@glocalassist.com | Employee@2026 |
| Employee | Kabir Singh | kabir.employee@glocalassist.com | Employee@2026 |
| Employee | Karan Mehta *(new)* | karan.employee@glocalassist.com | Employee@2026 |
| Employee | Sana Ali *(new)* | sana.employee@glocalassist.com | Employee@2026 |

Reporting chain: Riya & Kabir → Aman → Priya → you. Karan & Sana → Neha → Priya → you.

**Clients — now 9 total** (up from 5): added Vantage Legal Group, Skyline
Realty, Oakridge Manufacturing, Pinnacle Health, and **Vertex Analytics**
— the last one has **no current handler** because its engagement was
seeded as already **terminated** (previously Kabir's), so you can
immediately see a real termination record without doing anything.
Bright Path Consulting comes with a seeded **transfer** record (Team Lead
→ Manager) so you can see that flow too — check its History button.

**Projects — now 5 total** (up from 3): added Legal Contract Portal
(Vantage Legal, run by Neha's team) and Realty Listings Site (Skyline
Realty, also Neha's team), each with a couple of tasks assigned.

**Attendance — seeded for today** for Riya, Kabir, Karan, Sana, Aman, and
Neha, with check-in times and lunch breaks. **Riya's break is deliberately
75 minutes** — over the 60-minute limit — so you can see the red alert on
her Attendance page and the highlighted row in the Team Attendance table
immediately, without needing to check in/out and time it yourself.

## What to try

1. Log in as `jitender@glocalassist.com`, go to **Clients**, find "Vertex
   Analytics" — it shows Unassigned; click History to see the termination
   reason.
2. Click History on "Bright Path Consulting" to see the transfer record.
3. Go to Kabir Singh's profile (`Users` → click his name) → scroll to
   "Client Handling Changes" — you'll see the Vertex Analytics termination
   listed there directly on his report.
4. Go to **Attendance** as Admin/Manager to see Riya's row highlighted red
   for exceeding the break limit today.
5. Try transferring any client via the ↔ icon — you'll be required to type
   a reason before it lets you submit.

## Known limitations

- As always, run `npx prisma migrate deploy` against your real database —
  no live Postgres was available to test against here.
- Deleting a client entirely (the trash icon) is different from ending an
  engagement — deletion removes the client record outright and has no
  history trail; ending an engagement (via Transfer with "No one") is the
  one that's tracked. Worth remembering which action does which.
