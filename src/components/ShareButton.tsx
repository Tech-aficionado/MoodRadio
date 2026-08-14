'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { MoodEntry } from '@/types';

interface ShareButtonProps {
  entry: MoodEntry;
}

export default function ShareButton({ entry }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    setLoading(true);

    try {
      // Generate a public ID if not already present
      let publicId = entry.public_id;

      if (!publicId) {
        publicId = crypto.randomUUID().slice(0, 8);
        if (supabase) {
          await supabase
            .from('mood_entries')
            .update({ public_id: publicId })
            .eq('id', entry.id);
        }
      }

      const shareUrl = `${window.location.origin}/share/${publicId}`;

      // Try native share on mobile
      if (navigator.share) {
        await navigator.share({
          title: `I'm feeling ${entry.emotion} — MoodRadio`,
          text: entry.input_text,
          url: shareUrl,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (error) {
      // User cancelled share or copy failed
      console.error('Share failed:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.button
      onClick={handleShare}
      disabled={loading}
      className="relative inline-flex items-center gap-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.span
            key="copied"
            className="flex items-center gap-2 text-green-400"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
          >
            <Check className="w-4 h-4" />
            Link copied!
          </motion.span>
        ) : (
          <motion.span
            key="share"
            className="flex items-center gap-2"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
          >
            <Share2 className="w-4 h-4" />
            Share
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
