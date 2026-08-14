import { NextRequest, NextResponse } from 'next/server';
import { Track } from '@/types';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '').trim();

  if (!token) {
    return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
  }

  const maxResults = Math.min(
    Number(request.nextUrl.searchParams.get('maxResults')) || 20,
    50
  );

  try {
    // Fetch user's liked videos (playlist ID "LL" = Liked Videos)
    const params = new URLSearchParams({
      part: 'snippet',
      playlistId: 'LL',
      maxResults: String(maxResults),
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ error: 'Token expired or insufficient scope' }, { status: 401 });
      }
      return NextResponse.json({ error: 'YouTube API failed' }, { status: response.status });
    }

    const data = await response.json();

    // Filter to music-related videos by checking category or just return all liked
    const tracks: Track[] = (data.items || [])
      .filter((item: { snippet: { resourceId: { videoId: string } } }) => item.snippet.resourceId?.videoId)
      .map((item: {
        snippet: {
          title: string;
          videoOwnerChannelTitle?: string;
          resourceId: { videoId: string };
          thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
        };
      }) => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        artist: (item.snippet.videoOwnerChannelTitle || '').replace(/ - Topic$/, ''),
        thumbnail:
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${item.snippet.resourceId.videoId}/hqdefault.jpg`,
      }));

    return NextResponse.json(tracks);
  } catch (error) {
    console.error('Liked videos error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
