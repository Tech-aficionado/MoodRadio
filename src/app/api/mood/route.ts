import { NextRequest, NextResponse } from 'next/server';
import { MoodAnalysis } from '@/types';
import {
  generateWithAi,
  AiProxyError,
  isAiConfigured,
} from '@/lib/ai-proxy';

/**
 * Mood analysis endpoint.
 *
 * Runs the user's text through the AI provider (server-side only — the provider
 * endpoint and credentials never reach the browser) and returns a structured
 * emotion plus specific song/artist search queries, which is what keeps YouTube
 * from serving podcasts and compilations.
 *
 * If the provider is unavailable the response still succeeds (HTTP 200) with a
 * keyword-scored fallback tagged `_source: 'fallback'`. Diagnostics are logged
 * server-side, not returned to the caller — see `degraded()`.
 */

const VALID_EMOTIONS = [
  'happy', 'sad', 'anxious', 'calm', 'excited', 'melancholy', 'nostalgic',
  'angry', 'peaceful', 'romantic', 'lonely', 'hopeful', 'frustrated',
  'energetic', 'grateful', 'reflective', 'inspired', 'heartbroken',
  'dreamy', 'euphoric',
];

function buildPrompt(text: string, userProfile?: string): string {
  const profileContext = userProfile
    ? `\n\nTHE USER'S TASTE PROFILE (built from their own YouTube library and in-app behaviour):\n${userProfile}\n
How to use it:
- Anchor at least 3 of the 5 keywords in artists/genres/languages they demonstrably listen to
- Use their preferred languages in roughly the proportion shown
- Respect their energy and era preference unless the mood text clearly overrides it
- Treat any "NEVER suggest" list as absolute — do not name those artists at all
- Do not simply echo their top artists back; include at least 1 adjacent artist they would plausibly discover and enjoy`
    : '';

  return `You are a music recommendation engine for MoodRadio. Analyse the user's emotional text and generate YouTube search queries that find ACTUAL SONGS (not podcasts, not vlogs, not ASMR, not meditation talks, not compilations).

CRITICAL RULES for search_keywords:
- Each keyword MUST be a search that finds a REAL, SPECIFIC song on YouTube
- Preferred format: "[Artist name] [Song name]"
- Otherwise: "[specific genre] [mood descriptor] song"
- ALWAYS include an artist name, or the word "song"/"audio"
- NEVER use bare generic terms like "sad music playlist" or "chill vibes"
- Generate exactly 5 keywords (more variety = better queue)
- Mix: 3 specific artist+song searches + 2 genre-based searches
- Indian audience: mix Hindi / Punjabi / English according to their profile
- Vary the artists — do not repeat the same artist twice
${profileContext}

Return ONLY valid JSON, no markdown fence:

{
  "primary_emotion": "one of: ${VALID_EMOTIONS.join(', ')}",
  "intensity": <1-10>,
  "energy_desire": "high|medium|low",
  "color_hex": "#hexcolor",
  "color_gradient": ["#start", "#end"],
  "search_keywords": ["artist song 1", "artist song 2", "artist song 3", "genre mood song 4", "genre descriptor audio 5"],
  "ambient_particles": "fast|medium|slow|none"
}

EXAMPLE for "I feel like dancing tonight":
{"primary_emotion":"euphoric","intensity":8,"energy_desire":"high","color_hex":"#FF6B35","color_gradient":["#FF6B35","#FFD700"],"search_keywords":["Dua Lipa Don't Start Now","The Weeknd Blinding Lights","Diljit Dosanjh Born To Shine","upbeat dance pop song","energetic EDM festival audio"],"ambient_particles":"fast"}

EXAMPLE for "feeling so alone at 3am":
{"primary_emotion":"lonely","intensity":6,"energy_desire":"low","color_hex":"#607D8B","color_gradient":["#607D8B","#37474F"],"search_keywords":["Arijit Singh Phir Le Aya Dil","The Weeknd Call Out My Name","Prateek Kuhad cold mess","late night emotional R&B song","melancholy indie audio"],"ambient_particles":"slow"}

User's text: "${text}"

Return ONLY the JSON object.`;
}

/** Coerce a raw AI object into a safe, fully-populated MoodAnalysis. */
function normalise(parsed: Record<string, unknown>): MoodAnalysis {
  const gradient = Array.isArray(parsed.color_gradient) ? parsed.color_gradient : [];
  const keywords = Array.isArray(parsed.search_keywords)
    ? parsed.search_keywords.map(String).map((k) => k.trim()).filter(Boolean)
    : [];

  const energy = String(parsed.energy_desire || 'medium');
  const particles = String(parsed.ambient_particles || 'medium');

  return {
    primary_emotion: String(parsed.primary_emotion || 'reflective').toLowerCase(),
    intensity: Math.min(10, Math.max(1, Number(parsed.intensity) || 5)),
    energy_desire: (['high', 'medium', 'low'].includes(energy)
      ? energy
      : 'medium') as MoodAnalysis['energy_desire'],
    color_hex: String(parsed.color_hex || '#78909C'),
    color_gradient:
      gradient.length === 2
        ? [String(gradient[0]), String(gradient[1])]
        : ['#78909C', '#37474F'],
    search_keywords: keywords.length
      ? keywords.slice(0, 5)
      : ['indie chill song', 'lo-fi hip hop song', 'ambient music audio'],
    ambient_particles: (['fast', 'medium', 'slow', 'none'].includes(particles)
      ? particles
      : 'medium') as MoodAnalysis['ambient_particles'],
  };
}

// --- Fallback -------------------------------------------------------------
//
// The old fallback used `lower.includes(keyword)` against 7 literal words, so
// "feeling drained after work" matched NOTHING and always returned the same
// default. This version scores every mood against a synonym set and picks the
// best match, so ordinary phrasing lands somewhere sensible.

interface FallbackMood {
  cues: string[];
  analysis: MoodAnalysis;
}

const FALLBACK_MOODS: Record<string, FallbackMood> = {
  sad: {
    cues: ['sad', 'down', 'blue', 'cry', 'crying', 'hurt', 'broken', 'heartbreak', 'miserable', 'depressed', 'low', 'upset', 'grief'],
    analysis: {
      primary_emotion: 'sad', intensity: 6, energy_desire: 'low',
      color_hex: '#4A90D9', color_gradient: ['#4A90D9', '#1a3a5c'],
      search_keywords: ['Arijit Singh Channa Mereya', 'Lewis Capaldi Someone You Loved', 'Billie Eilish when the party is over', 'sad hindi song audio', 'heartbreak indie song'],
      ambient_particles: 'slow',
    },
  },
  happy: {
    cues: ['happy', 'good', 'great', 'joy', 'joyful', 'smile', 'smiling', 'cheerful', 'sunny', 'grateful', 'blessed', 'won', 'celebrate'],
    analysis: {
      primary_emotion: 'happy', intensity: 7, energy_desire: 'high',
      color_hex: '#FFD700', color_gradient: ['#FFD700', '#FF6B35'],
      search_keywords: ['Pharrell Williams Happy', 'Dua Lipa Levitating', 'Diljit Dosanjh Lover', 'feel good pop song', 'upbeat bollywood song audio'],
      ambient_particles: 'fast',
    },
  },
  angry: {
    cues: ['angry', 'anger', 'rage', 'furious', 'mad', 'pissed', 'hate', 'annoyed', 'frustrated', 'irritated', 'fed up'],
    analysis: {
      primary_emotion: 'angry', intensity: 8, energy_desire: 'high',
      color_hex: '#E74C3C', color_gradient: ['#E74C3C', '#8B0000'],
      search_keywords: ['Eminem Lose Yourself', 'Linkin Park In The End', 'KR$NA Playing With Fire', 'aggressive rap song', 'intense hip hop audio'],
      ambient_particles: 'fast',
    },
  },
  calm: {
    cues: ['calm', 'peace', 'peaceful', 'relax', 'relaxed', 'chill', 'quiet', 'still', 'unwind', 'serene', 'rest', 'breathe'],
    analysis: {
      primary_emotion: 'calm', intensity: 3, energy_desire: 'low',
      color_hex: '#7ED6A0', color_gradient: ['#7ED6A0', '#2E8B57'],
      search_keywords: ['Prateek Kuhad Kasoor', 'Bon Iver Skinny Love', 'Novo Amor Anchor', 'calm acoustic guitar song', 'soft indie folk audio'],
      ambient_particles: 'slow',
    },
  },
  lonely: {
    cues: ['lonely', 'alone', 'empty', 'isolated', 'nobody', 'miss', 'missing', 'abandoned', 'distant', '3am'],
    analysis: {
      primary_emotion: 'lonely', intensity: 5, energy_desire: 'low',
      color_hex: '#607D8B', color_gradient: ['#607D8B', '#37474F'],
      search_keywords: ['The Weeknd Call Out My Name', 'Arijit Singh Phir Le Aya Dil', 'Cigarettes After Sex Apocalypse', 'late night lonely R&B song', 'midnight emotional audio'],
      ambient_particles: 'slow',
    },
  },
  energetic: {
    cues: ['energetic', 'energy', 'hype', 'pumped', 'workout', 'gym', 'run', 'running', 'dance', 'dancing', 'party', 'motivated', 'lets go'],
    analysis: {
      primary_emotion: 'energetic', intensity: 9, energy_desire: 'high',
      color_hex: '#FF6B35', color_gradient: ['#FF6B35', '#FFD700'],
      search_keywords: ['Diljit Dosanjh Born To Shine', 'The Weeknd Blinding Lights', 'AP Dhillon Excuses', 'workout EDM song', 'hype trap audio'],
      ambient_particles: 'fast',
    },
  },
  nostalgic: {
    cues: ['nostalgic', 'nostalgia', 'memories', 'remember', 'childhood', 'old days', 'throwback', 'past', 'used to', 'back then'],
    analysis: {
      primary_emotion: 'nostalgic', intensity: 5, energy_desire: 'medium',
      color_hex: '#D4A373', color_gradient: ['#D4A373', '#8B6914'],
      search_keywords: ['Arijit Singh Tum Hi Ho', 'Coldplay The Scientist', 'Arctic Monkeys 505', 'old bollywood song audio', 'nostalgic 90s hindi song'],
      ambient_particles: 'medium',
    },
  },
  anxious: {
    cues: ['anxious', 'anxiety', 'stress', 'stressed', 'worried', 'nervous', 'overwhelmed', 'panic', 'tense', 'pressure', 'exam', 'deadline'],
    analysis: {
      primary_emotion: 'anxious', intensity: 7, energy_desire: 'low',
      color_hex: '#9B59B6', color_gradient: ['#9B59B6', '#4A235A'],
      search_keywords: ['Radiohead No Surprises', 'Joji Slow Dancing in the Dark', 'Lauv Modern Loneliness', 'calming ambient piano song', 'slow lo-fi audio'],
      ambient_particles: 'slow',
    },
  },
  tired: {
    cues: ['tired', 'exhausted', 'drained', 'sleepy', 'burnt out', 'burnout', 'worn out', 'long day', 'no energy', 'spent'],
    analysis: {
      primary_emotion: 'reflective', intensity: 4, energy_desire: 'low',
      color_hex: '#78909C', color_gradient: ['#78909C', '#37474F'],
      search_keywords: ['Prateek Kuhad cold mess', 'Keshi beside you', 'Rex Orange County Best Friend', 'mellow bedroom pop song', 'soft lo-fi chill audio'],
      ambient_particles: 'slow',
    },
  },
  romantic: {
    cues: ['love', 'loved', 'crush', 'romantic', 'romance', 'date', 'her', 'him', 'butterflies', 'in love'],
    analysis: {
      primary_emotion: 'romantic', intensity: 6, energy_desire: 'medium',
      color_hex: '#E91E63', color_gradient: ['#E91E63', '#880E4F'],
      search_keywords: ['Arijit Singh Raabta', 'Ed Sheeran Perfect', 'Anuv Jain Husn', 'romantic hindi song audio', 'soft love song'],
      ambient_particles: 'medium',
    },
  },
};

const DEFAULT_FALLBACK: MoodAnalysis = {
  primary_emotion: 'reflective', intensity: 4, energy_desire: 'medium',
  color_hex: '#78909C', color_gradient: ['#78909C', '#37474F'],
  search_keywords: ['Tame Impala Let It Happen', 'Prateek Kuhad Kasoor', 'Steve Lacy Dark Red', 'indie chill song audio', 'lo-fi hip hop song'],
  ambient_particles: 'medium',
};

function fallbackAnalysis(text: string): MoodAnalysis {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')} `;

  let bestMood: MoodAnalysis = DEFAULT_FALLBACK;
  let bestScore = 0;

  for (const { cues, analysis } of Object.values(FALLBACK_MOODS)) {
    let score = 0;
    for (const cue of cues) {
      if (lower.includes(` ${cue} `) || lower.includes(` ${cue}`)) {
        // Longer cues are more specific, so weight them higher.
        score += cue.includes(' ') ? 3 : 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMood = analysis;
    }
  }

  return bestMood;
}

/**
 * Build the degraded-mode response body.
 *
 * SECURITY: the detailed reason is deliberately withheld in production. This
 * endpoint is reachable unauthenticated, so echoing upstream errors verbatim
 * disclosed the AI proxy's existence, its error vocabulary and its per-project
 * whitelist model to anyone who POSTed to it. Full detail still goes to the
 * server log, which is where an operator should be reading it from anyway.
 */
function degraded(text: string, reason: string) {
  const body: Record<string, unknown> = {
    ...fallbackAnalysis(text),
    _source: 'fallback',
  };
  if (process.env.NODE_ENV !== 'production') {
    body._reason = reason;
  }
  return NextResponse.json(body);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: unknown;
      userProfile?: unknown;
      idToken?: unknown;
    };

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const userProfile =
      typeof body.userProfile === 'string' && body.userProfile.trim()
        ? body.userProfile.trim()
        : undefined;
    const idToken = typeof body.idToken === 'string' ? body.idToken : null;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!isAiConfigured()) {
      console.error('[MOOD] AI backend is not configured');
      return degraded(text, 'NOT_CONFIGURED');
    }

    try {
      const raw = await generateWithAi(idToken, buildPrompt(text, userProfile), {
        maxOutputTokens: 700,
        temperature: 0.85,
      });

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new AiProxyError('EMPTY_RESPONSE', 'AI response contained no JSON');
      }

      const analysis = normalise(
        JSON.parse(jsonMatch[0]) as Record<string, unknown>
      );

      console.log(
        '[MOOD] AI ok —',
        analysis.primary_emotion,
        '| keywords:',
        analysis.search_keywords.join(' / ')
      );

      return NextResponse.json({ ...analysis, _source: 'ai' });
    } catch (err) {
      const code = err instanceof AiProxyError ? err.code : 'UNKNOWN';
      const message = err instanceof Error ? err.message : String(err);

      // Server-side only: keeps the operator's diagnostics without handing the
      // same detail to every caller.
      console.error(`[MOOD] AI unavailable [${code}]: ${message}`);

      return degraded(text, `${code}: ${message}`);
    }
  } catch (error) {
    console.error('[MOOD] Request error:', error);
    return NextResponse.json(
      { error: 'Failed to analyse mood' },
      { status: 500 }
    );
  }
}
