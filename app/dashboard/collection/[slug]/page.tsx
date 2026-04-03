import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import ProductCard from '@/components/dashboard/ProductCard';
import CollectionSettings from '@/components/dashboard/CollectionSettings';
import CollectionShareButton from '@/components/dashboard/CollectionShareButton';
import { getServerTranslation } from '@/lib/i18n/server';
import { FolderOpen } from 'lucide-react';

export default async function CollectionPage({ params }: { params: { slug: string } }) {
  const { t } = await getServerTranslation();
  const supabase = await createClient();
  
  // 1. Check Auth (If this fails, IT IS THE MIDDLEWARE'S FAULT)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 2. Fetch Collection
  const { data: collection } = await supabase
    .from('collections')
    .select('*')
    .eq('slug', params.slug)
    .eq('user_id', user.id)
    .single();

  if (!collection) return notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('adult_content_filter, subscription_tier')
    .eq('id', user.id)
    .single();
  const adultFilterEnabled = profile?.adult_content_filter ?? true;
  const tier = profile?.subscription_tier || 'free';
  // 3. Fetch Items (SAFE: If empty, it returns [])
  const { data: items } = await supabase
    .from('items')
    .select('*')
    .eq('collection_id', collection.id)
    .order('created_at', { ascending: false });

  // 4. Fetch All Collections (For the "Move" dropdown)
  const { data: allCollections } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', user.id);

  const bgImage = collection.background_image_url;

  return (
    <div
      className={`min-h-screen pb-20 relative isolate ${bgImage ? '' : 'bg-beige-50 dark:bg-black'}`}
    >
      {bgImage ? (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          aria-hidden
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
      ) : null}

      <div className="relative z-10 min-h-screen">
      {/* Header */}
      <div className="pt-8 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          {/* Title Section */}
          <div className="flex-1">
            <div className={`flex items-center gap-3 mb-2 text-sm ${bgImage ? 'text-white/70' : 'text-zinc-500 dark:text-zinc-400'}`}>
              <span>{t('Collections')}</span>
              <span>/</span>
              <span className={`font-medium ${bgImage ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'}`}>{collection.name}</span>
            </div>
            <h1 className={`text-3xl font-bold tracking-tight flex items-center gap-3 ${bgImage ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>
              <FolderOpen className={bgImage ? 'text-white/80' : 'text-blue-500'} size={32} />
              {collection.name}
            </h1>
            <p className={`mt-1 ${bgImage ? 'text-white/60' : 'text-zinc-500 dark:text-zinc-400'}`}>
              {items?.length || 0} {items?.length === 1 ? t('item') : t('items')}
            </p>
          </div>

          {/* Actions Row */}
          <div className="flex items-center gap-2">
            {/* Settings Button */}
            <CollectionSettings 
              collectionId={collection.id} 
              collectionName={collection.name}
              backgroundImageUrl={collection.background_image_url}
              registryMode={collection.registry_mode}
              collaborativeEnabled={collection.collaborative_enabled}
              collaborationInviteCode={collection.collaboration_invite_code}
            />
            
            {/* Share Button */}
            <CollectionShareButton 
              collectionId={collection.id} 
              collectionSlug={collection.slug}
              initialIsPublic={(collection as any).is_public || false}
            />
          </div>
        </div>
      </div>

      <main className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* EMPTY STATE HANDLING */}
        {(!items || items.length === 0) ? (
                <div className={`flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl ${bgImage ? 'border-white/25 bg-black/25' : 'border-zinc-200 dark:border-dpurple-700'}`}>
                    <div className="text-4xl mb-4">📂</div>
                    <h3 className={`text-lg font-medium ${bgImage ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>{t('This collection is empty')}</h3>
                    <p className={`max-w-sm mt-2 ${bgImage ? 'text-white/60' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        {t('Move items here using the options menu on your main dashboard.')}
                    </p>
                </div>
        ) : (
            <div className="columns-2 sm:columns-2 lg:columns-3 xl:columns-4 gap-3 sm:gap-6 space-y-3 sm:space-y-6">
                {items.map((item: any, i: number) => (
                    <span className="block break-inside-avoid" key={item.id}>
                        <ProductCard 
                            item={item} 
                            index={i}
                            userCollections={allCollections || []}
                            adultFilterEnabled={adultFilterEnabled}
                            tier={tier}
                        />
                    </span>
                ))}
            </div>
        )}
      </main>
      </div>
    </div>
  );
}

