'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useMood } from '@/context/MoodContext';
import { usePlayer } from '@/context/PlayerContext';
import { useAuth } from '@/context/AuthContext';
import { useMusicProfile } from '@/components/MusicProfileOnboarding';
import { PlayerCard } from '@/components/PlayerCard';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import { QueueDrawer } from '@/components/QueueDrawer';
import { MusicProfileOnboarding } from '@/components/MusicProfileOnboarding';
import { MoodReadout } from '@/components/MoodReadout';
import { MoodAtmosphere } from '@/components/MoodAtmosphere';
import { KineticText } from '@/components/KineticText';
import { ArrowRight, Menu, User, History, BarChart3 } from 'lucide-react';
import Link from 'next/link';

const PRESETS = [
  { label: 'EUPHORIC', text: "I'm on top of the world right now" },
  { label: 'MELANCHOLIC', text: "There's a beautiful sadness tonight" },
  { label: 'PEACEFUL', text: 'I feel completely at peace' },
  { label: 'ANGRY', text: "I'm furious, give me intensity" },
  { label: 'NOSTALGIC', text: 'Missing the old days' },
  { label: 'ENERGETIC', text: "I'm hyped, give me energy" },
  { label: 'DREAMY', text: 'Floating, everything feels soft' },
  { label: 'HEARTBROKEN', text: 'My heart is shattered' },
];

// Text scramble effect
function useTextScramble(text: string, active: boolean) {
  const [displayText, setDisplayText] = useState(text);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  useEffect(() => {
    if (!active) { setDisplayText(text); return; }
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(
        text.split('').map((char, i) => {
          if (char === ' ') return ' ';
          if (i < iteration) return text[i];
          return chars[Math.floor(Math.random() * chars.length)];
        }).join('')
      );
      iteration += 1;
      if (iteration > text.length) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [text, active]);

  return displayText;
}

// Magnetic button component
function MagneticButton({ children, onClick, className = '' }: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * 0.15);
    y.set((e.clientY - centerY) * 0.15);
  };

  const handleMouseLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY }}
      className={className}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  );
}

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [submittedText, setSubmittedText] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  const { mood, analyzeMood, isAnalyzing } = useMood();
  const { currentTrack, isPlaying, searchAndPlay, loadLikedTracks } = usePlayer();
  const { googleAccessToken, user, isSignedIn, loading: authLoading, signInWithGoogle } = useAuth();
  const { getPromptContext } = useMusicProfile();

  const hasTrack = !!currentTrack;
  const scrambledTitle = useTextScramble('MOODRADIO', !hasTrack);

  useEffect(() => {
    if (googleAccessToken) loadLikedTracks(googleAccessToken);
  }, [googleAccessToken, loadLikedTracks]);

  useEffect(() => {
    if (!hasTrack && !inputValue && !isAnalyzing) {
      inactivityTimer.current = setTimeout(() => setShowPresets(true), 2000);
    } else {
      setShowPresets(false);
    }
    return () => { if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
  }, [hasTrack, inputValue, isAnalyzing]);

  const handleSubmit = useCallback(async (text: string) => {
    if (!text.trim() || isAnalyzing) return;
    // Keep what the user said so it can be echoed back next to the decoded
    // emotion — the input itself is cleared on submit.
    setSubmittedText(text.trim());
    const analysis = await analyzeMood(text, getPromptContext());
    if (analysis) {
      await searchAndPlay(analysis, googleAccessToken);
      setInputValue('');
    }
  }, [analyzeMood, searchAndPlay, googleAccessToken, getPromptContext, isAnalyzing]);

  const handlePreset = useCallback(async (text: string) => {
    setShowPresets(false);
    // Show the chosen feeling in the input instead of submitting invisibly.
    setInputValue(text);
    setSubmittedText(text);
    const analysis = await analyzeMood(text, getPromptContext());
    if (analysis) {
      await searchAndPlay(analysis, googleAccessToken);
      setInputValue('');
    }
  }, [analyzeMood, searchAndPlay, googleAccessToken, getPromptContext]);

  // --- Sign-in gate ---------------------------------------------------------
  // AI analysis needs a Firebase ID token, and taste learning needs YouTube
  // access, so the experience requires an account. Rendered after all hooks so
  // hook order stays stable.

  if (authLoading) {
    return (
      <main className="flex h-[100dvh] w-screen items-center justify-center bg-[#1A1A1A]">
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
          Loading
        </span>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="relative flex h-[100dvh] w-screen flex-col items-center justify-center overflow-hidden bg-[#1A1A1A] px-6">
        {/* Cycles through emotion hues so the gate previews what the app does. */}
        <MoodAtmosphere mood={null} showcase />
        {/* Keeps copy readable whichever hue is currently up. */}
        <div className="content-scrim" aria-hidden="true" />
        <div className="absolute left-0 right-0 top-0 h-[3px] bg-[#333]" />

        <motion.div
          className="relative z-10 w-full max-w-md"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="mb-6 text-[clamp(2.5rem,12vw,5rem)] font-bold leading-[0.9] tracking-tight text-white">
            <KineticText text="MOOD" className="text-[clamp(2.5rem,12vw,5rem)]" />
            <br />
            <KineticText
              text="RADIO"
              className="text-[clamp(2.5rem,12vw,5rem)] text-[#8A8A8A]"
              delay={0.16}
            />
          </h1>

          {/* Contrast: white/40 measured ~3.9:1 on #1A1A1A, below the 4.5:1
              minimum for body text. white/75 lands near 9:1. */}
          <p className="mb-10 max-w-sm text-sm leading-relaxed text-white/75">
            Type how you feel. Get music that matches. Sign in so it can learn
            your taste from your YouTube library.
          </p>

          <button
            onClick={signInWithGoogle}
            className="brutal-btn w-full py-4 text-[11px] font-bold uppercase tracking-[0.25em]"
          >
            Continue with Google
          </button>

          {/* This explains what access is being granted, so it should be the
              most legible small text on the screen, not the least.
              white/25 measured ~2.3:1 — a clear AA failure. */}
          <p className="mt-6 text-[11px] leading-relaxed tracking-wide text-white/60">
            Read-only YouTube access is used to learn which artists and genres
            you already listen to. Nothing is posted to your account.
          </p>

          {/* Reachable before sign-in on purpose: this is the consent screen,
              and Google's OAuth review expects the privacy policy to be
              discoverable from wherever access is requested. */}
          <div className="mt-6 flex gap-6 text-[10px] font-bold uppercase tracking-[0.25em]">
            <Link
              href="/privacy"
              className="text-white/50 transition-colors hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-white/50 transition-colors hover:text-white"
            >
              Terms
            </Link>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-[#1A1A1A]">
      {/* === EMOTIONAL ATMOSPHERE — the whole canvas carries the feeling === */}
      <MoodAtmosphere mood={mood} subdued={!!inputValue && !hasTrack} />

      {/* === MOOD ACCENT STRIP === */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[3px] z-50"
        style={{
          // color_hex covers every emotion the model can return;
          // --color-mood-* only defines 10 of them and greys out the rest.
          backgroundColor: mood?.color_hex || '#333333',
          boxShadow: mood ? `0 0 24px ${mood.color_hex}` : 'none',
        }}
        animate={{
          scaleX: isAnalyzing ? [1, 0.3, 1] : 1,
        }}
        transition={{
          scaleX: { duration: 1.5, repeat: isAnalyzing ? Infinity : 0, ease: 'easeInOut' },
        }}
      />

      {/* === TOP NAV === */}
      <nav className="absolute top-[3px] left-0 right-0 z-40 flex items-center justify-between px-6 py-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <motion.span
          className="text-[11px] font-bold tracking-[0.3em] text-white/40 uppercase scramble-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {scrambledTitle}
        </motion.span>

        {/* Current emotion — stays visible even while a track is playing, so
            the decoded feeling is never a mystery. */}
        <AnimatePresence>
          {mood && (
            <MoodReadout mood={mood} variant="chip" sourceText={submittedText} />
          )}
        </AnimatePresence>

        <div className="flex items-center gap-3">
          {/* Past the sign-in gate the user is always signed in. */}
          <button
            onClick={() => setShowNav(!showNav)}
            className="w-8 h-8 flex items-center justify-center border border-[#333] hover:border-white/40 transition-colors"
          >
            <Menu size={14} className="text-white/60" />
          </button>
        </div>
      </nav>

      {/* === NAV DRAWER === */}
      <AnimatePresence>
        {showNav && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowNav(false)} />
            <motion.div
              className="relative w-64 h-full bg-[#1A1A1A] border-l border-[#333] p-8 pt-20"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="space-y-1">
                <Link href="/history" onClick={() => setShowNav(false)}
                  className="flex items-center gap-4 py-4 border-b border-[#333] text-white/60 hover:text-white transition-colors group"
                >
                  <History size={16} className="group-hover:translate-x-1 transition-transform" />
                  <span className="text-sm font-medium tracking-wide">HISTORY</span>
                </Link>
                <Link href="/insights" onClick={() => setShowNav(false)}
                  className="flex items-center gap-4 py-4 border-b border-[#333] text-white/60 hover:text-white transition-colors group"
                >
                  <BarChart3 size={16} className="group-hover:translate-x-1 transition-transform" />
                  <span className="text-sm font-medium tracking-wide">INSIGHTS</span>
                </Link>
              </div>

              {user && (
                <div className="absolute bottom-8 left-8 right-8 flex items-center gap-3 pt-4 border-t border-[#333]">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-8 h-8 border border-[#333]" />
                  ) : (
                    <div className="w-8 h-8 border border-[#333] flex items-center justify-center">
                      <User size={12} className="text-white/40" />
                    </div>
                  )}
                  <span className="text-xs text-white/40 truncate">{user.displayName || user.email}</span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === MAIN CONTENT ===
          `items-center` + `my-auto` on the child centres the column when there
          is room and lets it scroll when there is not. Using `justify-center`
          here instead would clip the TOP of an overflowing column with no way
          to reach it, because <main> is overflow-hidden: at 390px the decoded
          state needs ~722px, which exceeds an iPhone SE (667) outright and any
          phone once the browser chrome is showing. */}
      <div className="relative z-10 flex h-full flex-col items-center overflow-y-auto overscroll-contain px-6 sm:px-10">
        <motion.div
          className="my-auto w-full max-w-xl py-6"
          animate={{
            y: hasTrack ? '-12vh' : 0,
            opacity: hasTrack ? 0.3 : 1,
          }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        >
          {/* === HEADLINE / DECODED EMOTION === */}
          <AnimatePresence mode="wait">
            {!hasTrack && !isAnalyzing && !mood && (
              <motion.div
                key="headline"
                className="mb-8 sm:mb-16"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1 className="display-text text-[clamp(48px,12vw,96px)] text-white leading-[0.85] mb-4">
                  <KineticText text="FEEL" className="text-[clamp(48px,12vw,96px)]" />
                  <br />
                  <KineticText
                    text="SOMETHING."
                    className="text-[clamp(48px,12vw,96px)] text-[#666]"
                    delay={0.18}
                  />
                </h1>
                <p className="text-white/70 text-sm tracking-wide mt-6 max-w-xs">
                  Type your current mood. We decode the emotion<br />and find the right sound.
                </p>
              </motion.div>
            )}

            {!hasTrack && !isAnalyzing && mood && (
              <motion.div key="readout" className="mb-8 sm:mb-16">
                <MoodReadout mood={mood} sourceText={submittedText} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* === INPUT === */}
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(inputValue); }}>
            <motion.div
              className="relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="describe how you feel..."
                disabled={isAnalyzing}
                className="brutal-input"
                autoComplete="off"
              />

              {/* Submit button */}
              <AnimatePresence>
                {inputValue.trim() && !isAnalyzing && (
                  <motion.button
                    type="submit"
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white text-[#1A1A1A] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    <ArrowRight size={16} strokeWidth={2.5} />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          </form>

          {/* === ANALYZING STATE === */}
          <AnimatePresence>
            {isAnalyzing && (
              <motion.div
                className="mt-8 flex items-center gap-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {/* Equalizer bars */}
                <div className="flex items-end gap-[3px] h-6">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      className="w-[3px] bg-white/60"
                      animate={{ height: [4, 20, 8, 24, 4] }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs text-white/65 tracking-[0.2em] uppercase">
                  Decoding emotion
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* === PRESETS === */}
          <AnimatePresence>
            {showPresets && (
              <motion.div
                className="mt-16"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <p className="text-[10px] text-white/55 tracking-[0.3em] uppercase mb-6">
                  OR SELECT A STATE
                </p>
                <div className="grid grid-cols-2 gap-[1px] bg-[#333]">
                  {PRESETS.map((p, i) => (
                    <MagneticButton
                      key={p.label}
                      onClick={() => handlePreset(p.text)}
                      className="bg-[#1A1A1A] px-5 py-4 text-left group"
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * i, duration: 0.3 }}
                        onMouseEnter={() => setHoveredPreset(p.label)}
                        onMouseLeave={() => setHoveredPreset(null)}
                      >
                        {/*
                          Was `text-[#555]` until hovered — 2.25:1 on #1A1A1A,
                          well under the 4.5:1 minimum. Worse, hover does not
                          exist on touch, so every label on a phone was stuck at
                          that ratio with no way to reveal it. The resting state
                          is now readable on its own (~7.5:1) and hover is just
                          emphasis.
                        */}
                        <span className={`text-[13px] font-bold tracking-[0.15em] transition-colors duration-200 ${
                          hoveredPreset === p.label ? 'text-white' : 'text-white/70'
                        }`}>
                          {p.label}
                        </span>
                        <motion.div
                          className="h-[2px] bg-white mt-2 origin-left"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: hoveredPreset === p.label ? 1 : 0 }}
                          transition={{ duration: 0.25 }}
                        />
                      </motion.div>
                    </MagneticButton>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* === PLAYER === */}
      <AnimatePresence>
        {currentTrack && <PlayerCard />}
      </AnimatePresence>

      {/* === QUEUE === */}
      <AnimatePresence>
        {currentTrack && isPlaying && <QueueDrawer />}
      </AnimatePresence>

      {/* === ONBOARDING === */}
      <MusicProfileOnboarding />

      {/* === YOUTUBE (hidden) === */}
      <YouTubePlayer />
    </main>
  );
}
