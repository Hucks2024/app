# Packmates

Meet people like you. A free map of meetups: run, walk, coffee, pint.

Live at [packmates.live](https://packmates.live). The name, tagline and
domain all live in `src/lib/site.ts`.

## How it works

- Sign in with email (or Apple / Google when their keys are set).
- A face photo is needed before you join or host, so people know who to
  look for.
- Anyone can join a meetup. To post one, you go to one first (anywhere).
- People at the same meetup can give each other a 👍 afterwards, or a 🚩.
  Three flags from people you've met is a lifetime ban.
- No messages between members and no browsing people. Logged-out visitors
  see the map but never the details of a meetup.
- Bots are turned away at the door (`src/proxy.ts`), signups are checked
  for bots (`src/lib/bots.ts`), and posts can't carry links, so there are
  no adverts.

## Tech

- Next.js 16 (App Router, Server Actions), Tailwind CSS
- Prisma 7 with libSQL: Turso in production, a local SQLite file in dev
- Session cookies signed with `jose`, passwords hashed with `bcryptjs`
- Email (password reset codes only) through Resend

## Local development

```bash
npm install
cp .env.example .env    # set SESSION_SECRET (openssl rand -base64 32)
npx prisma migrate dev
npm run db:seed         # makes the admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev
```

Open http://localhost:3000.

## Deploying

The app runs on Vercel with a Turso database.

1. Import the repo into Vercel.
2. Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` and `SESSION_SECRET`.
   Optional: `RESEND_API_KEY` for password reset emails, and the Apple /
   Google keys (see `.env.example`).
3. Point packmates.live at Vercel:
   - Vercel → Settings → Domains → add `packmates.live` and
     `www.packmates.live`.
   - WordPress.com → Domains → `packmates.live` → Name servers → use
     `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.
4. For password reset emails, follow the Email steps on `/admin`.

## GitHub Actions

- **Health check**: read-only. Shows where the domains point, and member
  and meetup counts. Never prints emails.
- **Make admin**: gives an existing member the admin role.
