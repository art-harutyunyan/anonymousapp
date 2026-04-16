-- =====================================================================
-- Anonymous Match — RLS Policies & Functions Migration 002
-- Run after 001_schema.sql
-- =====================================================================

-- Enable RLS on all tables
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notes       ENABLE ROW LEVEL SECURITY;

-- ─── profiles policies ───────────────────────────────────────────────
-- Anyone authenticated can view limited profile info (for discovery)
CREATE POLICY "profiles: authenticated can view non-banned"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_banned = FALSE);

-- Only the owner can update their own profile
CREATE POLICY "profiles: owner can update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile (for banning)
CREATE POLICY "profiles: admin can update any"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ─── discovery_actions policies ──────────────────────────────────────
CREATE POLICY "discovery_actions: user sees own actions"
  ON discovery_actions FOR SELECT
  TO authenticated
  USING (from_user = auth.uid());

CREATE POLICY "discovery_actions: user inserts own"
  ON discovery_actions FOR INSERT
  TO authenticated
  WITH CHECK (from_user = auth.uid());

-- ─── matches policies ────────────────────────────────────────────────
CREATE POLICY "matches: users see their own matches"
  ON matches FOR SELECT
  TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());

CREATE POLICY "matches: function can insert"
  ON matches FOR INSERT
  TO authenticated
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

CREATE POLICY "matches: users can deactivate their match"
  ON matches FOR UPDATE
  TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid())
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

-- ─── messages policies ───────────────────────────────────────────────
CREATE POLICY "messages: match participants can view"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE id = messages.match_id
        AND (user_a = auth.uid() OR user_b = auth.uid())
        AND is_active = TRUE
    )
  );

CREATE POLICY "messages: sender can insert"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE id = match_id
        AND (user_a = auth.uid() OR user_b = auth.uid())
        AND is_active = TRUE
    )
  );

CREATE POLICY "messages: sender can soft-delete"
  ON messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- ─── blocks policies ─────────────────────────────────────────────────
CREATE POLICY "blocks: blocker sees own blocks"
  ON blocks FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid());

CREATE POLICY "blocks: user can block"
  ON blocks FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "blocks: user can unblock"
  ON blocks FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid());

-- ─── reports policies ────────────────────────────────────────────────
CREATE POLICY "reports: reporter sees own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

CREATE POLICY "reports: admin sees all reports"
  ON reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "reports: authenticated can insert"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "reports: admin can update status"
  ON reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ─── admin_notes policies ────────────────────────────────────────────
CREATE POLICY "admin_notes: admin only"
  ON admin_notes FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ─── Discovery candidates function ───────────────────────────────────
CREATE OR REPLACE FUNCTION get_discovery_candidates(p_user_id UUID)
RETURNS TABLE (
  id                    UUID,
  nickname              TEXT,
  gender                gender_type,
  age                   INT,
  intent                intent_type,
  interests             TEXT[],
  country               TEXT,
  avatar_url            TEXT,
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
    -- Gender preference: I want them AND they want me (or either is 'other')
    AND (v_looking_for = 'other' OR p.gender = v_looking_for)
    AND (p.looking_for   = 'other' OR v_gender  = p.looking_for)
    -- Same chat intent
    AND p.intent = v_intent
    -- Not already actioned by me
    AND p.id NOT IN (
      SELECT da.to_user
      FROM discovery_actions da
      WHERE da.from_user = p_user_id
    )
    -- Not blocked (either direction)
    AND p.id NOT IN (
      SELECT b.blocked_id  FROM blocks b WHERE b.blocker_id = p_user_id
      UNION
      SELECT b.blocker_id  FROM blocks b WHERE b.blocked_id = p_user_id
    )
    -- Not already in an active match
    AND p.id NOT IN (
      SELECT CASE WHEN m.user_a = p_user_id THEN m.user_b ELSE m.user_a END
      FROM matches m
      WHERE (m.user_a = p_user_id OR m.user_b = p_user_id)
        AND m.is_active = TRUE
    )
  ORDER BY shared_interests_count DESC, p.created_at DESC
  LIMIT 30;
END;
$$;

-- ─── Create match after mutual start_talking ─────────────────────────
CREATE OR REPLACE FUNCTION try_create_match(
  p_actor_id    UUID,
  p_target_id   UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mutual   BOOLEAN;
  v_match_id UUID;
  v_user_a   UUID;
  v_user_b   UUID;
BEGIN
  -- Check if target already pressed start_talking on actor
  SELECT EXISTS (
    SELECT 1 FROM discovery_actions
    WHERE from_user = p_target_id
      AND to_user   = p_actor_id
      AND action    = 'start_talking'
  ) INTO v_mutual;

  IF NOT v_mutual THEN
    RETURN NULL;
  END IF;

  -- Enforce ordered pair constraint (user_a < user_b)
  IF p_actor_id < p_target_id THEN
    v_user_a := p_actor_id;
    v_user_b := p_target_id;
  ELSE
    v_user_a := p_target_id;
    v_user_b := p_actor_id;
  END IF;

  -- Insert match (ignore if already exists)
  INSERT INTO matches (user_a, user_b)
  VALUES (v_user_a, v_user_b)
  ON CONFLICT (user_a, user_b) DO NOTHING
  RETURNING id INTO v_match_id;

  -- If match already existed, fetch it
  IF v_match_id IS NULL THEN
    SELECT id INTO v_match_id FROM matches
    WHERE user_a = v_user_a AND user_b = v_user_b;
  END IF;

  RETURN v_match_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_discovery_candidates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION try_create_match(UUID, UUID) TO authenticated;
