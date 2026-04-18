-- Bots bypass the discovery_actions exclusion so skipped bots always cycle
-- back into the queue. This is important for test coverage — without it,
-- once a tester has actioned all bots they can never see them again.
--
-- Active-match exclusion still applies to bots: if you are already in a live
-- chat with a bot it will not appear in the discovery queue.
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
    AND (p.looking_for = 'other' OR v_gender = p.looking_for)
    -- Intent: must match unless the candidate is a bot (bots serve all intents)
    AND (p.is_bot = TRUE OR p.intent = v_intent)
    -- Already-actioned exclusion: bots bypass this so skipped bots always
    -- cycle back into the queue. Real users are excluded once actioned.
    AND (
      p.is_bot = TRUE
      OR p.id NOT IN (
        SELECT da.to_user
        FROM discovery_actions da
        WHERE da.from_user = p_user_id
      )
    )
    -- Not blocked (either direction)
    AND p.id NOT IN (
      SELECT b.blocked_id FROM blocks b WHERE b.blocker_id = p_user_id
      UNION
      SELECT b.blocker_id FROM blocks b WHERE b.blocked_id = p_user_id
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
