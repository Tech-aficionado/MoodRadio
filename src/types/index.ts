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

const emotionColors: Record<string, string> = {
  happy: '#FFD700',
  sad: '#4A90D9',
  angry: '#E74C3C',
  calm: '#7ED6A0',
  anxious: '#9B59B6',
  excited: '#FF6B35',
  melancholy: '#5B7DB1',
  nostalgic: '#D4A373',
  peaceful: '#88C999',
  romantic: '#E91E63',
  hopeful: '#FFC107',
  lonely: '#607D8B',
  energetic: '#FF5722',
  reflective: '#78909C',
  grateful: '#8BC34A',
  frustrated: '#F44336',
  content: '#66BB6A',
  inspired: '#AB47BC',
};

export function getEmotionColor(emotion: string): string {
  const key = emotion.toLowerCase();
  return emotionColors[key] || '#8B5CF6';
}

export function getEmotionGradient(emotion: string): [string, string] {
  const color = getEmotionColor(emotion);
  return [color, `${color}80`];
}
