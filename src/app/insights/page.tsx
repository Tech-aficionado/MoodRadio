'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Flame, Music, Activity, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useMoodHistory } from '@/hooks/useMoodHistory';
import { useStreak } from '@/hooks/useStreak';
import { getEmotionColor } from '@/types';

export default function InsightsPage() {
  const { entries, loading } = useMoodHistory('current-user');
  const { current } = useStreak(entries);

  const weekEntries = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return entries.filter((e) => new Date(e.created_at) >= weekAgo);
  }, [entries]);

  const emotionDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    weekEntries.forEach((e) => {
      counts[e.emotion] = (counts[e.emotion] || 0) + 1;
    });
    const total = weekEntries.length || 1;
    return Object.entries(counts)
      .map(([emotion, count]) => ({
        emotion,
        count,
        percentage: Math.round((count / total) * 100),
        color: getEmotionColor(emotion),
      }))
      .sort((a, b) => b.count - a.count);
  }, [weekEntries]);

  const sparklineData = useMemo(() => {
    return weekEntries.slice(0, 14).reverse().map((e) => e.intensity);
  }, [weekEntries]);

  const totalSessions = weekEntries.length;
  const totalTracks = weekEntries.reduce((sum, e) => sum + (e.tracks_played || 0), 0);

  const sparklinePath = useMemo(() => {
    if (sparklineData.length < 2) return '';
    const width = 200;
    const height = 40;
    const padding = 4;
    const stepX = (width - padding * 2) / (sparklineData.length - 1);
    const maxVal = Math.max(...sparklineData, 10);
    const minVal = Math.min(...sparklineData, 1);
    const range = maxVal - minVal || 1;
    const points = sparklineData.map((val, i) => {
      const x = padding + i * stepX;
      const y = height - padding - ((val - minVal) / range) * (height - padding * 2);
      return `${x},${y}`;
    });
    return `M${points.join(' L')}`;
  }, [sparklineData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] text-white flex items-center justify-center">
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
    );
  }

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
              INSIGHTS
            </h1>
            <p className="text-[#666] text-xs tracking-wide mt-2 uppercase">YOUR WEEK IN DATA</p>
          </div>
        </div>

        {/* Stats — brutalist grid */}
        <div className="grid grid-cols-3 gap-[1px] bg-[#333] mb-10">
          {[
            { icon: Activity, value: totalSessions, label: 'SESSIONS' },
            { icon: Music, value: totalTracks, label: 'TRACKS' },
            { icon: Flame, value: current, label: 'STREAK' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              className="bg-[#1A1A1A] p-6 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <stat.icon className="w-4 h-4 text-[#555] mx-auto mb-3" />
              <p className="display-text text-3xl text-white">{stat.value}</p>
              <p className="text-[9px] text-[#555] mt-2 tracking-[0.2em]">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Emotion Distribution */}
        <motion.section
          className="mb-10 p-6 border border-[#333] bg-[#222]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-[10px] font-bold text-[#666] mb-6 uppercase tracking-[0.2em]">
            EMOTION DISTRIBUTION
          </h2>

          {emotionDistribution.length === 0 ? (
            <p className="text-[#555] text-sm text-center py-6">No data this week.</p>
          ) : (
            <div className="space-y-4">
              {emotionDistribution.map((item, index) => (
                <div key={item.emotion} className="flex items-center gap-4">
                  <span className="text-[11px] text-[#888] uppercase w-24 truncate font-medium tracking-wide">
                    {item.emotion}
                  </span>
                  <div className="flex-1 h-[3px] bg-[#333] relative overflow-hidden">
                    <motion.div
                      className="h-full absolute left-0 top-0"
                      style={{ backgroundColor: item.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percentage}%` }}
                      transition={{ delay: 0.3 + index * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="text-[11px] text-[#555] w-10 text-right font-mono">
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Intensity Sparkline */}
        <motion.section
          className="mb-10 p-6 border border-[#333] bg-[#222]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-bold text-[#666] uppercase tracking-[0.2em]">
              INTENSITY TREND
            </h2>
            <TrendingUp className="w-3 h-3 text-[#555]" />
          </div>

          {sparklineData.length < 2 ? (
            <p className="text-[#555] text-sm text-center py-6">
              Need more sessions.
            </p>
          ) : (
            <div className="flex items-center justify-center">
              <svg
                width="200"
                height="40"
                viewBox="0 0 200 40"
                className="w-full h-10"
                preserveAspectRatio="none"
              >
                <motion.path
                  d={sparklinePath}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.5, duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </svg>
            </div>
          )}

          <div className="flex justify-between mt-3">
            <span className="text-[9px] text-[#555] tracking-wider">7 DAYS AGO</span>
            <span className="text-[9px] text-[#555] tracking-wider">TODAY</span>
          </div>
        </motion.section>

        {/* Empty state */}
        {weekEntries.length === 0 && (
          <motion.div
            className="text-center py-16 border border-[#333]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <p className="text-[#555] text-sm tracking-wide mb-6">
              START LOGGING TO SEE INSIGHTS
            </p>
            <Link href="/" className="brutal-btn inline-block">
              LOG MOOD
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
