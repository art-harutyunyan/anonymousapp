export type Gender = 'man' | 'woman' | 'non_binary' | 'other'
export type Intent = 'friendship' | 'dating' | 'casual' | 'talk'
export type ActionType = 'start_talking' | 'skip'
export type ReportStatus = 'pending' | 'reviewed' | 'actioned'
export type ReportReason = 'spam' | 'harassment' | 'underage' | 'inappropriate' | 'other'

export interface Profile {
  id: string
  nickname: string | null
  gender: Gender
  age: number
  looking_for: Gender
  intent: Intent
  interests: string[]
  country: string | null
  avatar_url: string | null
  tagline: string | null
  preferred_languages: string[]
  last_seen_at: string | null
  age_gate_confirmed_at: string | null
  is_premium: boolean
  is_banned: boolean
  is_admin: boolean
  is_bot: boolean
  onboarding_complete: boolean
  created_at: string
}

export interface SavedConnection {
  owner_id: string
  connection_id: string
  private_nickname: string | null
  note: string | null
  last_match_id: string | null
  saved_at: string
  profile?: Profile
}

export interface NotificationSettings {
  user_id: string
  browser_push: boolean
  email_match_invite: boolean
  email_saved_connection: boolean
  email_premium_events: boolean
  email_account_notices: boolean
  updated_at: string
}

export type LogEventType =
  | 'user_signed_up'
  | 'profile_completed'
  | 'discovery_action'
  | 'match_created'
  | 'user_blocked'
  | 'user_reported'
  | 'user_banned'
  | 'admin_action'

export interface ActivityLog {
  id: string
  user_id: string | null
  event_type: LogEventType
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface DiscoveryAction {
  id: string
  from_user: string
  to_user: string
  action: ActionType
  created_at: string
}

export interface Match {
  id: string
  user_a: string
  user_b: string
  is_active: boolean
  created_at: string
}

export interface MatchWithProfile extends Match {
  other_user: Profile
  last_message?: Message | null
  unread_count?: number
}

export interface Message {
  id: string
  match_id: string
  sender_id: string
  content: string
  is_deleted: boolean
  media_url: string | null
  media_type: 'image' | 'video' | null
  media_width: number | null
  media_height: number | null
  created_at: string
}

export interface Block {
  blocker_id: string
  blocked_id: string
  created_at: string
  blocked_profile?: Profile
}

export interface Report {
  id: string
  reporter_id: string
  reported_id: string
  reason: ReportReason
  details: string | null
  status: ReportStatus
  created_at: string
  reporter_profile?: Profile
  reported_profile?: Profile
}

export interface DiscoveryCandidate {
  id: string
  nickname: string | null
  gender: Gender
  age: number
  intent: Intent
  interests: string[]
  country: string | null
  avatar_url: string | null
  tagline: string | null
  last_seen_at: string | null
  is_premium: boolean
  shared_interests_count: number
}

export const INTERESTS = [
  'Music', 'Movies', 'Gaming', 'Travel', 'Fitness',
  'Cooking', 'Reading', 'Art', 'Photography', 'Technology',
  'Sports', 'Fashion', 'Nature', 'Dancing', 'Yoga',
  'Writing', 'Podcasts', 'Anime', 'Hiking', 'Coffee',
] as const

export const INTENT_LABELS: Record<Intent, string> = {
  friendship: 'Friendship',
  dating: 'Dating',
  casual: 'Casual Chat',
  talk: 'Just Talk',
}

export const GENDER_LABELS: Record<Gender, string> = {
  man: 'Man',
  woman: 'Woman',
  non_binary: 'Non-binary',
  other: 'Other',
}

export const AGE_RANGES = [
  { label: '18–19', min: 18 },
  { label: '20–25', min: 20 },
  { label: '26–30', min: 26 },
  { label: '31–35', min: 31 },
  { label: '36–40', min: 36 },
  { label: '41–50', min: 41 },
  { label: '50+',   min: 51 },
] as const

export function ageRangeLabel(age: number): string {
  for (let i = AGE_RANGES.length - 1; i >= 0; i--) {
    if (age >= AGE_RANGES[i].min) return AGE_RANGES[i].label
  }
  return String(age)
}

export const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian',
  'Dutch', 'Russian', 'Polish', 'Arabic', 'Hindi', 'Bengali',
  'Japanese', 'Korean', 'Mandarin', 'Cantonese', 'Turkish',
  'Swedish', 'Norwegian', 'Danish', 'Finnish',
] as const

export const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
  'France', 'Spain', 'Italy', 'Netherlands', 'Sweden', 'Norway', 'Denmark',
  'Finland', 'Poland', 'Brazil', 'Mexico', 'Argentina', 'Japan', 'South Korea',
  'India', 'China', 'Singapore', 'UAE', 'South Africa', 'Nigeria', 'Kenya',
  'Other',
] as const
