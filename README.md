# SHIFTY

Small internal tool for a driving operation.

- Drivers sign up, see shifts we've posted for next week, claim the ones they can work.
- Friday 23:59 is the cutoff.
- Admins (dispatchers) post shifts, approve/deny claims with a reason.
- Every day a driver works, they submit 5 inspection photos (front of vehicle, back, driver side, passenger side, selfie in uniform). Photos are retained on the service.

Built with Next.js 14 (App Router) + TypeScript + Tailwind.

---

## Run it locally (2 minutes)

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

**Storage:** by default we use a JSON file at `./.data/db.json`. Zero setup. This is MVP-grade — fine for review, not for real production traffic.

**To create the first admin:**
1. Go to `/signup`
2. Click "+ have an admin code?" at the bottom of the form
3. Enter the admin code (default: `letmein` — change via `ADMIN_CODE` env var)
4. Submit

Any subsequent signups without the admin code become regular drivers.
If `APPROVED_DRIVER_EMAILS` is set, only listed driver emails can sign up.

---

## Environment variables

| Variable | Required? | Purpose |
|---|---|---|
| `AUTH_SECRET` | Production: yes | Secret for signing JWT session cookies. Any random 32+ char string. |
| `ADMIN_CODE` | No | Code to claim admin role at signup. Defaults to `letmein`. Change it. |
| `POSTGRES_URL` | Production: yes | If set, uses Vercel Postgres instead of the local JSON file. |
| `NEXT_PUBLIC_BASE_URL` | No | Base URL for redirects after logout. Defaults to `http://localhost:3000`. |
| `NEXT_PUBLIC_VIA_REDIRECT_URL` | No | Redirect/deep-link target after successful daily inspection submit (e.g. Via mobile app). |
| `NEXT_PUBLIC_DISPATCH_PHONE` | No | Phone number used by the driver "Call dispatch" button for approved shifts. |
| `APPROVED_DRIVER_EMAILS` | No | Comma-separated allowlist for driver signup emails. If set, only these can create driver accounts. |
| `DRIVER_PASSWORD_RESET_CODE` | No | Required for phone-based password reset. Must be shared by dispatch only after identity verification. |

Copy `.env.example` to `.env.local` when running locally.

---

## Deploy to Vercel

1. Push this folder to a new GitHub repo.
2. On https://vercel.com, click "Add New → Project" and import the repo.
3. Under **Storage**, add a Postgres database. Vercel will auto-inject `POSTGRES_URL` and friends.
4. Under **Environment variables**, add:
   - `AUTH_SECRET` → any random string (at least 32 chars)
   - `ADMIN_CODE` → something only your team knows
5. Deploy. First page load will auto-create the database tables.

---

## Project structure

```
src/
  lib/
    db.ts          # Storage layer. Postgres (prod) or JSON file (local).
    auth.ts        # JWT sessions via jose, cookie-based.
    week.ts        # Monday-start weeks, Friday cutoff logic.
  app/
    page.tsx       # Marketing/landing page
    (auth)/
      signup/      # Account creation (driver or admin via code)
      login/
    driver/
      page.tsx     # Main: shifts for next week, claim availability
      inspection/  # Daily 5-photo inspection upload
      history/     # Past submitted inspections
    admin/
      page.tsx     # Claims dashboard: approve / deny with reason
      offerings/   # Post new shifts (date, time, label, notes)
      inspections/ # View all submitted driver inspections
      drivers/     # Roster of drivers + admins
    logout/
  components/
    TopNav.tsx
```

---

## Known MVP shortcuts (for the reviewer)

These are intentional trade-offs for "build it today":

- **Inspection photos are stored as base64 data URLs in the database.** Fine for <100 drivers. Before scaling, swap to Vercel Blob or S3 — the only code that reads `data_url` is in two places (`src/app/driver/inspection/page.tsx`, `src/app/admin/inspections/page.tsx`) and `submitInspectionAction`.
- **No email verification on signup.** Add before inviting drivers outside the team.
- **No rate limiting** on login or signup. Add middleware before public launch.
- **Weeks are server-time based** (no per-user timezone). All users assumed same TZ. Fine for a single-region op.
- **Schema bootstrap runs on first Postgres query** (see `ensureSchema` in `db.ts`). For real production, replace with proper migrations (e.g., Drizzle, Prisma).
- **No audit trail** on claim decisions beyond `decided_at`. Add an `audit_log` table if compliance needs it.

---

## What's in it

**Driver flow**
- Signup (driver by default) → sees landing page → goes to `/driver`
- `/driver`: shifts posted for next week, grouped by day. Click "I'm available" on each. Shows pending/approved/denied badges + denial reason.
- `/driver/inspection`: submit 5 labeled photos. One submission per calendar day. Mobile camera capture supported.
- `/driver/history`: all past inspections.

**Admin flow**
- Signup with admin code → `/admin`
- `/admin`: list of all pending claims for next week. Approve one-click. Deny requires a reason (shown to driver).
- `/admin/offerings`: add new shifts. Day picker, time presets (Early AM, Morning, Midday, Evening, Late night). Delete (warns if it has claims).
- `/admin/offerings`: includes a planning-week toggle (default next week, emergency current week).
- `/admin/inspections`: every submitted inspection, photos click-to-expand.
- `/admin/drivers`: roster.

---

## Questions for the reviewer

Worth deciding before public launch:

1. What's the escalation path when a driver disputes a denial reason?
2. What happens to photos after N days? (GDPR / retention policy)
3. Should drivers be able to edit their claims after approval?
4. Do we need partner-level visibility (e.g. show "this shift is for Partner X" to the driver)?
