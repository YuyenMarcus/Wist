'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Folder, Plus, Grid, Gift, Settings, Trash2, Layers, LayoutGrid } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

interface Collection {
  id: string;
  name: string;
  slug: string;
  user_id: string;
  created_at?: string;
}

export default function Sidebar({ initialCollections = [] }: { initialCollections?: Collection[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Initialize with empty array if prop is missing, preventing crashes
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [isCreating, setIsCreating] = useState(false);
  const [isManaging, setIsManaging] = useState(false); // New Manager Mode
  const [newCollectionName, setNewCollectionName] = useState('');
  const [loading, setLoading] = useState(false);

  // Determine view mode from URL parameter
  const viewMode = searchParams?.get('view') === 'grouped' ? 'grouped' : 'timeline';

  // NEW: Fetch collections directly on mount to ensure we have the latest data
  // This bypasses any "stale" data coming from the Server Layout
  useEffect(() => {
    const fetchCollections = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data } = await supabase
          .from('collections')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        
        if (data) {
          setCollections(data);
        }
      }
    };
    
    fetchCollections();
  }, []); // Runs once when component mounts

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim() || loading) return;

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    
    // Create a simple URL-friendly slug (e.g., "Living Room" -> "living-room")
    const slug = newCollectionName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');

    const { data, error } = await supabase
      .from('collections')
      .insert({ name: newCollectionName.trim(), slug, user_id: user.id })
      .select()
      .single();

    if (error) {
      console.error('Error creating collection:', error);
      alert('Failed to create collection: ' + error.message);
      setLoading(false);
      return;
    }

    if (data) {
      setCollections((prev) => [...prev, data]); // Add to local state immediately
      setNewCollectionName('');
      setIsCreating(false);
      router.refresh(); // Refresh server data
    }
    setLoading(false);
  };

  const handleCancel = () => {
    setNewCollectionName('');
    setIsCreating(false);
  };

  // Delete Collection (Directly from Sidebar)
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this collection? Items will move to 'Uncategorized'.")) return;
    
    const { error } = await supabase.from('collections').delete().eq('id', id);

    if (!error) {
      const deletedCollection = collections.find(c => c.id === id);
      setCollections(collections.filter(c => c.id !== id));
      router.refresh();
      // If we're on the deleted collection's page, redirect to dashboard
      if (pathname?.includes(deletedCollection?.slug || '')) {
        router.push('/dashboard');
      }
    } else {
      alert("Error deleting collection: " + error.message);
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
      
      {/* View Switcher (Timeline / Categories) */}
      <div className="px-4 pt-4 mb-6">
        <div className="flex p-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
          <Link 
            href="/dashboard" 
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'timeline' 
                ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 shadow-sm' 
                : 'text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400'
            }`}
          >
            <LayoutGrid size={16} />
            Timeline
          </Link>
          <Link 
            href="/dashboard?view=grouped" 
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'grouped' 
                ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 shadow-sm' 
                : 'text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400'
            }`}
          >
            <Layers size={16} />
            Categories
          </Link>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="space-y-1 mb-8 px-4">
        <Link 
          href="/dashboard/purchased" 
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === '/dashboard/purchased'
              ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400'
              : 'text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400'
          }`}
        >
          <Gift size={18} />
          Purchased
        </Link>
      </div>

      {/* Collections Header with Manage Button */}
      <div className="flex items-center justify-between mb-2 px-4 group">
        <h3 className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Collections</h3>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Manage/Delete Button */}
          <button 
            onClick={() => setIsManaging(!isManaging)}
            className={`p-1 rounded transition-all ${isManaging ? 'bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' : 'text-zinc-400 hover:text-violet-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            title="Manage Lists"
            aria-label="Manage collections"
          >
            <Settings size={14} />
          </button>
          {/* Add Button */}
          <button 
            onClick={() => setIsCreating(true)}
            className="p-1 text-zinc-400 hover:text-violet-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-all"
            aria-label="Create new collection"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Inline Create Form with Buttons */}
      {isCreating && (
        <div className="mb-3 px-4">
          <form onSubmit={handleCreate} className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-2 shadow-sm">
            <input 
              autoFocus
              type="text" 
              placeholder="List Name..." 
              className="w-full bg-transparent text-sm focus:outline-none text-zinc-900 dark:text-white mb-2 px-1 py-1"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancel();
                }
              }}
              disabled={loading}
            />
            <div className="flex gap-2">
              <button 
                type="submit" 
                disabled={loading || !newCollectionName.trim()}
                className="flex-1 bg-violet-600 text-white text-xs py-1.5 px-2 rounded font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add'}
              </button>
              <button 
                type="button" 
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs py-1.5 px-2 rounded font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Collections List */}
      <div className="space-y-1 overflow-y-auto flex-1 px-4 pb-4">
        {collections.length === 0 && !isCreating && (
          <p className="text-xs text-zinc-400 px-3 py-2">No collections yet</p>
        )}
        {collections.map((col) => (
          <div 
            key={col.id} 
            className="group/item flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            <Link 
              href={`/dashboard/collection/${col.slug}`}
              className={`flex-1 flex items-center gap-3 text-sm font-medium truncate transition-colors ${
                pathname?.includes(col.slug) 
                  ? 'text-violet-600 dark:text-violet-400' 
                  : 'text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400'
              }`}
            >
              <Folder size={18} />
              <span className="truncate">{col.name}</span>
            </Link>
            
            {/* DELETE BUTTON (Visible in Manage Mode) */}
            {isManaging && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(col.id);
                }}
                className="text-zinc-400 hover:text-red-500 p-1 rounded transition-colors"
                aria-label={`Delete ${col.name}`}
                title={`Delete ${col.name}`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

