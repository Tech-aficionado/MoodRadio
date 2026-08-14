'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, RefreshCw, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePlayer } from '@/context/PlayerContext';
import {
  buildMusicProfile,
  saveProfile,
  loadProfile,
  clearProfile,
  isProfileStale,
  profileToPromptContext,
  UserMusicProfile,
} from '@/lib/musicProfile';
import { loadFeedback, clearFeedback } from '@/lib/feedback';
import type { TasteHarvest } from '@/types/taste';

/**
 * Exposes the taste profile plus a prompt-context getter.
 *
 * `getPromptContext()` reads feedback fresh on every call rather than closing
 * over a snapshot, so artists the user skipped moments ago are reflected in the
 * very next mood request without rebuilding the whole profile.
 */
export function useMusicProfile() {
  const [profile, setProfile] = useState<UserMusicProfile | null>(null);

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const getPromptContext = useCallback((): string | undefined => {
    const current = loadProfile();
    if (!current) return undefined;
    const feedback = loadFeedback();
    return profileToPromptContext({
      ...current,
      favoriteArtists: feedback.favoriteArtists.length
        ? feedback.favoriteArtists
        : current.favoriteArtists,
      avoidArtists: feedback.avoidArtists.length
        ? feedback.avoidArtists
        : current.avoidArtists,
    });
  }, []);

  return { profile, setProfile, getPromptContext };
}

export function MusicProfileOnboarding() {
  const { googleAccessToken } = useAuth();
  const { currentTrack } = usePlayer();
  const [profile, setProfile] = useState<UserMusicProfile | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [justBuilt, setJustBuilt] = useState(false);
  const attempted = useRef(false);

  const buildProfile = useCallback(async () => {
    if (!googleAccessToken) return;
    setIsBuilding(true);

    try {
      const res = await fetch('/api/youtube/taste', {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });

      if (!res.ok) {
        console.warn('[PROFILE] taste harvest failed:', res.status);
        return;
      }

      const harvest: TasteHarvest = await res.json();
      console.log('[PROFILE] harvest stats', harvest.stats);

      // Even a thin harvest is worth saving — it still carries some signal and
      // prevents us retrying on every render.
      const next = buildMusicProfile(harvest, loadFeedback());
      saveProfile(next);
      setProfile(next);
      setJustBuilt(true);
      setTimeout(() => setJustBuilt(false), 4000);
    } catch (error) {
      console.error('[PROFILE] build error:', error);
    } finally {
      setIsBuilding(false);
    }
  }, [googleAccessToken]);

  // Build automatically once YouTube access is available. The old flow waited
  // for the user to click a banner, so most sessions never had a profile and
  // the AI got no taste context at all.
  useEffect(() => {
    const existing = loadProfile();
    setProfile(existing);

    if (!googleAccessToken || attempted.current) return;
    if (existing && !isProfileStale(existing)) return;

    attempted.current = true;
    void buildProfile();
  }, [googleAccessToken, buildProfile]);

  const rebuild = useCallback(() => {
    clearProfile();
    clearFeedback();
    setProfile(null);
    attempted.current = true;
    void buildProfile();
  }, [buildProfile]);

  if (!googleAccessToken) return null;

  // The collapsed player bar is `fixed bottom-0 ... z-30` and roughly 93px tall
  // (3px accent + 2px progress + 48px art + py-4). This chip is also fixed at
  // z-30, so at bottom-4 it painted straight over the player's artwork and
  // title on every screen — worst on mobile, where there is no spare width to
  // absorb it. Lift clear whenever a track is present.
  const bottomClass = currentTrack ? 'bottom-[7.5rem]' : 'bottom-4';

  return (
    <div className={`fixed ${bottomClass} left-6 z-20 transition-all duration-300`}>
      <AnimatePresence mode="wait">
        {isBuilding && (
          <motion.div
            key="building"
            className="flex items-center gap-2 border border-[#333] bg-[#1A1A1A] px-3 py-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <Loader2 size={11} className="animate-spin text-white/50" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
              Learning your taste
            </span>
          </motion.div>
        )}

        {!isBuilding && justBuilt && profile && (
          <motion.div
            key="done"
            className="flex items-center gap-2 border border-[#333] bg-[#1A1A1A] px-3 py-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <Check size={11} className="text-white/60" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
              {profile.sampleSize} tracks analysed
            </span>
          </motion.div>
        )}

        {!isBuilding && !justBuilt && profile && (
          <motion.button
            key="idle"
            onClick={rebuild}
            title={`Taste profile from ${profile.sampleSize} tracks — click to rebuild`}
            className="group flex items-center gap-2 border border-[#333] bg-[#1A1A1A] px-3 py-2 transition-colors hover:border-white/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              Personalised
            </span>
            <RefreshCw
              size={9}
              className="text-white/40 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
