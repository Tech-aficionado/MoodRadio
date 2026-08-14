import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const emotion = searchParams.get('emotion') || 'reflective';
  const text = searchParams.get('text') || 'Express your mood, discover your music';
  const color = searchParams.get('color') || '#8B5CF6';

  // Generate a second gradient color (darker shade)
  const darkerColor = darken(color, 0.4);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${color} 0%, ${darkerColor} 50%, #0a0a0a 100%)`,
          padding: '60px',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: '80px',
            right: '100px',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: `${color}30`,
            filter: 'blur(40px)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '100px',
            left: '80px',
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            background: `${color}20`,
            filter: 'blur(30px)',
            display: 'flex',
          }}
        />

        {/* Emotion label */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 28px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            marginBottom: '32px',
          }}
        >
          <span
            style={{
              fontSize: '22px',
              color: 'white',
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {emotion}
          </span>
        </div>

        {/* Quote text */}
        <div
          style={{
            display: 'flex',
            maxWidth: '900px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: text.length > 80 ? '28px' : '36px',
              color: 'rgba(255,255,255,0.9)',
              fontWeight: 300,
              lineHeight: 1.5,
              fontStyle: 'italic',
            }}
          >
            &ldquo;{text}&rdquo;
          </p>
        </div>

        {/* MoodRadio watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${color}, #ffffff)`,
              display: 'flex',
            }}
          />
          <span
            style={{
              fontSize: '20px',
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 500,
              letterSpacing: '0.5px',
            }}
          >
            MoodRadio
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

function darken(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.floor(((num >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.floor((num & 255) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
