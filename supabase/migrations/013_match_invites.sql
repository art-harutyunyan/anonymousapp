-- =====================================================================
-- Anonymous Match — Migration 013: match_invites (mutual opt-in)
-- =====================================================================
-- Implements T-M1 through T-M4: live waiting state so both parties
-- must opt-in within 60 seconds before a match is created.
-- =====================================================================

-- ─── 1. Status enum ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE match_invite_status AS ENUM ('waiting', 'accepted', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. match_invites table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      match_invite_status NOT NULL DEFAULT 'waiting',
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_user, to_user)
);

ALTER TABLE match_invites ENABLE ROW LEVEL SECURITY;

-- Both participants can read their invites (needed for Realtime)
CREATE POLICY "match_invites: participants can view"
  ON match_invites FOR SELECT
  TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());

-- Only the sender can create an invite
CREATE POLICY "match_invites: sender can insert"
  ON match_invites FOR INSERT
  TO authenticated
  WITH CHECK (from_user = auth.uid());

-- Sender can cancel (update status to expired) or system can expire
CREATE POLICY "match_invites: sender can update"
  ON match_invites FOR UPDATE
  TO authenticated
  USING (from_user = auth.uid());

-- ─── 3. Expiry helper RPC ────────────────────────────────────────────
-- Called by the client when 60-second countdown completes.
-- Returns the IDs of invites that were just expired so the UI can react.
CREATE OR REPLACE FUNCTION expire_old_invites()
RETURNS TABLE (expired_invite_id UUID, from_user UUID, to_user UUID)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  UPDATE match_invites
  SET status = 'expired'
  WHERE status = 'waiting' AND expires_at < NOW()
  RETURNING id, from_user, to_user;
$$;

GRANT EXECUTE ON FUNCTION expire_old_invites() TO authenticated;

-- ─── 4. Upsert-invite RPC ────────────────────────────────────────────
-- Creates or refreshes a waiting invite; also accepts an existing invite
-- from the other side and marks it 'accepted' (which the UI watches for).
CREATE OR REPLACE FUNCTION upsert_match_invite(
  p_from_user UUID,
  p_to_user   UUID
)
RETURNS match_invite_status
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status match_invite_status;
BEGIN
  IF auth.uid() <> p_from_user THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  -- Check whether the other side already has a waiting invite for us
  SELECT status INTO v_status
  FROM match_invites
  WHERE from_user = p_to_user AND to_user = p_from_user AND status = 'waiting';

  IF FOUND THEN
    -- Mutual opt-in: mark that invite as accepted
    UPDATE match_invites
    SET status = 'accepted'
    WHERE from_user = p_to_user AND to_user = p_from_user;
    RETURN 'accepted';
  END IF;

  -- No pending invite from the other side — create/refresh our invite
  INSERT INTO match_invites (from_user, to_user, status, expires_at)
  VALUES (p_from_user, p_to_user, 'waiting', NOW() + INTERVAL '60 seconds')
  ON CONFLICT (from_user, to_user)
  DO UPDATE SET status = 'waiting', expires_at = NOW() + INTERVAL '60 seconds';

  RETURN 'waiting';
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_match_invite(UUID, UUID) TO authenticated;

-- ─── 5. Enable Realtime on match_invites ─────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE match_invites;
