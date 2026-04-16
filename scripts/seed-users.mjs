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

const users = [
  { email: 'alice@test.com',  password: 'Password123!' },
  { email: 'bob@test.com',    password: 'Password123!' },
  { email: 'carol@test.com',  password: 'Password123!' },
  { email: 'dave@test.com',   password: 'Password123!' },
  { email: 'eve@test.com',    password: 'Password123!' },
  { email: 'frank@test.com',  password: 'Password123!' },
  { email: 'grace@test.com',  password: 'Password123!' },
  { email: 'henry@test.com',  password: 'Password123!' },
  { email: 'iris@test.com',   password: 'Password123!' },
  { email: 'jack@test.com',   password: 'Password123!' },
]

console.log('Creating test users...\n')

for (const { email, password } of users) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    console.error(`✗ ${email}: ${error.message}`)
  } else {
    console.log(`✓ ${email} (id: ${data.user.id})`)
  }
}

console.log('\nDone! Now run the profile seed SQL with the real UUIDs.')
console.log('Or just log in — onboarding will set up the profile.')
