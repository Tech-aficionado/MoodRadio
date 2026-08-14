'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { MoodEntry } from '@/types';

interface UseMoodHistoryResult {
  entries: MoodEntry[];
  loading: boolean;
  refetch: () => void;
}

export function useMoodHistory(userId?: string): UseMoodHistoryResult {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (!supabase) {
        setEntries([]);
        return;
      }
      const { data, error } = await supabase
        .from('mood_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEntries((data as MoodEntry[]) || []);
    } catch (err) {
      console.error('Failed to fetch mood history:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Refetch on window focus
  useEffect(() => {
    function handleFocus() {
      fetchEntries();
    }
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchEntries]);

  return { entries, loading, refetch: fetchEntries };
}
