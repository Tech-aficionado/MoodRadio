export interface MoodAnalysis {
  primary_emotion: string;
  intensity: number;
  energy_desire: 'high' | 'medium' | 'low';
  color_hex: string;
  color_gradient: [string, string];
  search_keywords: string[];
  ambient_particles: 'fast' | 'medium' | 'slow' | 'none';
}

export interface MoodEntry {
  id: string;
  user_id: string;
  input_text: string;
  emotion: string;
  intensity: number;
  color_hex: string;
  color_gradient: [string, string];
  energy_desire: string;
  search_keywords: string[];
  tracks_played: number;
  public_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface Track {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration?: string;
}

// Re-export palette helpers so existing callers don't break.
export {
  getEmotionColor,
  getEmotionGradient,
} from '@/lib/mood-palette';
