'use client';

import type { CSSProperties } from 'react';

/**
 * Kinetic typography — the word is the interface.
 *
 * Letters rise into place on a stagger, and the whole word breathes vertically
 * at the mood's pulse rate (see .kinetic-word / .kinetic-letter in globals.css).
 * The stagger is expressed as per-letter `animation-delay` rather than JS
 * timers, so a long word costs nothing at runtime.
 */

interface KineticTextProps {
  text: string;
  className?: string;
  style?: CSSProperties;
  /** Seconds between each letter's entrance. */
  stagger?: number;
  /** Delay before the first letter, in seconds. */
  delay?: number;
}

export function KineticText({
  text,
  className = '',
  style,
  stagger = 0.035,
  delay = 0,
}: KineticTextProps) {
  const letters = Array.from(text);

  return (
    // `key` on the wrapper restarts the reveal whenever the word changes, which
    // is what makes one emotion visibly hand over to the next.
    <span key={text} className={`kinetic-word ${className}`} style={style}>
      {letters.map((char, i) => (
        <span
          key={`${char}-${i}`}
          className="kinetic-letter"
          style={{ animationDelay: `${delay + i * stagger}s` }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
}

/**
 * Long titles scroll instead of truncating. Short ones stay put — a marquee on
 * text that already fits reads as a glitch.
 */
export function MarqueeText({
  text,
  className = '',
  threshold = 28,
}: {
  text: string;
  className?: string;
  threshold?: number;
}) {
  if (text.length <= threshold) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={`marquee-viewport block ${className}`}>
      <span className="marquee-track">
        {text}
        <span className="px-8">·</span>
        {/* Duplicated so the -50% translate loops seamlessly. */}
        {text}
        <span className="px-8">·</span>
      </span>
    </span>
  );
}
