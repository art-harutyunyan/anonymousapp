# Anonymous Match — Implementation Plan

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) + TypeScript | File-based routing, SSR/SSG, API routes |
| Styling | Tailwind CSS + shadcn/ui | Utility-first, composable dark-theme components |
| Backend/DB | Supabase | Auth, PostgreSQL, Realtime, Storage — all-in-one |
| State | Zustand | Lightweight client state (auth, chat, discovery queue) |
| Forms | React Hook Form + Zod | Typed validation on all user inputs |

---

## Database Question — What I Can Do vs. What I Need From You

### What I will generate
- Full SQL schema (tables, indexes, enums)
- Row-Level Security (RLS) policies for every table
- Seed data script for local testing
- Supabase Storage bucket config
- Realtime subscription setup

### What I cannot do automatically
I cannot create or connect to your Supabase project directly. You need to do two things once:

1. **Create a free Supabase project** at [supabase.com](https://supabase.com) → copy your `Project URL` and `anon public key`
2. **Paste them into the `.env.local` file** I will generate (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

After that, I will provide a single SQL migration file you can run in the Supabase SQL Editor (one click → paste → Run). That creates every table, policy, and seed row automatically.

If you have the **Supabase CLI** installed (`npm i -g supabase`), I can also wire up `supabase/migrations/` so `supabase db push` handles everything for you.

---

## Pages Overview

| Page | Route | Auth Required |
|---|---|---|
| Landing | `/` | No |
| Auth | `/auth` | No |
| Profile Onboarding | `/onboarding` | Yes |
| Discover | `/discover` | Yes + profile complete |
| Matches | `/matches` | Yes |
| Chat | `/chat/[matchId]` | Yes |
| Settings | `/settings` | Yes |
| Premium | `/premium` | Yes |
| Admin Dashboard | `/admin` | Yes + admin role |

---

## Task List

### Phase 1 — Project Bootstrap

- [ ] **T-01** Initialize Next.js 14 project with TypeScript, Tailwind CSS, ESLint
- [ ] **T-02** Install and configure shadcn/ui (dark theme, neutral palette)
- [ ] **T-03** Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `zustand`, `react-hook-form`, `zod`, `lucide-react`
- [ ] **T-04** Create `.env.local` template and Supabase client helpers (`lib/supabase/client.ts`, `lib/supabase/server.ts`)
- [ ] **T-05** Configure global dark theme in `tailwind.config.ts` and `globals.css`
- [ ] **T-06** Build shared layout shell: `<Navbar>`, `<BottomNav>` (mobile), sidebar (desktop)

---

### Phase 2 — Supabase Schema & Policies

- [ ] **T-07** Design and write schema for the following tables:
  - `profiles` — uid, nickname, gender, age, looking_for_gender, chat_intent, interests[], country, avatar_url, is_premium, is_banned, created_at
  - `discovery_actions` — from_user, to_user, action (`start_talking` | `skip`), created_at
  - `matches` — id, user_a, user_b, created_at, is_active
  - `messages` — id, match_id, sender_id, content, created_at, is_deleted
  - `blocks` — blocker_id, blocked_id, created_at
  - `reports` — id, reporter_id, reported_id, reason, details, status (`pending` | `reviewed` | `actioned`), created_at
  - `admin_notes` — id, report_id, admin_id, note, created_at

- [ ] **T-08** Write all RLS policies (see RLS section below)
- [ ] **T-09** Write Supabase Storage bucket config for `avatars`
- [ ] **T-10** Write seed data: 10 test users with varied profiles and some pre-existing matches/messages

---

### Phase 3 — Authentication

- [ ] **T-11** Build `/auth` page: tabbed Sign Up / Sign In forms with email + password
- [ ] **T-12** Wire Supabase Auth (`signUp`, `signInWithPassword`, `signOut`)
- [ ] **T-13** Add auth middleware (`middleware.ts`) — redirect unauthenticated users to `/auth`, redirect users without a complete profile to `/onboarding`
- [ ] **T-14** Add 18+ acknowledgement checkbox on sign-up (required, stored in profile)
- [ ] **T-15** Build landing page `/` with hero, feature highlights, and CTA → `/auth`

---

### Phase 4 — Profile Onboarding

- [ ] **T-16** Build multi-step onboarding wizard (`/onboarding`):
  - Step 1: Gender, Age
  - Step 2: Looking for (gender), Chat intent (friendship | dating | casual | talk)
  - Step 3: Interests (multi-select tag picker, 5–15 options)
  - Step 4: Optional — Nickname, Country, Avatar upload
- [ ] **T-17** On completion, write `profiles` row and set `onboarding_complete = true`
- [ ] **T-18** Validate that user is 18+ before allowing profile save

---

### Phase 5 — Discovery Engine

- [ ] **T-19** Write matching query (PostgreSQL function or server action):
  - Filter: gender preference match (bidirectional), age range overlap, same chat intent
  - Exclude: blocked users (both directions), already-actioned users, current active matches
  - Rank: descending count of shared interests
  - Limit: return next N candidates
- [ ] **T-20** Build `/discover` page:
  - Fetch candidate queue on load
  - Render one card at a time showing: nickname (or "Anonymous"), age, interests, chat intent, country (optional)
  - "Start Talking" button → records `start_talking` action
  - "Skip" button → records `skip` action, advances queue
  - Empty state when no more candidates
- [ ] **T-21** After recording `start_talking`: check if the other user already pressed `start_talking` on this user → if mutual, create `matches` row and show "It's a match!" modal
- [ ] **T-22** Card animation: slide-out on skip, pop effect on match

---

### Phase 6 — Matches & Realtime Chat

- [ ] **T-23** Build `/matches` page:
  - List all active matches
  - Show last message preview and unread indicator
  - Tap/click → opens `/chat/[matchId]`
- [ ] **T-24** Build `/chat/[matchId]` page:
  - Load message history from `messages` table
  - Subscribe to Supabase Realtime channel for new messages
  - Message input + send (inserts into `messages`)
  - Show sender's nickname (or "Anonymous") and timestamp
  - Mark messages read on view
- [ ] **T-25** Add block/report shortcut in chat header (kebab menu)

---

### Phase 7 — Settings & Safety

- [ ] **T-26** Build `/settings` page:
  - Edit profile fields (interests, chat intent, etc.)
  - Change password
  - Upload/change avatar
  - View and unblock blocked users
  - Delete account (soft-ban own profile)
- [ ] **T-27** Build block flow: confirm dialog → insert `blocks` row → remove from all active matches → hide from discovery
- [ ] **T-28** Build report flow: reason picker (spam | harassment | underage | inappropriate | other) + optional detail text → insert `reports` row → show confirmation

---

### Phase 8 — Premium Page

- [ ] **T-29** Build `/premium` page:
  - Feature comparison table (free vs. premium)
  - Premium features: unlimited daily likes, see who liked you, advanced filters (age range slider, country filter), read receipts
  - Pricing cards (monthly / annual)
  - Note: payment integration is out of scope — UI only, with a "Coming Soon" CTA or Stripe placeholder

---

### Phase 9 — Admin Moderation Dashboard

- [ ] **T-30** Build `/admin` page (role-gated):
  - Reports queue: list pending reports with reporter, reported user, reason
  - Per-report actions: Dismiss / Warn user (adds admin note) / Ban user (sets `is_banned = true`)
  - User search: look up any profile by nickname or UID
  - Basic stats: total users, active matches, reports this week

---

### Phase 10 — Polish & QA

- [ ] **T-31** Add loading skeletons for discover card, matches list, chat history
- [ ] **T-32** Add empty states for all major views
- [ ] **T-33** Add toast notifications (match created, message sent error, report submitted)
- [ ] **T-34** Mobile layout QA: bottom nav, chat input above keyboard, swipe feel
- [ ] **T-35** Security pass: verify all RLS policies, sanitize message content, rate-limit discovery actions

---

## Supabase Schema (Summary)

```sql
-- Enums
CREATE TYPE gender_type AS ENUM ('man', 'woman', 'non_binary', 'other');
CREATE TYPE intent_type AS ENUM ('friendship', 'dating', 'casual', 'talk');
CREATE TYPE action_type AS ENUM ('start_talking', 'skip');
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'actioned');

-- profiles (extends auth.users)
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname      TEXT,
  gender        gender_type NOT NULL,
  age           INT NOT NULL CHECK (age >= 18),
  looking_for   gender_type NOT NULL,
  intent        intent_type NOT NULL,
  interests     TEXT[] NOT NULL DEFAULT '{}',
  country       TEXT,
  avatar_url    TEXT,
  is_premium    BOOLEAN DEFAULT FALSE,
  is_banned     BOOLEAN DEFAULT FALSE,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- discovery_actions
CREATE TABLE discovery_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action      action_type NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user, to_user)
);

-- matches
CREATE TABLE matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- messages
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_deleted  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- blocks
CREATE TABLE blocks (
  blocker_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- reports
CREATE TABLE reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  details      TEXT,
  status       report_status DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## RLS Policy Assumptions

| Table | Who can SELECT | Who can INSERT | Who can UPDATE | Who can DELETE |
|---|---|---|---|---|
| `profiles` | Self + anyone (limited columns) | Self only (via trigger) | Self only | No one (soft delete) |
| `discovery_actions` | Self (from_user = me) | Self only | Nobody | Nobody |
| `matches` | Both matched users | Server/function only | Both users (is_active) | Nobody |
| `messages` | Both matched users | Sender only | Sender only (soft delete) | Nobody |
| `blocks` | Blocker only | Self only | Nobody | Self only |
| `reports` | Reporter + admins | Authenticated users | Admins only | Nobody |
| `admin_notes` | Admins only | Admins only | Admins only | Admins only |

---

## Delivery Order

Tasks will be implemented in the order above. Each phase is a logical milestone. After Phase 2, you will need to paste the SQL into Supabase and add your `.env.local` keys before subsequent phases can be tested end-to-end.

---

*Plan created: 2026-04-16*
