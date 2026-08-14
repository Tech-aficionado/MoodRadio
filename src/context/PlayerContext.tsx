'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { Track, MoodAnalysis } from '@/types';
import { recordLike, recordSkip, recordPlay, loadFeedback } from '@/lib/feedback';

interface PlayerControls {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface PlayerContextType {
  currentTrack: Track | null;
  queue: Track[];
  likedTracks: Track[];
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  duration: number;
  play: (track?: Track) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  like: () => void;
  dislike: () => void;
  searchAndPlay: (mood: MoodAnalysis, googleToken?: string | null) => Promise<void>;
  loadLikedTracks: (googleToken: string) => Promise<void>;
  setQueue: (tracks: Track[]) => void;
  setIsPlaying: (playing: boolean) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  registerPlayerControls: (controls: PlayerControls) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerControlsRef = useRef<PlayerControls | null>(null);

  const registerPlayerControls = useCallback((controls: PlayerControls) => {
    playerControlsRef.current = controls;
  }, []);

  // Record listening history from ONE place. `setCurrentTrack` is called from
  // play(), next() and previous(), so hooking the state rather than each caller
  // guarantees nothing is missed.
  useEffect(() => {
    if (currentTrack && (currentTrack.artist || currentTrack.title)) {
      recordPlay(currentTrack.artist, currentTrack.title, currentTrack.videoId);
    }
  }, [currentTrack]);

  const play = useCallback((track?: Track) => {
    if (track) {
      setCurrentTrack(track);
      setProgress(0);
      setDuration(0);
    }
    setIsPlaying(true);
    playerControlsRef.current?.playVideo();
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
    playerControlsRef.current?.pauseVideo();
  }, []);

  const resume = useCallback(() => {
    setIsPlaying(true);
    playerControlsRef.current?.playVideo();
  }, []);

  const next = useCallback(() => {
    if (queue.length > 0 && queueIndex < queue.length - 1) {
      const nextIndex = queueIndex + 1;
      setQueueIndex(nextIndex);
      setCurrentTrack(queue[nextIndex]);
      setProgress(0);
      setDuration(0);
      setIsPlaying(true);
    }
  }, [queue, queueIndex]);

  const previous = useCallback(() => {
    if (queue.length > 0 && queueIndex > 0) {
      const prevIndex = queueIndex - 1;
      setQueueIndex(prevIndex);
      setCurrentTrack(queue[prevIndex]);
      setProgress(0);
      setDuration(0);
      setIsPlaying(true);
    }
  }, [queue, queueIndex]);

  const like = useCallback(() => {
    if (currentTrack) {
      recordLike(currentTrack.artist, currentTrack.videoId);
    }
  }, [currentTrack]);

  const dislike = useCallback(() => {
    if (currentTrack) {
      recordSkip(currentTrack.artist, currentTrack.videoId);
    }
    next();
  }, [currentTrack, next]);

  // Load user's liked videos from YouTube
  const loadLikedTracks = useCallback(async (googleToken: string) => {
    try {
      const res = await fetch('/api/youtube/liked?maxResults=10', {
        headers: { Authorization: `Bearer ${googleToken}` },
      });
      if (res.ok) {
        const tracks: Track[] = await res.json();
        setLikedTracks(tracks);
      }
    } catch (err) {
      console.error('Failed to load liked tracks:', err);
    }
  }, []);

  // Search with optional OAuth token for personalization.
  // All AI keywords are forwarded; /api/search applies the quota-aware cap
  // (SEARCH_KEYWORD_LIMIT) so the ceiling lives in one place.
  const searchAndPlay = useCallback(async (mood: MoodAnalysis, googleToken?: string | null) => {
    setIsLoading(true);
    try {
      const keywords = mood.search_keywords.join(',');
      const headers: Record<string, string> = {};
      if (googleToken) {
        headers['Authorization'] = `Bearer ${googleToken}`;
      }

      const response = await fetch(
        `/api/search?keywords=${encodeURIComponent(keywords)}&maxResults=15`,
        { headers }
      );

      if (!response.ok) throw new Error('Search failed');

      let tracks: Track[] = await response.json();

      // Respect prior skips: never re-queue a blocked video, and de-prioritise
      // artists the user has repeatedly skipped. Without this, skipping had no
      // lasting effect and the same tracks kept reappearing.
      const feedback = loadFeedback();
      if (feedback.blockedVideoIds.length || feedback.avoidArtists.length) {
        const blocked = new Set(feedback.blockedVideoIds);
        const avoided = new Set(feedback.avoidArtists);
        const filtered = tracks.filter(
          (t) =>
            !blocked.has(t.videoId) &&
            !avoided.has((t.artist || '').toLowerCase())
        );
        // Only apply if something survives — a thin result set beats none.
        if (filtered.length >= 3) tracks = filtered;
      }

      // If user has liked tracks, mix 2-3 from their likes into the queue
      if (likedTracks.length > 0) {
        const shuffledLikes = [...likedTracks].sort(() => Math.random() - 0.5).slice(0, 3);
        // Insert liked tracks at positions 2, 5, 8
        const mixed = [...tracks];
        shuffledLikes.forEach((liked, i) => {
          const pos = 2 + i * 3;
          if (pos < mixed.length) {
            mixed.splice(pos, 0, liked);
          } else {
            mixed.push(liked);
          }
        });
        tracks = mixed;
      }

      if (tracks.length > 0) {
        setQueue(tracks);
        setQueueIndex(0);
        setCurrentTrack(tracks[0]);
        setProgress(0);
        setDuration(0);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Search and play error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [likedTracks]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        likedTracks,
        isPlaying,
        isLoading,
        progress,
        duration,
        play,
        pause,
        resume,
        next,
        previous,
        like,
        dislike,
        searchAndPlay,
        loadLikedTracks,
        setQueue,
        setIsPlaying,
        setProgress,
        setDuration,
        registerPlayerControls,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextType {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
}
