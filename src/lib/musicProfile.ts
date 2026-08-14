import type { TasteFeedback, TasteHarvest, TasteSignal } from '@/types/taste';

/**
 * Builds a music taste profile from enriched YouTube signals.
 *
 * Previously this guessed genre and language by substring-matching a handful of
 * keywords against video titles. Now it primarily uses YouTube's own
 * `topicDetails.topicCategories` plus uploader `tags`, falling back to title
 * heuristics only when neither is present.
 *
 * It is also defensive about missing fields. The old version did
 * `track.artist.toLowerCase()` unguarded, which threw whenever a record without
 * an `artist` was passed in — the caller was handing it playlist metadata
 * objects, so profile building silently failed and no profile was ever saved.
 */

export const PROFILE_VERSION = 2;

/** Rebuild the profile once it is older than this. Taste drifts. */
export const PROFILE_STALE_AFTER_DAYS = 14;

export interface UserMusicProfile {
  topArtists: string[];
  topGenres: string[];
  preferredLanguages: string[];
  energyPreference: 'high' | 'balanced' | 'low';
  eraPreference: 'modern' | 'mixed' | 'retro';
  /** Channels the user subscribes to — a durable taste signal. */
  followedChannels: string[];
  /** Learned from in-app behaviour rather than YouTube history. */
  favoriteArtists: string[];
  avoidArtists: string[];
  /** How many music signals the profile was built from. */
  sampleSize: number;
  profiledAt: string;
  version: number;
}

/** Map YouTube topic slugs onto human genre labels. */
const TOPIC_TO_GENRE: Record<string, string> = {
  Hip_hop_music: 'hip-hop',
  Rock_music: 'rock',
  Pop_music: 'pop',
  Electronic_music: 'electronic',
  Rhythm_and_blues: 'r&b',
  Soul_music: 'soul',
  Country_music: 'country',
  Jazz: 'jazz',
  Classical_music: 'classical',
  Reggae: 'reggae',
  Independent_music: 'indie',
  Music_of_Asia: 'asian',
  Christian_music: 'devotional',
  Religious_music: 'devotional',
  Folk_music: 'folk',
  Heavy_metal_music: 'metal',
  Punk_rock: 'punk',
  Blues: 'blues',
  Disco: 'disco',
  Funk: 'funk',
  Latin_music: 'latin',
  Electronic_dance_music: 'edm',
  House_music: 'house',
  Techno: 'techno',
  Dubstep: 'dubstep',
  Trap_music: 'trap',
  Ska: 'ska',
  Opera: 'opera',
  Vocal_music: 'vocal',
  Soundtrack: 'soundtrack',
  Film_score: 'soundtrack',
};

/** Fallback genre cues, applied only when topics and tags are absent. */
const GENRE_KEYWORDS: Record<string, string[]> = {
  'hip-hop': ['rap', 'hip hop', 'trap', 'drill', 'freestyle', 'hip-hop'],
  'pop': ['pop', 'top 40', 'chart', 'hit'],
  'rock': ['rock', 'metal', 'punk', 'grunge', 'alternative'],
  'electronic': ['edm', 'electronic', 'house', 'techno', 'dubstep', 'trance', 'bass'],
  'r&b': ['r&b', 'rnb', 'soul', 'neo-soul', 'rhythm and blues'],
  'indie': ['indie', 'underground', 'bedroom pop', 'lo-fi'],
  'classical': ['classical', 'orchestra', 'symphony', 'piano concerto', 'baroque'],
  'jazz': ['jazz', 'swing', 'bebop', 'smooth jazz'],
  'bollywood': ['bollywood', 'hindi songs', 'filmi', 'arijit', 'shreya', 'atif'],
  'punjabi': ['punjabi', 'bhangra', 'diljit', 'sidhu', 'ap dhillon'],
  'lo-fi': ['lo-fi', 'lofi', 'chill beats', 'study music'],
  'ambient': ['ambient', 'meditation', 'nature sounds', 'atmospheric'],
  'country': ['country', 'western', 'bluegrass', 'folk'],
  'k-pop': ['k-pop', 'kpop', 'bts', 'blackpink', 'twice', 'stray kids'],
  'latin': ['reggaeton', 'latin', 'salsa', 'bachata', 'bad bunny'],
};

const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  'hindi': ['hindi', 'bollywood', 'arijit singh', 'shreya ghoshal', 'atif aslam', 'neha kakkar', 'jubin nautiyal'],
  'punjabi': ['punjabi', 'diljit dosanjh', 'sidhu moose wala', 'ap dhillon', 'karan aujla'],
  'english': ['official video', 'lyrics', 'vevo'],
  'korean': ['k-pop', 'kpop', 'bts', 'blackpink', '(mv)', '뮤직비디오'],
  'spanish': ['reggaeton', 'bad bunny', 'ozuna', 'daddy yankee'],
  'tamil': ['tamil', 'anirudh', 'yuvan', 'ar rahman'],
  'telugu': ['telugu', 'tollywood'],
};

/** Non-latin script ranges give a far more reliable language read than names. */
const SCRIPT_LANGUAGES: Array<{ lang: string; re: RegExp }> = [
  { lang: 'hindi', re: /[\u0900-\u097F]/ },
  { lang: 'punjabi', re: /[\u0A00-\u0A7F]/ },
  { lang: 'tamil', re: /[\u0B80-\u0BFF]/ },
  { lang: 'telugu', re: /[\u0C00-\u0C7F]/ },
  { lang: 'bengali', re: /[\u0980-\u09FF]/ },
  { lang: 'korean', re: /[\uAC00-\uD7AF]/ },
  { lang: 'japanese', re: /[\u3040-\u30FF]/ },
  { lang: 'arabic', re: /[\u0600-\u06FF]/ },
];

function bump(counts: Record<string, number>, key: string, by = 1) {
  if (!key) return;
  counts[key] = (counts[key] || 0) + by;
}

function topKeys(counts: Record<string, number>, n: number): string[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/**
 * A liked track is worth more than a track that merely sits in a playlist.
 */
function weightFor(source: TasteSignal['source']): number {
  switch (source) {
    case 'liked':
      return 3;
    case 'played':
      return 2;
    default:
      return 1;
  }
}

export function buildMusicProfile(
  harvest: TasteHarvest,
  feedback?: TasteFeedback
): UserMusicProfile {
  const artistCounts: Record<string, number> = {};
  const genreCounts: Record<string, number> = {};
  const langCounts: Record<string, number> = {};

  let highEnergy = 0;
  let lowEnergy = 0;
  let retro = 0;
  let modern = 0;

  const signals = Array.isArray(harvest?.signals) ? harvest.signals : [];

  for (const signal of signals) {
    // Defensive: never assume these exist.
    const title = signal?.title ?? '';
    const artist = signal?.artist ?? '';
    const tags = Array.isArray(signal?.tags) ? signal.tags : [];
    const topics = Array.isArray(signal?.topics) ? signal.topics : [];
    const weight = weightFor(signal?.source ?? 'playlist');

    const haystack = `${title} ${artist} ${tags.join(' ')}`.toLowerCase();

    if (artist) bump(artistCounts, artist.toLowerCase(), weight);

    // --- Genre: prefer YouTube's own classification ---
    let genreFound = false;
    for (const topic of topics) {
      const genre = TOPIC_TO_GENRE[topic];
      if (genre) {
        bump(genreCounts, genre, weight * 2); // authoritative, weight it up
        genreFound = true;
      }
    }
    if (!genreFound) {
      for (const [genre, cues] of Object.entries(GENRE_KEYWORDS)) {
        if (cues.some((cue) => haystack.includes(cue))) {
          bump(genreCounts, genre, weight);
        }
      }
    }

    // --- Language: script detection first, then name cues ---
    let scriptFound = false;
    for (const { lang, re } of SCRIPT_LANGUAGES) {
      if (re.test(title)) {
        bump(langCounts, lang, weight * 2);
        scriptFound = true;
      }
    }
    if (!scriptFound) {
      for (const [lang, cues] of Object.entries(LANGUAGE_KEYWORDS)) {
        if (cues.some((cue) => haystack.includes(cue))) {
          bump(langCounts, lang, weight);
        }
      }
    }

    // --- Energy ---
    if (/remix|bass|hype|party|dance|edm|trap|drill|rage|workout/i.test(haystack)) {
      highEnergy += weight;
    }
    if (/lo-?fi|chill|sleep|calm|ambient|relax|piano|acoustic|slow/i.test(haystack)) {
      lowEnergy += weight;
    }
    // Duration is a real energy/format hint: very long tracks skew ambient.
    if (signal?.durationSec && signal.durationSec > 480) lowEnergy += weight;

    // --- Era ---
    if (/90s|80s|70s|retro|throwback|old school|classic/i.test(haystack)) {
      retro += weight;
    } else {
      modern += weight;
    }
  }

  const energyPreference: UserMusicProfile['energyPreference'] =
    highEnergy > lowEnergy * 2
      ? 'high'
      : lowEnergy > highEnergy * 2
        ? 'low'
        : 'balanced';

  const eraPreference: UserMusicProfile['eraPreference'] =
    retro > modern * 0.5 ? 'retro' : retro > modern * 0.2 ? 'mixed' : 'modern';

  return {
    topArtists: topKeys(artistCounts, 12),
    topGenres: topKeys(genreCounts, 5),
    preferredLanguages: topKeys(langCounts, 3),
    energyPreference,
    eraPreference,
    followedChannels: (harvest?.followedChannels ?? []).slice(0, 12),
    favoriteArtists: feedback?.favoriteArtists?.slice(0, 10) ?? [],
    avoidArtists: feedback?.avoidArtists?.slice(0, 10) ?? [],
    sampleSize: signals.length,
    profiledAt: new Date().toISOString(),
    version: PROFILE_VERSION,
  };
}

/**
 * Renders the profile as prompt context for the AI.
 *
 * Note the explicit avoid list — without it the model happily keeps suggesting
 * artists the user has already skipped repeatedly.
 */
export function profileToPromptContext(profile: UserMusicProfile): string {
  const parts: string[] = [];

  if (profile.topGenres?.length) {
    parts.push(`Favourite genres: ${profile.topGenres.join(', ')}`);
  }
  if (profile.topArtists?.length) {
    parts.push(`Most-listened artists: ${profile.topArtists.slice(0, 8).join(', ')}`);
  }
  if (profile.favoriteArtists?.length) {
    parts.push(`Explicitly liked in-app: ${profile.favoriteArtists.join(', ')}`);
  }
  if (profile.followedChannels?.length) {
    parts.push(`Subscribed channels: ${profile.followedChannels.slice(0, 6).join(', ')}`);
  }
  if (profile.preferredLanguages?.length) {
    parts.push(`Preferred languages: ${profile.preferredLanguages.join(', ')}`);
  }
  parts.push(`Energy preference: ${profile.energyPreference}`);
  parts.push(`Era: ${profile.eraPreference}`);

  if (profile.avoidArtists?.length) {
    parts.push(
      `NEVER suggest these (repeatedly skipped): ${profile.avoidArtists.join(', ')}`
    );
  }
  if (profile.sampleSize) {
    parts.push(`Based on ${profile.sampleSize} music tracks from their library`);
  }

  return `${parts.join('. ')}.`;
}

// --- Persistence ---

const PROFILE_KEY = 'moodradio_music_profile';

export function saveProfile(profile: UserMusicProfile) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadProfile(): UserMusicProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserMusicProfile;
    // Discard profiles written by the old, weaker model.
    if ((parsed.version ?? 1) < PROFILE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isProfileStale(profile: UserMusicProfile | null): boolean {
  if (!profile?.profiledAt) return true;
  const ageMs = Date.now() - new Date(profile.profiledAt).getTime();
  return ageMs > PROFILE_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

export function clearProfile() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PROFILE_KEY);
}
