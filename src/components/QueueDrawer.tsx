'use client';

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, X, SkipForward, ListMusic } from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';

export const QueueDrawer = memo(function QueueDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const { queue, currentTrack, play, next } = usePlayer();

  const currentIndex = queue.findIndex(t => t.videoId === currentTrack?.videoId);
  const upcoming = queue.slice(currentIndex + 1);

  if (upcoming.length === 0) return null;

  return (
    <>
      {/* Control row above player */}
      <div className="fixed bottom-[90px] left-6 right-6 z-30 flex items-center justify-between">
        <motion.button
          onClick={next}
          className="brutal-btn-ghost text-[10px] tracking-[0.15em] py-2 px-4 flex items-center gap-2"
          whileTap={{ scale: 0.95 }}
        >
          <SkipForward size={10} />
          SKIP
        </motion.button>

        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="brutal-btn-ghost text-[10px] tracking-[0.15em] py-2 px-4 flex items-center gap-2"
          whileTap={{ scale: 0.95 }}
        >
          <ListMusic size={10} />
          {upcoming.length} NEXT
          <ChevronUp
            size={10}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </motion.button>
      </div>

      {/* Queue panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              className="fixed bottom-[120px] right-6 left-6 sm:left-auto sm:w-80 z-50 max-h-[45vh] overflow-hidden bg-[#1A1A1A] border border-[#333]"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#333]">
                <span className="text-[10px] font-bold text-[#666] uppercase tracking-[0.2em]">
                  UP NEXT — {upcoming.length} TRACKS
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-6 h-6 flex items-center justify-center text-[#555] hover:text-white transition-colors"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Track list */}
              <div className="overflow-y-auto max-h-[calc(45vh-44px)]">
                {upcoming.slice(0, 10).map((track, i) => (
                  <motion.button
                    key={track.videoId}
                    onClick={() => { play(track); setIsOpen(false); }}
                    className="flex items-center gap-4 w-full px-5 py-3 hover:bg-[#222] transition-colors text-left border-b border-[#2a2a2a] last:border-b-0 group"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileTap={{ scale: 0.98, backgroundColor: '#2a2a2a' }}
                  >
                    {/* Index */}
                    <span className="text-[10px] text-[#555] font-mono w-4 text-right">
                      {String(i + 1).padStart(2, '0')}
                    </span>

                    {/* Thumbnail */}
                    <div className="w-9 h-9 overflow-hidden flex-shrink-0 border border-[#333]">
                      <img
                        src={track.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-[#999] truncate group-hover:text-white transition-colors font-medium">
                        {track.title}
                      </p>
                      <p className="text-[10px] text-[#555] truncate uppercase tracking-wide mt-0.5">
                        {track.artist}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});
