import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getEmotionColor } from '@/types';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface SharePageProps {
  params: Promise<{ id: string }>;
}

async function getMoodEntry(id: string) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('mood_entries')
    .select('*')
    .eq('public_id', id)
    .single();

  if (error || !data) return null;
  return data;
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { id } = await params;
  const entry = await getMoodEntry(id);

  if (!entry) {
    return { title: 'MoodRadio — Mood Not Found' };
  }

  const ogUrl = `/api/og?emotion=${encodeURIComponent(entry.emotion)}&text=${encodeURIComponent(entry.input_text)}&color=${encodeURIComponent(entry.color_hex || getEmotionColor(entry.emotion))}`;

  return {
    title: `Feeling ${entry.emotion} — MoodRadio`,
    description: entry.input_text,
    openGraph: {
      title: `Feeling ${entry.emotion} — MoodRadio`,
      description: entry.input_text,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Feeling ${entry.emotion} — MoodRadio`,
      description: entry.input_text,
      images: [ogUrl],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params;
  const entry = await getMoodEntry(id);

  if (!entry) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Mood Not Found</h1>
          <p className="text-white/50">This mood entry doesn&apos;t exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const color = entry.color_hex || getEmotionColor(entry.emotion);
  const gradient = entry.color_gradient || [color, `${color}80`];

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      {/* Background gradient */}
      <div
        className="fixed inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse at center, ${gradient[0]}40 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 max-w-md w-full">
        {/* Shareable card */}
        <div
          className="rounded-3xl p-8 backdrop-blur-xl border border-white/10 overflow-hidden relative"
          style={{
            background: `linear-gradient(135deg, ${gradient[0]}20 0%, ${gradient[1]}10 100%)`,
          }}
        >
          {/* Glow effect */}
          <div
            className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-30"
            style={{ backgroundColor: color }}
          />

          {/* Emotion badge */}
          <div className="mb-6">
            <span
              className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium capitalize"
              style={{
                backgroundColor: `${color}20`,
                color: color,
              }}
            >
              {entry.emotion}
            </span>
          </div>

          {/* Quote */}
          <blockquote className="text-xl font-light text-white/90 leading-relaxed mb-6">
            &ldquo;{entry.input_text}&rdquo;
          </blockquote>

          {/* Metadata */}
          <div className="flex items-center justify-between text-sm text-white/40">
            <span>
              {new Date(entry.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              Intensity {entry.intensity}/10
            </span>
          </div>

          {/* Watermark */}
          <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${color}, #ffffff)`,
              }}
            />
            <span className="text-xs text-white/30 font-medium tracking-wider">
              MOODRADIO
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white/70 text-sm hover:bg-white/15 transition-colors"
          >
            Try MoodRadio →
          </a>
        </div>
      </div>
    </div>
  );
}
