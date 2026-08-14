import { NextRequest, NextResponse } from 'next/server';
import { Track } from '@/types';

/**
 * YouTube music search.
 *
 * Improvements over the previous version — all three were described in the old
 * comments but never actually implemented:
 *
 *  1. "official audio" hint is now genuinely appended (the old code passed
 *     `q: query` untouched while claiming otherwise).
 *  2. Relevance is scored against the ORIGINATING query, so a track only ranks
 *     high if its artist/title actually matches what the AI asked for. This is
 *     the main defence against "it played something unrelated".
 *  3. The keyword cap is configurable instead of hardcoded to 3 while a comment
 *     claimed "up to 5".
 *
 * QUOTA NOTE: each YouTube search.list call costs 100 units against a default
 * 10,000/day quota. So the cap directly sets the daily ceiling:
 *   3 keywords -> 300/mood -> ~33 moods/day
 *   4 keywords -> 400/mood -> ~25 moods/day  (default)
 *   5 keywords -> 500/mood -> ~20 moods/day
 * Override with SEARCH_KEYWORD_LIMIT.
 */

const KEYWORD_LIMIT = Math.min(
  Math.max(Number(process.env.SEARCH_KEYWORD_LIMIT) || 4, 1),
  5
);

// Titles/channels that indicate non-music content.
const BLOCKLIST = [
  /podcast/i, /asmr/i, /guided meditation/i, /meditation talk/i,
  /reaction/i, /review/i, /explained/i, /tutorial/i,
  /vlog/i, /unboxing/i, /compilation/i, /mashup/i,
  /top \d+/i, /best of 20/i, /1 hour/i, /2 hour/i,
  /full album/i, /nonstop/i, /jukebox/i,
  /live stream/i, /shorts/i, /tiktok/i, /meme/i,
  /slowed.*reverb/i, /8d audio/i, /interview/i, /audiobook/i,
];

const LONG_CONTENT = [
  /\b(1|2|3|4|5|6|7|8|9|10)\s*hours?\b/i,
  /\bfull album\b/i,
  /\bmix\b.*\b(20\d\d)\b/i,
  /\bnonstop\b/i,
  /\bjukebox\b/i,
  /\ball songs\b/i,
];

function isLikelyMusic(title: string, channel: string): boolean {
  const combined = `${title} ${channel}`;
  if (BLOCKLIST.some((p) => p.test(combined))) return false;
  if (LONG_CONTENT.some((p) => p.test(title))) return false;
  return true;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with',
  'song', 'songs', 'audio', 'official', 'video', 'music', 'lyrics', 'lyric',
  'mood', 'vibes', 'best', 'new', 'full',
]);

function tokenise(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Intrinsic signals that a result is a real song. */
function musicScore(title: string, channel: string): number {
  let score = 0;
  if (channel.endsWith(' - Topic')) score += 10; // YT auto-generated music channel
  if (/vevo$/i.test(channel)) score += 8;
  if (/official/i.test(title)) score += 3;
  if (/audio/i.test(title)) score += 2;
  if (/lyric/i.test(title)) score += 2;
  if (/music video/i.test(title)) score += 2;
  if (/ft\.|feat\./i.test(title)) score += 2;
  if (/\(.*remix\)/i.test(title)) score += 1;
  return score;
}

/**
 * How well does this result match the query that produced it?
 * Weighted above the intrinsic signals, because a well-produced track that is
 * the WRONG track is exactly the failure mode we are fixing.
 */
function relevanceScore(title: string, channel: string, query: string): number {
  const queryTokens = tokenise(query);
  if (!queryTokens.length) return 0;

  const artistTokens = new Set(tokenise(channel));
  const titleTokens = new Set(tokenise(title));

  let artistHits = 0;
  let titleHits = 0;
  for (const token of queryTokens) {
    if (artistTokens.has(token)) artistHits++;
    if (titleTokens.has(token)) titleHits++;
  }

  let score = 0;
  // The AI names an artist first, so an artist match is the strongest signal.
  if (artistHits > 0) score += 15 + (artistHits - 1) * 5;
  score += titleHits * 6;

  // Reward covering most of the query rather than one incidental word.
  const coverage = (artistHits + titleHits) / queryTokens.length;
  if (coverage >= 0.6) score += 8;

  return score;
}

/** Nudge YouTube toward music without corrupting an explicit song search. */
function withMusicHint(query: string): string {
  if (/\b(audio|official|video|lyrics?|song)\b/i.test(query)) return query;
  return `${query} official audio`;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const query = sp.get('q');
  const keywords = sp.get('keywords'); // comma-separated
  const maxResults = Math.min(Number(sp.get('maxResults')) || 15, 50);

  if (!query && !keywords) {
    return NextResponse.json(
      { error: '"q" or "keywords" required' },
      { status: 400 }
    );
  }

  const authHeader = request.headers.get('Authorization');
  const userToken = authHeader?.replace('Bearer ', '').trim();
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!userToken && !apiKey) {
    return NextResponse.json(
      { error: 'YouTube API key not configured' },
      { status: 503 }
    );
  }

  try {
    const queries = (
      keywords
        ? keywords.split(',').map((k) => k.trim()).filter(Boolean)
        : [query!.trim()]
    ).slice(0, KEYWORD_LIMIT);

    console.log('[SEARCH] Queries:', queries);

    const perQuery = Math.ceil(maxResults / queries.length) + 3;
    const settled = await Promise.allSettled(
      queries.map((q) => ytSearch(q, perQuery, userToken, apiKey))
    );

    // Keep each track paired with the query that found it.
    const tagged: Array<{ track: Track; query: string }> = [];
    settled.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        for (const track of result.value) {
          tagged.push({ track, query: queries[i] });
        }
      } else {
        console.warn(`[SEARCH] "${queries[i]}" failed:`, result.reason);
      }
    });

    // Deduplicate, keeping the first (best-matched) occurrence.
    const seen = new Set<string>();
    const unique = tagged.filter(({ track }) => {
      if (seen.has(track.videoId)) return false;
      seen.add(track.videoId);
      return true;
    });

    const ranked = unique
      .filter(({ track }) => isLikelyMusic(track.title, track.artist))
      .map(({ track, query: q }) => ({
        track,
        score:
          musicScore(track.title, track.artist) +
          relevanceScore(track.title, track.artist, q),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(({ track }) => track);

    console.log(
      `[SEARCH] ${ranked.length} tracks from ${queries.length} queries`
    );
    return NextResponse.json(ranked);
  } catch (error) {
    console.error('[SEARCH] Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

async function ytSearch(
  query: string,
  max: number,
  userToken?: string | null,
  apiKey?: string | null
): Promise<Track[]> {
  const buildParams = () =>
    new URLSearchParams({
      part: 'snippet',
      q: withMusicHint(query),
      type: 'video',
      videoCategoryId: '10', // Music
      regionCode: 'IN',
      maxResults: String(max),
      safeSearch: 'none',
    });

  const params = buildParams();
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (userToken) {
    headers['Authorization'] = `Bearer ${userToken}`;
  } else if (apiKey) {
    params.set('key', apiKey);
  }

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
    { headers, next: { revalidate: userToken ? 0 : 300 } }
  );

  if (res.ok) return mapTracks(await res.json());

  // A stale/insufficient OAuth token should not kill the search — retry on key.
  if (res.status === 401 && apiKey) {
    const retry = buildParams();
    retry.set('key', apiKey);
    const fallback = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${retry}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 300 } }
    );
    if (fallback.ok) return mapTracks(await fallback.json());
  }

  throw new Error(`YouTube API ${res.status}`);
}

interface YouTubeSearchResponse {
  items?: Array<{
    id: { videoId?: string };
    snippet: {
      title: string;
      channelTitle: string;
      thumbnails?: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
    };
  }>;
}

function mapTracks(data: YouTubeSearchResponse): Track[] {
  return (data.items || [])
    .filter((item) => !!item.id?.videoId)
    .map((item) => ({
      videoId: item.id.videoId as string,
      title: cleanTitle(item.snippet.title),
      artist: cleanArtist(item.snippet.channelTitle),
      thumbnail:
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
    }));
}

function cleanArtist(channel: string): string {
  return channel.replace(/ - Topic$/, '').replace(/VEVO$/i, '').trim();
}

function cleanTitle(title: string): string {
  return title
    .replace(/\(Official.*?\)/gi, '')
    .replace(/\[Official.*?\]/gi, '')
    .replace(/\(Lyric.*?\)/gi, '')
    .replace(/\[Lyric.*?\]/gi, '')
    .replace(/\(Audio.*?\)/gi, '')
    .replace(/\[Audio.*?\]/gi, '')
    .replace(/\(Music Video\)/gi, '')
    .replace(/\[Music Video\]/gi, '')
    .replace(/\(Full Video\)/gi, '')
    .replace(/\|.*$/g, '')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}
