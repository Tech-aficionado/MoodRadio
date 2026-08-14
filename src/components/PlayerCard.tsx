'use client';

import { memo, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, Heart,
  ChevronUp, ChevronDown, Share2, Repeat, Shuffle, Volume2
} from 'lucide-react';
import { usePlayer } from '@/context/PlayerContext';
import { useMood } from '@/context/MoodContext';
import { MarqueeText } from '@/components/KineticText';

export const PlayerCard = memo(function PlayerCard() {
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    resume,
    pause,
    next,
    previous,
    like,
  } = usePlayer();
  const { mood } = useMood();
  const [liked, setLiked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const moodColor = mood ? `var(--color-mood-${mood.primary_emotion})` : '#666';

  const handleLike = () => {
    setLiked(!liked);
    like();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Swipe to skip
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100) {
      if (info.offset.x > 0) previous();
      else next();
    }
  };

  // Progress scrubbing
  const handleScrubStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsScrubbing(true);
    updateScrubPosition(e);
  };

  const handleScrubMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isScrubbing) return;
    updateScrubPosition(e);
  };

  const handleScrubEnd = () => {
    setIsScrubbing(false);
    // In a full implementation, this would seek the player
  };

  const updateScrubPosition = (e: React.MouseEvent | React.TouchEvent) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setScrubPosition(percent);
  };

  const displayProgress = isScrubbing ? scrubPosition : progressPercent;

  // === MINI PLAYER ===
  if (!expanded) {
    return (
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-30 pb-[max(0px,env(safe-area-inset-bottom))]"
        initial={{ y: 120 }}
        animate={{ y: 0 }}
        exit={{ y: 120 }}
        transition={{ type: 'spring', stiffness: 250, damping: 28 }}
      >
        {/* Mood accent */}
        <div className="h-[3px] w-full" style={{ backgroundColor: moodColor }} />

        <div className="bg-[#1A1A1A] border-t border-[#333]">
          {/* Progress */}
          <div className="h-[2px] bg-[#222] w-full">
            <motion.div
              className="h-full bg-white/60"
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 2, ease: 'linear' }}
            />
          </div>

          {/* Content — draggable for swipe-to-skip */}
          <motion.div
            className="flex items-center gap-4 px-6 py-4 cursor-grab active:cursor-grabbing"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragEnd={handleDragEnd}
          >
            {/* Album art — tap to expand */}
            <motion.button
              className="w-14 h-14 overflow-hidden flex-shrink-0 border border-[#333] relative"
              onClick={() => setExpanded(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center">
                <ChevronUp size={16} className="text-white opacity-0 group-hover:opacity-100" />
              </div>
            </motion.button>

            {/* Track info */}
            <div className="flex-1 min-w-0" onClick={() => setExpanded(true)}>
              <motion.p
                className="text-sm font-semibold text-white truncate leading-tight tracking-tight"
                key={currentTrack.videoId}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {currentTrack.title}
              </motion.p>
              <p className="text-xs text-[#666] truncate mt-1 tracking-wide uppercase">
                {currentTrack.artist}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <motion.button
                onClick={previous}
                className="w-9 h-9 flex items-center justify-center text-[#666] hover:text-white transition-colors"
                whileTap={{ scale: 0.8, rotate: -15 }}
              >
                <SkipBack size={14} fill="currentColor" />
              </motion.button>

              <motion.button
                onClick={isPlaying ? pause : resume}
                className="w-12 h-12 flex items-center justify-center bg-white text-[#1A1A1A]"
                whileTap={{ scale: 0.85 }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isPlaying ? 'pause' : 'play'}
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }}
                    transition={{ duration: 0.15 }}
                  >
                    {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                  </motion.div>
                </AnimatePresence>
              </motion.button>

              <motion.button
                onClick={next}
                className="w-9 h-9 flex items-center justify-center text-[#666] hover:text-white transition-colors"
                whileTap={{ scale: 0.8, rotate: 15 }}
              >
                <SkipForward size={14} fill="currentColor" />
              </motion.button>

              <motion.button
                onClick={handleLike}
                className={`w-9 h-9 flex items-center justify-center ml-2 transition-colors ${
                  liked ? 'text-white' : 'text-[#444] hover:text-[#888]'
                }`}
                whileTap={{ scale: 1.4 }}
                animate={liked ? { scale: [1, 1.3, 1] } : {}}
              >
                <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // === EXPANDED PLAYER ===
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-[#1A1A1A] flex flex-col"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 200, damping: 28 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <motion.button
          onClick={() => setExpanded(false)}
          className="w-10 h-10 border border-[#333] flex items-center justify-center hover:border-white/50 transition-colors"
          whileTap={{ scale: 0.9 }}
        >
          <ChevronDown size={16} className="text-white/60" />
        </motion.button>

        <span className="text-[9px] font-bold tracking-[0.3em] text-[#555] uppercase">
          NOW PLAYING
        </span>

        <motion.button
          className="w-10 h-10 border border-[#333] flex items-center justify-center hover:border-white/50 transition-colors"
          whileTap={{ scale: 0.9 }}
        >
          <Share2 size={14} className="text-white/60" />
        </motion.button>
      </div>

      {/* Album art — large, with subtle rotation when playing */}
      <div className="flex-1 flex items-center justify-center px-10">
        <motion.div
          className="w-full max-w-[320px] aspect-square border border-[#333] overflow-hidden relative"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          animate={{
            rotate: isPlaying ? [0, 0.5, 0, -0.5, 0] : 0,
          }}
          transition={{
            rotate: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <img
            src={currentTrack.thumbnail}
            alt=""
            className="w-full h-full object-cover"
          />

          {/* Playing indicator overlay */}
          <AnimatePresence>
            {isPlaying && (
              <motion.div
                className="absolute bottom-4 left-4 flex items-end gap-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="w-[3px] bg-white"
                    animate={{ height: [4, 14, 6, 18, 4] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Track info */}
      <div className="px-8 mb-6">
        <motion.h2
          className="text-xl font-bold text-white leading-tight tracking-tight"
          key={currentTrack.videoId + '-title'}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <MarqueeText text={currentTrack.title} />
        </motion.h2>
        <motion.p
          className="text-sm text-[#666] mt-1 uppercase tracking-wider"
          key={currentTrack.videoId + '-artist'}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          {currentTrack.artist}
        </motion.p>

        {/* Mood tag */}
        {mood && (
          <motion.div
            className="mt-3 inline-flex items-center gap-2 border px-3 py-1"
            style={{ borderColor: moodColor, color: moodColor }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="w-2 h-2" style={{ backgroundColor: moodColor }} />
            <span className="text-[10px] uppercase tracking-[0.15em] font-medium">
              {mood.primary_emotion}
            </span>
          </motion.div>
        )}
      </div>

      {/* Progress bar — scrubbable */}
      <div className="px-8 mb-4">
        <div
          ref={progressBarRef}
          className="relative h-8 flex items-center cursor-pointer group"
          onMouseDown={handleScrubStart}
          onMouseMove={handleScrubMove}
          onMouseUp={handleScrubEnd}
          onMouseLeave={handleScrubEnd}
          onTouchStart={handleScrubStart}
          onTouchMove={handleScrubMove}
          onTouchEnd={handleScrubEnd}
        >
          {/* Track */}
          <div className="w-full h-[3px] bg-[#333] relative">
            <motion.div
              className="h-full bg-white absolute left-0 top-0"
              style={{ width: `${displayProgress}%` }}
            />
            {/* Scrub handle */}
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-[#1A1A1A]"
              style={{ left: `${displayProgress}%`, marginLeft: '-6px' }}
              animate={{ scale: isScrubbing ? 1.5 : 1 }}
              transition={{ type: 'spring', stiffness: 400 }}
            />
          </div>
        </div>

        {/* Time labels */}
        <div className="flex justify-between">
          <span className="text-[10px] text-[#555] font-mono">{formatTime(progress)}</span>
          <span className="text-[10px] text-[#555] font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls — expanded */}
      <div className="px-8 pb-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          {/* Shuffle */}
          <motion.button
            className="w-10 h-10 flex items-center justify-center text-[#555] hover:text-white transition-colors"
            whileTap={{ scale: 0.8, rotate: 20 }}
          >
            <Shuffle size={16} />
          </motion.button>

          {/* Prev */}
          <motion.button
            onClick={previous}
            className="w-12 h-12 flex items-center justify-center text-[#888] hover:text-white transition-colors"
            whileTap={{ scale: 0.7, x: -8 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <SkipBack size={20} fill="currentColor" />
          </motion.button>

          {/* Play/Pause — larger */}
          <motion.button
            onClick={isPlaying ? pause : resume}
            className="w-16 h-16 flex items-center justify-center bg-white text-[#1A1A1A]"
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 300, damping: 12 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isPlaying ? 'pause' : 'play'}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              >
                {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-1" />}
              </motion.div>
            </AnimatePresence>
          </motion.button>

          {/* Next */}
          <motion.button
            onClick={next}
            className="w-12 h-12 flex items-center justify-center text-[#888] hover:text-white transition-colors"
            whileTap={{ scale: 0.7, x: 8 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <SkipForward size={20} fill="currentColor" />
          </motion.button>

          {/* Like */}
          <motion.button
            onClick={handleLike}
            className={`w-10 h-10 flex items-center justify-center transition-colors ${
              liked ? 'text-white' : 'text-[#555] hover:text-white'
            }`}
            whileTap={{ scale: 1.5 }}
            animate={liked ? {
              scale: [1, 1.4, 1],
              rotate: [0, -10, 10, 0],
            } : {}}
            transition={{ duration: 0.4 }}
          >
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          </motion.button>
        </div>

        {/* Swipe hint */}
        <p className="text-center text-[9px] text-[#444] tracking-[0.2em] uppercase mt-6">
          SWIPE LEFT/RIGHT TO SKIP
        </p>
      </div>
    </motion.div>
  );
});
