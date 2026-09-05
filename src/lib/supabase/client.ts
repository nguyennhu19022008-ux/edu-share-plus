import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

const DEFAULT_SUPABASE_URL = 'https://brnshmzflawffaysyyvx.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_8uoLV_3qU8H6p5XRjNqp-g_4tNOLLzw';

function getEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'): string {
  const value = import.meta.env[name]?.trim();
  if (value) return value;
  if (name === 'VITE_SUPABASE_URL') return DEFAULT_SUPABASE_URL;
  return DEFAULT_SUPABASE_KEY;
}

export function getSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const supabaseUrl = getEnv('VITE_SUPABASE_URL');
  const publishableKey = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY');

  // Use sessionStorage to isolate tabs so that teacher and student can be logged in concurrently in different tabs
  const storage = typeof window !== 'undefined' ? window.sessionStorage : undefined;

  browserClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
