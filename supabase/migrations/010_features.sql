-- =====================================================================
-- Anonymous Match — Feature Migration 010
-- Covers: age gate timestamp, online status, profile extras,
--         saved connections, chat media, mute, notification settings,
--         advanced filter support, read receipt exposure
-- =====================================================================

-- ─── 1. Age gate hardening (T-L3) ────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS age_gate_confirmed_at TIMESTAMPTZ;

-- ─── 2. Online / availability status (T-M6) ──────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON profiles(last_seen_at DESC);

-- ─── 3. Profile extras (T-P1, T-P2) ──────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tagline              TEXT CHECK (char_length(tagline) <= 80),
  ADD COLUMN IF NOT EXISTS preferred_languages  TEXT[] NOT NULL DEFAULT '{}';

-- ─── 4. Saved connections (T-S1, T-S2, T-S3) ─────────────────────────
CREATE TABLE IF NOT EXISTS saved_connections (
  owner_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  private_nickname   TEXT CHECK (char_length(private_nickname) <= 30),
  note               TEXT CHECK (char_length(note) <= 500),  -- premium only
  last_match_id      UUID REFERENCES matches(id) ON DELETE SET NULL,
  saved_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, connection_id),
  CONSTRAINT no_self_save CHECK (owner_id <> connection_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_owner    ON saved_connections(owner_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_conn     ON saved_connections(connection_id);

ALTER TABLE saved_connections ENABLE ROW LEVEL SECURITY;

-- Owner-only access
CREATE POLICY "saved: owner full access"
  ON saved_connections FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Slot limit trigger (free = 3, premium = unlimited)
CREATE OR REPLACE FUNCTION check_saved_connection_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_premium BOOLEAN;
  v_count      INT;
BEGIN
  SELECT is_premium INTO v_is_premium FROM profiles WHERE id = NEW.owner_id;
  IF v_is_premium THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM saved_connections WHERE owner_id = NEW.owner_id;

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'saved_connection_limit_reached'
      USING HINT = 'Free users can save up to 3 connections. Upgrade to Premium for unlimited.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_saved_limit
  BEFORE INSERT ON saved_connections
  FOR EACH ROW EXECUTE FUNCTION check_saved_connection_limit();

-- ─── 5. Chat media support (T-C1, T-C2) ──────────────────────────────
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media_url    TEXT,
  ADD COLUMN IF NOT EXISTS media_type   TEXT CHECK (media_type IN ('image', 'video')),
  ADD COLUMN IF NOT EXISTS media_width  INT,
  ADD COLUMN IF NOT EXISTS media_height INT;

-- Allow content to be empty when media is present
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_check;
ALTER TABLE messages ADD CONSTRAINT messages_content_check
  CHECK (
    (char_length(content) <= 2000)
    AND (content <> '' OR media_url IS NOT NULL)
  );

-- ─── 6. Mute per match (T-C11) ────────────────────────────────────────
-- Store as an array of user IDs who have muted this match
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS muted_by UUID[] NOT NULL DEFAULT '{}';

-- ─── 7. Notification settings (T-N1) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id                      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  browser_push                 BOOLEAN NOT NULL DEFAULT TRUE,
  email_match_invite           BOOLEAN NOT NULL DEFAULT TRUE,
  email_saved_connection       BOOLEAN NOT NULL DEFAULT FALSE,
  email_premium_events         BOOLEAN NOT NULL DEFAULT TRUE,
  email_account_notices        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_settings: owner full access"
  ON notification_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-create a notification_settings row for every new profile
CREATE OR REPLACE FUNCTION handle_new_notification_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_notif_settings
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_notification_settings();

-- ─── 8. heartbeat RPC ─────────────────────────────────────────────────
-- Lightweight function for client to ping last_seen_at
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET last_seen_at = NOW()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION update_last_seen() TO authenticated;

-- ─── 9. Update get_discovery_candidates with online + tagline/languages ──
-- Expose last_seen_at and tagline in candidate results so the UI can
-- display an online indicator and tagline without a second query.
CREATE OR REPLACE FUNCTION get_discovery_candidates(
  p_user_id     UUID,
  p_min_age     INT  DEFAULT NULL,
  p_max_age     INT  DEFAULT NULL,
  p_country     TEXT DEFAULT NULL
)
RETURNS TABLE (
  id                    UUID,
  nickname              TEXT,
  gender                gender_type,
  age                   INT,
  intent                intent_type,
  interests             TEXT[],
  country               TEXT,
  avatar_url            TEXT,
  tagline               TEXT,
  last_seen_at          TIMESTAMPTZ,
  shared_interests_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_gender       gender_type;
  v_looking_for  gender_type;
  v_intent       intent_type;
  v_interests    TEXT[];
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  SELECT p.gender, p.looking_for, p.intent, p.interests
  INTO v_gender, v_looking_for, v_intent, v_interests
  FROM profiles p
  WHERE p.id = p_user_id;

  RETURN QUERY
  SELECT
    p.id,
    p.nickname,
    p.gender,
    p.age,
    p.intent,
    p.interests,
    p.country,
    p.avatar_url,
    p.tagline,
    p.last_seen_at,
    (
      SELECT COUNT(*)::INT
      FROM unnest(p.interests) i
      WHERE i = ANY(v_interests)
    ) AS shared_interests_count
  FROM profiles p
  WHERE
    p.id <> p_user_id
    AND p.is_banned = FALSE
    AND p.onboarding_complete = TRUE
    AND (v_looking_for = 'other' OR p.gender = v_looking_for)
    AND (p.looking_for   = 'other' OR v_gender  = p.looking_for)
    AND p.intent = v_intent
    -- Optional premium filters
    AND (p_min_age IS NULL OR p.age >= p_min_age)
    AND (p_max_age IS NULL OR p.age <= p_max_age)
    AND (p_country  IS NULL OR p.country = p_country)
    -- Exclusions via NOT EXISTS (faster than NOT IN at scale)
    AND NOT EXISTS (
      SELECT 1 FROM discovery_actions da
      WHERE da.from_user = p_user_id AND da.to_user = p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = p_user_id AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id     AND b.blocked_id = p_user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM matches m
      WHERE ((m.user_a = p_user_id AND m.user_b = p.id)
          OR (m.user_a = p.id     AND m.user_b = p_user_id))
        AND m.is_active = TRUE
    )
  ORDER BY
    -- Premium boost: users active in last 5 min float to top
    (p.last_seen_at > NOW() - INTERVAL '5 minutes') DESC,
    shared_interests_count DESC,
    p.created_at DESC
  LIMIT 30;
END;
$$;

GRANT EXECUTE ON FUNCTION get_discovery_candidates(UUID, INT, INT, TEXT) TO authenticated;

-- ─── 10. Saved connections log event ─────────────────────────────────
-- Extend log_event_type enum to include saved_connection events
ALTER TYPE log_event_type ADD VALUE IF NOT EXISTS 'saved_connection_created';

-- ─── 11. composite index on discovery_actions (perf, already in IMPROVEMENTS.md) ──
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_discovery_actions_from_created
  ON discovery_actions(from_user, action, created_at DESC);
