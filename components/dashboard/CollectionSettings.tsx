'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, Trash2, Edit2, Check, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  collectionId: string;
  collectionName: string;
}

export default function CollectionSettings({ collectionId, collectionName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newName, setNewName] = useState(collectionName);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  // Reset state when collection name changes
  useEffect(() => {
    setNewName(collectionName);
  }, [collectionName]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
        setIsDeleting(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newName === collectionName) {
      setIsEditing(false);
      return;
    }
    
    setLoading(true);
    
    // Create new slug from name
    const newSlug = newName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');

    const { error } = await supabase
      .from('collections')
      .update({ name: newName.trim(), slug: newSlug })
      .eq('id', collectionId);

    if (!error) {
      setIsEditing(false);
      setIsOpen(false);
      // Redirect to new slug URL
      router.push(`/dashboard/collection/${newSlug}`);
      router.refresh();
    } else {
      console.error('Error renaming collection:', error);
      alert('Failed to rename collection: ' + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);

    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId);

    if (!error) {
      router.push('/dashboard'); // Go back to main dashboard
      router.refresh();
    } else {
      console.error('Error deleting collection:', error);
      alert('Failed to delete collection: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="relative z-20" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-beige-100 dark:bg-dpurple-900 border border-zinc-200 dark:border-dpurple-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-dpurple-800 transition-colors text-zinc-500 dark:text-zinc-400"
        aria-label="Collection settings"
      >
        <Settings size={18} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 bg-beige-50 dark:bg-dpurple-900 rounded-xl shadow-xl border border-zinc-200 dark:border-dpurple-700 p-2 overflow-hidden z-30"
          >
            {/* RENAME MODE */}
            {isEditing ? (
              <form onSubmit={handleRename} className="p-2">
                <label className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1 block">
                  Rename List
                </label>
                <div className="flex gap-2">
                  <input 
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setIsEditing(false);
                        setNewName(collectionName);
                      }
                    }}
                    className="flex-1 bg-zinc-50 dark:bg-dpurple-800 border border-zinc-200 dark:border-dpurple-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white"
                    disabled={loading}
                  />
                  <button 
                    type="submit" 
                    disabled={loading || !newName.trim() || newName === collectionName} 
                    className="p-1 bg-violet-500 text-white rounded hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Check size={16} />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsEditing(false);
                      setNewName(collectionName);
                    }}
                    disabled={loading}
                    className="p-1 bg-zinc-100 dark:bg-dpurple-800 text-zinc-500 dark:text-zinc-400 rounded hover:bg-zinc-200 dark:hover:bg-dpurple-700 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </form>
            ) : isDeleting ? (
              /* DELETE CONFIRMATION MODE */
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                  <AlertTriangle size={16} />
                  <span className="text-sm font-bold">Delete Collection?</span>
                </div>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mb-3 leading-relaxed">
                  Items inside will NOT be deleted. They will move to "Uncategorized".
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={handleDelete} 
                    disabled={loading}
                    className="flex-1 py-1.5 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button 
                    onClick={() => setIsDeleting(false)} 
                    disabled={loading}
                    className="flex-1 py-1.5 bg-beige-50 dark:bg-dpurple-900 border border-zinc-200 dark:border-dpurple-600 text-zinc-600 dark:text-zinc-300 text-xs font-bold rounded hover:bg-zinc-50 dark:hover:bg-dpurple-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* DEFAULT MENU */
              <div className="space-y-1">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-dpurple-800 rounded-lg transition-colors text-left"
                >
                  <Edit2 size={16} />
                  Rename
                </button>
                <button 
                  onClick={() => setIsDeleting(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left"
                >
                  <Trash2 size={16} />
                  Delete Collection
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

