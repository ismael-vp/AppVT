import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder';

// createBrowserClient implementa el patrón singleton internamente en @supabase/ssr
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
