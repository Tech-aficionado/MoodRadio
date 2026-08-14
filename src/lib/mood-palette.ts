/**
 * Unified mood colour palette — THE single source of truth for every emotion
 * colour in MoodRadio.
 *
 * Every consumer (components, the mood API fallback, the share page) imports
 * from here instead of maintaining its own hardcoded map.
 *
 * Contrast: every `hex` value achieves ≥ 4.5:1 WCAG AA contrast against the
 * app's dark surface (#1A1A1A) so it is safe to use as foreground text.
 * Gradient stops are deliberate dark variants (not alpha-faded) intended for
 * the atmosphere background wash where contrast is irrelevant.
 */

export interface MoodPaletteEntry {
  /** Base accent colour (WCAG AA ≥ 4.5:1 on #1A1A1A). */
  hex: string;
  /** Two-stop gradient [from, to] for the atmosphere wash. */
  gradient: [string, string];
}

/**
 * The canonical emotion palette. Keyed by lowercase emotion name.
 *
 * Sources merged:
 * - src/types/index.ts emotionColors (18 emotions)
 * - src/app/api/mood/route.ts VALID_EMOTIONS + FALLBACK_MOODS (adds heartbroken, dreamy, euphoric)
 * - MoodAtmosphere SHOWCASE_HUES (colours only, no named emotions)
 *
 * Where the original hex failed 4.5:1, it was lightened minimally to pass.
 */
export const MOOD_PALETTE: Record<string, MoodPaletteEntry> = {
  happy:       { hex: '#FFD700', gradient: ['#FFD700', '#996B00'] },
  sad:         { hex: '#4A90D9', gradient: ['#4A90D9', '#1A3A5C'] },
  angry:       { hex: '#E74C3C', gradient: ['#E74C3C', '#8B0000'] },
  calm:        { hex: '#7ED6A0', gradient: ['#7ED6A0', '#2E8B57'] },
  anxious:     { hex: '#AA72C1', gradient: ['#AA72C1', '#4A235A'] },
  excited:     { hex: '#FF6B35', gradient: ['#FF6B35', '#993D1A'] },
  melancholy:  { hex: '#6887B7', gradient: ['#6887B7', '#1E3450'] },
  nostalgic:   { hex: '#D4A373', gradient: ['#D4A373', '#8B6914'] },
  peaceful:    { hex: '#88C999', gradient: ['#88C999', '#1E4433'] },
  romantic:    { hex: '#EC417B', gradient: ['#EC417B', '#880E4F'] },
  hopeful:     { hex: '#FFC107', gradient: ['#FFC107', '#996D00'] },
  lonely:      { hex: '#6D8794', gradient: ['#6D8794', '#37474F'] },
  energetic:   { hex: '#FF5722', gradient: ['#FF5722', '#992E0F'] },
  reflective:  { hex: '#78909C', gradient: ['#78909C', '#37474F'] },
  grateful:    { hex: '#8BC34A', gradient: ['#8BC34A', '#3D6B0F'] },
  frustrated:  { hex: '#F44336', gradient: ['#F44336', '#8B0000'] },
  content:     { hex: '#66BB6A', gradient: ['#66BB6A', '#2E5A30'] },
  inspired:    { hex: '#B863C6', gradient: ['#B863C6', '#4A1A56'] },
  heartbroken: { hex: '#D4627A', gradient: ['#D4627A', '#5C1A2A'] },
  dreamy:      { hex: '#B39DDB', gradient: ['#B39DDB', '#3D2066'] },
  euphoric:    { hex: '#FFD54F', gradient: ['#FFD54F', '#A67C00'] },
};

/** Fallback for emotions not in the palette (AI may return novel labels). */
export const UNKNOWN_EMOTION_FALLBACK: MoodPaletteEntry = {
  hex: '#8B5CF6',
  gradient: ['#8B5CF6', '#3B1F7A'],
};

/** Get the accent colour for a given emotion. */
export function getEmotionColor(emotion: string): string {
  return (MOOD_PALETTE[emotion.toLowerCase()] ?? UNKNOWN_EMOTION_FALLBACK).hex;
}

/** Get the two-stop gradient for a given emotion. */
export function getEmotionGradient(emotion: string): [string, string] {
  return (MOOD_PALETTE[emotion.toLowerCase()] ?? UNKNOWN_EMOTION_FALLBACK).gradient;
}
