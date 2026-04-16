-- =====================================================================
-- Anonymous Match — Seed Data Migration 003
-- Creates 10 test users + sample matches and messages
-- Run after 001 and 002.
--
-- NOTE: These inserts go into auth.users first via the admin API.
-- Since we can't directly insert auth.users from SQL Editor,
-- use the Supabase Dashboard > Authentication > Users to create
-- these accounts with email/password, then run the UPDATE statements
-- below to fill in profile data.
--
-- Test credentials (all passwords: Password123!):
--   alice@test.com    bob@test.com      carol@test.com
--   dave@test.com     eve@test.com      frank@test.com
--   grace@test.com    henry@test.com    iris@test.com
--   jack@test.com
-- =====================================================================

-- After creating the 10 test accounts in Supabase Auth dashboard,
-- run the following to set up their profiles.
-- Replace the UUIDs with the actual UUIDs shown in the Auth dashboard.

-- For convenience, we use a DO block so you can paste user IDs once.
DO $$
DECLARE
  -- Replace these with real UUIDs after creating users in Auth dashboard
  id_alice  UUID := '00000000-0000-0000-0000-000000000001';
  id_bob    UUID := '00000000-0000-0000-0000-000000000002';
  id_carol  UUID := '00000000-0000-0000-0000-000000000003';
  id_dave   UUID := '00000000-0000-0000-0000-000000000004';
  id_eve    UUID := '00000000-0000-0000-0000-000000000005';
  id_frank  UUID := '00000000-0000-0000-0000-000000000006';
  id_grace  UUID := '00000000-0000-0000-0000-000000000007';
  id_henry  UUID := '00000000-0000-0000-0000-000000000008';
  id_iris   UUID := '00000000-0000-0000-0000-000000000009';
  id_jack   UUID := '0000000a-0000-0000-0000-000000000010';
  match1_id UUID := gen_random_uuid();
  match2_id UUID := gen_random_uuid();
BEGIN

  -- ─── Profiles ──────────────────────────────────────────────────────
  UPDATE profiles SET
    nickname = 'Alice', gender = 'woman', age = 24,
    looking_for = 'man', intent = 'dating',
    interests = ARRAY['Music','Travel','Coffee','Photography','Yoga'],
    country = 'United States', onboarding_complete = TRUE
  WHERE id = id_alice;

  UPDATE profiles SET
    nickname = 'Bob', gender = 'man', age = 26,
    looking_for = 'woman', intent = 'dating',
    interests = ARRAY['Music','Gaming','Travel','Movies','Coffee'],
    country = 'United Kingdom', onboarding_complete = TRUE
  WHERE id = id_bob;

  UPDATE profiles SET
    nickname = 'Carol', gender = 'woman', age = 22,
    looking_for = 'other', intent = 'friendship',
    interests = ARRAY['Art','Reading','Hiking','Nature','Photography'],
    country = 'Canada', onboarding_complete = TRUE
  WHERE id = id_carol;

  UPDATE profiles SET
    nickname = 'Dave', gender = 'man', age = 28,
    looking_for = 'woman', intent = 'friendship',
    interests = ARRAY['Technology','Gaming','Fitness','Cooking','Music'],
    country = 'Germany', onboarding_complete = TRUE
  WHERE id = id_dave;

  UPDATE profiles SET
    nickname = 'Eve', gender = 'woman', age = 30,
    looking_for = 'man', intent = 'talk',
    interests = ARRAY['Podcasts','Reading','Writing','Coffee','Travel'],
    country = 'Australia', onboarding_complete = TRUE
  WHERE id = id_eve;

  UPDATE profiles SET
    nickname = 'Frank', gender = 'man', age = 25,
    looking_for = 'woman', intent = 'talk',
    interests = ARRAY['Podcasts','Technology','Sports','Coffee','Music'],
    country = 'United States', onboarding_complete = TRUE
  WHERE id = id_frank;

  UPDATE profiles SET
    nickname = 'Grace', gender = 'woman', age = 21,
    looking_for = 'other', intent = 'casual',
    interests = ARRAY['Dancing','Fashion','Music','Art','Yoga'],
    country = 'France', onboarding_complete = TRUE
  WHERE id = id_grace;

  UPDATE profiles SET
    nickname = 'Henry', gender = 'man', age = 29,
    looking_for = 'other', intent = 'casual',
    interests = ARRAY['Gaming','Anime','Technology','Music','Art'],
    country = 'Japan', onboarding_complete = TRUE
  WHERE id = id_henry;

  UPDATE profiles SET
    nickname = 'Iris', gender = 'non_binary', age = 23,
    looking_for = 'other', intent = 'friendship',
    interests = ARRAY['Art','Writing','Nature','Photography','Reading'],
    country = 'Netherlands', onboarding_complete = TRUE
  WHERE id = id_iris;

  UPDATE profiles SET
    nickname = 'Jack', gender = 'man', age = 27,
    looking_for = 'woman', intent = 'dating',
    interests = ARRAY['Sports','Fitness','Cooking','Travel','Music'],
    country = 'Brazil', onboarding_complete = TRUE
  WHERE id = id_jack;

  -- Set one admin
  UPDATE profiles SET is_admin = TRUE WHERE id = id_alice;

  -- ─── Discovery actions (Alice + Bob mutual start_talking) ──────────
  INSERT INTO discovery_actions (from_user, to_user, action)
  VALUES
    (id_alice, id_bob, 'start_talking'),
    (id_bob, id_alice, 'start_talking'),
    (id_alice, id_dave, 'skip'),
    (id_carol, id_iris, 'start_talking');

  -- ─── Match between Alice and Bob ──────────────────────────────────
  INSERT INTO matches (id, user_a, user_b)
  VALUES (match1_id, id_alice, id_bob);

  -- ─── Messages in that match ───────────────────────────────────────
  INSERT INTO messages (match_id, sender_id, content, created_at)
  VALUES
    (match1_id, id_alice, 'Hey! Glad we matched 👋', NOW() - INTERVAL '2 hours'),
    (match1_id, id_bob,   'Hi! Me too. What''s up?', NOW() - INTERVAL '1 hour 55 min'),
    (match1_id, id_alice, 'Just chilling, you into music?', NOW() - INTERVAL '1 hour 50 min'),
    (match1_id, id_bob,   'Yeah big time! What genres?', NOW() - INTERVAL '1 hour 45 min'),
    (match1_id, id_alice, 'Indie and electronic mostly 🎵', NOW() - INTERVAL '1 hour');

  -- ─── A second match (Carol + Henry - casual/other) ────────────────
  INSERT INTO discovery_actions (from_user, to_user, action)
  VALUES
    (id_grace, id_henry, 'start_talking'),
    (id_henry, id_grace, 'start_talking')
  ON CONFLICT DO NOTHING;

  INSERT INTO matches (id, user_a, user_b)
  VALUES (match2_id, id_grace, id_henry);

  INSERT INTO messages (match_id, sender_id, content, created_at)
  VALUES
    (match2_id, id_grace, 'Hi there!', NOW() - INTERVAL '30 min'),
    (match2_id, id_henry, 'Hey! Nice to meet you 😊', NOW() - INTERVAL '25 min');

  -- ─── Sample report ────────────────────────────────────────────────
  INSERT INTO reports (reporter_id, reported_id, reason, details)
  VALUES (id_bob, id_frank, 'spam', 'Keeps sending promotional links');

END $$;
