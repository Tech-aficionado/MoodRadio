'use client';

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { MoodAnalysis } from '@/types';

/**
 * Full-screen emotional atmosphere.
 *
 * The mood used to be expressed only as a 3px accent strip, which left the app
 * looking composed but emotionally mute — the feeling IS the product. This
 * renders the detected emotion as the environment: a colour wash from the
 * analysis gradient, breathing at a rate driven by intensity, drifting at a
 * rate driven by `ambient_particles`.
 *
 * PERFORMANCE: React only computes a handful of CSS custom properties here, and
 * every animation runs in CSS off those values. There is no per-frame state, no
 * requestAnimationFrame loop and no particle DOM — deliberately, because PR #9
 * had to undo a re-render storm and #8 had to tone particles down. Only
 * transform/opacity animate, so the whole layer stays on the compositor.
 */

interface MoodAtmosphereProps {
  mood: MoodAnalysis | null;
  /** Dim the field while the user is typing so text stays legible. */
  subdued?: boolean;
  /**
   * Slowly cycle through emotion hues instead of showing the neutral idle
   * field. Used on the sign-in gate, where there is no mood yet — otherwise a
   * first-time visitor only ever sees a flat dark screen and never learns what
   * the app actually does.
   */
  showcase?: boolean;
}

/**
 * A spread of the emotional range rather than a rainbow: elation, melancholy,
 * calm, intimacy, anger. Ordered so neighbouring hues contrast as they blend.
 */
const SHOWCASE_HUES: Array<[string, string]> = [
  ['#FF6B35', '#7A2E12'], // euphoric / energetic
  ['#4A90D9', '#152A45'], // melancholy / sad
  ['#7ED6A0', '#1E4433'], // calm / peaceful
  ['#E91E63', '#4A0A23'], // romantic
  ['#E74C3C', '#3D0F0B'], // angry / intense
];

/** Total loop length. Each hue holds for roughly a fifth of it. */
const SHOWCASE_CYCLE_SECONDS = 48;

/** Higher intensity breathes faster and harder. */
function pulseDuration(intensity: number): number {
  // intensity 1 -> ~10s (barely there), 10 -> ~3.2s (urgent)
  const clamped = Math.min(10, Math.max(1, intensity));
  return 10.4 - clamped * 0.72;
}

function driftDuration(particles: MoodAnalysis['ambient_particles']): number {
  switch (particles) {
    case 'fast':
      return 12;
    case 'medium':
      return 20;
    case 'slow':
      return 32;
    default:
      return 44; // 'none' — near-static, but never fully frozen
  }
}

export function MoodAtmosphere({
  mood,
  subdued = false,
  showcase = false,
}: MoodAtmosphereProps) {
  const style = useMemo<CSSProperties>(() => {
    if (!mood) {
      // Idle: a slow neutral field, so the screen is never dead flat.
      return {
        ['--mood-c1' as string]: '#2E2E2E',
        ['--mood-c2' as string]: '#151515',
        ['--mood-alpha' as string]: '0.4',
        ['--mood-pulse-dur' as string]: '11s',
        ['--mood-drift-dur' as string]: '34s',
        ['--mood-stretch' as string]: '0.015',
      };
    }

    const [c1, c2] = mood.color_gradient?.length === 2
      ? mood.color_gradient
      : [mood.color_hex || '#3A3A3A', '#141414'];

    const intensity = Math.min(10, Math.max(1, mood.intensity));

    // Intense feelings saturate the room more, but stay under the ceiling that
    // keeps white body text readable.
    const alpha = subdued
      ? 0.22 + intensity * 0.012
      : 0.34 + intensity * 0.026;

    return {
      ['--mood-c1' as string]: c1,
      ['--mood-c2' as string]: c2,
      ['--mood-alpha' as string]: alpha.toFixed(3),
      ['--mood-pulse-dur' as string]: `${pulseDuration(intensity).toFixed(2)}s`,
      ['--mood-drift-dur' as string]: `${driftDuration(mood.ambient_particles)}s`,
      // Type stretch is subtle on purpose — enough to feel alive, not wobbly.
      ['--mood-stretch' as string]: (0.012 + intensity * 0.005).toFixed(4),
    };
  }, [mood, subdued]);

  // Showcase replaces the flat idle field with a slow tour of the emotional
  // range, so the gate demonstrates the product instead of hiding it.
  if (showcase && !mood) {
    return (
      <div className="atmosphere" style={style} aria-hidden="true">
        {SHOWCASE_HUES.map(([c1, c2], i) => (
          <div
            key={c1}
            className="atmosphere-cycle-layer"
            style={{
              ['--cycle-c1' as string]: c1,
              ['--cycle-c2' as string]: c2,
              // Higher than the in-app wash: the gate has no album art or
              // player chrome competing, and it needs to actually read as
              // colour rather than a dark tint.
              ['--cycle-alpha' as string]: '0.58',
              ['--cycle-dur' as string]: `${SHOWCASE_CYCLE_SECONDS}s`,
              animationDelay: `${(i * SHOWCASE_CYCLE_SECONDS) / SHOWCASE_HUES.length}s`,
            }}
          />
        ))}
        <div className="atmosphere-grain" />
        {/* Lighter vignette than the in-app one, which would flatten the hue. */}
        <div
          className="atmosphere-vignette"
          style={{
            background:
              'radial-gradient(ellipse at 50% 45%, transparent 42%, rgba(10,10,10,0.5) 92%, #0A0A0A 100%)',
          }}
        />
      </div>
    );
  }

  return (
    <div className="atmosphere" style={style} aria-hidden="true">
      <div className="atmosphere-wash" />
      <div className="atmosphere-drift" />
      <div className="atmosphere-grain" />
      <div className="atmosphere-vignette" />
    </div>
  );
}

/**
 * Exposes the same custom properties to non-background elements (hero type,
 * meters) so they breathe in sync with the atmosphere.
 */
export function moodMotionVars(mood: MoodAnalysis | null): CSSProperties {
  if (!mood) {
    return {
      ['--mood-pulse-dur' as string]: '11s',
      ['--mood-stretch' as string]: '0.015',
    };
  }
  const intensity = Math.min(10, Math.max(1, mood.intensity));
  return {
    ['--mood-pulse-dur' as string]: `${pulseDuration(intensity).toFixed(2)}s`,
    ['--mood-stretch' as string]: (0.012 + intensity * 0.005).toFixed(4),
  };
}
