// app/[username]/page.tsx
import { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getPublicProfileData } from '@/lib/supabase/public-profile';

// Force dynamic rendering so we always get fresh data
export const dynamic = 'force-dynamic';

interface Props {
  params: { username: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { profile } = await getPublicProfileData(params.username);
  
  if (!profile) return { title: 'User Not Found | Wist' };

  return {
    title: `${profile.full_name || profile.username}'s Wishlist`,
    description: `Check out what ${profile.username} is wishing for.`,
    openGraph: {
      images: profile.avatar_url ? [profile.avatar_url] : [],
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const username = decodeURIComponent(params.username);
  const { profile, items } = await getPublicProfileData(username);

  if (!profile) {
    notFound(); 
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Navigation / Branding Bar */}
      <nav className="bg-white border-b border-gray-200 px-4 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="font-bold text-xl tracking-tight">Wist.</div>
        <a 
          href="https://wishlist.nuvio.cloud" 
          className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
        >
          Create your own
        </a>
      </nav>

      {/* Header Profile Section */}
      <div className="bg-white border-b border-gray-200 pt-10 pb-10 px-4 mb-8">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
          
          {/* Avatar */}
          <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg mb-4 bg-gray-100">
            {profile.avatar_url ? (
              <Image 
                src={profile.avatar_url} 
                alt={profile.username}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl bg-indigo-100 text-indigo-500 font-bold">
                {profile.username[0].toUpperCase()}
              </div>
            )}
          </div>

          {/* User Info */}
          <h1 className="text-3xl font-bold text-gray-900 mb-1">
            {profile.full_name || profile.username}
          </h1>
          <p className="text-gray-500 font-medium mb-4">@{profile.username}</p>
          
          {profile.bio && (
            <p className="text-gray-600 max-w-lg mx-auto leading-relaxed">
              {profile.bio}
            </p>
          )}

          <div className="mt-6 flex gap-4 text-sm text-gray-500 font-medium">
             <span>{items.length} Items</span>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6">
        {items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-500 text-lg">This wishlist is currently empty.</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
            {items.map((item) => (
              <a 
                key={item.id}
                href={item.url} 
                target="_blank"
                rel="noopener noreferrer"
                className="group break-inside-avoid block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 transform hover:-translate-y-1"
              >
                {/* Image */}
                <div className="relative bg-gray-100">
                  {item.image_url ? (
                    <img // Using standard img tag here for better masonry flexibility
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-square flex items-center justify-center text-gray-400 bg-gray-50">
                      No Image
                    </div>
                  )}
                  
                  {/* Price Badge */}
                  {item.current_price && item.current_price > 0 && (
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-black text-xs font-bold px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
                      ${item.current_price.toFixed(2)}
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="text-base font-semibold text-gray-900 leading-snug group-hover:text-indigo-600 transition-colors mb-2">
                    {item.title}
                  </h3>
                  
                  <div className="flex justify-between items-center mt-3 border-t border-gray-50 pt-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {item.retailer}
                    </span>
                    <span className="text-xs text-indigo-600 font-medium group-hover:underline">
                      View Item &rarr;
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

