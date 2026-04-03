import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getPublicProfile } from '@/lib/supabase/public-profile';
import PublicProfileView from '@/components/public/PublicProfileView';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: {
    username: string;
    slug: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const username = decodeURIComponent(params.username);
  const slug = decodeURIComponent(params.slug);

  try {
    const { profile, sharedCollection, error } = await getPublicProfile(username, {
      collectionSlug: slug,
    });

    if (error || !profile || !sharedCollection) {
      return {
        title: 'Wishlist | Wist',
        description: 'This collection could not be found.',
      };
    }

    const displayName = profile.full_name || `@${profile.username}`;
    const title = `${displayName} — ${sharedCollection.name} | Wist`;
    const description = `Wishlist: ${sharedCollection.name}. ${profile.bio || `Items from ${displayName} on Wist.`}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: profile.avatar_url ? [{ url: profile.avatar_url, alt: displayName }] : [],
      },
      twitter: {
        card: 'summary',
        title,
        description,
        images: profile.avatar_url ? [profile.avatar_url] : [],
      },
    };
  } catch {
    return {
      title: 'Wishlist | Wist',
      description: 'View wishlist on Wist',
    };
  }
}

export default async function PublicCollectionPage({ params }: PageProps) {
  const username = decodeURIComponent(params.username);
  const slug = decodeURIComponent(params.slug);

  const { profile, items, sharedCollection, reservations, error } = await getPublicProfile(username, {
    collectionSlug: slug,
  });

  if (error || !profile || !sharedCollection) {
    notFound();
  }

  return (
    <PublicProfileView
      profile={profile}
      items={items}
      sharedCollection={sharedCollection}
      reservations={reservations}
    />
  );
}
