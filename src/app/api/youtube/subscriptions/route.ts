import { NextRequest, NextResponse } from 'next/server';

export interface YouTubeSubscription {
  channelId: string;
  title: string;
  thumbnail: string;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '').trim();

  if (!token) {
    return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      mine: 'true',
      maxResults: '50',
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/subscriptions?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ error: 'Token expired or insufficient scope' }, { status: 401 });
      }
      return NextResponse.json({ error: 'YouTube API failed' }, { status: response.status });
    }

    const data = await response.json();

    // Filter to music-related channels by title keywords
    const musicKeywords = ['music', 'songs', 'beats', 'records', 'audio', 'sound', 'lofi', 'chill', 'vevo', 'topic'];

    const subscriptions: YouTubeSubscription[] = (data.items || [])
      .map((item: {
        snippet: {
          resourceId: { channelId: string };
          title: string;
          thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
        };
      }) => ({
        channelId: item.snippet.resourceId.channelId,
        title: item.snippet.title,
        thumbnail:
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url || '',
      }))
      .filter((sub: YouTubeSubscription) =>
        musicKeywords.some((kw) => sub.title.toLowerCase().includes(kw))
      );

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('Subscriptions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
