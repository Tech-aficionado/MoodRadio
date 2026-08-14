import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('Supabase not configured — mood history will not persist.');
    return null;
  }

  _supabase = createClient(url, key);
  return _supabase;
}

// For backward compat — components can import { supabase }
// but must handle null
export const supabase = typeof window !== 'undefined'
  ? getSupabase()
  : null;
