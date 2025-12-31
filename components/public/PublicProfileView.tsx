'use client';

import { PublicProfileData, PublicItem } from '@/lib/supabase/public-profile';
import WishlistGrid from '@/components/wishlist/WishlistGrid';

interface PublicProfileViewProps {
  profile: PublicProfileData;
  items: PublicItem[];
}

/**
 * Public Profile View Component
 * 
 * Displays a user's public wishlist with their profile information.
 * This is a client component for interactivity (reservations, etc.)
 */
export default function PublicProfileView({ profile, items }: PublicProfileViewProps) {
  // Convert PublicItem[] to SupabaseProduct[] format for WishlistGrid
  const products = items.map(item => ({
    id: item.id,
    title: item.title,
    price: item.price,
    image: item.image,
    url: item.url,
    user_id: profile.id,
    created_at: new Date().toISOString(),
    last_scraped: null,
    reserved_by: null,
    reserved_at: null,
    is_public: true,
    share_token: null,
  }));

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex flex-col items-center gap-4">
            {/* Avatar */}
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || profile.username}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center border-4 border-white shadow-lg">
                <span className="text-3xl font-medium text-white">
                  {profile.full_name?.[0]?.toUpperCase() || profile.username[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}

            {/* Name & Username */}
            <div>
              <h1 className="text-3xl font-semibold text-zinc-900 mb-1">
                {profile.full_name || `${profile.username}'s Wishlist`}
              </h1>
              <p className="text-sm text-zinc-500">@{profile.username}</p>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-zinc-600 max-w-md mt-2">{profile.bio}</p>
            )}

            {/* Item Count */}
            <p className="text-sm text-zinc-500 mt-2">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>

        {/* Wishlist Grid */}
        {items.length > 0 ? (
          <WishlistGrid 
            items={products}
            isOwner={false}
          />
        ) : (
          <div className="text-center py-20">
            <p className="text-zinc-500">This wishlist is empty.</p>
          </div>
        )}
      </div>
    </div>
  );
}

