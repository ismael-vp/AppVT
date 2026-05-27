import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder';

const globalForSupabase = globalThis as unknown as {
  supabase: SupabaseClient | undefined;
};

// Fix 15: singleton siempre activo (no solo en dev), evita múltiples instancias en producción
export const supabase =
  globalForSupabase.supabase ?? createClient(supabaseUrl, supabaseAnonKey);

globalForSupabase.supabase = supabase;
