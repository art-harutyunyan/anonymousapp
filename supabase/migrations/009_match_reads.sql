-- =====================================================================
-- Anonymous Match — Unread tracking Migration 009
-- Adds per-side read timestamps on matches + mark_match_read RPC
-- =====================================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS last_read_at_a TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS last_read_at_b TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION mark_match_read(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_user_a UUID;
  v_user_b UUID;
BEGIN
  SELECT user_a, user_b INTO v_user_a, v_user_b
    FROM matches WHERE id = p_match_id;

  IF v_user_a IS NULL THEN
    RAISE EXCEPTION 'match not found';
  END IF;

  IF v_uid = v_user_a THEN
    UPDATE matches SET last_read_at_a = NOW() WHERE id = p_match_id;
  ELSIF v_uid = v_user_b THEN
    UPDATE matches SET last_read_at_b = NOW() WHERE id = p_match_id;
  ELSE
    RAISE EXCEPTION 'not a participant';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_match_read(UUID) TO authenticated;
