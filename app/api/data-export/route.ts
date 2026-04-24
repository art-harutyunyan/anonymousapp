import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id

  const [
    { data: profile },
    { data: messages },
    { data: matches },
    { data: savedConnections },
    { data: discoveryActions },
    { data: notifSettings },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).single(),
    supabase.from('messages').select('id, match_id, content, media_url, media_type, created_at, is_deleted').eq('sender_id', uid).order('created_at'),
    supabase.from('matches').select('id, user_a, user_b, created_at, is_active').or(`user_a.eq.${uid},user_b.eq.${uid}`).order('created_at'),
    supabase.from('saved_connections').select('connection_id, private_nickname, note, saved_at').eq('owner_id', uid),
    supabase.from('discovery_actions').select('to_user, action, created_at').eq('from_user', uid).order('created_at'),
    supabase.from('notification_settings').select('*').eq('user_id', uid).single(),
  ])

  const export_ = {
    exported_at: new Date().toISOString(),
    user_id: uid,
    email: user.email,
    profile,
    notification_settings: notifSettings,
    matches: matches ?? [],
    messages_sent: messages ?? [],
    saved_connections: savedConnections ?? [],
    discovery_actions: discoveryActions ?? [],
  }

  return new NextResponse(JSON.stringify(export_, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="anonymous-match-data-${uid.slice(0, 8)}.json"`,
    },
  })
}
