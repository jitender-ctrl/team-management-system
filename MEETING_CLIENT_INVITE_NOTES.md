# Update — invite clients to meetings by email

Builds on the meeting-booking feature.

## What changed

The "Book a Meeting" modal now has two more ways to invite people beyond
your team:

- **Invite clients** — checkbox list of your existing Clients. Their
  stored email (from the Clients page) is used automatically. If a client
  has no email on file, they're shown with a small warning and won't get
  an invite until you add one to their client record.
- **Invite by email directly** — for a one-off guest not in your Clients
  list yet: type a name (optional) and email, click Add, repeat as needed.

Both groups receive a real invitation **email** (not an in-app
notification, since they don't have a login) with the meeting title,
date/time, location or video link, and description — everything they need,
formatted properly. This uses the same SMTP setup from the auth email
system (Gmail App Password or any SMTP provider); if it's not configured
yet, invite emails just log to the server console instead, same as the
other email features.

After booking, the day's meeting details on the Calendar show how many
guests were invited and how many invite emails actually sent successfully
(e.g. "2/2 emailed") — useful if an email address was invalid or SMTP
temporarily failed.

## Migration

```bash
cd server
npx prisma migrate deploy
```

Adds a `MeetingGuest` table (meetingId, optional link back to the Client
record, name, email, whether the invite email sent successfully).

## API changes

`POST /api/meetings` now also accepts:
- `clientIds: number[]` — existing Client records to invite
- `guestEmails: { email, name? }[]` — freeform external invites

`GET /api/meetings` responses now include a `guests` array per meeting.

## Known limitations

- Clients (and freeform guests) can't RSVP in-app — they have no login.
  The email itself is the full invite; if you want a "yes/no" reply from
  them, that'd need a public RSVP link (no auth) similar to the client
  portal — say the word if you want that added.
- As always, run `npx prisma migrate deploy` against your real database,
  and set up SMTP credentials (see the auth-email notes) for invites to
  actually deliver rather than just logging to console.
