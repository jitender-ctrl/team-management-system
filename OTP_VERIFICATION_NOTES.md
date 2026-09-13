# Update — OTP-based email verification

Replaces the link-based email verification with a 6-digit code (OTP) sent
by email, wherever email verification happens in the app.

## What changed

- **Adding a team member** (Users page → "+ Add Member"): a 6-digit
  verification code is now emailed to them automatically. The success
  toast confirms this ("Team member added — a verification code was
  emailed to them"). The Team Members table now shows an "Email not
  verified" label under their status until they verify.
- **New login page link**: "Got a verification code? Verify your email" →
  a dedicated `/verify-otp` page where anyone (team member or otherwise)
  can enter their email + the 6-digit code to verify — no login required,
  since a brand-new team member may not have logged in yet.
- **Settings page**: the email verification card now has the code entry
  built right in (send code → type it in the box right there → Verify),
  instead of sending you off to click a link.
- **Changing your email** (Settings): now sends a 6-digit code to the new
  address instead of a link, with the same inline "enter code to confirm"
  flow — your login email doesn't change until you enter the correct code.
- Self-service registration (`POST /api/auth/register`, not used by this
  app's normal admin-provisioned flow but kept for completeness) also
  switched to OTP.

The old link-based `GET /api/auth/verify-email/:token` endpoint and page
still exist and still work (harmless to leave in place), but nothing in
the app links to them anymore — OTP is now the only path actually used.

## New/changed endpoints

- `POST /api/auth/verify-otp` — public, `{ email, otp }` — verifies a
  brand-new/unverified account's primary email.
- `POST /api/auth/resend-otp` — public, `{ email }` — sends a fresh code;
  always responds the same way whether or not the email exists, so it
  can't be used to check which emails are registered.
- `POST /api/auth/confirm-email-otp` — authed, `{ otp }` — confirms an
  in-progress email *change* (reads the pending email from your own
  session, not from the request).
- `POST /api/auth/resend-verification` — authed, no body — now generates
  and emails an OTP instead of a link (endpoint name kept for compatibility).
- `POST /api/users` (admin creating a team member) now also generates and
  emails an OTP automatically, no extra step needed.

## Migration

```bash
cd server
npx prisma migrate deploy
```

Adds `User.otpCode` and `User.otpExpiry` (nullable). Codes expire after
**10 minutes** — short-lived by design since they're meant to be entered
right after the email arrives; "Resend code" is always available if it
expires first.

## Email delivery

Same SMTP setup as the rest of the auth system (Gmail App Password or any
SMTP provider — see the earlier auth-email notes). If SMTP isn't configured
yet, the code just prints to the server console instead of sending — so
you can copy it from there during local development.

## Known limitations

- As always, run `npx prisma migrate deploy` against your real database —
  no live Postgres was available to test against here.
- Verification is still **not a hard login gate** — an unverified account
  can log in and use the app normally; the OTP flow confirms the email is
  real and reachable, but doesn't block access. If you want unverified
  accounts blocked from logging in until they verify, that's a small
  change to the `login` controller — say the word if you want that added.
