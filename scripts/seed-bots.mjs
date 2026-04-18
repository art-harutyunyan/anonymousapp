/**
 * Seed bot users for testing.
 *
 * 16 bots covering every combination of gender × intent so any test user
 * finds candidates regardless of their looking_for / intent settings.
 * Every bot carries all 20 interests for maximum shared_interests_count.
 *
 * Usage:
 *   node scripts/seed-bots.mjs
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// All 20 interests — every bot carries the full set so shared_interests_count
// is always maximal and bots always surface at the top of discovery.
const ALL_INTERESTS = [
  'Music', 'Movies', 'Gaming', 'Travel', 'Fitness',
  'Cooking', 'Reading', 'Art', 'Photography', 'Technology',
  'Sports', 'Fashion', 'Nature', 'Dancing', 'Yoga',
  'Writing', 'Podcasts', 'Anime', 'Hiking', 'Coffee',
]

// 16 bots: 4 genders × 4 intents
// looking_for: 'other' means each bot matches with ANY gender.
const BOTS = [
  // ── man × all intents ──────────────────────────────────────────────────────
  {
    email: 'bot-alex@anon.internal',
    nickname: 'Alex',
    gender: 'man',
    age: 24,
    intent: 'friendship',
    country: 'United States',
  },
  {
    email: 'bot-rio@anon.internal',
    nickname: 'Rio',
    gender: 'man',
    age: 27,
    intent: 'dating',
    country: 'Canada',
  },
  {
    email: 'bot-kai@anon.internal',
    nickname: 'Kai',
    gender: 'man',
    age: 21,
    intent: 'casual',
    country: 'Germany',
  },
  {
    email: 'bot-zane@anon.internal',
    nickname: 'Zane',
    gender: 'man',
    age: 30,
    intent: 'talk',
    country: 'Netherlands',
  },

  // ── woman × all intents ────────────────────────────────────────────────────
  {
    email: 'bot-mia@anon.internal',
    nickname: 'Mia',
    gender: 'woman',
    age: 22,
    intent: 'friendship',
    country: 'United Kingdom',
  },
  {
    email: 'bot-luna@anon.internal',
    nickname: 'Luna',
    gender: 'woman',
    age: 25,
    intent: 'dating',
    country: 'Australia',
  },
  {
    email: 'bot-nova@anon.internal',
    nickname: 'Nova',
    gender: 'woman',
    age: 23,
    intent: 'casual',
    country: 'France',
  },
  {
    email: 'bot-sky@anon.internal',
    nickname: 'Sky',
    gender: 'woman',
    age: 28,
    intent: 'talk',
    country: 'Japan',
  },

  // ── non_binary × all intents ───────────────────────────────────────────────
  {
    email: 'bot-quinn@anon.internal',
    nickname: 'Quinn',
    gender: 'non_binary',
    age: 25,
    intent: 'friendship',
    country: 'Sweden',
  },
  {
    email: 'bot-ash@anon.internal',
    nickname: 'Ash',
    gender: 'non_binary',
    age: 26,
    intent: 'dating',
    country: 'Norway',
  },
  {
    email: 'bot-river@anon.internal',
    nickname: 'River',
    gender: 'non_binary',
    age: 29,
    intent: 'casual',
    country: 'Denmark',
  },
  {
    email: 'bot-sage@anon.internal',
    nickname: 'Sage',
    gender: 'non_binary',
    age: 27,
    intent: 'talk',
    country: 'Finland',
  },

  // ── other × all intents ────────────────────────────────────────────────────
  {
    email: 'bot-finn@anon.internal',
    nickname: 'Finn',
    gender: 'other',
    age: 23,
    intent: 'friendship',
    country: 'Brazil',
  },
  {
    email: 'bot-ember@anon.internal',
    nickname: 'Ember',
    gender: 'other',
    age: 29,
    intent: 'dating',
    country: 'Mexico',
  },
  {
    email: 'bot-blake@anon.internal',
    nickname: 'Blake',
    gender: 'other',
    age: 31,
    intent: 'casual',
    country: 'Singapore',
  },
  {
    email: 'bot-wren@anon.internal',
    nickname: 'Wren',
    gender: 'other',
    age: 26,
    intent: 'talk',
    country: 'South Korea',
  },
]

console.log(`Seeding ${BOTS.length} bot users…\n`)

let created = 0
let updated = 0

for (const bot of BOTS) {
  // Create auth user (or look up existing)
  let uid
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: bot.email,
    password: 'BotUser$ecure!99',
    email_confirm: true,
  })

  if (authErr) {
    if (authErr.message?.toLowerCase().includes('already')) {
      const { data: list } = await supabase.auth.admin.listUsers()
      const existing = list?.users?.find((u) => u.email === bot.email)
      if (!existing) {
        console.error(`  ✗ ${bot.nickname}: exists but couldn't find UID`)
        continue
      }
      uid = existing.id
      console.log(`  ~ ${bot.nickname} (${bot.email}) — auth exists, updating profile…`)
    } else {
      console.error(`  ✗ ${bot.nickname}: ${authErr.message}`)
      continue
    }
  } else {
    uid = authData.user.id
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      nickname: bot.nickname,
      gender: bot.gender,
      age: bot.age,
      looking_for: 'other',     // matches with every gender
      intent: bot.intent,
      interests: ALL_INTERESTS,  // all 20 — always surfaces in discovery
      country: bot.country,
      is_bot: true,
      is_premium: true,          // unlimited swipes
      onboarding_complete: true,
    })
    .eq('id', uid)

  if (profileErr) {
    console.error(`  ✗ ${bot.nickname} profile: ${profileErr.message}`)
  } else {
    const isNew = !authErr
    if (isNew) created++; else updated++
    console.log(`  ✓ ${bot.nickname} (${bot.gender}, ${bot.age}, ${bot.intent}) — id: ${uid}`)
  }
}

console.log(`\nDone. ${created} created, ${updated} updated.`)
console.log('Each bot has all 20 interests and looking_for=other.')
console.log('Coverage: 4 genders × 4 intents = 16 bots.')
