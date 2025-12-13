import { supabase } from './client';

/**
 * Profile interface matching the Supabase profiles table schema
 */
export interface Profile {
  id: string; // uuid, matches auth.users
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  updated_at: string; // timestamp
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
 * Updates a user's profile
 * @param userId - The user's UUID from auth.users
 * @param updates - Object containing fields to update (full_name and/or avatar_url)
 * @returns Updated profile data or error
 */
export async function updateProfile(
  userId: string,
  updates: {
    full_name?: string | null;
    avatar_url?: string | null;
  }
): Promise<{
  data: Profile | null;
  error: any;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  return { data, error };
}

