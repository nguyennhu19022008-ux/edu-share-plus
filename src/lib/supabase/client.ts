import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

function requireEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY') {
  const value = import.meta.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Thiếu ${name}. Hãy tạo file .env.local theo .env.example rồi khởi động lại Vite.`,
    );
  }
  return value;
}

export function getSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const supabaseUrl = requireEnv('VITE_SUPABASE_URL');
  const publishableKey = requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY');

  browserClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
