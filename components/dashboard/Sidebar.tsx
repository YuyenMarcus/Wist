'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Folder, Plus, Grid, Gift } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Collection {
  id: string;
  name: string;
  slug: string;
  user_id: string;
  created_at?: string;
}

export default function Sidebar({ initialCollections }: { initialCollections: Collection[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Create a simple URL-friendly slug (e.g., "Living Room" -> "living-room")
    const slug = newCollectionName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');

    const { data, error } = await supabase
      .from('collections')
      .insert({ name: newCollectionName, slug, user_id: user.id })
      .select()
      .single();

    if (error) {
      console.error('Error creating collection:', error);
      return;
    }

    if (data) {
      setCollections([...collections, data]);
      setNewCollectionName('');
      setIsCreating(false);
      router.refresh(); // Refresh server data
    }
  };

  return (
    <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 h-screen sticky top-0 hidden md:flex flex-col bg-white dark:bg-black">
      
      {/* Logo - Top Corner */}
      <Link href="/dashboard" className="flex items-center gap-2 px-4 pt-4 pb-6 hover:opacity-80 transition-opacity border-b border-zinc-200 dark:border-zinc-800">
        <Image 
          src="/logo.svg" 
          alt="Wist Logo" 
          width={40} 
          height={40}
          className="w-10 h-10"
        />
        <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-white">wist.</span>
      </Link>
      
      {/* Main Navigation */}
      <div className="space-y-1 mb-8 px-4 pt-4">
        <Link 
          href="/dashboard" 
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === '/dashboard' 
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' 
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Grid size={18} />
          All Items
        </Link>
        <Link 
          href="/dashboard/purchased" 
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === '/dashboard/purchased'
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Gift size={18} />
          Purchased
        </Link>
      </div>

      {/* Collections Header */}
      <div className="flex items-center justify-between mb-2 px-4">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Collections</h3>
        <button 
          onClick={() => setIsCreating(true)}
          className="text-zinc-400 hover:text-blue-500 transition-colors p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
          aria-label="Create new collection"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Inline Create Form */}
      {isCreating && (
        <form onSubmit={handleCreate} className="mb-2 px-4">
          <input 
            autoFocus
            type="text" 
            placeholder="List Name..." 
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onBlur={() => {
              if (!newCollectionName.trim()) {
                setIsCreating(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsCreating(false);
                setNewCollectionName('');
              }
            }}
          />
        </form>
      )}

      {/* Collections List */}
      <div className="space-y-1 overflow-y-auto flex-1 px-4 pb-4">
        {collections.length === 0 && !isCreating && (
          <p className="text-xs text-zinc-400 px-3 py-2">No collections yet</p>
        )}
        {collections.map((col) => (
          <Link 
            key={col.id} 
            href={`/dashboard/collection/${col.slug}`}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname?.includes(col.slug) 
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' 
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Folder size={18} />
            <span className="truncate">{col.name}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}

