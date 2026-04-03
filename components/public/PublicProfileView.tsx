'use client';

import { useEffect, useState, useCallback } from 'react';
import { PublicProfileData, PublicItem } from '@/lib/supabase/public-profile';
import { getProfileTheme, type ProfileTheme } from '@/lib/constants/profile-themes';
import TierBadge from '@/components/ui/TierBadge';
import { Globe, Sparkles, Plus, Check, Loader2, Gift, Users, EyeOff } from 'lucide-react';
import { isAdultContent } from '@/lib/content-filter';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface SharedCollectionProps {
  name: string;
  slug: string;
  id?: string;
  registry_mode?: boolean;
  background_image_url?: string | null;
  collab_join_href?: string | null;
}

interface PublicProfileViewProps {
  profile: PublicProfileData;
  items: PublicItem[];
  sharedCollection?: SharedCollectionProps | null;
  reservations?: Record<string, { name: string | null }>;
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

function AddToMyListButton({ item, theme }: { item: PublicItem; theme: ProfileTheme }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  async function handleAdd() {
    setState('loading');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      let clientTier: string | undefined;
      if (session.user?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', session.user.id)
          .single();
        clientTier = prof?.subscription_tier || undefined;
      }

      const res = await fetch('/api/items/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          url: item.url,
          title: item.title,
          price: item.price,
          image_url: item.image,
          client_tier: clientTier,
        }),
      });

      if (res.ok) {
        setState('done');
      } else {
        setState('idle');
      }
    } catch {
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500 text-white shadow-lg text-[10px] font-semibold">
        <Check className="w-3 h-3" />
        Added
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAdd(); }}
      disabled={state === 'loading'}
      className={`absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-white shadow-lg text-[10px] font-semibold active:scale-95 transition-all bg-gradient-to-r ${theme.avatarGradient} hover:opacity-90`}
      title="Add to my wishlist"
    >
      {state === 'loading' ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <>
          <Plus className="w-3 h-3" />
          Add
        </>
      )}
    </button>
  );
}

const reserveBtnBase =
  'absolute top-2 right-2 z-20 flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-full text-white shadow-lg text-sm font-semibold active:scale-[0.98] transition-all';

function ReserveButton({
  item,
  collectionId,
  isReserved,
  reserverName,
  theme,
  onReserved,
  onUnreserved,
}: {
  item: PublicItem;
  collectionId: string;
  isReserved: boolean;
  reserverName: string | null;
  theme: ProfileTheme;
  onReserved: (itemId: string, token: string, name: string) => void;
  onUnreserved: (itemId: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'confirm'>('idle');
  const [unreserveLoading, setUnreserveLoading] = useState(false);
  const [reserveSubmitting, setReserveSubmitting] = useState(false);
  const [name, setName] = useState('');
  const storageKey = `wist_reserve_${item.id}`;
  const savedToken = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;

  if (isReserved) {
    if (savedToken) {
      return (
        <button
          type="button"
          disabled={unreserveLoading}
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setUnreserveLoading(true);
            try {
              const res = await fetch(`/api/collections/${collectionId}/items/${item.id}/reserve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ unreserveToken: savedToken }),
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok) {
                localStorage.removeItem(storageKey);
                onUnreserved(item.id);
              } else {
                alert(typeof data.error === 'string' ? data.error : 'Could not unreserve. Try again.');
              }
            } catch {
              alert('Could not unreserve. Check your connection and try again.');
            } finally {
              setUnreserveLoading(false);
            }
          }}
          className={`${reserveBtnBase} bg-zinc-700 hover:bg-zinc-800 disabled:opacity-60`}
        >
          {unreserveLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Unreserve'
          )}
        </button>
      );
    }
    return (
      <div className={`${reserveBtnBase} bg-emerald-600 pointer-events-none cursor-default`}>
        <Check className="w-5 h-5 shrink-0" />
        <span className="max-w-[140px] sm:max-w-[200px] truncate">
          {reserverName ? `Reserved by ${reserverName}` : 'Reserved'}
        </span>
      </div>
    );
  }

  if (state === 'confirm') {
    return (
      <div
        className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 rounded-xl p-4"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        role="dialog"
        aria-modal="true"
        aria-label="Reserve this gift"
      >
        <p className="text-white text-sm font-semibold mb-2">Your name (optional)</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sarah"
          className="w-full rounded-lg px-3 py-2 text-sm bg-white/90 text-zinc-900 placeholder:text-zinc-400 mb-3"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex gap-2 w-full">
          <button
            type="button"
            disabled={reserveSubmitting}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setReserveSubmitting(true);
              try {
                const res = await fetch(`/api/collections/${collectionId}/items/${item.id}/reserve`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: name.trim() || undefined }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.token) {
                  localStorage.setItem(storageKey, data.token);
                  onReserved(item.id, data.token, name.trim());
                  setState('idle');
                } else {
                  alert(typeof data.error === 'string' ? data.error : 'Could not reserve this item.');
                }
              } catch {
                alert('Could not reserve. Check your connection and try again.');
              } finally {
                setReserveSubmitting(false);
              }
            }}
            className="flex-1 rounded-xl bg-emerald-500 text-white text-sm font-semibold py-2.5 hover:bg-emerald-600 transition-colors disabled:opacity-60"
          >
            {reserveSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setState('idle'); }}
            disabled={reserveSubmitting}
            className="flex-1 rounded-xl bg-zinc-200 text-zinc-800 text-sm font-semibold py-2.5 hover:bg-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setState('confirm'); }}
      className={`${reserveBtnBase} bg-gradient-to-r ${theme.avatarGradient} hover:opacity-95`}
      title="Reserve this item"
    >
      <Gift className="w-5 h-5 shrink-0" />
      Reserve
    </button>
  );
}

function PublicItemCard({
  item,
  amazonTag,
  theme,
  registryMode,
  collectionId,
  isReserved,
  reserverName,
  onReserved,
  onUnreserved,
  adultFilterEnabled,
}: {
  item: PublicItem;
  amazonTag?: string | null;
  theme: ProfileTheme;
  registryMode?: boolean;
  collectionId?: string;
  isReserved?: boolean;
  reserverName?: string | null;
  onReserved?: (itemId: string, token: string, name: string) => void;
  onUnreserved?: (itemId: string) => void;
  adultFilterEnabled: boolean;
}) {
  const isNsfw = adultFilterEnabled && isAdultContent(item.title);
  let href = item.url;
  if (amazonTag && href && /amazon\./i.test(href)) {
    try {
      const u = new URL(href);
      u.searchParams.set('tag', amazonTag);
      href = u.toString();
    } catch {}
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden border ${theme.borderColor} ${theme.cardBg} shadow-sm hover:shadow-md transition-shadow group`}
    >
      {registryMode && collectionId && onReserved && onUnreserved ? (
        <ReserveButton
          item={item}
          collectionId={collectionId}
          isReserved={!!isReserved}
          reserverName={reserverName ?? null}
          theme={theme}
          onReserved={onReserved}
          onUnreserved={onUnreserved}
        />
      ) : (
        <AddToMyListButton item={item} theme={theme} />
      )}
      <a
        href={href || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-b-xl"
        onClick={(e) => {
          if (!href || href === '#') e.preventDefault();
        }}
      >
        {item.image && (
          <div className={`aspect-square overflow-hidden bg-zinc-100 relative ${isReserved ? 'after:absolute after:inset-0 after:bg-black/30' : ''}`}>
            <img
              src={item.image}
              alt={item.title || ''}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                isNsfw ? 'blur-xl scale-110' : isReserved ? 'blur-[2px]' : ''
              }`}
              loading="lazy"
            />
            {isNsfw && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-[8] bg-zinc-900/40 pointer-events-none">
                <EyeOff className="w-6 h-6 sm:w-8 sm:h-8 text-white/80 mb-1" />
                <span className="text-white/90 text-xs sm:text-sm font-bold tracking-wider">18+</span>
              </div>
            )}
            {isReserved && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                  <Check className="w-6 h-6 text-white" />
                </div>
              </div>
            )}
          </div>
        )}
        <div className="p-3">
          {item.title && (
            <h3 className={`text-sm font-medium ${theme.text} line-clamp-2 leading-snug`}>
              {item.title}
            </h3>
          )}
          {item.price != null && item.price > 0 && (
            <p className={`mt-1.5 text-sm font-bold ${theme.accent}`}>
              ${Number(item.price).toFixed(2)}
            </p>
          )}
        </div>
      </a>
    </div>
  );
}

export default function PublicProfileView({
  profile,
  items,
  sharedCollection = null,
  reservations: initialReservations = {},
}: PublicProfileViewProps) {
  const hasSocials = profile.instagram_handle || profile.tiktok_handle || profile.website;
  const theme = getProfileTheme(profile.profile_theme);
  const isDarkTheme = theme.isDark;
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [reservations, setReservations] = useState(initialReservations);
  const isRegistryMode = sharedCollection?.registry_mode === true;
  const collectionId = sharedCollection?.id;
  const backgroundImage = sharedCollection?.background_image_url;
  const adultFilterEnabled = profile.adult_content_filter ?? true;

  const handleReserved = useCallback((itemId: string, _token: string, name: string) => {
    setReservations(prev => ({ ...prev, [itemId]: { name: name || null } }));
  }, []);

  const handleUnreserved = useCallback((itemId: string) => {
    setReservations(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsSignedIn(!!session);
    });
  }, []);

  useEffect(() => {
    if (isDarkTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return () => { document.documentElement.classList.remove('dark'); };
  }, [isDarkTheme]);

  return (
    <div
      className={`min-h-screen transition-colors relative isolate ${backgroundImage ? '' : theme.bg}`}
    >
      {backgroundImage ? (
        <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
      ) : null}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-32">
        {/* Header */}
        <header className="flex flex-col items-center text-center mb-10 sm:mb-16 px-2">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name || profile.username}
              className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full object-cover border-4 shadow-lg ${isDarkTheme ? 'border-zinc-800' : 'border-white'}`}
            />
          ) : (
            <div className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br ${theme.avatarGradient} flex items-center justify-center border-4 shadow-lg ${isDarkTheme ? 'border-zinc-800' : 'border-white'}`}>
              <span className="text-2xl sm:text-3xl font-medium text-white">
                {profile.full_name?.[0]?.toUpperCase() || profile.username[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}

          <h1 className={`mt-4 text-xl sm:text-3xl font-bold ${theme.text} tracking-tight flex items-center justify-center gap-2 flex-wrap`}>
            {sharedCollection
              ? `${profile.full_name || profile.username}'s ${sharedCollection.name}`
              : profile.full_name || `${profile.username}'s Wishlist`}
            <TierBadge tier={profile.subscription_tier} size="md" />
          </h1>

          <p className={`mt-1 text-sm ${theme.textSecondary} font-medium`}>@{profile.username}</p>

          {sharedCollection && (
            <p className={`mt-2 text-xs sm:text-sm ${theme.textSecondary}`}>
              <Link
                href={`/u/${encodeURIComponent(profile.username)}`}
                className={`font-medium underline-offset-2 hover:underline ${theme.accent}`}
              >
                View full wishlist
              </Link>
            </p>
          )}

          {profile.bio && (
            <p className={`mt-3 text-sm sm:text-base ${theme.textSecondary} max-w-md leading-relaxed`}>
              {profile.bio}
            </p>
          )}

          {hasSocials && (
            <div className="flex items-center gap-3 mt-4">
              {profile.instagram_handle && (
                <a
                  href={`https://instagram.com/${profile.instagram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2 rounded-full ${theme.cardBg} border ${theme.borderColor} ${theme.textSecondary} hover:text-pink-600 hover:border-pink-300 transition-colors shadow-sm`}
                  title={`@${profile.instagram_handle} on Instagram`}
                >
                  <InstagramIcon className="w-[18px] h-[18px]" />
                </a>
              )}
              {profile.tiktok_handle && (
                <a
                  href={`https://tiktok.com/@${profile.tiktok_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2 rounded-full ${theme.cardBg} border ${theme.borderColor} ${theme.textSecondary} hover:opacity-70 transition-all shadow-sm`}
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
                  className={`p-2 rounded-full ${theme.cardBg} border ${theme.borderColor} ${theme.textSecondary} hover:opacity-70 transition-all shadow-sm`}
                  title={profile.website}
                >
                  <Globe className="w-[18px] h-[18px]" />
                </a>
              )}
            </div>
          )}

          <p className={`mt-3 text-sm ${theme.textSecondary}`}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
            {sharedCollection ? ' in this collection' : ''}
          </p>
        </header>

        {/* Collaboration join — only when owner enabled it on the shared collection */}
        {sharedCollection?.collab_join_href && (
          <div className="flex justify-center mb-6 px-2">
            <div
              className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full max-w-md px-4 py-3 rounded-xl border ${theme.borderColor} ${theme.cardBg} shadow-sm`}
            >
              <div className="flex items-start gap-2 text-left flex-1 min-w-0">
                <Users className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" />
                <div>
                  <p className={`text-sm font-semibold ${theme.text}`}>Join this collection</p>
                  <p className={`text-xs mt-0.5 ${theme.textSecondary}`}>
                    The list owner invited collaborators. Sign in to join and help manage items.
                  </p>
                </div>
              </div>
              <Link
                href={sharedCollection.collab_join_href}
                className={`shrink-0 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition-colors shadow-sm`}
              >
                Join
              </Link>
            </div>
          </div>
        )}

        {/* Registry badge */}
        {isRegistryMode && (
          <div className="flex justify-center mb-6">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${theme.borderColor} ${theme.cardBg} shadow-sm`}>
              <Gift className="w-4 h-4 text-emerald-500" />
              <span className={`text-sm font-medium ${theme.text}`}>Gift Registry</span>
              <span className={`text-xs ${theme.textSecondary}`}>— tap an item to reserve it</span>
            </div>
          </div>
        )}

        {/* Grid */}
        {items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mx-auto max-w-4xl">
            {items.map((item) => (
              <PublicItemCard
                key={item.id}
                item={item}
                amazonTag={profile.amazon_affiliate_id}
                theme={theme}
                registryMode={isRegistryMode}
                collectionId={collectionId}
                adultFilterEnabled={adultFilterEnabled}
                isReserved={!!reservations[item.id]}
                reserverName={reservations[item.id]?.name}
                onReserved={handleReserved}
                onUnreserved={handleUnreserved}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className={theme.textSecondary}>
              {sharedCollection ? 'This collection is empty.' : 'This wishlist is empty.'}
            </p>
          </div>
        )}
      </div>

      {/* Sticky bottom CTA — only for visitors not signed in */}
      {isSignedIn === false && (
        <div className="fixed bottom-0 inset-x-0 z-50 pointer-events-none">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-5">
            <div className={`pointer-events-auto flex items-center justify-between gap-3 rounded-2xl ${isDarkTheme ? 'bg-zinc-900/80 border-zinc-700/60' : 'bg-white/80 border-zinc-200'} backdrop-blur-xl border shadow-lg px-4 sm:px-5 py-3.5`}>
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br ${theme.avatarGradient} flex items-center justify-center`}>
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </div>
                <p className={`text-xs sm:text-sm font-medium ${theme.text}`}>
                  <span className="hidden sm:inline">Track prices & build your own wishlist</span>
                  <span className="sm:hidden">Build your own wishlist</span>
                </p>
              </div>
              <Link
                href="/signup"
                className={`flex-shrink-0 inline-flex items-center gap-1.5 bg-gradient-to-r ${theme.avatarGradient} text-white text-xs sm:text-sm font-semibold px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-opacity hover:opacity-90 shadow-sm`}
              >
                Get your Wist
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
