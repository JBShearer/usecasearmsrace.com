#!/bin/bash

# Migration Sync Strategy
#
# Problem: Local migrations (001, 002, 003, 004) don't match remote format
# Solution: Pull remote schema, then apply new migrations on top
#
# This script documents the steps to sync migrations properly.

cd "/Users/I530341/Documents/Evil Brain Production/usecasearmsrace.com"

echo "═══════════════════════════════════════════════════════════"
echo "MIGRATION SYNC - Use Case Arms Race"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "Step 1: Backup local migrations"
echo "------------------------------------------------------------"
echo "mkdir -p .migration_backup"
echo "cp supabase/migrations/*.sql .migration_backup/"
echo ""

echo "Step 2: Pull remote database schema"
echo "------------------------------------------------------------"
echo "# This creates new migration files with proper timestamps"
echo "supabase db pull"
echo ""

echo "Step 3: Review what changed"
echo "------------------------------------------------------------"
echo "# Check what tables/functions exist in remote"
echo "ls -la supabase/migrations/"
echo ""

echo "Step 4: Apply new migrations (003, 004)"
echo "------------------------------------------------------------"
echo "# Option A: Rename our migrations with timestamps"
echo "TIMESTAMP=\$(date +%Y%m%d%H%M%S)"
echo "mv supabase/migrations/003_rls_hardening.sql supabase/migrations/\${TIMESTAMP}_rls_hardening.sql"
echo ""
echo "# OR Option B: Apply via SQL editor manually"
echo "# Go to: https://supabase.com/dashboard/project/aslcrwmbdtvimjrexxzw/sql/new"
echo "# Copy/paste 003 and 004"
echo ""

echo "Step 5: Verify"
echo "------------------------------------------------------------"
echo "# Check rate_limits table exists"
echo 'curl -s -H "apikey: eyJh..." "https://aslcrwmbdtvimjrexxzw.supabase.co/rest/v1/rate_limits?limit=0"'
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "RECOMMENDED: Use SQL Editor for 003 + 004"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Fastest approach:"
echo "1. Go to SQL Editor in Supabase Dashboard"
echo "2. Paste contents of 003_rls_hardening.sql"
echo "3. Run"
echo "4. Paste contents of 004_rate_limiting.sql"
echo "5. Run"
echo ""
echo "This avoids migration file conflicts."
echo ""
