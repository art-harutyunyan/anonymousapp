# Anonymous Match — Setup Guide

## Prerequisites
- Node.js 20+
- A free Supabase account (supabase.com)

---

## Step 1 — Configure environment variables

Open `.env.local` and replace the placeholder values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key-here
```

Get these from **Supabase Dashboard → Project Settings → API**.

---

## Step 2 — Run database migrations

Open the **Supabase SQL Editor** and run each file in order:

| Order | File | What it does |
|---|---|---|
| 1 | `supabase/migrations/001_schema.sql` | Tables, enums, indexes, triggers |
| 2 | `supabase/migrations/002_rls_and_functions.sql` | RLS policies + discovery/match functions |
| 3 | `supabase/migrations/004_storage.sql` | Avatar storage bucket + policies |
| 4 | `supabase/migrations/003_seed.sql` | Optional — 10 test users |

**Tip:** Copy each file's contents → paste into SQL Editor → click Run.

---

## Step 3 — Create test users (for seed data)

If you want the seed data to work:

1. Go to **Supabase Dashboard → Authentication → Users**
2. Create 10 users with these emails (password: `Password123!`):
   ```
   alice@test.com    bob@test.com     carol@test.com
   dave@test.com     eve@test.com     frank@test.com
   grace@test.com    henry@test.com   iris@test.com
   jack@test.com
   ```
3. Copy the UUIDs shown next to each user
4. Replace the placeholder UUIDs in `003_seed.sql` and run it

---

## Step 4 — Enable Realtime

In Supabase Dashboard → **Database → Replication**, make sure `messages` and `matches` tables are enabled for Realtime. (The migration attempts this automatically, but verify it in the UI.)

---

## Step 5 — Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Page reference

| URL | Description | Auth required |
|---|---|---|
| `/` | Landing page | No |
| `/auth` | Sign in / Sign up | No |
| `/onboarding` | Profile setup wizard | Yes |
| `/discover` | Card-based discovery | Yes + profile complete |
| `/matches` | Your match list | Yes |
| `/chat/[matchId]` | Realtime chat | Yes |
| `/settings` | Profile, security, blocked | Yes |
| `/premium` | Premium features | Yes |
| `/admin` | Moderation dashboard | Yes + is_admin = true |

---

## Making a user admin

```sql
UPDATE profiles SET is_admin = TRUE WHERE id = 'your-user-uuid-here';
```

---

## Tech stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui (base-ui)
- **Backend:** Supabase (Auth + PostgreSQL + Realtime + Storage)
- **State:** Zustand
- **Forms:** React Hook Form + Zod v4
