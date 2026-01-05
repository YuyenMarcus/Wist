import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import ProductCard from '@/components/dashboard/ProductCard';
import CollectionSettings from '@/components/dashboard/CollectionSettings';
import CollectionShareButton from '@/components/dashboard/CollectionShareButton';
import { FolderOpen } from 'lucide-react';

export default async function CollectionPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();
  
  // 1. Check Auth (Middleware handles redirect, but we still need user for queries)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // This shouldn't happen if middleware is working, but safety check
    return notFound();
  }

  // 2. Fetch Collection
  const { data: collection } = await supabase
    .from('collections')
    .select('*')
    .eq('slug', params.slug)
    .eq('user_id', user.id)
    .single();

  // If collection doesn't exist, show 404 (Don't log out)
  if (!collection) return notFound();

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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black pb-20">
      
      {/* Header */}
      <div className="pt-8 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          {/* Title Section */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 text-zinc-500 dark:text-zinc-400 text-sm">
              <span>Collections</span>
              <span>/</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-medium">{collection.name}</span>
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
              <FolderOpen className="text-blue-500" size={32} />
              {collection.name}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {items?.length || 0} {items?.length === 1 ? 'item' : 'items'}
            </p>
          </div>

          {/* Actions Row */}
          <div className="flex items-center gap-2">
            {/* Settings Button */}
            <CollectionSettings 
              collectionId={collection.id} 
              collectionName={collection.name} 
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
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                <div className="text-4xl mb-4">📂</div>
                <h3 className="text-lg font-medium text-zinc-900 dark:text-white">This collection is empty</h3>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mt-2">
                    Move items here using the options menu on your main dashboard.
                </p>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {items.map((item: any) => (
                    <ProductCard 
                        key={item.id} 
                        item={item} 
                        userCollections={allCollections || []} 
                    />
                ))}
            </div>
        )}
      </main>
    </div>
  );
}

