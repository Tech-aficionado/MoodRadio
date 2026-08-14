import { NextRequest, NextResponse } from 'next/server';
import type { TasteHarvest, TasteSignal } from '@/types/taste';

/**
 * Aggregated YouTube taste ingestion.
 *
 * Replaces the old approach, which had three problems:
 *
 *  1. It fed EVERY liked video into the profile with no music filter, so liked
 *     tech talks, memes and vlogs polluted the taste model. We now enrich each
 *     video via videos.list and keep only categoryId "10" (Music).
 *
 *  2. It passed /api/youtube/playlists (which returns playlist METADATA, not
 *     tracks) straight into the profiler as if it were Track[]. Those objects
 *     have no `artist`, so profile building threw and was swallowed — meaning
 *     no profile was ever saved. We now resolve playlists to their actual items.
 *
 *  3. Subscriptions were fetched by an endpoint nobody called. Followed
 *     channels are a strong taste signal and are now included.
 *
 * It also uses YouTube's own `topicDetails.topicCategories` and uploader `tags`
 * instead of guessing genre from title substrings.
 *
 * QUOTA: playlistItems/playlists/subscriptions/videos .list cost 1 unit each
 * (search costs 100), so fetching a few hundred items is cheap.
 */

const YT = 'https://www.googleapis.com/youtube/v3';

const MAX_LIKED = 200;
const MAX_PLAYLISTS = 8;
const MAX_ITEMS_PER_PLAYLIST = 50;
const PAGE_SIZE = 50;

interface PlaylistItemsResponse {
  items?: Array<{
    snippet?: {
      title?: string;
      videoOwnerChannelTitle?: string;
      videoOwnerChannelId?: string;
      publishedAt?: string;
      resourceId?: { videoId?: string };
    };
  }>;
  nextPageToken?: string;
}

interface VideosResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      channelId?: string;
      categoryId?: string;
      tags?: string[];
      publishedAt?: string;
    };
    contentDetails?: { duration?: string };
    topicDetails?: { topicCategories?: string[] };
  }>;
}

function cleanChannel(name: string): string {
  return name.replace(/ - Topic$/, '').replace(/VEVO$/i, '').trim();
}

/** PT4M13S -> 253 */
function parseDuration(iso?: string): number | undefined {
  if (!iso) return undefined;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return undefined;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

/** https://en.wikipedia.org/wiki/Hip_hop_music -> Hip_hop_music */
function topicName(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1] || url;
}

async function ytGet<T>(
  path: string,
  params: URLSearchParams,
  token: string
): Promise<T | null> {
  const res = await fetch(`${YT}/${path}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    console.warn(`[TASTE] ${path} failed: ${res.status}`);
    return null;
  }
  return (await res.json()) as T;
}

/** Walk a playlist, following nextPageToken up to `limit` items. */
async function fetchPlaylistItems(
  playlistId: string,
  limit: number,
  token: string
): Promise<Array<{ videoId: string; title: string; artist: string; channelId?: string; publishedAt?: string }>> {
  const out: Array<{ videoId: string; title: string; artist: string; channelId?: string; publishedAt?: string }> = [];
  let pageToken: string | undefined;

  while (out.length < limit) {
    const params = new URLSearchParams({
      part: 'snippet',
      playlistId,
      maxResults: String(Math.min(PAGE_SIZE, limit - out.length)),
    });
    if (pageToken) params.set('pageToken', pageToken);

    const data = await ytGet<PlaylistItemsResponse>('playlistItems', params, token);
    if (!data?.items?.length) break;

    for (const item of data.items) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (!videoId) continue;
      out.push({
        videoId,
        title: item.snippet?.title || '',
        artist: cleanChannel(item.snippet?.videoOwnerChannelTitle || ''),
        channelId: item.snippet?.videoOwnerChannelId,
        publishedAt: item.snippet?.publishedAt,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return out;
}

/** Enrich video ids with category, tags, topics and duration (batches of 50). */
async function enrich(
  videoIds: string[],
  token: string
): Promise<Map<string, {
  categoryId?: string;
  tags?: string[];
  topics?: string[];
  durationSec?: number;
  title?: string;
  artist?: string;
  channelId?: string;
  publishedAt?: string;
}>> {
  const map = new Map<string, {
    categoryId?: string;
    tags?: string[];
    topics?: string[];
    durationSec?: number;
    title?: string;
    artist?: string;
    channelId?: string;
    publishedAt?: string;
  }>();

  for (let i = 0; i < videoIds.length; i += PAGE_SIZE) {
    const batch = videoIds.slice(i, i + PAGE_SIZE);
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,topicDetails',
      id: batch.join(','),
      maxResults: String(PAGE_SIZE),
    });

    const data = await ytGet<VideosResponse>('videos', params, token);
    if (!data?.items) continue;

    for (const item of data.items) {
      map.set(item.id, {
        categoryId: item.snippet?.categoryId,
        tags: item.snippet?.tags?.slice(0, 15),
        topics: item.topicDetails?.topicCategories?.map(topicName),
        durationSec: parseDuration(item.contentDetails?.duration),
        title: item.snippet?.title,
        artist: item.snippet?.channelTitle
          ? cleanChannel(item.snippet.channelTitle)
          : undefined,
        channelId: item.snippet?.channelId,
        publishedAt: item.snippet?.publishedAt,
      });
    }
  }

  return map;
}

export async function GET(request: NextRequest) {
  const token = request.headers
    .get('Authorization')
    ?.replace('Bearer ', '')
    .trim();

  if (!token) {
    return NextResponse.json(
      { error: 'Authorization required' },
      { status: 401 }
    );
  }

  try {
    // --- 1. Gather candidate videos from likes and playlists, in parallel ---
    const [liked, playlistsData, subsData] = await Promise.all([
      fetchPlaylistItems('LL', MAX_LIKED, token),
      ytGet<{ items?: Array<{ id: string; contentDetails?: { itemCount?: number } }> }>(
        'playlists',
        new URLSearchParams({
          part: 'snippet,contentDetails',
          mine: 'true',
          maxResults: '25',
        }),
        token
      ),
      ytGet<{ items?: Array<{ snippet?: { title?: string; resourceId?: { channelId?: string } } }> }>(
        'subscriptions',
        new URLSearchParams({ part: 'snippet', mine: 'true', maxResults: '50' }),
        token
      ),
    ]);

    // Largest playlists first — they carry the most taste evidence.
    const playlistIds = (playlistsData?.items || [])
      .sort(
        (a, b) => (b.contentDetails?.itemCount || 0) - (a.contentDetails?.itemCount || 0)
      )
      .slice(0, MAX_PLAYLISTS)
      .map((p) => p.id);

    const playlistBatches = await Promise.all(
      playlistIds.map((id) =>
        fetchPlaylistItems(id, MAX_ITEMS_PER_PLAYLIST, token)
      )
    );
    const playlistItems = playlistBatches.flat();

    // --- 2. Deduplicate, remembering the strongest source per video ---
    // An explicit like outranks mere playlist membership.
    const bySource = new Map<string, 'liked' | 'playlist'>();
    for (const item of playlistItems) bySource.set(item.videoId, 'playlist');
    for (const item of liked) bySource.set(item.videoId, 'liked');

    const baseById = new Map<string, (typeof liked)[number]>();
    for (const item of [...playlistItems, ...liked]) {
      baseById.set(item.videoId, item);
    }

    const allIds = [...bySource.keys()];

    // --- 3. Enrich, then keep only real music ---
    const enrichment = await enrich(allIds, token);

    const signals: TasteSignal[] = [];
    let nonMusicDropped = 0;

    for (const videoId of allIds) {
      const base = baseById.get(videoId);
      const extra = enrichment.get(videoId);

      // Unenriched videos are usually private/deleted — drop rather than guess.
      if (!extra) {
        nonMusicDropped++;
        continue;
      }
      // THE key filter: category 10 is Music. This is what keeps liked tech
      // talks and memes out of the taste model.
      if (extra.categoryId !== '10') {
        nonMusicDropped++;
        continue;
      }

      signals.push({
        videoId,
        title: extra.title || base?.title || '',
        artist: extra.artist || base?.artist || '',
        channelId: extra.channelId || base?.channelId,
        tags: extra.tags,
        topics: extra.topics,
        categoryId: extra.categoryId,
        durationSec: extra.durationSec,
        publishedAt: extra.publishedAt || base?.publishedAt,
        source: bySource.get(videoId) || 'playlist',
      });
    }

    const followedChannels = (subsData?.items || [])
      .map((s) => cleanChannel(s.snippet?.title || ''))
      .filter(Boolean);

    const harvest: TasteHarvest = {
      signals,
      followedChannels,
      stats: {
        likedFetched: liked.length,
        playlistItemsFetched: playlistItems.length,
        subscriptions: followedChannels.length,
        musicKept: signals.length,
        nonMusicDropped,
        enriched: enrichment.size,
      },
    };

    console.log('[TASTE] harvest', harvest.stats);
    return NextResponse.json(harvest);
  } catch (error) {
    console.error('[TASTE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to harvest taste data' },
      { status: 500 }
    );
  }
}
