import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

const TABLES = [
  'users',
  'categories',
  'providers',
  'scholarships',
  'applications',
  'documents',
  'notifications',
  'saved_scholarships',
  'verifications',
  'admin_users'
];

async function main() {
  console.log('--- Inspecting Supabase Tables ---');
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`[${table}] ERROR:`, error.message, `(Code: ${error.code})`);
    } else {
      console.log(`[${table}] OK! Rows count: ${data.length}`, data.length > 0 ? 'Columns:' + Object.keys(data[0]).join(', ') : '(Table empty)');
    }
  }
}

main();
