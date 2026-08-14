'use client';

import { useMemo } from 'react';
import { MoodEntry } from '@/types';

interface StreakResult {
  current: number;
  best: number;
  lastMoodDate: Date | null;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isConsecutiveDay(d1: Date, d2: Date): boolean {
  const diff = Math.abs(d1.getTime() - d2.getTime());
  return diff >= 86400000 - 1000 && diff <= 86400000 + 1000; // ~24 hours with tolerance
}

export function useStreak(entries: MoodEntry[]): StreakResult {
  return useMemo(() => {
    if (entries.length === 0) {
      return { current: 0, best: 0, lastMoodDate: null };
    }

    // Get unique dates (sorted newest first)
    const uniqueDates: Date[] = [];
    const seen = new Set<string>();

    for (const entry of entries) {
      const date = new Date(entry.created_at);
      date.setHours(0, 0, 0, 0);
      const key = date.toDateString();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueDates.push(date);
      }
    }

    // Sort newest first
    uniqueDates.sort((a, b) => b.getTime() - a.getTime());

    const lastMoodDate = uniqueDates[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate current streak
    let currentStreak = 0;
    const startCheck = isSameDay(uniqueDates[0], today) ? 0 : -1;

    if (startCheck === -1) {
      // Last mood was not today -- check if it was yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (!isSameDay(uniqueDates[0], yesterday)) {
        // Streak is broken
        currentStreak = 0;
      }
    }

    if (startCheck !== -1 || currentStreak !== 0 || isSameDay(uniqueDates[0], today)) {
      currentStreak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const prev = uniqueDates[i - 1];
        const curr = uniqueDates[i];
        if (isConsecutiveDay(prev, curr)) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Check if streak includes today or yesterday
    if (startCheck === -1) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (isSameDay(uniqueDates[0], yesterday)) {
        currentStreak = 1;
        for (let i = 1; i < uniqueDates.length; i++) {
          const prev = uniqueDates[i - 1];
          const curr = uniqueDates[i];
          if (isConsecutiveDay(prev, curr)) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    // Calculate best streak
    let bestStreak = 1;
    let tempStreak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = uniqueDates[i - 1];
      const curr = uniqueDates[i];
      if (isConsecutiveDay(prev, curr)) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }

    bestStreak = Math.max(bestStreak, currentStreak);

    return { current: currentStreak, best: bestStreak, lastMoodDate };
  }, [entries]);
}
