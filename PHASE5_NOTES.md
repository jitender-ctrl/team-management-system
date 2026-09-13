# Phase 5 upgrade — what changed & how to run it

Builds on Phases 1–4. This batch covers:

1. Auto-transfer on employee deletion (no more blocking)
2. Full email system: verification, forgot/reset password, change password
3. Settings page: change email, mobile number, password
4. Professional icons (lucide-react) replacing emoji throughout
5. Animations (framer-motion) — page transitions, modals, hover states
6. Calendar meeting booking
7. Project edit UI
8. Time tracker (start/stop timer + manual logging)

## 1. Getting it running

```bash
# Server
cd server
npm install
npx prisma migrate deploy    # applies the final migration (auth fields, meetings, time entries)
npm run dev

# Client
cd client
npm install
npm run dev
```

## 2. Setting up email (free — Gmail SMTP)

Password reset and email verification links need somewhere to send from.
The free path:

1. Use (or create) a Gmail account.
2. Turn on **2-Step Verification**: myaccount.google.com/security
3. Generate an **App Password**: myaccount.google.com/apppasswords
   (pick "Mail" as the app — you'll get a 16-character password)
4. In `server/.env`, set:
   ```
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=465
   SMTP_USER="youraddress@gmail.com"
   SMTP_PASS="the 16-character app password (no spaces)"
   SMTP_FROM="TeamFlow <youraddress@gmail.com>"
   ```

**Until you set this up**, emails aren't lost — they're printed to the
server's console log instead, so you can copy the verification/reset link
from there during local development. Everything else works identically
either way.

Any other SMTP provider (SendGrid, Mailgun, Brevo, Outlook) works the same
way — just point `SMTP_HOST`/`PORT`/`USER`/`PASS` at their credentials.

## 3. What changed for employee deletion

Per your decision: **deleting an employee now auto-transfers their created
work to you** (the admin doing the deletion) instead of blocking. Anything
they created — projects, tasks, clients, chat messages, complaints, groups,
meetings, task attachments — is reassigned to your account so nothing is
lost or orphaned. Their personal records (attendance, daily updates, time
entries, notifications) are removed along with their account. This applies
to both single-user delete and the bulk "Delete" action on the Team Members
page.

## 4. Email verification, password reset, forgot password

- **New account**: gets a verification email automatically (or logs to
  console if SMTP isn't configured). Unverified accounts can still log in
  and use the app — verification is a soft nudge, not a hard gate, since
  you're the one creating accounts for your team, not them self-registering.
- **Forgot password** (`/forgot-password`, linked from the login page):
  request a reset link by email. Doesn't reveal whether an email exists.
- **Reset password** (`/reset-password/:token`): sets a new password,
  link expires in 1 hour.
- **Change password** (Settings page): requires your current password.
- **Verify email** (`/verify-email/:token`): confirms the address.

New endpoints: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`,
`GET /api/auth/verify-email/:token`, `PUT /api/auth/change-password`,
`POST /api/auth/resend-verification`, `POST /api/auth/change-email`.

## 5. Settings page

New "Settings" nav item (bottom of sidebar). Three sections:
- **Change email** — staged behind verification. Your login email doesn't
  change until you click the link sent to the *new* address, so a typo
  can't lock you out.
- **Mobile number** — plain update, no verification needed.
- **Change password** — requires current password.

Plus a verification-status banner with a "resend" link if you haven't
verified yet.

## 6. Icons & animation

- Every navigational/functional emoji (sidebar, buttons, chat toolbar,
  activity log, command palette, toasts) is now a proper icon from
  **lucide-react** — consistent sizing, weight, and color instead of
  OS-dependent emoji rendering.
- **Chat reactions intentionally still use real emoji** (👍❤️😂😮😢🙏) —
  those are content people are reacting *with*, not UI chrome, so they stay
  as emoji the same way they would in any chat app.
- **framer-motion** now drives: page transitions (fade/slide between
  routes), the notification dropdown, the mobile sidebar drawer, toast
  slide-in/out, and the login page's animated illustration (a bar-chart +
  checkmark + card scene built as inline SVG — no external image
  dependency, so it always loads instantly with no broken-image risk).

## 7. Calendar: book a meeting

"Book Meeting" button on the Calendar page opens a modal: title,
description, date/time range, location or video link, optional linked
project, and attendees. Meetings show on the month grid (purple chips)
alongside task deadlines, and the day-detail panel lists full meeting
details with a cancel option for the organizer. Invitees get a
notification.

New endpoints: `GET/POST /api/meetings`, `PUT/DELETE /api/meetings/:id`,
`POST /api/meetings/:id/rsvp`.

## 8. Project edit

"Edit" link next to the project title on its board page opens an inline
panel to change name, description, status, client, and start/end dates —
using the `PUT /api/projects/:id` endpoint that already existed but had no
UI wired to it until now.

## 9. Time tracker

On any task's detail modal (open a task from the board): a "Start timer" /
"Stop timer" button, a quick manual-entry form (minutes + optional note),
and a running list of everyone's logged time on that task with a total.
Starting a timer while another one is already running for you auto-stops
the old one first — you can't track two things at once.

New endpoints: `POST /api/time-entries/tasks/:taskId/start`,
`POST /api/time-entries/tasks/:taskId/stop`,
`POST /api/time-entries/tasks/:taskId/manual`,
`GET /api/time-entries/tasks/:taskId`, `GET /api/time-entries/running`,
`GET /api/time-entries/my-summary`, `DELETE /api/time-entries/:id`.

## Known limitations

- As always, run `npx prisma migrate deploy` against your real database —
  no live Postgres was available to test against here.
- Email sending depends entirely on the SMTP credentials you provide;
  without them, links print to the server console instead (fine for local
  dev, not for real users).
- The bundle is now ~995KB minified (lucide-react + framer-motion added
  real weight). Still loads fine for an internal tool, but if load time
  ever matters, code-splitting with `React.lazy()` per route is the next
  lever to pull.
