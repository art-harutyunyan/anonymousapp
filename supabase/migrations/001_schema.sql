-- =====================================================================
-- Anonymous Match — Schema Migration 001
-- Run this first in Supabase SQL Editor
-- =====================================================================

-- Enums
CREATE TYPE gender_type  AS ENUM ('man', 'woman', 'non_binary', 'other');
CREATE TYPE intent_type  AS ENUM ('friendship', 'dating', 'casual', 'talk');
CREATE TYPE action_type  AS ENUM ('start_talking', 'skip');
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'actioned');
CREATE TYPE report_reason AS ENUM ('spam', 'harassment', 'underage', 'inappropriate', 'other');

-- ─── profiles ────────────────────────────────────────────────────────
-- One row per auth user, created by trigger on auth.users insert.
CREATE TABLE profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname             TEXT,
  gender               gender_type,
  age                  INT CHECK (age IS NULL OR age >= 18),
  looking_for          gender_type,
  intent               intent_type,
  interests            TEXT[] NOT NULL DEFAULT '{}',
  country              TEXT,
  avatar_url           TEXT,
  is_premium           BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned            BOOLEAN NOT NULL DEFAULT FALSE,
  is_admin             BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_complete  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── discovery_actions ───────────────────────────────────────────────
CREATE TABLE discovery_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action      action_type NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_action UNIQUE (from_user, to_user)
);

CREATE INDEX idx_discovery_from ON discovery_actions(from_user);
CREATE INDEX idx_discovery_to ON discovery_actions(to_user);

-- ─── matches ─────────────────────────────────────────────────────────
CREATE TABLE matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_match CHECK (user_a <> user_b),
  CONSTRAINT ordered_pair   CHECK (user_a < user_b)
);

CREATE INDEX idx_matches_user_a ON matches(user_a);
CREATE INDEX idx_matches_user_b ON matches(user_b);
CREATE UNIQUE INDEX idx_matches_unique_pair ON matches(user_a, user_b);

-- ─── messages ────────────────────────────────────────────────────────
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) <= 2000),
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_match ON messages(match_id, created_at);

-- ─── blocks ──────────────────────────────────────────────────────────
CREATE TABLE blocks (
  blocker_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

-- ─── reports ─────────────────────────────────────────────────────────
CREATE TABLE reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason       report_reason NOT NULL,
  details      TEXT,
  status       report_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_report CHECK (reporter_id <> reported_id)
);

CREATE INDEX idx_reports_status ON reports(status);

-- ─── admin_notes ─────────────────────────────────────────────────────
CREATE TABLE admin_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  admin_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Trigger: auto-create profile on sign-up ─────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ─── Trigger: update updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ─── Enable Realtime for messages and matches ─────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
