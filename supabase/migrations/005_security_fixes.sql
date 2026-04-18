-- =====================================================================
-- Anonymous Match — Security Fixes Migration 005
-- Fixes:
--   1. Messages: prevent content edits after send (only is_deleted allowed)
--   2. Matches: remove direct client INSERT — all creation must go through
--      try_create_match() SECURITY DEFINER which bypasses RLS anyway
-- =====================================================================

-- ─── 1. Immutable message content ────────────────────────────────────
-- RLS alone can't compare old vs new column values, so use a trigger.

CREATE OR REPLACE FUNCTION prevent_message_content_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.content <> OLD.content THEN
    RAISE EXCEPTION 'message content is immutable after insert';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_immutable_content
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION prevent_message_content_update();

-- Tighten the UPDATE policy: resulting row must have is_deleted = TRUE
-- (prevents un-deleting and ensures the only valid update is a soft-delete)
DROP POLICY IF EXISTS "messages: sender can soft-delete" ON messages;

CREATE POLICY "messages: sender can soft-delete"
  ON messages FOR UPDATE
  TO authenticated
  USING  (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() AND is_deleted = TRUE);

-- ─── 2. Remove direct client match inserts ───────────────────────────
-- try_create_match() is SECURITY DEFINER so it bypasses RLS entirely.
-- The INSERT policy below is therefore only reachable by direct client
-- calls, which should not be allowed.

DROP POLICY IF EXISTS "matches: function can insert" ON matches;

-- ─── 3. Rate-limit start_talking actions for free users ──────────────
-- Free users: max 20 start_talking actions per UTC day.
-- Premium users: unlimited.

CREATE OR REPLACE FUNCTION check_daily_action_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_premium BOOLEAN;
  v_count      INT;
BEGIN
  IF NEW.action <> 'start_talking' THEN
    RETURN NEW;
  END IF;

  SELECT is_premium INTO v_is_premium FROM profiles WHERE id = NEW.from_user;

  IF v_is_premium THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM discovery_actions
  WHERE from_user = NEW.from_user
    AND action = 'start_talking'
    AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');

  IF v_count >= 20 THEN
    RAISE EXCEPTION 'daily_limit_reached'
      USING HINT = 'Free users can send up to 20 Start Talking requests per day. Upgrade to Premium for unlimited.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER discovery_actions_rate_limit
  BEFORE INSERT ON discovery_actions
  FOR EACH ROW EXECUTE FUNCTION check_daily_action_limit();
