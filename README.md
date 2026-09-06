# Pacemates

A small, verified community for organizing group runs — built because open
"anyone can join" meetup boards are an easy place for creeps to hide behind a
fake profile. Every member here submits a selfie + a government photo ID,
which a human admin reviews before that person can join or host a single run.

Rename it anytime — the display name, tagline, and domain all live in one
place: `src/lib/site.ts`.

## How it works

- **Sign up** → account is created with `verificationStatus: UNSUBMITTED`.
- **Verify** (`/verify`) → upload a selfie + photo ID. Both are stored as
  binary blobs directly in the database (not a public file store), status
  becomes `PENDING`.
- **Admin review** (`/admin`, admin accounts only) → an admin looks at the
  selfie next to the ID photo and approves or rejects. On a decision, the ID
  photo is **permanently deleted from the database** — it's only needed once
  to make the call, not kept around. The selfie becomes the person's public
  profile photo once approved.
- Only members with `verificationStatus: APPROVED` can post a run, join a
  run, or post in a run's discussion thread. Everyone else can browse but
  not interact.
- Any member can **report** another member from a run's participant list.
  Open reports show up in `/admin`, where an admin can suspend the account.

This is a manual-review trust & safety flow, not an automated identity/KYC
check — there's no biometric face-matching happening, just a person looking
at two photos side by side. That's a deliberate choice: it's free, keeps ID
data out of a third party's hands, and is enough for a small community. If
you outgrow manual review, look at a dedicated identity-verification API
(e.g. Stripe Identity, Persona) and swap it in at `src/app/verify/actions.ts`
and `src/app/admin/actions.ts`.

## Tech stack

- **Next.js 14** (App Router, Server Actions — no separate API layer for most
  features)
- **Prisma + SQLite** — one small `.db` file, see the production note below
- **Tailwind CSS**
- Session auth via signed httpOnly cookies (`jose` + `bcryptjs`), no
  third-party auth provider

## Local development

```bash
npm install
cp .env.example .env
# edit .env — at minimum set a real SESSION_SECRET (openssl rand -base64 32)

npx prisma migrate dev --name init
npm run db:seed      # creates the admin account from ADMIN_EMAIL/ADMIN_PASSWORD

npm run dev
```

Visit `http://localhost:3000`. Log in as the seeded admin to reach `/admin`
and approve your own test accounts' verification requests.

## Deploying, and connecting doyoulikepizza.com

This app deploys cleanly to **Vercel** (or any Node host).

1. Push this repo to GitHub (already done if you're reading this from the
   repo) and import it into Vercel.
2. Set the environment variables from `.env.example` in the Vercel project
   settings — `SESSION_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. **Database persistence — read this before deploying:** Vercel's
   serverless functions have a read-only/ephemeral filesystem in production,
   so a plain SQLite file (`file:./dev.db`) will **not** persist between
   requests there. You have two good options:
   - **Turso** (recommended) — a hosted, SQLite-compatible database
     ([turso.tech](https://turso.tech)) with a free tier. Create a database,
     then point `DATABASE_URL` at the `libsql://...` connection string it
     gives you.
   - **Host with a real disk** — Render, Fly.io, or a small VPS all support
     a persistent volume, so the SQLite file just lives on disk normally.
   Either way, run `npx prisma migrate deploy` against the production
   `DATABASE_URL` once before first use (the `build` script already does
   this automatically on deploy).
4. **Point doyoulikepizza.com at it:** in the Vercel project → Settings →
   Domains, add `doyoulikepizza.com` (and `www.doyoulikepizza.com` if you
   want both). Vercel will show you the DNS records to add — usually an `A`
   record (or `ALIAS`/`ANAME`) for the apex domain and a `CNAME` for `www` —
   at whatever registrar/DNS provider you bought the domain through. DNS
   changes can take anywhere from a few minutes to a few hours to propagate.
5. Once the domain is live, update `NEXT_PUBLIC_SITE_URL` to
   `https://doyoulikepizza.com` (already the default) and redeploy so the
   Open Graph/canonical tags match.

## Data model

- `User` — profile info, verification status, account status, role
- `VerificationRequest` — the selfie/ID pair for one verification attempt;
  `idPhoto` is nulled out once reviewed
- `RunActivity` — a posted run (title, location, time, distance, pace, cap)
- `Participation` — who joined/waitlisted/left which run
- `Comment` — per-run discussion thread
- `Report` — one member flagging another, reviewed by an admin

## Safety notes for whoever runs this

- You (the admin) are personally in the loop reviewing ID photos — treat
  that data carefully. It's deleted automatically after review, but while
  pending it's sitting in your database, so keep `SESSION_SECRET` and your
  database credentials private, and serve the app over HTTPS in production
  (Vercel does this by default).
- This is a small-scale, self-hosted trust & safety system, not a
  substitute for real-world caution. Consider adding a "meet in a public
  place for the first run" note somewhere visible, and take reports
  seriously.
