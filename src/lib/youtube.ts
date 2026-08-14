import type { Track } from '@/types';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      high: { url: string };
      medium: { url: string };
      default: { url: string };
    };
  };
}

interface YouTubeVideoItem {
  id: string;
  contentDetails: {
    duration: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      high: { url: string };
      medium: { url: string };
      default: { url: string };
    };
  };
}

function parseDuration(isoDuration: string): string {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export async function searchTracks(query: string, maxResults: number = 15): Promise<Track[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    videoCategoryId: '10',
    maxResults: maxResults.toString(),
    key: apiKey,
  });

  const response = await fetch(`${YOUTUBE_API_BASE}/search?${params}`);
  if (!response.ok) {
    throw new Error(`YouTube search failed: ${response.statusText}`);
  }

  const data = await response.json();
  const items: YouTubeSearchItem[] = data.items || [];

  const videoIds = items.map((item) => item.id.videoId).join(',');
  if (!videoIds) return [];

  const detailsParams = new URLSearchParams({
    part: 'contentDetails',
    id: videoIds,
    key: apiKey,
  });

  const detailsResponse = await fetch(`${YOUTUBE_API_BASE}/videos?${detailsParams}`);
  const detailsData = await detailsResponse.json();
  const durationsMap = new Map<string, string>();

  for (const item of detailsData.items || []) {
    durationsMap.set(item.id, parseDuration(item.contentDetails.duration));
  }

  return items.map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default.url,
    duration: durationsMap.get(item.id.videoId) || '0:00',
  }));
}

export async function getVideoDetails(videoId: string): Promise<Track | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }

  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    id: videoId,
    key: apiKey,
  });

  const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`);
  if (!response.ok) {
    throw new Error(`YouTube video details failed: ${response.statusText}`);
  }

  const data = await response.json();
  const item: YouTubeVideoItem | undefined = data.items?.[0];

  if (!item) return null;

  return {
    videoId: item.id,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default.url,
    duration: parseDuration(item.contentDetails.duration),
  };
}
