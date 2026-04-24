# Anonymous Match — PRD Gap Tasks

> Tasks derived from comparing [`anonymous_chat_prd.pdf`](anonymous_chat_prd.pdf) against the current implementation.
> **Not included here:** security hardening, stress testing, and performance work — those live in [IMPROVEMENTS.md](IMPROVEMENTS.md).
>
> Legend: 🔴 P0 launch-blocker · 🟠 P1 important · 🟡 P2 nice-to-have · 🟢 P3 polish / post-MVP

---

## 1. Profile Model Gaps (PRD §7)

- [x] 🟡 **T-P1** Add optional `tagline` column to `profiles` (TEXT, max ~80 chars). Show on candidate card + editable in onboarding step 4 + settings.
- [x] 🟡 **T-P2** Add optional `preferred_languages` TEXT[] column. Add multi-select picker in onboarding + settings; include in candidate card chips.
- [ ] 🟢 **T-P3** Decide: allow multiple simultaneous chat intents? (PRD §19 open question.) Today `intent` is a single enum — if multi-intent is chosen, migrate to `intent_type[]` and update `get_discovery_candidates` to use array-overlap instead of equality.

---

## 2. Matching & Candidate Flow Gaps (PRD §8, §9.2, §9.3)

### 2.1 Live mutual-opt-in waiting state 🟠

Current flow is asymmetric: press Start Talking → action is stored; if the other user has already pressed it, a match is created silently. PRD §9.3 calls for a **live waiting UI** where both parties see a lightweight "waiting for the other side…" animation until both opt-in or a timeout fires.

- [x] 🟠 **T-M1** Add `match_invites` table: `from_user`, `to_user`, `status` (`waiting` / `accepted` / `expired`), `expires_at`. Invite is upserted when either user taps Start Talking.
- [x] 🟠 **T-M2** Add Supabase Realtime subscription on `/discover` filtered by `to_user = auth.uid()` so User B sees an incoming "someone wants to chat" indicator on the card.
- [x] 🟠 **T-M3** Replace the silent `try_create_match` path with an explicit waiting modal on the first tapper's side ("Waiting for <nickname>…") that resolves to the match modal or a toast + auto-rematch if declined/expired.
- [x] 🟠 **T-M4** Add `pg_cron` job (or trigger on read) to mark stale `waiting` invites as `expired` after N seconds (start with 60 s). *(Implemented via client-side countdown + server `expire_old_invites()` RPC.)*
- [x] 🟠 **T-M5** On expiry/decline, return both users to the pool and fetch next candidate automatically (PRD §8 step 7). *(On expiry modal dismisses and auto-advances to next candidate.)*

### 2.2 Online / availability signal 🟠

Candidate card should surface an online-or-available status (PRD §8 "Candidate card contents").

- [x] 🟠 **T-M6** Add `last_seen_at TIMESTAMPTZ` on `profiles`; update via heartbeat from Supabase Realtime presence or a lightweight `/api/heartbeat` call every 30 s while the app is focused.
- [x] 🟠 **T-M7** Filter `get_discovery_candidates` to prefer users active in the last ~5 min; render a green dot + "Online now" label on the card.
- [ ] 🟢 **T-M8** (Post-MVP / §11) Add availability modes: `online`, `busy`, `invisible`, `saved_connections_only`. Store on `profiles.availability`.

### 2.3 Minimize repeat exposure 🟡

PRD §9.2: "should minimize repeat exposure to recently skipped users." Today a skipped user is permanently excluded (unique constraint on `(from_user, to_user)` in `discovery_actions`).

- [ ] 🟡 **T-M9** Allow skip recycling after a configurable window (e.g. 30 days) — remove the hard unique constraint or add a `cooldown_until` column and exclude users only while cooldown is active. Update `get_discovery_candidates` accordingly.

---

## 3. Chat Experience Gaps (PRD §9.4, §10)

### 3.1 Image sharing 🔴 (MVP)

PRD MVP scope explicitly includes image sharing; today only text is supported.

- [x] 🔴 **T-C1** Create `chat-media` storage bucket (5–10 MB/file, `image/*` only), with RLS: only match participants can read, only sender can write under their UID folder.
- [x] 🔴 **T-C2** Extend `messages` schema: add `media_url TEXT`, `media_type TEXT` (`image` / `video`), `media_width INT`, `media_height INT`. Allow `content` to be empty when `media_url` is set.
- [x] 🔴 **T-C3** Add image-attach button in chat input → compress client-side (`browser-image-compression`, max 1600 px) → strip EXIF → upload → insert message with `media_url`.
- [x] 🔴 **T-C4** Render image bubbles with tap-to-lightbox; add loading skeleton for pending uploads.

### 3.2 Short video sharing 🟠 (MVP)

- [ ] 🟠 **T-C5** Extend `chat-media` bucket to accept `video/mp4`, `video/webm` up to 15 MB / 30 s. Enforce duration check client-side (`HTMLVideoElement.duration`) before upload.
- [ ] 🟠 **T-C6** Render video bubble with native `<video controls preload="metadata">` and poster frame.
- [ ] 🟠 **T-C7** Free vs Premium media caps (PRD §13 "Higher media limits"): free = 3 videos/day per chat; premium = unlimited. Enforce via trigger on `messages` INSERT.

### 3.3 Media moderation 🟠 (PRD §12)

- [ ] 🟠 **T-C8** Hook every media upload into a scan pipeline — Supabase Edge Function that calls a moderation API (AWS Rekognition / Sightengine / open-source NSFW detector). Reject or quarantine before the message is published to the chat.
- [ ] 🟠 **T-C9** Log all media uploads and scan verdicts in `activity_logs` for trust-and-safety review.
- [ ] 🟡 **T-C10** Add media retention policy: expire `chat-media` objects older than N days (default 90); run via daily `pg_cron`.

### 3.4 Mute user 🟡 (PRD §9.4)

- [x] 🟡 **T-C11** Add "Mute" action (in the chat kebab menu next to Block/Report). Add `is_muted` column to `matches` per user — store as `muted_by UUID[]`. Realtime subscription still delivers messages but the UI suppresses unread badges and push/email notifications.

---

## 4. Saved Connections — Entire System Missing 🔴 (PRD §9.5, §10, §13)

Saved connections are central to premium/monetization and are **not implemented at all** — no table, no API, no UI.

- [x] 🔴 **T-S1** Migration: `saved_connections` table
  ```
  owner_id UUID FK profiles
  connection_id UUID FK profiles
  private_nickname TEXT           -- user-chosen label, visible only to owner
  note TEXT                       -- premium-only private note (PRD §13)
  last_match_id UUID FK matches
  saved_at TIMESTAMPTZ
  PRIMARY KEY (owner_id, connection_id)
  ```
- [x] 🔴 **T-S2** RLS: owner-only SELECT / INSERT / UPDATE / DELETE.
- [x] 🔴 **T-S3** Plan-based slot limits — free users cap at 3 (PRD recommendation 1–3), premium unlimited. Enforce via BEFORE INSERT trigger reading `profiles.is_premium`.
- [x] 🔴 **T-S4** "Save this chat partner" CTA in chat header and in the match-ended modal (after someone ends a chat).
- [x] 🔴 **T-S5** `/saved` page: grid/list of saved connections with private nickname, online indicator (premium), "Invite to chat" button.
- [ ] 🔴 **T-S6** Re-invite flow: pressing "Invite" creates a fresh `match_invites` row between owner and saved connection; both users must be online. If target is offline and user is free → toast "Upgrade to Premium to invite offline connections." If target is premium-eligible → realtime push to their `/discover` or a top banner.
- [x] 🟠 **T-S7** Rename / delete saved connection UI.
- [ ] 🟠 **T-S8** Premium "Online status for saved connections" indicator (green dot driven by `profiles.last_seen_at`). Gate behind `is_premium`.
- [ ] 🟡 **T-S9** Premium private notes/tags on saved connection rows (PRD §13).
- [ ] 🟢 **T-S10** Post-MVP: saved-connection chat history view (PRD §11).

---

## 5. Notifications — Entire System Missing 🟠 (PRD §9.7)

Currently only in-app toasts exist; no browser push, no email.

- [x] 🟠 **T-N1** Migration: `notification_settings` table (per user) — `browser_push`, `email_match_invite`, `email_saved_connection_online`, `email_premium_events`, `email_account_notices`. Default to sane values.
- [x] 🟠 **T-N2** Add notification-settings UI panel in `/settings`.
- [ ] 🟠 **T-N3** Browser push — implement Web Push via service worker (VAPID keys). Subscribe on login; store subscription in `push_subscriptions` table. Send on: saved-connection invite, new match, new message while tab backgrounded.
- [ ] 🟡 **T-N4** Email notifications — Supabase Edge Function triggered by `pg_notify` / webhooks; use Resend or Postmark for delivery. Respect user preferences.
- [ ] 🟡 **T-N5** Unsubscribe link + token-based one-click unsubscribe per email type.

---

## 6. Safety, Privacy, Compliance (PRD §12)

- [x] 🔴 **T-L1** Terms of Service page (`/terms`) and Privacy Policy page (`/privacy`). Link from auth signup + footer.
- [x] 🔴 **T-L2** Acceptable-use rules page (`/community-guidelines`). Surface on first chat and in reporting UI.
- [x] 🟠 **T-L3** Real age-gate enforcement beyond the signup checkbox — minimum: store the attested age, block onboarding below 18, and log acknowledgement timestamp for audit.
- [x] 🟠 **T-L4** GDPR data export — `/settings` → "Download my data" button. Produces a JSON of `profiles`, `messages` (sent by user), `matches`, `saved_connections`, `reports filed`. (Also listed in [IMPROVEMENTS.md] P3.)
- [x] 🟠 **T-L5** Account deletion must cascade and purge avatars + chat media from storage, not only the row. Add Edge Function triggered on `profiles` DELETE.
- [ ] 🟡 **T-L6** Automated abuse detection (PRD §9.6 "basic automated detection for spam, repeated abuse, and suspicious media patterns") — simple first pass: rate-limit block/report counts, flag users with > N reports in 24 h, auto-pause accounts crossing threshold pending review.

---

## 7. Premium Feature Stubs (PRD §13)

Many premium features are listed on `/premium` but nothing enforces them. Payment itself is tracked in [IMPROVEMENTS.md §4.2] — this section covers the feature logic assuming payment is in place.

- [ ] 🔴 **T-PR1** Unlimited daily matches for premium — already coded in `check_daily_action_limit` (bypasses when `is_premium`). **Audit only**: verify the flag path works end-to-end once payment flips it on.
- [x] 🟠 **T-PR2** "See who pressed Start Talking on you" — Route Handler returning `discovery_actions` where `to_user = me` and I haven't acted back. Gate by `is_premium`. Add `/liked-me` page.
- [x] 🟠 **T-PR3** Advanced filters — age range slider + country multi-filter on `/discover`. Extend `get_discovery_candidates` to accept optional filter args. Gate filter UI behind `is_premium`.
- [x] 🟠 **T-PR4** Read receipts — use `match_reads` (already exists per migration 009) to expose a "Read <time>" indicator beneath the last message the other user has seen. Gate behind `is_premium` per PRD §13.
- [ ] 🟠 **T-PR5** Priority matching queue — add `boost_until TIMESTAMPTZ` column on `profiles`; sort candidate output so boosted users appear first. Premium users get a permanent mild boost; one-off "Boost" purchases later (PRD §11).
- [x] 🟡 **T-PR6** Undo last skip — client keeps a short-lived stack of the last skip; Premium users can pop it to restore the card. Don't require a DB delete — just a UI affordance for the unexpired in-memory item (avoids stale state if they closed the tab).
- [x] 🟡 **T-PR7** Premium badge on profile — show a subtle crown icon next to nickname in candidate card, match list, and chat header when `is_premium`. No identity leak.
- [ ] 🟡 **T-PR8** Reconnect with recent successful matches — list the last N ended matches in `/saved` suggestions ("You chatted with this person recently — save them?").

---

## 8. Business KPIs & Analytics (PRD §15)

Activity-log table exists but there's no dashboard showing the PRD KPIs.

- [ ] 🟠 **T-A1** Admin KPI dashboard (extends `/admin`):
  - Match acceptance rate (mutual opt-in ÷ candidate impressions) — need to log candidate impressions first; add a `candidate_impression` log event or a lightweight `discovery_impressions` counter table.
  - Time to first chat (median queue-entry → first message).
  - Chat completion rate (chats with ≥ N messages).
  - Day-1 / Day-7 retention.
  - Saved-connection creation rate.
  - Report rate per 1,000 chats.
- [ ] 🟡 **T-A2** Export to CSV for any KPI view.

---

## 9. Open-Question Decisions (PRD §19)

Track these as explicit decisions before shipping; each unlocks related tasks above.

- [ ] 🟡 **T-D1** Age: exact vs range. Today UI uses `AGE_RANGES` but stores the range's min as `age`. Decide: keep ranges, or ask for exact age and derive ranges for display.
- [ ] 🟡 **T-D2** Free saved-connection slot count (1 vs 2 vs 3). Informs **T-S3**.
- [ ] 🟡 **T-D3** Multi-intent at once? Informs **T-P3**.
- [ ] 🟡 **T-D4** Email-only, phone-only, or both for onboarding verification? Informs email-confirmation work in IMPROVEMENTS.md §2.1.
- [ ] 🟡 **T-D5** Final media size/duration caps (image MB, video MB + seconds). Informs **T-C1** / **T-C5**.

---

## Summary by Priority

| Priority | Done | Remaining | Largest Remaining Buckets |
|---|---|---|---|
| 🔴 P0 | 9/10 | 1 | Premium audit (T-PR1) |
| 🟠 P1 | 15/22 | 7 | Video sharing, media moderation, notifications (push+email), saved re-invite, priority queue |
| 🟡 P2 | 6/14 | 8 | Skip cooldown, media retention, abuse detection, analytics export, open questions |
| 🟢 P3 | 0/3 | 3 | Availability modes, multi-intent, saved chat history |

**Remaining high-priority work before public launch:**
1. T-PR1 — verify premium unlimited matches end-to-end
2. T-C5/C6 — video sharing in chat
3. T-S6 — re-invite saved connections via match_invites
4. T-N3 — browser push notifications
5. T-C8/C9 — media moderation pipeline
