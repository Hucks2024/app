# Pacemates

A small, verified community for organizing group runs, built because open
"anyone can join" meetup boards are an easy place for creeps to hide behind a
fake profile. Every member here submits a selfie + a government photo ID,
which a human admin reviews before that person can join or host a single run.

Rename it anytime: the display name, tagline, and domain all live in one
place: `src/lib/site.ts`.

## How it works

- **Sign up** → account is created with `verificationStatus: UNSUBMITTED`.
- **Verify** (`/verify`) → upload a selfie + photo ID. Both are stored as
  binary blobs directly in the database (not a public file store), status
  becomes `PENDING`.
- **Admin review** (`/admin`, admin accounts only) → an admin looks at the
  selfie next to the ID photo and approves or rejects. On a decision, the ID
  photo is **permanently deleted from the database**, it's only needed once
  to make the call, not kept around. The selfie becomes the person's public
  profile photo once approved.
- Only members with `verificationStatus: APPROVED` can post a run, join a
  run, or post in a run's discussion thread. Everyone else can browse but
  not interact.
- Any member can **report** another member from a run's participant list.
  Open reports show up in `/admin`, where an admin can suspend the account.

This is a manual-review trust & safety flow, not an automated identity/KYC
check: there's no biometric face-matching happening, just a person looking
at two photos side by side. That's a deliberate choice: it's free, keeps ID
data out of a third party's hands, and is enough for a small community. If
you outgrow manual review, look at a dedicated identity-verification API
(e.g. Stripe Identity, Persona) and swap it in at `src/app/verify/actions.ts`
and `src/app/admin/actions.ts`.

## Tech stack

- **Next.js 16** (App Router, Server Actions, no separate API layer for most
  features)
- **Prisma 7 + SQLite** (via `@prisma/adapter-libsql`): one small `.db`
  file locally, or a hosted Turso database in production; see below
- **Tailwind CSS**
- Session auth via signed httpOnly cookies (`jose` + `bcryptjs`), no
  third-party auth provider

## Local development

```bash
npm install
cp .env.example .env
# edit .env, at minimum set a real SESSION_SECRET (openssl rand -base64 32)

npx prisma migrate dev --name init
npm run db:seed      # creates the admin account from ADMIN_EMAIL/ADMIN_PASSWORD

npm run dev
```

Visit `http://localhost:3000`. Log in as the seeded admin to reach `/admin`
and approve your own test accounts' verification requests.

## Deploying, and connecting doyoulikepizza.com

### Option A: Vercel (recommended, fully working)

1. Push this repo to GitHub (already done if you're reading this from the
   repo) and import it into Vercel.
2. Set the environment variables from `.env.example` in the Vercel project
   settings: `SESSION_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. **Database persistence (read this before deploying):** Vercel's
   serverless functions have a read-only/ephemeral filesystem in production,
   so a plain SQLite file (`file:./dev.db`) will **not** persist between
   requests there. You have two good options:
   - **Turso** (recommended): a hosted, SQLite-compatible database
     ([turso.tech](https://turso.tech)) with a free tier. Create a database,
     then set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (from the Turso
     dashboard/CLI) as env vars; the app prefers these over `DATABASE_URL`
     automatically (see `src/lib/db.ts`), no code changes needed.
   - **Host with a real disk**: Render, Fly.io, or a small VPS all support
     a persistent volume, so the plain SQLite file just lives on disk
     normally; keep using `DATABASE_URL` in that case.
   Either way, run `npx prisma migrate deploy` against the production
   database once before first use (the `build` script already does this
   automatically on deploy).
4. **Point doyoulikepizza.com at it:** in the Vercel project → Settings →
   Domains, add `doyoulikepizza.com` (and `www.doyoulikepizza.com` if you
   want both). Vercel will show you the DNS records to add, usually an `A`
   record (or `ALIAS`/`ANAME`) for the apex domain and a `CNAME` for `www`,
   at whatever registrar/DNS provider you bought the domain through (or at
   Cloudflare's DNS if that's where the domain is managed, Cloudflare can
   host your DNS and point the domain at Vercel even though the app itself
   isn't running on Cloudflare's own servers). DNS changes can take anywhere
   from a few minutes to a few hours to propagate.
5. Once the domain is live, update `NEXT_PUBLIC_SITE_URL` to
   `https://doyoulikepizza.com` (already the default) and redeploy so the
   Open Graph/canonical tags match.
6. **Redirecting an existing WordPress site to it:** if `doyoulikepizza.com`
   currently runs WordPress and you want it to *point at* this app instead,
   the cleanest approach is to change the domain's DNS to Vercel per step 4
   above and retire the WordPress hosting (rather than trying to run a
   redirect *from* WordPress, which keeps you paying for and maintaining a
   WordPress install just to bounce visitors elsewhere). If you'd rather
   keep WordPress on the root domain for now and only send some traffic
   here, deploy this app and point a subdomain (e.g. `runs.doyoulikepizza.com`)
   at it in step 4 instead, then add a link or redirect to that subdomain
   from WordPress.

### Option B: Cloudflare Workers (prepared, currently blocked)

The repo already has the Cloudflare toolchain wired up (`@opennextjs/cloudflare`,
`wrangler.jsonc`, `open-next.config.ts`, `npm run preview` / `npm run deploy`)
and the database layer supports Turso out of the box, which is exactly what a
Cloudflare deployment needs. **It doesn't run yet**, though: Prisma 7's client
tries to compile its query-engine WASM module at runtime, and Cloudflare
Workers refuses runtime WASM compilation for security reasons
(`CompileError: WebAssembly.Module(): Wasm code generation disallowed by
embedder`). This is a confirmed, open upstream bug:
[prisma/prisma#28657](https://github.com/prisma/prisma/issues/28657), not
something fixable from application code. `opennextjs-cloudflare build`
succeeds and the app boots fine on Workers; only the first real database
query fails.

If you want this running on Cloudflare specifically:
- Watch that GitHub issue: once Prisma ships a fix, this should start
  working with no code changes (the adapter/Turso wiring is already in
  `src/lib/db.ts`), just re-run `npm run preview` to confirm, then
  `npm run deploy`.
- Or swap the ORM for one with solid Cloudflare support today, e.g.
  [Drizzle ORM](https://orm.drizzle.team/): a bigger rewrite (every query in
  `src/app/**/actions.ts` and `page.tsx` would need converting), not
  something done here without asking first.
- In the meantime, Cloudflare can still front the app in a DNS-only sense:
  use Cloudflare as your registrar/DNS provider while the app itself runs on
  Vercel (Option A), this is what most people actually want out of "point
  my Cloudflare domain at my app" anyway.

## Data model

- `User`: profile info, verification status, account status, role
- `VerificationRequest`: the selfie/ID pair for one verification attempt;
  `idPhoto` is nulled out once reviewed
- `RunActivity`: a posted run (title, location, time, distance, pace, cap)
- `Participation`: who joined/waitlisted/left which run
- `Comment`: per-run discussion thread
- `Report`: one member flagging another, reviewed by an admin

## Safety notes for whoever runs this

- You (the admin) are personally in the loop reviewing ID photos, treat
  that data carefully. It's deleted automatically after review, but while
  pending it's sitting in your database, so keep `SESSION_SECRET` and your
  database credentials private, and serve the app over HTTPS in production
  (Vercel does this by default).
- This is a small-scale, self-hosted trust & safety system, not a
  substitute for real-world caution. Consider adding a "meet in a public
  place for the first run" note somewhere visible, and take reports
  seriously.
