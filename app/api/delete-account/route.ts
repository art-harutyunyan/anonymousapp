import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id
  const admin = createAdminClient()

  // 1. Delete avatar objects
  const { data: avatarFiles } = await admin.storage.from('avatars').list(uid)
  if (avatarFiles?.length) {
    await admin.storage.from('avatars').remove(avatarFiles.map((f) => `${uid}/${f.name}`))
  }

  // 2. Delete chat-media objects — enumerate matches to find folder prefixes
  const { data: matches } = await admin
    .from('matches')
    .select('id')
    .or(`user_a.eq.${uid},user_b.eq.${uid}`)

  for (const match of matches ?? []) {
    const prefix = `${match.id}/${uid}`
    const { data: mediaFiles } = await admin.storage.from('chat-media').list(prefix)
    if (mediaFiles?.length) {
      await admin.storage.from('chat-media').remove(mediaFiles.map((f) => `${prefix}/${f.name}`))
    }
  }

  // 3. Delete the auth user — cascades to profiles and all child tables via FK ON DELETE CASCADE
  const { error } = await admin.auth.admin.deleteUser(uid)
  if (error) {
    console.error('[delete-account] admin.deleteUser error:', error)
    return NextResponse.json({ error: 'Could not delete account' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
