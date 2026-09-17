import { createClient, SupabaseClient, User as SupabaseUser, Session } from '@supabase/supabase-js';
import { toSnake } from './mapper';


export type { SupabaseUser, Session };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let supabase: SupabaseClient;

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
} else {
  // Create a non-functional stub so imports don't crash when unconfigured
  supabase = {} as SupabaseClient;
  console.warn('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
}

export { supabase };

// -----------------------------------------------------------------------
// Supabase database helpers
// -----------------------------------------------------------------------

/** Upsert (insert or update) a record in a Supabase table */
export async function syncToSupabase(table: string, data: object): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const row = toSnake(data);
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
    if (error) console.error(`Supabase upsert error [${table}]:`, error.message);
  } catch (err) {
    console.error(`Supabase upsert failed [${table}]:`, err);
  }
}


/** Delete a record from a Supabase table by id */
export async function removeFromSupabase(table: string, id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) console.error(`Supabase delete error [${table}]:`, error.message);
  } catch (err) {
    console.error(`Supabase delete failed [${table}]:`, err);
  }
}

/** Test the Supabase connection on app boot */
export async function testSupabaseConnection(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase.from('categories').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      console.warn('Supabase connection check:', error.message);
    } else {
      console.log('Supabase connected ✓');
    }
  } catch (err) {
    console.warn('Supabase connection test failed:', err);
  }
}
