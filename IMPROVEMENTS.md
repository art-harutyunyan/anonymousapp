# Anonymous Match — Improvement Plan & Stress Test Guide

> Status snapshot: **early-stage MVP**, structurally sound, ready for ~500 concurrent users.
> Critical work needed before public launch: payment, spam prevention, performance tuning.

---

## 1. Priority Matrix

| Priority | Area | Why |
|---|---|---|
| 🔴 P0 | Email verification | Spam accounts trivial without it |
| 🔴 P0 | Payment integration | Premium is cosmetic today |
| 🔴 P0 | Discovery query performance | O(N×M) collapses under load |
| 🟠 P1 | CAPTCHA on signup | Bot farms |
| 🟠 P1 | Rate-limit caching | Per-INSERT COUNT scan at scale |
| 🟠 P1 | Admin audit logging | No trail of bans/unbans |
| 🟡 P2 | Password reset UI | Currently inaccessible |
| 🟡 P2 | Security headers | next.config has none |
| 🟡 P2 | Image optimization + EXIF strip | Privacy + storage cost |
| 🟢 P3 | Read receipts | Premium feature stub |
| 🟢 P3 | Multi-device session mgmt | Quality of life |
| 🟢 P3 | GDPR data export | Compliance |

---

## 2. Security Improvements

### 2.1 Email Verification (P0)

Supabase can enforce confirmation before first login — currently it's off.

```sql
-- Supabase Dashboard → Authentication → Settings
-- Enable "Confirm email" toggle
-- OR via supabase CLI:
-- supabase auth config set --confirm-email true
```

**Impact:** eliminates throwaway account spam without any code change.

---

### 2.2 CAPTCHA on Signup (P1)

Add Cloudflare Turnstile (free, privacy-friendly) to the auth form.

```tsx
// app/auth/page.tsx — add to sign-up form
import Turnstile from 'react-turnstile'

// In form state:
const [cfToken, setCfToken] = useState('')

// In JSX:
<Turnstile
  siteKey={process.env.NEXT_PUBLIC_CF_TURNSTILE_KEY!}
  onSuccess={(token) => setCfToken(token)}
/>

// Pass cfToken in handleSignUp → verify server-side in a Route Handler
```

---

### 2.3 Security Headers (P1)

`next.config.ts` has no security headers. Add them:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' challenges.cloudflare.com",
              "img-src 'self' blob: data: *.supabase.co",
              "connect-src 'self' *.supabase.co wss://*.supabase.co",
            ].join('; '),
          },
        ],
      },
    ]
  },
}
```

---

### 2.4 Admin Action Audit Log (P1)

Every ban/unban today shows "admin pressed button" but no record of *who* pressed it or *why*. Fix:

```sql
-- Migration 008 or new
ALTER TABLE admin_notes ADD COLUMN IF NOT EXISTS action_type TEXT;  -- 'ban' | 'unban' | 'dismiss'
ALTER TABLE admin_notes ADD COLUMN IF NOT EXISTS target_user UUID REFERENCES profiles(id);

-- In admin page: always insert an admin_notes row on every action, not just bans
```

---

### 2.5 SECURITY DEFINER Function Hardening (P1)

`get_discovery_candidates(p_user_id)` takes any UUID — a logged-in user can probe another user's candidate queue.

```sql
-- Add caller ownership check at top of function
IF auth.uid() <> p_user_id THEN
  RAISE EXCEPTION 'permission denied';
END IF;
```

Same for `try_create_match` — validate `p_actor_id = auth.uid()`.

---

## 3. Performance Improvements

### 3.1 Discovery Query — Replace IN Subqueries with Joins/CTEs (P0)

Current query runs 4 correlated `NOT IN (SELECT …)` clauses per candidate fetch.
At 10,000 discovery_actions rows this becomes a sequential scan per user.

```sql
-- Migration: rewrite get_discovery_candidates
-- Replace NOT IN with NOT EXISTS or a single exclusion CTE:
WITH excluded AS (
  SELECT to_user AS id FROM discovery_actions WHERE from_user = p_user_id
  UNION ALL
  SELECT blocked_id   FROM blocks WHERE blocker_id = p_user_id
  UNION ALL
  SELECT blocker_id   FROM blocks WHERE blocked_id = p_user_id
  UNION ALL
  SELECT CASE WHEN user_a = p_user_id THEN user_b ELSE user_a END
    FROM matches WHERE (user_a = p_user_id OR user_b = p_user_id) AND is_active
)
SELECT ... FROM profiles p
WHERE p.id NOT IN (SELECT id FROM excluded)
  AND ...
```

**Also add a composite index:**

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_discovery_actions_from_created
  ON discovery_actions(from_user, action, created_at DESC);
```

---

### 3.2 Daily Rate-Limit — Cache in a Counter Table (P1)

Current trigger does `COUNT(*) FROM discovery_actions WHERE from_user = x AND created_at >= today` on every single INSERT.
With 1,000 users each doing 20 actions, that's 20,000 COUNT queries.

```sql
-- New table: daily action counters, reset automatically
CREATE TABLE daily_action_counts (
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  day         DATE NOT NULL DEFAULT CURRENT_DATE,
  count       INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- Updated check trigger: increment counter, compare to limit
-- This reduces the check from O(rows) to O(1) PK lookup
INSERT INTO daily_action_counts(user_id, day, count)
VALUES (NEW.from_user, CURRENT_DATE, 1)
ON CONFLICT (user_id, day) DO UPDATE SET count = daily_action_counts.count + 1
RETURNING count INTO v_count;
```

---

### 3.3 Middleware — Cache Profile Lookup (P2)

Every page load calls `auth.getUser()` + `SELECT profiles WHERE id = user_id`.
With 100 concurrent sessions that's 200 Supabase round-trips per second just for navigation.

**Short-term:** Store `onboarding_complete`, `is_admin`, `is_banned` in the JWT custom claims via Supabase Auth Hook (Database Webhook on `profiles` UPDATE).
Middleware reads from `session.user.user_metadata` — zero extra queries.

```sql
-- Supabase Dashboard → Auth → Hooks → Custom Access Token Hook
-- Function reads profiles and injects claims into JWT
CREATE OR REPLACE FUNCTION custom_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  claims JSONB;
  profile_row profiles%ROWTYPE;
BEGIN
  SELECT * INTO profile_row FROM profiles WHERE id = (event->>'user_id')::UUID;
  claims := event->'claims';
  claims := jsonb_set(claims, '{onboarding_complete}', to_jsonb(profile_row.onboarding_complete));
  claims := jsonb_set(claims, '{is_admin}',            to_jsonb(profile_row.is_admin));
  claims := jsonb_set(claims, '{is_banned}',           to_jsonb(profile_row.is_banned));
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
```

---

### 3.4 Realtime — Reduce Heartbeat Overhead (P3)

Default heartbeat is every 30s, but on reconnect the socket opens one per connected client.
For 1,000 concurrent users: 1,000 WebSocket connections × heartbeat every 30s = ~33 heartbeat messages/second.
This is fine for Supabase's shared tier but will hit free-plan limits.

**Note for stress test:** simulate WebSocket connections, not just HTTP.

---

### 3.5 Activity Logs — Async Write (P2)

Every match/discovery/message triggers a sync DB write to `activity_logs`.
At high volume this adds ~5ms latency per action.

**Option A (easy):** Batch inserts using `pg_cron` to flush from an in-memory queue every minute.
**Option B (proper):** Use Supabase Edge Functions as a webhook to write logs async.

---

## 4. Feature Gaps

### 4.1 Password Reset UI (P1)

The backend supports it (Supabase sends reset emails) but there's no button.

```tsx
// app/auth/page.tsx — add to sign-in tab
<button
  type="button"
  className="text-xs text-primary underline"
  onClick={() => supabase.auth.resetPasswordForEmail(email)}
>
  Forgot password?
</button>

// app/auth/reset/page.tsx — new page for the /auth/confirm callback
// Reads the token from URL hash, calls supabase.auth.updateUser({ password })
```

---

### 4.2 Payment Integration (P0)

Stripe is the standard path. Rough integration plan:

1. Add `stripe_customer_id`, `subscription_id`, `subscription_status`, `subscription_expires_at` to `profiles`.
2. Create Supabase Edge Function: `stripe-webhook` — listens for `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`.
3. On payment success → set `is_premium = true`, record expiry.
4. Add cron job (Supabase pg_cron) to expire subscriptions daily.
5. Wire up Next.js checkout: `POST /api/stripe/checkout` → create Stripe session → redirect.

```sql
-- Migration: payment fields
ALTER TABLE profiles
  ADD COLUMN stripe_customer_id     TEXT,
  ADD COLUMN subscription_status    TEXT CHECK (subscription_status IN ('active','canceled','past_due')),
  ADD COLUMN subscription_expires_at TIMESTAMPTZ;
```

---

### 4.3 Image Optimization (P2)

Currently storing raw uploads — no resize, no EXIF strip.

```ts
// Before upload in settings/onboarding:
import { createCanvas, loadImage } from '@napi-rs/canvas'  // server-side
// OR use browser Canvas API (client-side):

const resized = await resizeToMax(file, 400, 400)  // max 400×400 px
const stripped = await stripExif(resized)          // remove GPS, device info
await supabase.storage.from('avatars').upload(path, stripped, { upsert: true })
```

**Quick win:** use `browser-image-compression` (client-side, no server needed):

```bash
npm install browser-image-compression
```

---

### 4.4 "See Who Liked You" (P3)

Premium feature currently not implemented at all. Schema already has `discovery_actions`.

```sql
-- Route: GET /api/who-liked-me
SELECT from_user FROM discovery_actions
WHERE to_user = auth.uid()
  AND action = 'start_talking'
  AND to_user NOT IN (SELECT to_user FROM discovery_actions WHERE from_user = auth.uid())
-- i.e., they liked you but you haven't acted on them yet
```

Gate behind `profile.is_premium` check in the Route Handler.

---

## 5. Stress Test Plan

### 5.1 Tool: k6

Install: https://k6.io/docs/getting-started/installation/

```bash
# Windows via Chocolatey
choco install k6

# or via npm wrapper
npm install -g k6
```

---

### 5.2 Scenario Definitions

#### Scenario A — Concurrent Sign-in (Auth Stress)

Tests Supabase Auth under concurrent login load.

```js
// scripts/stress/auth.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 50  },   // ramp up
    { duration: '1m',  target: 100 },   // hold
    { duration: '30s', target: 0   },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% under 2s
    http_req_failed:   ['rate<0.01'],   // <1% errors
  },
}

const BASE = __ENV.SUPABASE_URL + '/auth/v1'
const ANON = __ENV.SUPABASE_ANON_KEY

export default function () {
  const res = http.post(
    `${BASE}/token?grant_type=password`,
    JSON.stringify({ email: `test${__VU}@test.com`, password: 'Password123!' }),
    { headers: { 'Content-Type': 'application/json', 'apikey': ANON } }
  )
  check(res, { 'login ok': (r) => r.status === 200 })
  sleep(1)
}
```

---

#### Scenario B — Discovery Fetch (DB Query Stress)

Tests `get_discovery_candidates` — the hottest query in the app.

```js
// scripts/stress/discovery.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 100  },
    { duration: '2m',  target: 500  },  // 500 concurrent users browsing
    { duration: '30s', target: 0    },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // discovery can be slower
    http_req_failed:   ['rate<0.02'],
  },
}

const BASE = __ENV.SUPABASE_URL + '/rest/v1'
const ANON = __ENV.SUPABASE_ANON_KEY

export default function () {
  // Assumes you have the JWT for user VU (from prior auth step)
  const token = __ENV[`TOKEN_${__VU}`] || __ENV.TEST_JWT
  const res = http.post(
    `${BASE}/rpc/get_discovery_candidates`,
    JSON.stringify({ p_user_id: __ENV.TEST_USER_ID }),
    {
      headers: {
        'apikey': ANON,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )
  check(res, {
    'discovery ok':           (r) => r.status === 200,
    'returns candidates':     (r) => JSON.parse(r.body).length >= 0,
    'under 2s':               (r) => r.timings.duration < 2000,
  })
  sleep(2)
}
```

---

#### Scenario C — Message Send (Realtime + Write Stress)

Tests message INSERT + realtime broadcast under concurrent chat load.

```js
// scripts/stress/messaging.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 50,              // 50 concurrent chatters
  duration: '3m',
  thresholds: {
    http_req_duration: ['p(95)<1500'],  // sends should be fast
    http_req_failed:   ['rate<0.01'],
  },
}

const BASE = __ENV.SUPABASE_URL + '/rest/v1'
const ANON = __ENV.SUPABASE_ANON_KEY

export default function () {
  const token = __ENV.TEST_JWT
  const matchId = __ENV.TEST_MATCH_ID

  const res = http.post(
    `${BASE}/messages`,
    JSON.stringify({
      match_id:  matchId,
      sender_id: __ENV.TEST_USER_ID,
      content:   `stress test msg ${Date.now()}`,
    }),
    {
      headers: {
        'apikey': ANON,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
    }
  )
  check(res, { 'message inserted': (r) => r.status === 201 })
  sleep(0.5)  // 2 msgs/sec per user
}
```

---

#### Scenario D — Discovery Actions Spike (Rate-Limit Trigger Stress)

Tests the `check_daily_action_limit` trigger under burst conditions.
20 free users each sending all 20 daily actions in a burst at midnight UTC.

```js
// scripts/stress/actions.js
import http from 'k6/http'
import { check } from 'k6'

export const options = {
  scenarios: {
    burst: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      stages: [
        { duration: '10s', target: 200 },  // spike: 200 req/s
        { duration: '30s', target: 200 },  // hold
        { duration: '10s', target: 0   },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<5000'],
    http_req_failed:   ['rate<0.05'],  // some 429/limit errors expected
  },
}

// Use the same upsert endpoint as the app
export default function () {
  const token = __ENV.TEST_JWT
  http.post(
    `${__ENV.SUPABASE_URL}/rest/v1/discovery_actions`,
    JSON.stringify({
      from_user: __ENV.TEST_USER_ID,
      to_user:   __ENV.TARGET_USER_ID,
      action:    'start_talking',
    }),
    {
      headers: {
        'apikey': __ENV.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
    }
  )
}
```

---

### 5.3 Running Stress Tests

Add scripts to `package.json`:

```json
"stress:auth":      "k6 run --env SUPABASE_URL=$SUPABASE_URL --env SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY scripts/stress/auth.js",
"stress:discovery": "k6 run --env SUPABASE_URL=$SUPABASE_URL --env SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY --env TEST_JWT=$TEST_JWT --env TEST_USER_ID=$TEST_USER_ID scripts/stress/discovery.js",
"stress:messaging": "k6 run --env SUPABASE_URL=$SUPABASE_URL --env SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY --env TEST_JWT=$TEST_JWT --env TEST_MATCH_ID=$TEST_MATCH_ID scripts/stress/messaging.js",
"stress:all":       "k6 run scripts/stress/full.js"
```

Run:

```bash
# Single scenario
SUPABASE_URL=https://aczyriezwetgteulpcak.supabase.co \
SUPABASE_ANON_KEY=your-anon-key \
TEST_JWT=your-test-jwt \
npm run stress:discovery

# Output: k6 prints p50/p95/p99 latency, req/s, error rates
# Save results: add --out json=results/discovery.json
```

---

### 5.4 What to Watch During Stress Tests

#### Supabase Dashboard → Reports → API Performance
- Look for queries > 100ms
- `get_discovery_candidates` will show up as the top slow query

#### Supabase Dashboard → Database → Performance
- Bloat on `discovery_actions` and `activity_logs` after test
- Lock contention on `profiles` updates (ban + discovery simultaneous)

#### Connection indicator in the app
- With 500 simulated users + k6 traffic, check if heartbeat latency climbs > 300ms
- Degraded status = server under pressure

#### Realtime connections
- Supabase free tier: 200 concurrent WebSocket connections
- Pro tier: 500
- Scale tier: unlimited
- **Your stress scenario D (200 VU) will hit free tier limits** — upgrade before testing at that scale

---

### 5.5 Expected Baseline Numbers (before optimizations)

| Scenario | Expected p95 | Expected error rate | Breaks at |
|---|---|---|---|
| Auth login | < 800ms | < 0.5% | ~300 VU |
| Discovery RPC | < 2000ms | < 1% | ~150 VU (IN subquery bottleneck) |
| Message insert | < 600ms | < 0.5% | ~400 VU |
| Action spike | < 1500ms | ~5% (rate-limit errors expected) | N/A |

After applying **improvement 3.1** (CTE rewrite) and **3.2** (counter table):

| Scenario | Expected p95 | Breaks at |
|---|---|---|
| Discovery RPC | < 500ms | ~1000 VU |
| Action spike | < 300ms | ~2000 VU |

---

## 6. Quick Wins Checklist

Things that take < 1 hour each and have immediate impact:

- [ ] `next.config.ts` — add security headers (section 2.3)
- [ ] `supabase/migrations/` — add ownership check to SECURITY DEFINER functions (section 2.5)
- [ ] `app/auth/page.tsx` — add "Forgot password?" link (section 4.1)
- [ ] `scripts/stress/` — create stress test folder and auth.js (section 5.3)
- [ ] Supabase Dashboard — enable "Confirm email" on Auth settings (section 2.1)
- [ ] Supabase Dashboard — enable pg_audit or Supabase Audit Log for admin actions
- [ ] `app/onboarding/page.tsx` + `settings/page.tsx` — add `browser-image-compression` before avatar upload (section 4.3)
- [ ] Add composite index on `discovery_actions(from_user, action, created_at DESC)` (section 3.1)
