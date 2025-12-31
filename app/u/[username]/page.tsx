import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getPublicProfile } from '@/lib/supabase/public-profile';
import PublicProfileView from '@/components/public/PublicProfileView';

interface PageProps {
  params: {
    username: string;
  };
}

/**
 * Generate metadata for SEO and social sharing
 * 
 * This runs server-side before the page renders to populate
 * Open Graph tags for Twitter, iMessage, etc.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const username = params.username;

  try {
    // Fetch only profile data (not items) for metadata
    const { profile } = await getPublicProfile(username);

    if (!profile) {
      return {
        title: 'User Not Found | Wist',
        description: 'This wishlist doesn\'t exist or is private.',
      };
    }

    const displayName = profile.full_name || `@${profile.username}`;
    const title = `${displayName}'s Wishlist | Wist`;
    const description = profile.bio 
      ? `${displayName}'s wishlist on Wist. ${profile.bio}`
      : `View ${displayName}'s wishlist on Wist`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'profile',
        images: profile.avatar_url 
          ? [{ url: profile.avatar_url, alt: displayName }]
          : [],
      },
      twitter: {
        card: 'summary',
        title,
        description,
        images: profile.avatar_url ? [profile.avatar_url] : [],
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Wishlist | Wist',
      description: 'View wishlist on Wist',
    };
  }
}

/**
 * Public Profile Page
 * 
 * Server-side rendered page that displays a user's public wishlist.
 * 
 * Routing Strategy:
 * - Captures username from URL: /u/[username]
 * - URL-decodes the username before querying database
 * - Returns 404 if user not found
 */
export default async function PublicProfilePage({ params }: PageProps) {
  // Extract and decode username from URL
  const username = decodeURIComponent(params.username);

  // Fetch public profile data (server-side)
  const { profile, items, error } = await getPublicProfile(username);

  // If user not found or error, return 404
  if (error || !profile) {
    notFound();
  }

  // Render the public profile view
  return <PublicProfileView profile={profile} items={items} />;
}
