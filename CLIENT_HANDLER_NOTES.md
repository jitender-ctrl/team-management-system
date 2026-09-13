# Client update — handled-by team member & engagement type

Small addition on top of Phase 5.

## What changed

The Clients page now has two new fields per client:

- **Handled by** — which team member is the face of this client (a
  dropdown of your team). Shown as an avatar + name in the clients table.
- **Engagement type** — Part Time or Full Time, shown as a badge:
  - **Part Time**: 4 hours/day, 5 days/week → 20 hrs/week
  - **Full Time**: 8 hours/day, 5 days/week → 40 hrs/week

Both are optional — existing clients show "Unassigned" / no badge until you
set them. There's also now an **Edit** (pencil) button per client row to
update these (or any other field) after creation, alongside the existing
Delete button.

## Migration

```bash
cd server
npx prisma migrate deploy
```

This adds `Client.handledById` (nullable, references `User`) and
`Client.engagementType` (nullable enum: `PART_TIME` | `FULL_TIME`).

## API changes

`POST /api/clients` and `PUT /api/clients/:id` now accept `handledById`
and `engagementType` in the request body. `GET /api/clients` and
`GET /api/clients/:id` now include the `handledBy` user (id, name,
avatarUrl) in the response.

## Where this could go next

Right now this is informational — a badge and an assignment, nothing else
reads it yet. If it'd help, I can wire the engagement type's expected
weekly hours into the analytics dashboard (e.g. flag a Full Time client
whose assigned team member is logging well under 40 hrs/week via the time
tracker), or add a "my clients" filter on the Clients page scoped to
whoever is logged in. Just say the word.
