/**
 * Apply a migration SQL file to the remote Supabase project.
 *
 * Uses the Supabase Management API (`POST /v1/projects/{ref}/database/query`)
 * so no direct Postgres connection or pg driver is needed — just a Personal
 * Access Token.  Good for when the `supabase` CLI's migration history has
 * drifted from the local files and you just need to run one file.
 *
 * Usage:
 *   npm run db:migrate                         # runs the LATEST file in supabase/migrations
 *   npm run db:migrate 006_bots_and_logs.sql   # runs a specific file
 *   npm run db:migrate ./path/to/file.sql      # runs any file by path
 *
 * Required env vars (in .env.local):
 *   SUPABASE_ACCESS_TOKEN   Personal Access Token from
 *                           https://supabase.com/dashboard/account/tokens
 *                           (starts with sbp_)
 *   NEXT_PUBLIC_SUPABASE_URL  Used to derive the project ref if
 *                             SUPABASE_PROJECT_REF isn't set explicitly.
 *   SUPABASE_PROJECT_REF    (optional) Overrides the ref parsed from the URL.
 */

import { readFile, readdir } from 'fs/promises'
import { resolve, dirname, isAbsolute, basename } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const MIGRATIONS_DIR = resolve(ROOT, 'supabase/migrations')

config({ path: resolve(ROOT, '.env.local') })

// ── Validate env ───────────────────────────────────────────────────────────
const PAT = process.env.SUPABASE_ACCESS_TOKEN
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const REF =
  process.env.SUPABASE_PROJECT_REF ??
  URL.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]

if (!PAT) {
  console.error('✗ SUPABASE_ACCESS_TOKEN is missing from .env.local')
  console.error('  Get one at https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}
if (!REF) {
  console.error('✗ Could not determine project ref.')
  console.error('  Set SUPABASE_PROJECT_REF in .env.local or use a')
  console.error('  NEXT_PUBLIC_SUPABASE_URL like https://<ref>.supabase.co')
  process.exit(1)
}

// ── Pick the file to run ───────────────────────────────────────────────────
async function resolveFile() {
  const arg = process.argv[2]
  if (!arg) {
    // Default: latest file in supabase/migrations (lexicographic sort matches
    // our 001_, 002_, … naming convention).
    const entries = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
    if (entries.length === 0) throw new Error(`no .sql files in ${MIGRATIONS_DIR}`)
    return resolve(MIGRATIONS_DIR, entries[entries.length - 1])
  }
  if (isAbsolute(arg)) return arg
  // Allow either "006_bots_and_logs.sql" (relative to migrations dir) or any
  // relative path from the repo root.
  const asMigration = resolve(MIGRATIONS_DIR, arg)
  try { await readFile(asMigration); return asMigration } catch { /* fall through */ }
  return resolve(ROOT, arg)
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const filePath = await resolveFile()
  const sql      = await readFile(filePath, 'utf8')
  const name     = basename(filePath)

  console.log(`→ project: ${REF}`)
  console.log(`→ file:    ${name} (${sql.length} chars)`)
  console.log('→ POST /v1/projects/:ref/database/query')

  const t0  = Date.now()
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  )
  const dt = Date.now() - t0

  if (!res.ok) {
    const text = await res.text()
    console.error(`✗ ${res.status} ${res.statusText} (${dt} ms)`)
    console.error(text)
    process.exit(1)
  }

  // The endpoint returns whatever the last statement produced; we don't care
  // about the value, only that it succeeded.
  const body = await res.text()
  console.log(`✓ applied in ${dt} ms`)
  if (body && body !== '[]') console.log(`  response: ${body.slice(0, 400)}${body.length > 400 ? '…' : ''}`)

  // Kick PostgREST to pick up schema changes immediately — otherwise clients
  // will see "Could not find the X column of Y in the schema cache" for a bit.
  console.log('→ reloading PostgREST schema cache')
  const reload = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ query: `NOTIFY pgrst, 'reload schema';` }),
    },
  )
  console.log(reload.ok ? '✓ schema cache reloaded' : `✗ reload failed: ${reload.status}`)
}

main().catch((err) => {
  console.error('✗ unexpected error:', err)
  process.exit(1)
})
