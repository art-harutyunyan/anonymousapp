/**
 * Seed bot users for testing.
 *
 * Bots cover all 4 intents × 2 genders so any real test user can find
 * at least one bot in their discovery queue. When a real user presses
 * "Start Talking" on a bot, the DB trigger auto-reciprocates and a
 * match is created instantly.
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

const BOTS = [
  {
    email: 'bot-alex@anon.internal',
    nickname: 'Alex',
    gender: 'man',
    age: 24,
    intent: 'friendship',
    interests: ['Gaming', 'Music', 'Technology', 'Movies', 'Anime'],
    country: 'United States',
  },
  {
    email: 'bot-mia@anon.internal',
    nickname: 'Mia',
    gender: 'woman',
    age: 22,
    intent: 'friendship',
    interests: ['Art', 'Photography', 'Travel', 'Coffee', 'Reading'],
    country: 'United Kingdom',
  },
  {
    email: 'bot-rio@anon.internal',
    nickname: 'Rio',
    gender: 'man',
    age: 27,
    intent: 'dating',
    interests: ['Fitness', 'Cooking', 'Travel', 'Sports', 'Music'],
    country: 'Canada',
  },
  {
    email: 'bot-luna@anon.internal',
    nickname: 'Luna',
    gender: 'woman',
    age: 25,
    intent: 'dating',
    interests: ['Yoga', 'Nature', 'Writing', 'Hiking', 'Coffee'],
    country: 'Australia',
  },
  {
    email: 'bot-kai@anon.internal',
    nickname: 'Kai',
    gender: 'man',
    age: 21,
    intent: 'casual',
    interests: ['Podcasts', 'Technology', 'Gaming', 'Music', 'Anime'],
    country: 'Germany',
  },
  {
    email: 'bot-nova@anon.internal',
    nickname: 'Nova',
    gender: 'woman',
    age: 23,
    intent: 'casual',
    interests: ['Fashion', 'Dancing', 'Movies', 'Photography', 'Art'],
    country: 'France',
  },
  {
    email: 'bot-zane@anon.internal',
    nickname: 'Zane',
    gender: 'man',
    age: 30,
    intent: 'talk',
    interests: ['Reading', 'Writing', 'Nature', 'Hiking', 'Podcasts'],
    country: 'Netherlands',
  },
  {
    email: 'bot-sky@anon.internal',
    nickname: 'Sky',
    gender: 'woman',
    age: 28,
    intent: 'talk',
    interests: ['Music', 'Movies', 'Cooking', 'Travel', 'Yoga'],
    country: 'Japan',
  },
]

console.log('Seeding bot users…\n')

let created = 0
let skipped = 0

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
      // Look up the existing user's ID so we can still update their profile
      const { data: list } = await supabase.auth.admin.listUsers()
      const existing = list?.users?.find((u) => u.email === bot.email)
      if (!existing) {
        console.error(`  ✗ ${bot.nickname}: exists but couldn't find UID`)
        continue
      }
      uid = existing.id
      console.log(`  ~ ${bot.nickname} (${bot.email}) — auth exists, updating profile…`)
      skipped++
    } else {
      console.error(`  ✗ ${bot.nickname}: ${authErr.message}`)
      continue
    }
  } else {
    uid = authData.user.id
  }

  // Fully populate the profile (trigger created a skeleton row)
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      nickname: bot.nickname,
      gender: bot.gender,
      age: bot.age,
      looking_for: 'other',   // matches with everyone
      intent: bot.intent,
      interests: bot.interests,
      country: bot.country,
      is_bot: true,
      is_premium: true,        // bots are unlimited
      onboarding_complete: true,
    })
    .eq('id', uid)

  if (profileErr) {
    console.error(`  ✗ ${bot.nickname} profile update: ${profileErr.message}`)
  } else {
    console.log(`  ✓ ${bot.nickname} (${bot.gender}, ${bot.age}, ${bot.intent}) — id: ${uid}`)
    created++
  }
}

console.log(`\nDone. ${created} bots created, ${skipped} already existed.`)
console.log('\nBots will auto-match with any real user who presses "Start Talking" on them.')
