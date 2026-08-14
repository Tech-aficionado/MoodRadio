'use client';

interface StreakBadgeProps {
  current: number;
  best: number;
}

export default function StreakBadge({ current, best }: StreakBadgeProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-[10px] text-[#666] uppercase tracking-[0.15em] font-medium">
        {current} DAY STREAK
      </span>
      {best > current && (
        <span className="text-[9px] text-[#555] tracking-wider">
          BEST: {best}
        </span>
      )}
    </div>
  );
}
