import { NextRequest, NextResponse } from 'next/server';
import { MoodAnalysis } from '@/types';
import {
  generateWithAi,
  AiProxyError,
  isAiConfigured,
} from '@/lib/ai-proxy';
import {
  getEmotionColor,
  getEmotionGradient,
} from '@/lib/mood-palette';

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

function buildPrompt(
  text: string,
  userProfile?: string,
  recentArtists?: string[]
): string {
  const profileContext = userProfile
    ? `\n\n=== THE USER'S TASTE PROFILE (from their own YouTube library and in-app behaviour) ===
${userProfile}

This profile is a REQUIREMENT, not a hint:
- At least 3 of the 5 keywords MUST be artists or genres consistent with it
- Use their preferred languages in roughly the proportion shown
- Respect their energy and era preference unless the mood text clearly overrides it
- Any "NEVER suggest" list is absolute
- Include at least 1 adjacent artist they plausibly do NOT know yet, so the queue is not just a mirror`
    : '\n\n(No taste profile available — infer from the text alone.)';

  // The single biggest cause of repetition was worked examples naming real
  // artists: few-shot names dominate the output distribution, so the same
  // handful came back on nearly every request. The example below is now
  // structural only, and this list closes the loop across requests.
  const exclusions = recentArtists?.length
    ? `\n\n=== ALREADY HEARD RECENTLY — DO NOT SUGGEST ANY OF THESE ===
${recentArtists.slice(0, 25).join(', ')}

Pick different artists. If an excluded artist feels like the perfect fit, choose
a different artist in the same lane instead.`
    : '';

  return `You are a music recommendation engine for MoodRadio. Analyse the user's emotional text and generate YouTube search queries that find ACTUAL SONGS (not podcasts, not vlogs, not ASMR, not meditation talks, not compilations).

RULES for search_keywords:
- Each keyword MUST find a REAL, SPECIFIC song on YouTube
- Preferred format: "<Artist Name> <Song Title>"
- Otherwise: "<specific genre> <mood descriptor> song"
- ALWAYS include an artist name, or the word "song"/"audio"
- NEVER use bare generic terms like "sad music playlist" or "chill vibes"
- Produce exactly 5 keywords: 3 specific artist+song, 2 genre-based
- **All 5 must be DIFFERENT artists.** Never repeat an artist within a response
- Do NOT default to the single most famous artist in a genre. Prefer a deeper
  cut, or an artist one step sideways from the obvious pick
- Vary your choices between requests: if you would normally reach for a
  particular household name, choose a different one this time${profileContext}${exclusions}

Return ONLY valid JSON, no markdown fence, in exactly this shape:

{
  "primary_emotion": "one of: ${VALID_EMOTIONS.join(', ')}",
  "intensity": <1-10>,
  "energy_desire": "high|medium|low",
  "color_hex": "#hexcolor",
  "color_gradient": ["#start", "#end"],
  "search_keywords": [
    "<Artist A> <Song Title>",
    "<Artist B> <Song Title>",
    "<Artist C> <Song Title>",
    "<genre> <mood> song",
    "<genre descriptor> audio"
  ],
  "ambient_particles": "fast|medium|slow|none"
}

The bracketed placeholders above are FORMAT ILLUSTRATIONS. Do not output them
literally, and do not treat any artist named anywhere in this prompt as a
suggestion — choose artists that fit this specific user and this specific mood.

Ensure color_hex is bright enough to read as text on a near-black background.

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

  const emotion = String(parsed.primary_emotion || 'reflective').toLowerCase();

  // Validate gradient: must be exactly 2 hex strings (#RRGGBB or #RGB).
  const isValidHex = (v: unknown): v is string =>
    typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
  const validGradient =
    gradient.length === 2 && isValidHex(gradient[0]) && isValidHex(gradient[1]);

  return {
    primary_emotion: emotion,
    intensity: Math.min(10, Math.max(1, Number(parsed.intensity) || 5)),
    energy_desire: (['high', 'medium', 'low'].includes(energy)
      ? energy
      : 'medium') as MoodAnalysis['energy_desire'],
    color_hex: String(parsed.color_hex || getEmotionColor(emotion)),
    color_gradient: validGradient
      ? [String(gradient[0]), String(gradient[1])]
      : getEmotionGradient(emotion),
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
      color_hex: getEmotionColor('sad'), color_gradient: getEmotionGradient('sad'),
      search_keywords: ['Arijit Singh Channa Mereya', 'Lewis Capaldi Someone You Loved', 'Billie Eilish when the party is over', 'sad hindi song audio', 'heartbreak indie song'],
      ambient_particles: 'slow',
    },
  },
  happy: {
    cues: ['happy', 'good', 'great', 'joy', 'joyful', 'smile', 'smiling', 'cheerful', 'sunny', 'grateful', 'blessed', 'won', 'celebrate'],
    analysis: {
      primary_emotion: 'happy', intensity: 7, energy_desire: 'high',
      color_hex: getEmotionColor('happy'), color_gradient: getEmotionGradient('happy'),
      search_keywords: ['Pharrell Williams Happy', 'Dua Lipa Levitating', 'Diljit Dosanjh Lover', 'feel good pop song', 'upbeat bollywood song audio'],
      ambient_particles: 'fast',
    },
  },
  angry: {
    cues: ['angry', 'anger', 'rage', 'furious', 'mad', 'pissed', 'hate', 'annoyed', 'frustrated', 'irritated', 'fed up'],
    analysis: {
      primary_emotion: 'angry', intensity: 8, energy_desire: 'high',
      color_hex: getEmotionColor('angry'), color_gradient: getEmotionGradient('angry'),
      search_keywords: ['Eminem Lose Yourself', 'Linkin Park In The End', 'KR$NA Playing With Fire', 'aggressive rap song', 'intense hip hop audio'],
      ambient_particles: 'fast',
    },
  },
  calm: {
    cues: ['calm', 'peace', 'peaceful', 'relax', 'relaxed', 'chill', 'quiet', 'still', 'unwind', 'serene', 'rest', 'breathe'],
    analysis: {
      primary_emotion: 'calm', intensity: 3, energy_desire: 'low',
      color_hex: getEmotionColor('calm'), color_gradient: getEmotionGradient('calm'),
      search_keywords: ['Prateek Kuhad Kasoor', 'Bon Iver Skinny Love', 'Novo Amor Anchor', 'calm acoustic guitar song', 'soft indie folk audio'],
      ambient_particles: 'slow',
    },
  },
  lonely: {
    cues: ['lonely', 'alone', 'empty', 'isolated', 'nobody', 'miss', 'missing', 'abandoned', 'distant', '3am'],
    analysis: {
      primary_emotion: 'lonely', intensity: 5, energy_desire: 'low',
      color_hex: getEmotionColor('lonely'), color_gradient: getEmotionGradient('lonely'),
      search_keywords: ['The Weeknd Call Out My Name', 'Arijit Singh Phir Le Aya Dil', 'Cigarettes After Sex Apocalypse', 'late night lonely R&B song', 'midnight emotional audio'],
      ambient_particles: 'slow',
    },
  },
  energetic: {
    cues: ['energetic', 'energy', 'hype', 'pumped', 'workout', 'gym', 'run', 'running', 'dance', 'dancing', 'party', 'motivated', 'lets go'],
    analysis: {
      primary_emotion: 'energetic', intensity: 9, energy_desire: 'high',
      color_hex: getEmotionColor('energetic'), color_gradient: getEmotionGradient('energetic'),
      search_keywords: ['Diljit Dosanjh Born To Shine', 'The Weeknd Blinding Lights', 'AP Dhillon Excuses', 'workout EDM song', 'hype trap audio'],
      ambient_particles: 'fast',
    },
  },
  nostalgic: {
    cues: ['nostalgic', 'nostalgia', 'memories', 'remember', 'childhood', 'old days', 'throwback', 'past', 'used to', 'back then'],
    analysis: {
      primary_emotion: 'nostalgic', intensity: 5, energy_desire: 'medium',
      color_hex: getEmotionColor('nostalgic'), color_gradient: getEmotionGradient('nostalgic'),
      search_keywords: ['Arijit Singh Tum Hi Ho', 'Coldplay The Scientist', 'Arctic Monkeys 505', 'old bollywood song audio', 'nostalgic 90s hindi song'],
      ambient_particles: 'medium',
    },
  },
  anxious: {
    cues: ['anxious', 'anxiety', 'stress', 'stressed', 'worried', 'nervous', 'overwhelmed', 'panic', 'tense', 'pressure', 'exam', 'deadline'],
    analysis: {
      primary_emotion: 'anxious', intensity: 7, energy_desire: 'low',
      color_hex: getEmotionColor('anxious'), color_gradient: getEmotionGradient('anxious'),
      search_keywords: ['Radiohead No Surprises', 'Joji Slow Dancing in the Dark', 'Lauv Modern Loneliness', 'calming ambient piano song', 'slow lo-fi audio'],
      ambient_particles: 'slow',
    },
  },
  tired: {
    cues: ['tired', 'exhausted', 'drained', 'sleepy', 'burnt out', 'burnout', 'worn out', 'long day', 'no energy', 'spent'],
    analysis: {
      primary_emotion: 'reflective', intensity: 4, energy_desire: 'low',
      color_hex: getEmotionColor('reflective'), color_gradient: getEmotionGradient('reflective'),
      search_keywords: ['Prateek Kuhad cold mess', 'Keshi beside you', 'Rex Orange County Best Friend', 'mellow bedroom pop song', 'soft lo-fi chill audio'],
      ambient_particles: 'slow',
    },
  },
  romantic: {
    cues: ['love', 'loved', 'crush', 'romantic', 'romance', 'date', 'her', 'him', 'butterflies', 'in love'],
    analysis: {
      primary_emotion: 'romantic', intensity: 6, energy_desire: 'medium',
      color_hex: getEmotionColor('romantic'), color_gradient: getEmotionGradient('romantic'),
      search_keywords: ['Arijit Singh Raabta', 'Ed Sheeran Perfect', 'Anuv Jain Husn', 'romantic hindi song audio', 'soft love song'],
      ambient_particles: 'medium',
    },
  },
};

const DEFAULT_FALLBACK: MoodAnalysis = {
  primary_emotion: 'reflective', intensity: 4, energy_desire: 'medium',
  color_hex: getEmotionColor('reflective'), color_gradient: getEmotionGradient('reflective'),
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
      recentArtists?: unknown;
    };

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const userProfile =
      typeof body.userProfile === 'string' && body.userProfile.trim()
        ? body.userProfile.trim()
        : undefined;
    const idToken = typeof body.idToken === 'string' ? body.idToken : null;
    const recentArtists = Array.isArray(body.recentArtists)
      ? body.recentArtists.map(String).filter(Boolean).slice(0, 25)
      : [];

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // "It ignores my taste profile" is usually the profile never arriving at
    // all, which was previously invisible. Make it observable.
    console.log(
      `[MOOD] profile=${userProfile ? `applied (${userProfile.length} chars)` : 'ABSENT'} history=${recentArtists.length} artist(s)`
    );

    if (!isAiConfigured()) {
      console.error('[MOOD] AI backend is not configured');
      return degraded(text, 'NOT_CONFIGURED');
    }

    try {
      const raw = await generateWithAi(
        idToken,
        buildPrompt(text, userProfile, recentArtists),
        {
          maxOutputTokens: 700,
          // Slightly hotter than before: at 0.85 the model kept converging on
          // the same handful of household names across requests.
          temperature: 0.95,
        }
      );

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new AiProxyError('EMPTY_RESPONSE', 'AI response contained no JSON');
      }

      const analysis = normalise(
        JSON.parse(jsonMatch[0]) as Record<string, unknown>
      );

      // Belt and braces: the prompt asks for 5 distinct artists, but a model
      // will still occasionally repeat one. Drop duplicates by leading artist
      // token so the queue does not end up dominated by a single name.
      const seenArtist = new Set<string>();
      const deduped = analysis.search_keywords.filter((k) => {
        const lead = k.toLowerCase().split(/\s+/).slice(0, 2).join(' ');
        if (seenArtist.has(lead)) return false;
        seenArtist.add(lead);
        return true;
      });
      if (deduped.length >= 3) {
        analysis.search_keywords = deduped;
      }

      console.log(
        '[MOOD] AI ok —',
        analysis.primary_emotion,
        '| keywords:',
        analysis.search_keywords.join(' / ')
      );

      return NextResponse.json({
        ...analysis,
        _source: 'ai',
        _profileApplied: !!userProfile,
      });
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
