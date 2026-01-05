'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase/client';

interface Props {
  collectionId: string;
  collectionSlug: string;
  initialIsPublic?: boolean;
}

export default function CollectionShareButton({ collectionId, collectionSlug, initialIsPublic = false }: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleShare = async () => {
    try {
      // For now, just copy the collection URL to clipboard
      // In the future, this can toggle is_public and generate share_token
      const shareUrl = `${window.location.origin}/dashboard/collection/${collectionSlug}`;
      
      await navigator.clipboard.writeText(shareUrl);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      alert('Failed to copy link. Please try again.');
    }
  };

  return (
    <>
      <button
        onClick={handleShare}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-violet-600 dark:bg-violet-700 text-white rounded-lg text-sm font-medium hover:bg-violet-700 dark:hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Share2 size={16} />
        Share List
      </button>

      {/* Success Toast */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium shadow-lg z-50"
          >
            Link copied to clipboard!
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

