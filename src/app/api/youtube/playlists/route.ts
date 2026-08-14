import { NextRequest, NextResponse } from 'next/server';

export interface YouTubePlaylist {
  id: string;
  title: string;
  thumbnail: string;
  itemCount: number;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '').trim();

  if (!token) {
    return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      mine: 'true',
      maxResults: '25',
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ error: 'Token expired or insufficient scope' }, { status: 401 });
      }
      return NextResponse.json({ error: 'YouTube API failed' }, { status: response.status });
    }

    const data = await response.json();

    const playlists: YouTubePlaylist[] = (data.items || []).map((item: {
      id: string;
      snippet: {
        title: string;
        thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
      };
      contentDetails: { itemCount: number };
    }) => ({
      id: item.id,
      title: item.snippet.title,
      thumbnail:
        item.snippet.thumbnails?.high?.url ||
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url || '',
      itemCount: item.contentDetails?.itemCount || 0,
    }));

    return NextResponse.json(playlists);
  } catch (error) {
    console.error('Playlists error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
