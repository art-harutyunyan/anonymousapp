-- =====================================================================
-- Anonymous Match — Migration 012: expose is_premium in discovery
-- =====================================================================
-- Adds is_premium to the get_discovery_candidates return set so the UI
-- can show a subtle crown badge on premium candidates without an extra
-- profile query.
-- =====================================================================

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
  is_premium            BOOLEAN,
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
    p.is_premium,
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
