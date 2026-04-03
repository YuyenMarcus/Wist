export interface AdminUser {
  id: string
  email: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  subscription_tier: string
  is_admin: boolean
  is_banned: boolean
  ban_reason: string | null
  age: number | null
  item_count: number
  created_at: string | null
  /** From Auth admin API */
  last_sign_in_at?: string | null
}

export interface BannedEmail {
  id: string
  email: string
  reason: string | null
  created_at: string
}
