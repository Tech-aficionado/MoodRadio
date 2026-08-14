export const EMOTION_COLORS: Record<string, string> = {
  joy: '#FFD700',
  sadness: '#4A90D9',
  anger: '#E74C3C',
  fear: '#8E44AD',
  love: '#FF6B9D',
  nostalgia: '#D4A574',
  calm: '#7DCEA0',
  anxiety: '#F39C12',
  excitement: '#FF4757',
  melancholy: '#5B6ABF',
  hope: '#48C9B0',
  loneliness: '#6C7A89',
};

export const EMOTION_GRADIENTS: Record<string, [string, string]> = {
  joy: ['#FFD700', '#FFA500'],
  sadness: ['#4A90D9', '#2C3E50'],
  anger: ['#E74C3C', '#C0392B'],
  fear: ['#8E44AD', '#4A235A'],
  love: ['#FF6B9D', '#C44569'],
  nostalgia: ['#D4A574', '#A0522D'],
  calm: ['#7DCEA0', '#27AE60'],
  anxiety: ['#F39C12', '#D35400'],
  excitement: ['#FF4757', '#FF6348'],
  melancholy: ['#5B6ABF', '#34495E'],
  hope: ['#48C9B0', '#1ABC9C'],
  loneliness: ['#6C7A89', '#2C3E50'],
};

/**
 * NOTE: the previous `analyzeMood()` helper here was dead code — it POSTed to
 * /api/mood without the user profile or the Firebase ID token, so it could only
 * ever produce unauthenticated, unpersonalised results. The live path is
 * `useMood()` in src/context/MoodContext.tsx. Use that instead.
 */
