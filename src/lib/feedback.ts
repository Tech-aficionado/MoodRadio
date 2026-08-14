'use client';

import type { TasteFeedback } from '@/types/taste';

/**
 * In-app listening feedback.
 *
 * PlayerContext's `like()` and `dislike()` previously only called
 * console.log, discarding the single highest-quality taste signal available:
 * what the user actually keeps versus skips. This module persists that
 * behaviour so it can steer future AI suggestions.
 *
 * Stored locally — no backend required, and it survives reloads.
 */

const KEY = 'moodradio_taste_feedback';

/** Skips needed before an artist is actively avoided. */
const AVOID_THRESHOLD = 2;

const EMPTY: TasteFeedback = {
  favoriteArtists: [],
  avoidArtists: [],
  blockedVideoIds: [],
  updatedAt: new Date(0).toISOString(),
};

interface StoredFeedback extends TasteFeedback {
  /** artist -> skip count, so one accidental skip does not ban an artist. */
  skipCounts: Record<string, number>;
  likeCounts: Record<string, number>;
}

function read(): StoredFeedback {
  if (typeof window === 'undefined') {
    return { ...EMPTY, skipCounts: {}, likeCounts: {} };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, skipCounts: {}, likeCounts: {} };
    const parsed = JSON.parse(raw) as Partial<StoredFeedback>;
    return {
      favoriteArtists: parsed.favoriteArtists ?? [],
      avoidArtists: parsed.avoidArtists ?? [],
      blockedVideoIds: parsed.blockedVideoIds ?? [],
      updatedAt: parsed.updatedAt ?? EMPTY.updatedAt,
      skipCounts: parsed.skipCounts ?? {},
      likeCounts: parsed.likeCounts ?? {},
    };
  } catch {
    return { ...EMPTY, skipCounts: {}, likeCounts: {} };
  }
}

function write(data: StoredFeedback) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...data, updatedAt: new Date().toISOString() })
    );
  } catch {
    // Storage full or blocked — feedback is a nice-to-have, never fatal.
  }
}

function normaliseArtist(artist: string): string {
  return artist.trim().toLowerCase();
}

/** Record an explicit like. Also clears any prior avoid on that artist. */
export function recordLike(artist: string, videoId?: string): void {
  if (!artist) return;
  const key = normaliseArtist(artist);
  const data = read();

  data.likeCounts[key] = (data.likeCounts[key] || 0) + 1;
  data.skipCounts[key] = 0;

  if (!data.favoriteArtists.includes(key)) {
    data.favoriteArtists = [key, ...data.favoriteArtists].slice(0, 25);
  }
  // An explicit like overrides an earlier avoid verdict.
  data.avoidArtists = data.avoidArtists.filter((a) => a !== key);
  if (videoId) {
    data.blockedVideoIds = data.blockedVideoIds.filter((v) => v !== videoId);
  }

  write(data);
}

/**
 * Record a skip/dislike. Only promotes to "avoid" after repeated skips, so a
 * single skip (which often just means "not right now") is not over-read.
 */
export function recordSkip(artist: string, videoId?: string): void {
  if (!artist) return;
  const key = normaliseArtist(artist);
  const data = read();

  data.skipCounts[key] = (data.skipCounts[key] || 0) + 1;

  // Never avoid an artist the user has explicitly liked.
  const liked = (data.likeCounts[key] || 0) > 0;
  if (
    !liked &&
    data.skipCounts[key] >= AVOID_THRESHOLD &&
    !data.avoidArtists.includes(key)
  ) {
    data.avoidArtists = [key, ...data.avoidArtists].slice(0, 25);
  }

  if (videoId && !data.blockedVideoIds.includes(videoId)) {
    data.blockedVideoIds = [videoId, ...data.blockedVideoIds].slice(0, 200);
  }

  write(data);
}

export function loadFeedback(): TasteFeedback {
  const { favoriteArtists, avoidArtists, blockedVideoIds, updatedAt } = read();
  return { favoriteArtists, avoidArtists, blockedVideoIds, updatedAt };
}

export function clearFeedback(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
