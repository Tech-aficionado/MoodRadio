'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { MoodAnalysis } from '@/types';
import { ensureIdToken } from '@/lib/auth-token';
import { loadFeedback } from '@/lib/feedback';

interface MoodContextType {
  mood: MoodAnalysis | null;
  isAnalyzing: boolean;
  analyzeMood: (text: string, userProfile?: string) => Promise<MoodAnalysis | null>;
  clearMood: () => void;
}

/**
 * The mood API authenticates to the AI provider using a Firebase ID
 * token. `ensureIdToken` waits for Firebase to restore the session (otherwise
 * an early submit sees a null user) and falls back to anonymous auth so
 * signed-out visitors still get AI analysis.
 */

const MoodContext = createContext<MoodContextType | undefined>(undefined);

export function MoodProvider({ children }: { children: ReactNode }) {
  const [mood, setMood] = useState<MoodAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeMood = useCallback(async (text: string, userProfile?: string): Promise<MoodAnalysis | null> => {
    setIsAnalyzing(true);
    try {
      const idToken = await ensureIdToken();
      // Recently-heard artists go up as an exclusion list — without this each
      // request is stateless and the model returns the same names every time.
      const { recentArtists } = loadFeedback();

      const response = await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userProfile, idToken, recentArtists }),
      });

      if (!response.ok) {
        throw new Error('Mood analysis failed');
      }

      const analysis: MoodAnalysis & {
        _source?: string;
        _reason?: string;
        _profileApplied?: boolean;
      } = await response.json();

      // Make a silent AI outage visible instead of passing it off as taste.
      if (analysis._source === 'fallback') {
        console.warn(
          `[MOOD] AI unavailable — using fallback. Reason: ${analysis._reason ?? 'suppressed in production'}`
        );
      } else if (analysis._profileApplied === false) {
        console.warn(
          '[MOOD] No taste profile was sent, so suggestions are generic. ' +
            'Connect YouTube (or rebuild the profile via the "Personalised" chip) to fix this.'
        );
      }

      setMood(analysis);
      return analysis;
    } catch (error) {
      console.error('Mood analysis error:', error);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const clearMood = useCallback(() => {
    setMood(null);
  }, []);

  return (
    <MoodContext.Provider value={{ mood, isAnalyzing, analyzeMood, clearMood }}>
      {children}
    </MoodContext.Provider>
  );
}

export function useMood(): MoodContextType {
  const context = useContext(MoodContext);
  if (!context) {
    throw new Error('useMood must be used within a MoodProvider');
  }
  return context;
}
