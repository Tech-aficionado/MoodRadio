/**
 * Taste signals — the raw evidence used to build a user's music profile.
 *
 * A "signal" is one observed data point about what the user listens to,
 * normalised across the different YouTube sources plus in-app behaviour.
 * Ingestion (/api/youtube/taste) produces these; src/lib/musicProfile.ts
 * consumes them.
 */

export type TasteSource = 'liked' | 'playlist' | 'subscription' | 'played';

export interface TasteSignal {
  videoId: string;
  title: string;
  /** Channel title, cleaned of " - Topic" / "VEVO" suffixes. */
  artist: string;
  channelId?: string;
  /** Uploader-supplied tags — a strong genre/language hint. */
  tags?: string[];
  /**
   * YouTube's own topic classification, reduced to the final path segment of
   * each Wikipedia URL (e.g. "Hip_hop_music"). Far more reliable than guessing
   * genre from the title.
   */
  topics?: string[];
  /** YouTube category id; "10" is Music. */
  categoryId?: string;
  durationSec?: number;
  /** Upload date, used as a rough era signal. */
  publishedAt?: string;
  source: TasteSource;
}

/** Aggregated payload returned by /api/youtube/taste. */
export interface TasteHarvest {
  signals: TasteSignal[];
  followedChannels: string[];
  stats: {
    likedFetched: number;
    playlistItemsFetched: number;
    subscriptions: number;
    musicKept: number;
    nonMusicDropped: number;
    enriched: number;
  };
}

/** Explicit in-app feedback, the highest-quality signal we can collect. */
export interface TasteFeedback {
  /** Artists the user actively liked while listening. */
  favoriteArtists: string[];
  /** Artists whose tracks the user repeatedly skipped or disliked. */
  avoidArtists: string[];
  /** Video ids never to queue again. */
  blockedVideoIds: string[];
  updatedAt: string;
}
