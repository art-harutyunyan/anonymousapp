-- =====================================================================
-- Anonymous Match — Bots & Activity Logging Migration 006
-- =====================================================================

-- ─── 1. Bot flag on profiles ──────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;

-- Bots must bypass the daily rate limit
CREATE OR REPLACE FUNCTION check_daily_action_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_premium BOOLEAN;
  v_is_bot     BOOLEAN;
  v_count      INT;
BEGIN
  IF NEW.action <> 'start_talking' THEN
    RETURN NEW;
  END IF;

  SELECT is_premium, is_bot INTO v_is_premium, v_is_bot
  FROM profiles WHERE id = NEW.from_user;

  IF v_is_premium OR v_is_bot THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM discovery_actions
  WHERE from_user = NEW.from_user
    AND action    = 'start_talking'
    AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');

  IF v_count >= 20 THEN
    RAISE EXCEPTION 'daily_limit_reached'
      USING HINT = 'Free users can send up to 20 Start Talking requests per day. Upgrade to Premium for unlimited.';
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 2. Activity logs table ───────────────────────────────────────────
CREATE TYPE log_event_type AS ENUM (
  'user_signed_up',
  'profile_completed',
  'discovery_action',
  'match_created',
  'user_blocked',
  'user_reported',
  'user_banned',
  'admin_action'
);

CREATE TABLE activity_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  event_type  log_event_type NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logs_user    ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_logs_event   ON activity_logs(event_type, created_at DESC);
CREATE INDEX idx_logs_created ON activity_logs(created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Users see only their own logs; admins see all
CREATE POLICY "logs: user reads own"
  ON activity_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "logs: admin reads all"
  ON activity_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Inserts happen via SECURITY DEFINER functions only
CREATE POLICY "logs: no direct insert"
  ON activity_logs FOR INSERT TO authenticated
  WITH CHECK (FALSE);

-- ─── 3. Log helper (SECURITY DEFINER — bypasses RLS) ─────────────────
CREATE OR REPLACE FUNCTION log_event(
  p_user_id   UUID,
  p_event     log_event_type,
  p_metadata  JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO activity_logs (user_id, event_type, metadata)
  VALUES (p_user_id, p_event, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION log_event(UUID, log_event_type, JSONB) TO authenticated;

-- ─── 4. Logging triggers ──────────────────────────────────────────────

-- 4a. profiles INSERT → user_signed_up
CREATE OR REPLACE FUNCTION tg_log_user_signed_up()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM log_event(NEW.id, 'user_signed_up', NULL);
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_user_signed_up
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION tg_log_user_signed_up();

-- 4b. profiles UPDATE onboarding_complete TRUE → profile_completed
CREATE OR REPLACE FUNCTION tg_log_profile_completed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.onboarding_complete = TRUE AND OLD.onboarding_complete = FALSE THEN
    PERFORM log_event(NEW.id, 'profile_completed',
      jsonb_build_object('intent', NEW.intent, 'gender', NEW.gender, 'age', NEW.age));
  END IF;
  IF NEW.is_banned = TRUE AND OLD.is_banned = FALSE THEN
    PERFORM log_event(NEW.id, 'user_banned', NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_profile_events
  AFTER UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION tg_log_profile_completed();

-- 4c. discovery_actions INSERT → discovery_action (skip bots)
CREATE OR REPLACE FUNCTION tg_log_discovery_action()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_bot BOOLEAN;
BEGIN
  SELECT is_bot INTO v_is_bot FROM profiles WHERE id = NEW.from_user;
  IF v_is_bot THEN
    RETURN NEW;
  END IF;
  PERFORM log_event(NEW.from_user, 'discovery_action',
    jsonb_build_object('action', NEW.action, 'to_user', NEW.to_user));
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_discovery_action
  AFTER INSERT ON discovery_actions
  FOR EACH ROW EXECUTE FUNCTION tg_log_discovery_action();

-- 4d. matches INSERT → match_created (log for both participants)
CREATE OR REPLACE FUNCTION tg_log_match_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a_bot BOOLEAN;
  v_b_bot BOOLEAN;
BEGIN
  SELECT is_bot INTO v_a_bot FROM profiles WHERE id = NEW.user_a;
  SELECT is_bot INTO v_b_bot FROM profiles WHERE id = NEW.user_b;
  IF NOT v_a_bot THEN
    PERFORM log_event(NEW.user_a, 'match_created',
      jsonb_build_object('match_id', NEW.id, 'with_user', NEW.user_b, 'with_bot', v_b_bot));
  END IF;
  IF NOT v_b_bot THEN
    PERFORM log_event(NEW.user_b, 'match_created',
      jsonb_build_object('match_id', NEW.id, 'with_user', NEW.user_a, 'with_bot', v_a_bot));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_match_created
  AFTER INSERT ON matches
  FOR EACH ROW EXECUTE FUNCTION tg_log_match_created();

-- 4e. blocks INSERT → user_blocked
CREATE OR REPLACE FUNCTION tg_log_user_blocked()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM log_event(NEW.blocker_id, 'user_blocked',
    jsonb_build_object('blocked_id', NEW.blocked_id));
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_user_blocked
  AFTER INSERT ON blocks
  FOR EACH ROW EXECUTE FUNCTION tg_log_user_blocked();

-- 4f. reports INSERT → user_reported
CREATE OR REPLACE FUNCTION tg_log_user_reported()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM log_event(NEW.reporter_id, 'user_reported',
    jsonb_build_object('reported_id', NEW.reported_id, 'reason', NEW.reason));
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_user_reported
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION tg_log_user_reported();

-- ─── 5. Bot auto-respond trigger ──────────────────────────────────────
-- When a real user presses start_talking on a bot, the bot immediately
-- reciprocates → mutual match is created automatically.

CREATE OR REPLACE FUNCTION tg_bot_auto_respond()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_is_bot   BOOLEAN;
  v_match_id UUID;
BEGIN
  IF NEW.action <> 'start_talking' THEN
    RETURN NEW;
  END IF;

  SELECT is_bot INTO v_is_bot FROM profiles WHERE id = NEW.to_user;
  IF NOT v_is_bot THEN
    RETURN NEW;
  END IF;

  -- Bot reciprocates
  INSERT INTO discovery_actions (from_user, to_user, action)
  VALUES (NEW.to_user, NEW.from_user, 'start_talking')
  ON CONFLICT (from_user, to_user) DO NOTHING;

  -- Create the match (try_create_match is already SECURITY DEFINER)
  SELECT try_create_match(NEW.to_user, NEW.from_user) INTO v_match_id;

  RETURN NEW;
END;
$$;

-- Runs AFTER the rate-limit (BEFORE) and logging (AFTER) triggers.
-- Named with 'z_' prefix so it fires last among AFTER INSERT triggers.
CREATE TRIGGER z_bot_auto_respond
  AFTER INSERT ON discovery_actions
  FOR EACH ROW EXECUTE FUNCTION tg_bot_auto_respond();
