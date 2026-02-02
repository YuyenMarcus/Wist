'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { 
  Folder, Plus, Grid, Gift, Settings, Trash2, Layers, LayoutGrid, 
  Heart, Home, ShoppingBag, Star, Bookmark, Tag, Box, Package, 
  Sparkles, Zap, Coffee, Music, Gamepad2, Shirt, Car, Plane, 
  Camera, Palette, Dumbbell, BookOpen, Laptop, Phone, Watch, 
  Headphones, Utensils, Bed, Sofa, TreePine  // ← Added new icons
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

interface Collection {
  id: string;
  name: string;
  slug: string;
  user_id: string;
  created_at?: string;
  icon?: string | null;
  color?: string | null;
}

// Color palette for collection icons
const COLOR_PALETTE = [
  { name: 'Violet', value: '#8b5cf6', class: 'text-violet-600 dark:text-violet-400' },
  { name: 'Red', value: '#ef4444', class: 'text-red-600 dark:text-red-400' },
  { name: 'Blue', value: '#3b82f6', class: 'text-blue-600 dark:text-blue-400' },
  { name: 'Green', value: '#10b981', class: 'text-green-600 dark:text-green-400' },
  { name: 'Yellow', value: '#eab308', class: 'text-yellow-600 dark:text-yellow-400' },
  { name: 'Orange', value: '#f97316', class: 'text-orange-600 dark:text-orange-400' },
  { name: 'Pink', value: '#ec4899', class: 'text-pink-600 dark:text-pink-400' },
] as const;

// Available icons for collections
const AVAILABLE_ICONS = [
  { name: 'Folder', icon: Folder },
  { name: 'Gift', icon: Gift },
  { name: 'Heart', icon: Heart },
  { name: 'Home', icon: Home },
  { name: 'ShoppingBag', icon: ShoppingBag },
  { name: 'Star', icon: Star },
  { name: 'Bookmark', icon: Bookmark },
  { name: 'Tag', icon: Tag },
  { name: 'Box', icon: Box },
  { name: 'Package', icon: Package },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Zap', icon: Zap },
  { name: 'Coffee', icon: Coffee },
  { name: 'Music', icon: Music },
  { name: 'Gamepad2', icon: Gamepad2 },
  { name: 'Shirt', icon: Shirt },
  { name: 'Car', icon: Car },
  { name: 'Plane', icon: Plane },
  { name: 'Camera', icon: Camera },
  { name: 'Palette', icon: Palette },
  { name: 'Dumbbell', icon: Dumbbell },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'Laptop', icon: Laptop },
  { name: 'Phone', icon: Phone },
  { name: 'Watch', icon: Watch },
  { name: 'Headphones', icon: Headphones },
  { name: 'Utensils', icon: Utensils },      // ← Knife
  { name: 'Bed', icon: Bed },                // ← Bed
  { name: 'Sofa', icon: Sofa },              // ← Couch
  { name: 'TreePine', icon: TreePine },      // ← Christmas Tree
] as const;

// Helper function to get icon component by name
function getIconComponent(iconName: string | null | undefined) {
  const iconEntry = AVAILABLE_ICONS.find(i => i.name === iconName);
  return iconEntry ? iconEntry.icon : Folder;
}

// Collection Item Component (without drag and drop)
function CollectionItem({
  collection,
  pathname,
  isManaging,
  onDelete,
  onIconChange,
}: {
  collection: Collection;
  pathname: string | null;
  isManaging: boolean;
  onDelete: (id: string) => void;
  onIconChange?: (id: string, iconName: string) => void;
}) {
  const IconComponent = getIconComponent(collection.icon);
  const colorClass = COLOR_PALETTE.find(c => c.name === collection.color)?.class || 'text-violet-600 dark:text-violet-400';
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const [iconPickerPosition, setIconPickerPosition] = useState({ top: 0, left: 0 });

  // Close icon picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node)) {
        setShowIconPicker(false);
      }
    }

    if (showIconPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showIconPicker]);

  return (
    <div className="group/item flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors relative" ref={iconPickerRef}>
      <div
        className={`flex-1 flex items-center gap-3 text-sm font-medium truncate ${
          pathname?.includes(collection.slug)
            ? 'text-violet-600 dark:text-violet-400'
            : 'text-zinc-500'
        }`}
      >
        {isManaging ? (
          <button
            ref={iconButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (iconButtonRef.current) {
                const rect = iconButtonRef.current.getBoundingClientRect();
                setIconPickerPosition({
                  top: rect.bottom + 4,
                  left: rect.left
                });
              }
              setShowIconPicker(!showIconPicker);
            }}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
            title="Change icon"
          >
            <IconComponent size={18} className={colorClass} />
          </button>
        ) : (
          <IconComponent size={18} className={colorClass} />
        )}
        <span className="truncate">{collection.name}</span>
      </div>

      {/* Icon Picker Popup - Using fixed positioning to avoid overflow */}
      {showIconPicker && isManaging && (
        <>
          {/* Backdrop to close popup */}
          <div 
            className="fixed inset-0 z-[9998]"
            onClick={(e) => {
              e.stopPropagation();
              setShowIconPicker(false);
            }}
          />
          <div 
            className="fixed z-[9999] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl p-2 w-64 max-h-64 overflow-y-auto"
            style={{
              top: `${iconPickerPosition.top}px`,
              left: `${iconPickerPosition.left}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
          <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 px-2 py-1 mb-1">Choose Icon</div>
          <div className="grid grid-cols-6 gap-1">
            {AVAILABLE_ICONS.map(({ name, icon: Icon }) => {
              const isSelected = collection.icon === name || (!collection.icon && name === 'Folder');
              return (
                <button
                  key={name}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (onIconChange) {
                      onIconChange(collection.id, name);
                    }
                    setShowIconPicker(false);
                  }}
                  className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                    isSelected ? 'bg-violet-100 dark:bg-violet-900/20 ring-1 ring-violet-500' : ''
                  }`}
                  title={name}
                >
                  <Icon size={16} className={isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-zinc-500'} />
                </button>
              );
            })}
          </div>
          </div>
        </>
      )}

      {/* DELETE BUTTON (Visible in Manage Mode) */}
      {isManaging && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete(collection.id);
          }}
          className="text-zinc-400 hover:text-red-500 p-1 rounded transition-colors"
          aria-label={`Delete ${collection.name}`}
          title={`Delete ${collection.name}`}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
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
  const [newCollectionIcon, setNewCollectionIcon] = useState('Folder');
  const [newCollectionColor, setNewCollectionColor] = useState('Violet');
  const [showCreateIconPicker, setShowCreateIconPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const createIconPickerRef = useRef<HTMLDivElement>(null);
  const createIconButtonRef = useRef<HTMLButtonElement>(null);
  const [createIconPickerPosition, setCreateIconPickerPosition] = useState({ top: 0, left: 0 });

  // Determine view mode from URL parameter
  const viewMode = searchParams?.get('view') === 'grouped' ? 'grouped' : 'timeline';

  // Close create icon picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (createIconPickerRef.current && !createIconPickerRef.current.contains(event.target as Node)) {
        setShowCreateIconPicker(false);
      }
    }

    if (showCreateIconPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCreateIconPicker]);

  // NEW: Fetch collections directly on mount to ensure we have the latest data
  // This bypasses any "stale" data coming from the Server Layout
  useEffect(() => {
    const fetchCollections = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data, error } = await supabase
          .from('collections')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        
        if (error) {
          console.error('Error fetching collections:', error);
        }
        
        if (data) {
          // Sort by created_at (newest first)
          const sorted = data.sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA;
          });
          setCollections(sorted);
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
      .insert({ 
        name: newCollectionName.trim(), 
        slug, 
        user_id: user.id,
        icon: newCollectionIcon,
        color: newCollectionColor
      })
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
      setNewCollectionIcon('Folder');
      setNewCollectionColor('Violet');
      setShowCreateIconPicker(false);
      setIsCreating(false);
      router.refresh(); // Refresh server data
    }
    setLoading(false);
  };

  const handleCancel = () => {
    setNewCollectionName('');
    setNewCollectionIcon('Folder');
    setNewCollectionColor('Violet');
    setShowCreateIconPicker(false);
    setIsCreating(false);
  };

  // Update collection icon
  const handleIconChange = async (collectionId: string, iconName: string) => {
    const { error } = await supabase
      .from('collections')
      .update({ icon: iconName })
      .eq('id', collectionId);

    if (error) {
      console.error('Error updating icon:', error);
      alert('Failed to update icon: ' + error.message);
      return;
    }

    // Update local state
    setCollections((prev) =>
      prev.map((col) => (col.id === collectionId ? { ...col, icon: iconName } : col))
    );
    router.refresh();
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
    <aside className="w-64 border-r border-zinc-200 h-screen sticky top-0 hidden md:flex flex-col bg-white">
      
      {/* Logo - Top Corner */}
      <Link href="/dashboard" className="flex items-center gap-2 px-4 pt-4 pb-6 hover:opacity-80 transition-opacity border-b border-zinc-200">
        <div className="relative flex items-center">
          <Image 
            src="/logo.svg" 
            alt="Wist Logo" 
            width={40} 
            height={40}
            className="w-10 h-10"
          />
          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600 bg-violet-50 rounded-full border border-violet-200">
            BETA
          </span>
        </div>
      </Link>
      
      {/* View Switcher (Timeline / Categories) */}
      <div className="px-4 pt-4 mb-6">
        <div className="flex p-1 bg-white border border-zinc-200 rounded-lg shadow-sm">
          <Link 
            href="/dashboard" 
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'timeline' 
                ? 'bg-violet-50 text-violet-600 shadow-sm' 
                : 'text-zinc-500 hover:text-violet-600'
            }`}
          >
            <LayoutGrid size={16} />
            Timeline
          </Link>
          <Link 
            href="/dashboard?view=grouped" 
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'grouped' 
                ? 'bg-violet-50 text-violet-600 shadow-sm' 
                : 'text-zinc-500 hover:text-violet-600'
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
          <form onSubmit={handleCreate} className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm">
            
            {/* Icon and Color Picker Row */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {/* Icon Picker */}
              <div className="relative flex-shrink-0" ref={createIconPickerRef}>
                <button
                  ref={createIconButtonRef}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (createIconButtonRef.current) {
                      const rect = createIconButtonRef.current.getBoundingClientRect();
                      setCreateIconPickerPosition({
                        top: rect.bottom + 4,
                        left: rect.left
                      });
                    }
                    setShowCreateIconPicker(!showCreateIconPicker);
                  }}
                  className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
                  title="Choose icon"
                >
                  {(() => {
                    const IconComponent = getIconComponent(newCollectionIcon);
                    const colorClass = COLOR_PALETTE.find(c => c.name === newCollectionColor)?.class || 'text-violet-600 dark:text-violet-400';
                    return <IconComponent size={18} className={colorClass} />;
                  })()}
                </button>

                {/* Icon Picker Popup for Creation - Using fixed positioning to avoid overflow */}
                {showCreateIconPicker && (
                  <>
                    {/* Backdrop to close popup */}
                    <div 
                      className="fixed inset-0 z-[9998]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCreateIconPicker(false);
                      }}
                    />
                    <div 
                      className="fixed z-[9999] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl p-2 w-64 max-h-64 overflow-y-auto"
                      style={{
                        top: `${createIconPickerPosition.top}px`,
                        left: `${createIconPickerPosition.left}px`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                    <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 px-2 py-1 mb-1">Choose Icon</div>
                    <div className="grid grid-cols-6 gap-1">
                      {AVAILABLE_ICONS.map(({ name, icon: Icon }) => {
                        const isSelected = newCollectionIcon === name || (!newCollectionIcon && name === 'Folder');
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setNewCollectionIcon(name);
                              setShowCreateIconPicker(false);
                            }}
                            className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                              isSelected ? 'bg-violet-100 dark:bg-violet-900/20 ring-1 ring-violet-500' : ''
                            }`}
                            title={name}
                          >
                            <Icon size={16} className={isSelected ? 'text-violet-600 dark:text-violet-400' : 'text-zinc-500'} />
                          </button>
                        );
                      })}
                    </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* Color Palette */}
              <div className="flex gap-1 flex-wrap flex-1 min-w-0">
                {COLOR_PALETTE.map(color => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setNewCollectionColor(color.name);
                    }}
                    className={`w-5 h-5 rounded-full transition-all flex-shrink-0 ${
                      newCollectionColor === color.name 
                        ? 'ring-2 ring-zinc-400 dark:ring-zinc-600 ring-inset scale-110' 
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            
            {/* Name Input */}
            <input 
              autoFocus
              type="text" 
              placeholder="List Name..."
              className="w-full bg-transparent text-sm focus:outline-none text-zinc-900 dark:text-white px-2 py-2 mb-3 border-b border-zinc-200 dark:border-zinc-800"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancel();
                }
              }}
              disabled={loading}
            />
            
            {/* Action Buttons */}
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
          <CollectionItem
            key={col.id}
            collection={col}
            pathname={pathname}
            isManaging={isManaging}
            onDelete={handleDelete}
            onIconChange={handleIconChange}
          />
        ))}
      </div>
    </aside>
  );
}

