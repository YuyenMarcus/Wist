'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings, Trash2, Edit2, Check, X, AlertTriangle, ImagePlus, Gift, Loader2, Users, Link2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

/** Flip to true to show “Make collaborative” in collection settings again */
const SHOW_COLLABORATIVE_SETTINGS = false;

interface Props {
  collectionId: string;
  collectionName: string;
  backgroundImageUrl?: string | null;
  registryMode?: boolean;
  collaborativeEnabled?: boolean;
  collaborationInviteCode?: string | null;
}

export default function CollectionSettings({
  collectionId,
  collectionName,
  backgroundImageUrl,
  registryMode,
  collaborativeEnabled,
  collaborationInviteCode,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newName, setNewName] = useState(collectionName);
  const [loading, setLoading] = useState(false);
  const [bgImage, setBgImage] = useState(backgroundImageUrl ?? null);
  const [isRegistry, setIsRegistry] = useState(registryMode ?? false);
  const [isCollab, setIsCollab] = useState(collaborativeEnabled ?? false);
  const [collabCode, setCollabCode] = useState(collaborationInviteCode ?? null);
  const [collabBusy, setCollabBusy] = useState(false);
  const [collabCopied, setCollabCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNewName(collectionName);
  }, [collectionName]);

  useEffect(() => {
    setBgImage(backgroundImageUrl ?? null);
  }, [backgroundImageUrl]);

  useEffect(() => {
    setIsRegistry(registryMode ?? false);
  }, [registryMode]);

  useEffect(() => {
    setIsCollab(collaborativeEnabled ?? false);
  }, [collaborativeEnabled]);

  useEffect(() => {
    setCollabCode(collaborationInviteCode ?? null);
  }, [collaborationInviteCode]);

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
      router.push('/dashboard');
      router.refresh();
    } else {
      console.error('Error deleting collection:', error);
      alert('Failed to delete collection: ' + error.message);
      setLoading(false);
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Image must be under 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${user.id}/collection-bg-${collectionId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('collections')
        .update({ background_image_url: publicUrl })
        .eq('id', collectionId);

      if (updateError) throw updateError;

      setBgImage(publicUrl);
      router.refresh();
    } catch (err: any) {
      console.error('Background upload error:', err);
      alert(err.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveBg = async () => {
    setUploading(true);
    try {
      const { error } = await supabase
        .from('collections')
        .update({ background_image_url: null })
        .eq('id', collectionId);
      if (error) throw error;
      setBgImage(null);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to remove image.');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleRegistry = async () => {
    const newValue = !isRegistry;
    setIsRegistry(newValue);
    const { error } = await supabase
      .from('collections')
      .update({ registry_mode: newValue })
      .eq('id', collectionId);
    if (error) {
      setIsRegistry(!newValue);
      alert('Failed to update registry mode.');
    } else {
      router.refresh();
    }
  };

  const patchCollaborative = async (next: boolean) => {
    setCollabBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/collections', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ id: collectionId, collaborative_enabled: next }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof payload.error === 'string' ? payload.error : 'Could not update collaboration.');
        return;
      }
      setIsCollab(!!payload.collection?.collaborative_enabled);
      setCollabCode(payload.collection?.collaboration_invite_code ?? null);
      router.refresh();
    } catch {
      alert('Could not update collaboration.');
    } finally {
      setCollabBusy(false);
    }
  };

  const handleToggleCollaborative = async () => {
    const next = !isCollab;
    if (
      !next &&
      !confirm(
        'Turn off collaboration? The join button will disappear from your public page, invite links will stop working, and all collaborators will be removed from this list.'
      )
    ) {
      return;
    }
    await patchCollaborative(next);
  };

  const handleCopyCollabLink = async () => {
    if (!collabCode) return;
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${collabCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCollabCopied(true);
      setTimeout(() => setCollabCopied(false), 2000);
    } catch {
      alert(url);
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
                  {`Items inside will NOT be deleted. They will move to "No collection".`}
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

                {/* Background Image */}
                <div className="px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Background Image</span>
                    {bgImage && (
                      <button
                        onClick={handleRemoveBg}
                        disabled={uploading}
                        className="text-xs text-red-500 hover:text-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {bgImage ? (
                    <div className="relative rounded-lg overflow-hidden h-20 group">
                      <img src={bgImage} alt="" className="w-full h-full object-cover" />
                      <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <span className="text-white text-xs font-medium">Change</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleBgUpload}
                          disabled={uploading}
                          className="hidden"
                        />
                      </label>
                      {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <label className={`flex items-center justify-center gap-2 h-20 rounded-lg border-2 border-dashed border-zinc-200 dark:border-dpurple-600 cursor-pointer hover:border-violet-400 dark:hover:border-violet-600 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      {uploading ? (
                        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                      ) : (
                        <>
                          <ImagePlus size={16} className="text-zinc-400" />
                          <span className="text-xs text-zinc-400">Add background image</span>
                        </>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleBgUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {SHOW_COLLABORATIVE_SETTINGS && (
                  <div className="px-3 py-2 space-y-2">
                    <button
                      type="button"
                      disabled={collabBusy}
                      onClick={handleToggleCollaborative}
                      className="w-full flex items-center justify-between px-0 py-1 text-sm text-zinc-600 dark:text-zinc-300 hover:opacity-90 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <span className="flex items-center gap-3 text-left">
                        <Users size={16} className="shrink-0" />
                        <span>
                          <span className="block font-medium">Make collaborative</span>
                          <span className="block text-[11px] text-zinc-400 dark:text-zinc-500 font-normal leading-snug mt-0.5">
                            Shows a Join button on your shared collection page. Off by default.
                          </span>
                        </span>
                      </span>
                      <div className={`w-8 h-[18px] rounded-full transition-colors relative shrink-0 ${isCollab ? 'bg-violet-500' : 'bg-zinc-300 dark:bg-dpurple-600'}`}>
                        <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${isCollab ? 'translate-x-[16px]' : 'translate-x-[2px]'}`} />
                      </div>
                    </button>
                    {isCollab && collabCode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyCollabLink();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-dpurple-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-dpurple-700 transition-colors"
                      >
                        <Link2 size={14} />
                        {collabCopied ? 'Copied!' : 'Copy collaboration join link'}
                      </button>
                    )}
                  </div>
                )}

                {/* Registry Mode Toggle */}
                <button
                  type="button"
                  onClick={handleToggleRegistry}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-dpurple-800 rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Gift size={16} />
                    Gift Registry
                  </span>
                  <div className={`w-8 h-[18px] rounded-full transition-colors relative ${isRegistry ? 'bg-violet-500' : 'bg-zinc-300 dark:bg-dpurple-600'}`}>
                    <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${isRegistry ? 'translate-x-[16px]' : 'translate-x-[2px]'}`} />
                  </div>
                </button>

                <div className="my-1 border-t border-zinc-100 dark:border-dpurple-700" />

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

