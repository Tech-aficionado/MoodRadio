'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { MoodEntry, getEmotionColor } from '@/types';

interface MoodCalendarProps {
  entries: MoodEntry[];
  onDaySelect: (date: Date) => void;
}

function getDayLabel(dayIndex: number): string {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIndex];
}

function getLast35Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export default function MoodCalendar({ entries, onDaySelect }: MoodCalendarProps) {
  const [hoveredDay, setHoveredDay] = useState<Date | null>(null);
  const days = getLast35Days();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Map dates to their primary emotion
  const dayMoodMap = new Map<string, MoodEntry>();
  entries.forEach((entry) => {
    const key = new Date(entry.created_at).toDateString();
    if (!dayMoodMap.has(key)) {
      dayMoodMap.set(key, entry);
    }
  });

  return (
    <div className="w-full">
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="text-center text-xs text-white/30 font-medium">
            {getDayLabel(i)}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const entry = dayMoodMap.get(day.toDateString());
          const color = entry ? getEmotionColor(entry.emotion) : undefined;
          const isToday = isSameDay(day, today);
          const isHovered = hoveredDay && isSameDay(day, hoveredDay);

          return (
            <motion.div
              key={day.toISOString()}
              className="flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02, duration: 0.3 }}
            >
              <button
                onClick={() => onDaySelect(day)}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isToday ? 'ring-2 ring-white/30' : ''
                } ${!entry ? 'border border-white/10' : ''}`}
                style={entry ? { backgroundColor: color } : undefined}
                aria-label={`${day.toLocaleDateString()}${entry ? ` - ${entry.emotion}` : ''}`}
              >
                {/* Hover tooltip */}
                {isHovered && entry && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-black/90 border border-white/10 text-xs text-white whitespace-nowrap z-50"
                  >
                    {entry.emotion}
                  </motion.div>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
