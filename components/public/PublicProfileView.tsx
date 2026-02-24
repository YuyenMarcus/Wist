'use client';

import { PublicProfileData, PublicItem } from '@/lib/supabase/public-profile';
import WishlistGrid from '@/components/wishlist/WishlistGrid';
import TierBadge from '@/components/ui/TierBadge';
import { Globe } from 'lucide-react';

interface PublicProfileViewProps {
  profile: PublicProfileData;
  items: PublicItem[];
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48v-7.15a8.16 8.16 0 005.58 2.2V11.2a4.85 4.85 0 01-3.77-1.74V6.69h3.77z"/>
    </svg>
  );
}

export default function PublicProfileView({ profile, items }: PublicProfileViewProps) {
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

  const hasSocials = profile.instagram_handle || profile.tiktok_handle || profile.website;

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
              <h1 className="text-3xl font-semibold text-zinc-900 mb-1 flex items-center justify-center gap-2">
                {profile.full_name || `${profile.username}'s Wishlist`}
                <TierBadge tier={profile.subscription_tier} size="md" />
              </h1>
              <p className="text-sm text-zinc-500">@{profile.username}</p>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-zinc-600 max-w-md mt-2">{profile.bio}</p>
            )}

            {/* Social Links */}
            {hasSocials && (
              <div className="flex items-center gap-3 mt-1">
                {profile.instagram_handle && (
                  <a
                    href={`https://instagram.com/${profile.instagram_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-white border border-zinc-200 text-zinc-500 hover:text-pink-600 hover:border-pink-300 transition-colors shadow-sm"
                    title={`@${profile.instagram_handle} on Instagram`}
                  >
                    <InstagramIcon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                  </a>
                )}
                {profile.tiktok_handle && (
                  <a
                    href={`https://tiktok.com/@${profile.tiktok_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 transition-colors shadow-sm"
                    title={`@${profile.tiktok_handle} on TikTok`}
                  >
                    <TikTokIcon className="w-[18px] h-[18px]" />
                  </a>
                )}
                {profile.website && (
                  <a
                    href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full bg-white border border-zinc-200 text-zinc-500 hover:text-violet-600 hover:border-violet-300 transition-colors shadow-sm"
                    title={profile.website}
                  >
                    <Globe className="w-[18px] h-[18px]" />
                  </a>
                )}
              </div>
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

