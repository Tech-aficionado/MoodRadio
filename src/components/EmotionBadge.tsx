'use client';

import { getEmotionColor } from '@/types';

interface EmotionBadgeProps {
  emotion: string;
  size?: 'sm' | 'md';
}

export default function EmotionBadge({ emotion, size = 'md' }: EmotionBadgeProps) {
  const color = getEmotionColor(emotion);

  return (
    <span
      className={`inline-flex items-center gap-1.5 border uppercase tracking-wider font-medium ${
        size === 'sm' ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-3 py-1'
      }`}
      style={{ borderColor: color, color }}
    >
      <span className="w-1.5 h-1.5" style={{ backgroundColor: color }} />
      {emotion}
    </span>
  );
}
