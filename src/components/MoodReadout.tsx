'use client';

import { motion } from 'framer-motion';
import type { MoodAnalysis } from '@/types';
import { KineticText } from '@/components/KineticText';
import { moodMotionVars } from '@/components/MoodAtmosphere';

/**
 * Displays the decoded emotion.
 *
 * Until now the analysis result was never shown as text anywhere: the only
 * expression of `mood` was a 3px colour strip and an accent colour, so the user
 * had no idea which feeling had been detected or how intensely. EmotionBadge
 * and MoodCard existed but the main screen imported neither.
 *
 * `color_hex` comes straight from the analysis rather than a
 * `--color-mood-<emotion>` CSS variable, because those variables only cover a
 * subset of the 20 emotions the model can return.
 */

interface MoodReadoutProps {
  mood: MoodAnalysis;
  /** chip = compact, always-visible; panel = full readout for the idle state. */
  variant?: 'chip' | 'panel';
  /** The text the user actually submitted, echoed back for context. */
  sourceText?: string;
}

/**
 * Guarantee the emotion colour is readable on the dark surface.
 *
 * `color_hex` comes straight from the model and is not contrast-checked, so a
 * dark value (deep blues and purples are common for melancholy, grief, fear)
 * rendered the emotion word nearly invisible — and the mood wash sitting behind
 * it does not help, because the wash is dark too at low intensity.
 *
 * Relative luminance per WCAG; anything below the floor is mixed toward white
 * until it clears it, which preserves the hue while lifting legibility.
 */
function readableOn(hex: string, floor = 0.32): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#FFFFFF';

  const int = parseInt(m[1], 16);
  let r = (int >> 16) & 255;
  let g = (int >> 8) & 255;
  let b = int & 255;

  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance = () =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  // Step toward white in small increments so the hue survives.
  let guard = 0;
  while (luminance() < floor && guard < 24) {
    r = Math.round(r + (255 - r) * 0.12);
    g = Math.round(g + (255 - g) * 0.12);
    b = Math.round(b + (255 - b) * 0.12);
    guard++;
  }

  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function IntensityMeter({
  intensity,
  color,
  compact = false,
}: {
  intensity: number;
  color: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-end gap-[2px]" aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.span
          key={i}
          className={`${compact ? 'w-[2px]' : 'w-[3px]'} ${i < intensity ? 'intensity-bar' : ''}`}
          style={{
            height: compact ? 8 : 10 + i * 1.6,
            backgroundColor: i < intensity ? color : '#333',
            animationDelay: `${i * 0.06}s`,
          }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: i * 0.03, duration: 0.25 }}
        />
      ))}
    </div>
  );
}

export function MoodReadout({
  mood,
  variant = 'panel',
  sourceText,
}: MoodReadoutProps) {
  const color = mood.color_hex || '#FFFFFF';
  const safeColor = readableOn(color);

  if (variant === 'chip') {
    return (
      <motion.div
        className="flex items-center gap-2 border border-[#333] bg-[#1A1A1A] px-2.5 py-1.5"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        title={
          sourceText
            ? `"${sourceText}" - ${mood.primary_emotion} ${mood.intensity}/10`
            : `${mood.primary_emotion} ${mood.intensity}/10`
        }
      >
        <span
          className="h-1.5 w-1.5 shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
          {mood.primary_emotion}
        </span>
        <IntensityMeter intensity={mood.intensity} color={color} compact />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="border-l-2 pl-5"
      style={{ borderColor: color, ...moodMotionVars(mood) }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/55">
        Emotion decoded
      </p>

      <KineticText
        text={mood.primary_emotion.toUpperCase()}
        className="mb-4 text-[clamp(36px,9vw,64px)]"
        style={{ color: safeColor, textShadow: `0 0 48px ${safeColor}44` }}
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[9px] uppercase tracking-[0.2em] text-white/55">
            Intensity
          </span>
          <IntensityMeter intensity={mood.intensity} color={safeColor} />
          <span className="text-[10px] font-bold tabular-nums text-white/75">
            {mood.intensity}/10
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[9px] uppercase tracking-[0.2em] text-white/55">
            Energy
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/80">
            {mood.energy_desire}
          </span>
        </div>
      </div>

      {sourceText && (
        <p className="max-w-sm text-sm italic leading-relaxed text-white/70">
          &ldquo;{sourceText}&rdquo;
        </p>
      )}
    </motion.div>
  );
}
