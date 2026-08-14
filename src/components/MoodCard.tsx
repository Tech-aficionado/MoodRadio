'use client';

import { MoodEntry, getEmotionColor } from '@/types';

interface MoodCardProps {
  entry: MoodEntry;
}

export default function MoodCard({ entry }: MoodCardProps) {
  const color = getEmotionColor(entry.emotion);
  const time = new Date(entry.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const date = new Date(entry.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-[#222] transition-colors group">
      {/* Mood accent bar */}
      <div className="w-[3px] h-10 shrink-0" style={{ backgroundColor: color }} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-white/80 truncate group-hover:text-white transition-colors">
          {entry.input_text}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] text-[#666] uppercase tracking-wider font-medium">
            {entry.emotion}
          </span>
          {entry.tracks_played && entry.tracks_played > 0 && (
            <span className="text-[10px] text-[#555]">
              {entry.tracks_played} tracks
            </span>
          )}
        </div>
      </div>

      {/* Time */}
      <div className="text-right shrink-0">
        <p className="text-[10px] text-[#666] font-mono">{time}</p>
        <p className="text-[9px] text-[#555] font-mono mt-0.5">{date}</p>
      </div>
    </div>
  );
}
