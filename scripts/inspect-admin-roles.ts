/**
 * scripts/inspect-admin-roles.ts
 *
 * Queries public.users and reports all accounts where role = 'admin'.
 * READ-ONLY — no writes are made.
 *
 * Usage (from project root):
 *   VITE_SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/inspect-admin-roles.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main(): Promise<void> {
  console.log('Querying public.users for role = "admin"...\n');

  const { data, error } = await supabase
    .from('users')
    .select('id, email, role, first_name, last_name, created_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase query error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No admin-role records found in public.users.');
    return;
  }

  console.log('Found ' + String(data.length) + ' admin-role record(s):\n');
  console.log('-'.repeat(80));
  for (const row of data) {
    const r = row as Record<string, unknown>;
    console.log('ID      : ' + String(r['id']));
    console.log('Email   : ' + String(r['email']));
    console.log('Role    : ' + String(r['role']));
    console.log('Name    : ' + String(r['first_name'] ?? '') + ' ' + String(r['last_name'] ?? ''));
    console.log('Created : ' + String(r['created_at']));
    console.log('-'.repeat(80));
  }
}

main().catch((err: unknown) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
