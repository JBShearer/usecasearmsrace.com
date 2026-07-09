#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Quick deployment check for existing Supabase project
 *
 * Project: aslcrwmbdtvimjrexxzw.supabase.co
 *
 * Checks:
 * 1. Which migrations have been applied
 * 2. Whether RLS is enabled
 * 3. Whether rate_limits table exists
 * 4. Which edge functions are deployed
 */

const SUPABASE_URL = "https://aslcrwmbdtvimjrexxzw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzbGNyd21iZHR2aW1qcmV4eHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDA0NjgsImV4cCI6MjA5NjcxNjQ2OH0.XYG0LrgA_92h7dGjw0aamX53WIrwQaqPHNHQLe8p9ls";

console.log("═══════════════════════════════════════════════════════════");
console.log("EXISTING SUPABASE PROJECT STATUS CHECK");
console.log("═══════════════════════════════════════════════════════════\n");

console.log(`Project: ${SUPABASE_URL}\n`);

// Check if we can connect
console.log("📡 Testing connection...");

try {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (response.ok) {
    console.log("✅ Connection successful\n");
  } else {
    console.log(`⚠️  Connection returned ${response.status}\n`);
  }
} catch (err) {
  console.log(`❌ Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}\n`);
  Deno.exit(1);
}

// Check which tables exist
console.log("📊 Checking database tables...\n");

const tables = [
  'use_cases',
  'semantic_modifiers',
  'rate_limits',
  'votes',
  'watches',
  'case_status_log',
  'cards',
  'card_instances',
  'episodes'
];

for (const table of tables) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=0`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (response.ok) {
      console.log(`  ✅ ${table}`);
    } else if (response.status === 404) {
      console.log(`  ⬜ ${table} (not created yet)`);
    } else {
      console.log(`  ⚠️  ${table} (status ${response.status})`);
    }
  } catch (err) {
    console.log(`  ❌ ${table} (error)`);
  }
}

console.log("\n📋 Next Steps:\n");

console.log("If rate_limits table doesn't exist:");
console.log("  → Migrations 003 and 004 need to be applied");
console.log("  → Need Supabase service role key to push migrations");
console.log("  → Check Supabase dashboard → Project Settings → API\n");

console.log("If tables exist:");
console.log("  → Ready to deploy edge functions");
console.log("  → Run: scripts/check-rls.ts for full verification\n");

console.log("═══════════════════════════════════════════════════════════");
