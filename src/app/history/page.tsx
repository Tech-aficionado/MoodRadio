'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import MoodCalendar from '@/components/MoodCalendar';
import MoodCard from '@/components/MoodCard';
import StreakBadge from '@/components/StreakBadge';
import EmotionBadge from '@/components/EmotionBadge';
import { useMoodHistory } from '@/hooks/useMoodHistory';
import { useStreak } from '@/hooks/useStreak';
import { MoodEntry, getEmotionColor } from '@/types';

export default function HistoryPage() {
  const { entries, loading } = useMoodHistory('current-user');
  const { current, best } = useStreak(entries);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const selectedDayEntries = selectedDay
    ? entries.filter((e) => {
        const entryDate = new Date(e.created_at);
        return (
          entryDate.getFullYear() === selectedDay.getFullYear() &&
          entryDate.getMonth() === selectedDay.getMonth() &&
          entryDate.getDate() === selectedDay.getDate()
        );
      })
    : [];

  const recentEntries = entries.slice(0, 20);

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-white">
      <div className="relative z-10 max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-6 mb-16">
          <Link href="/">
            <motion.div
              className="w-10 h-10 border border-[#333] flex items-center justify-center hover:border-white/50 transition-colors"
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeft className="w-4 h-4 text-white/60" />
            </motion.div>
          </Link>
          <div>
            <h1 className="display-text text-[clamp(32px,8vw,56px)] text-white leading-none">
              HISTORY
            </h1>
            <div className="mt-2">
              <StreakBadge current={current} best={best} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-end gap-[3px] h-6">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="w-[3px] bg-white/40"
                  animate={{ height: [4, 18, 8, 22, 4] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.12 }}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Mood Calendar */}
            <motion.section
              className="mb-10 p-6 border border-[#333] bg-[#222]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h2 className="text-[10px] font-bold text-[#666] mb-5 uppercase tracking-[0.2em]">
                LAST 35 DAYS
              </h2>
              <MoodCalendar entries={entries} onDaySelect={setSelectedDay} />
            </motion.section>

            {/* Selected day detail */}
            {selectedDay && (
              <motion.section
                className="mb-10 p-6 border border-[#333] bg-[#222]"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <h3 className="text-[10px] font-bold text-[#666] mb-4 uppercase tracking-[0.2em]">
                  {selectedDay.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </h3>
                {selectedDayEntries.length === 0 ? (
                  <p className="text-[#555] text-sm">No mood logged.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedDayEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-[#333] last:border-0">
                        <div
                          className="w-3 h-3 shrink-0"
                          style={{ backgroundColor: getEmotionColor(entry.emotion) }}
                        />
                        <span className="text-white/70 text-sm flex-1 truncate">
                          {entry.input_text}
                        </span>
                        <EmotionBadge emotion={entry.emotion} size="sm" />
                      </div>
                    ))}
                  </div>
                )}
              </motion.section>
            )}

            {/* Recent sessions */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-[10px] font-bold text-[#666] mb-6 uppercase tracking-[0.2em]">
                RECENT SESSIONS
              </h2>
              <div className="space-y-[1px] bg-[#333]">
                {recentEntries.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * index }}
                    className="bg-[#1A1A1A]"
                  >
                    <MoodCard entry={entry} />
                  </motion.div>
                ))}
              </div>

              {recentEntries.length === 0 && (
                <div className="text-center py-16 border border-[#333]">
                  <p className="text-[#555] text-sm tracking-wide">
                    NO SESSIONS YET
                  </p>
                </div>
              )}
            </motion.section>
          </>
        )}
      </div>
    </div>
  );
}
