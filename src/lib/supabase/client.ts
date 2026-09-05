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

function getTabStorageKey(): string {
  if (typeof window === 'undefined') return 'sb-edushare-auth-token';
  let tabId = window.sessionStorage.getItem('edushare_tab_id');
  if (!tabId) {
    tabId = 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    window.sessionStorage.setItem('edushare_tab_id', tabId);
  }
  return `sb-edushare-${tabId}-auth-token`;
}

export function getSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const supabaseUrl = getEnv('VITE_SUPABASE_URL');
  const publishableKey = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY');

  // Use sessionStorage and unique tab storageKey so each tab has its own BroadcastChannel and session storage
  const storage = typeof window !== 'undefined' ? window.sessionStorage : undefined;
  const storageKey = getTabStorageKey();

  browserClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      storage,
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
