import { supabase } from './client';

/**
 * Profile interface matching the Supabase profiles table schema
 */
export interface Profile {
  id: string; // uuid, matches auth.users
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null; // User bio with 150 character limit
  updated_at: string; // timestamp
  username: string | null; // NEW: for public sharing
  username_set_at: string | null; // NEW: when username was set
  username_changed_at: string | null; // NEW: when username was last changed
  website: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  amazon_affiliate_id: string | null;
}

/**
 * Fetches a user's profile by their user ID
 * @param userId - The user's UUID from auth.users
 * @returns Profile data or null if not found
 */
export async function getProfile(userId: string): Promise<{
  data: Profile | null;
  error: any;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  return { data, error };
}

/**
 * Public profile interface (limited fields for sharing)
 */
export interface PublicProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

/**
 * Get profile by username (for public sharing)
 */
export async function getProfileByUsername(username: string): Promise<{
  data: PublicProfile | null;
  error: any;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .eq('username', username)
    .single();

  return { data, error };
}

/**
 * Check if username is available
 */
export async function isUsernameAvailable(username: string): Promise<{
  available: boolean;
  error: any;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .single();

  if (error && error.code === 'PGRST116') {
    // No rows found = username is available
    return { available: true, error: null };
  }

  if (error) {
    return { available: false, error };
  }

  // Username exists
  return { available: false, error: null };
}

/**
 * Updates a user's profile
 * @param userId - The user's UUID from auth.users
 * @param updates - Object containing fields to update
 */
export async function updateProfile(
  userId: string,
  updates: {
    full_name?: string | null;
    avatar_url?: string | null;
    username?: string | null;
    bio?: string | null;
    website?: string | null;
    instagram_handle?: string | null;
    tiktok_handle?: string | null;
    amazon_affiliate_id?: string | null;
  }
): Promise<{
  data: Profile | null;
  error: any;
}> {
  const updateData: any = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // If setting username for first time, also set username_set_at
  if (updates.username && !updates.username.match(/^[a-zA-Z0-9_-]+$/)) {
    return {
      data: null,
      error: { message: 'Username can only contain letters, numbers, underscores, and hyphens' },
    };
  }

  if (updates.username) {
    // Check if username is available (unless it's their current username)
    const { data: currentProfile } = await getProfile(userId);
    if (currentProfile?.username !== updates.username) {
      // Check if username change is locked (30 days)
      if (currentProfile?.username_changed_at) {
        const lastChanged = new Date(currentProfile.username_changed_at);
        const now = new Date();
        const daysSinceChange = (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceChange < 30) {
          const daysRemaining = Math.ceil(30 - daysSinceChange);
          return {
            data: null,
            error: { 
              message: `Username can only be changed once every 30 days. You can change it again in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.`,
              code: 'USERNAME_CHANGE_LOCKED'
            },
          };
        }
      }

      const { available, error: checkError } = await isUsernameAvailable(updates.username);
      if (checkError) {
        return { data: null, error: checkError };
      }
      if (!available) {
        return { data: null, error: { message: 'Username is already taken' } };
      }

      // Update username_changed_at when username is actually changed
      updateData.username_changed_at = new Date().toISOString();
    }

    // If this is the first time setting username
    if (!currentProfile?.username_set_at) {
      updateData.username_set_at = new Date().toISOString();
      // Also set username_changed_at for first-time setting
      if (!updateData.username_changed_at) {
        updateData.username_changed_at = new Date().toISOString();
      }
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  return { data, error };
}
