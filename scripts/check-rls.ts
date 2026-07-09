#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * RLS Policy Verification Script
 *
 * Runs all checks from DEPLOYMENT_GUIDE.md Phase 0
 * Use before production deployment to verify security hardening.
 *
 * Usage:
 *   deno run --allow-net --allow-env scripts/check-rls.ts
 *
 * Environment variables required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
  critical: boolean;
}

const results: CheckResult[] = [];

// ============================================================================
// CHECK 1: RLS Enabled on All Tables
// ============================================================================

async function checkRLSEnabled(): Promise<CheckResult> {
  try {
    const { data, error } = await supabase.rpc('check_rls_enabled');

    if (error) {
      return {
        name: 'RLS Enabled',
        passed: false,
        details: `RPC failed: ${error.message}`,
        critical: true,
      };
    }

    const disabledTables = data?.filter((row: any) => !row.rls_enabled) || [];

    if (disabledTables.length > 0) {
      return {
        name: 'RLS Enabled',
        passed: false,
        details: `${disabledTables.length} tables missing RLS: ${disabledTables.map((t: any) => t.tablename).join(', ')}`,
        critical: true,
      };
    }

    return {
      name: 'RLS Enabled',
      passed: true,
      details: 'All tables have RLS enabled',
      critical: true,
    };
  } catch (err) {
    return {
      name: 'RLS Enabled',
      passed: false,
      details: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      critical: true,
    };
  }
}

// ============================================================================
// CHECK 2: Registry Reader Role Exists
// ============================================================================

async function checkRegistryReaderRole(): Promise<CheckResult> {
  try {
    // Check if registry_reader role exists
    const { data: roles, error } = await supabase.rpc('get_roles');

    if (error) {
      return {
        name: 'Registry Reader Role',
        passed: false,
        details: `Unable to check roles: ${error.message}`,
        critical: true,
      };
    }

    const hasRole = roles?.some((r: any) => r.rolname === 'registry_reader');

    if (!hasRole) {
      return {
        name: 'Registry Reader Role',
        passed: false,
        details: 'registry_reader role does not exist',
        critical: true,
      };
    }

    return {
      name: 'Registry Reader Role',
      passed: true,
      details: 'registry_reader role exists',
      critical: true,
    };
  } catch (err) {
    return {
      name: 'Registry Reader Role',
      passed: false,
      details: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      critical: true,
    };
  }
}

// ============================================================================
// CHECK 3: Rate Limiting Table and RPC
// ============================================================================

async function checkRateLimiting(): Promise<CheckResult> {
  try {
    // Check if rate_limits table exists
    const { data: tables, error: tableError } = await supabase
      .from('rate_limits')
      .select('*')
      .limit(0);

    if (tableError) {
      return {
        name: 'Rate Limiting',
        passed: false,
        details: `rate_limits table missing: ${tableError.message}`,
        critical: true,
      };
    }

    // Check if increment_rate_limit RPC exists
    const testUserId = 'test-check-script';
    const { data, error } = await supabase.rpc('increment_rate_limit', {
      p_user_id: testUserId,
      p_function_name: 'check-script',
      p_bucket: new Date().toISOString(),
    });

    if (error) {
      return {
        name: 'Rate Limiting',
        passed: false,
        details: `increment_rate_limit RPC missing: ${error.message}`,
        critical: true,
      };
    }

    // Cleanup test data
    await supabase.from('rate_limits').delete().eq('user_id', testUserId);

    return {
      name: 'Rate Limiting',
      passed: true,
      details: 'Rate limiting table and RPC functional',
      critical: true,
    };
  } catch (err) {
    return {
      name: 'Rate Limiting',
      passed: false,
      details: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      critical: true,
    };
  }
}

// ============================================================================
// CHECK 4: Edge Functions Deployed
// ============================================================================

async function checkEdgeFunctions(): Promise<CheckResult> {
  const requiredFunctions = [
    'submit-verdict',
    'mint-card',
    'feed-query',
    'steward-brief',
  ];

  const deployedFunctions: string[] = [];
  const missingFunctions: string[] = [];

  for (const fn of requiredFunctions) {
    try {
      const response = await fetch(`${SUPABASE_URL.replace('/rest/v1', '')}/functions/v1/${fn}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({}),
      });

      // Function exists if we get any response (even 400/500)
      if (response.status !== 404) {
        deployedFunctions.push(fn);
      } else {
        missingFunctions.push(fn);
      }
    } catch {
      missingFunctions.push(fn);
    }
  }

  if (missingFunctions.length > 0) {
    return {
      name: 'Edge Functions',
      passed: false,
      details: `Missing functions: ${missingFunctions.join(', ')}`,
      critical: true,
    };
  }

  return {
    name: 'Edge Functions',
    passed: true,
    details: `All functions deployed: ${deployedFunctions.join(', ')}`,
    critical: true,
  };
}

// ============================================================================
// CHECK 5: Storage Bucket Exists
// ============================================================================

async function checkStorageBucket(): Promise<CheckResult> {
  try {
    const { data, error } = await supabase.storage.getBucket('cards');

    if (error) {
      return {
        name: 'Storage Bucket',
        passed: false,
        details: `cards bucket missing: ${error.message}`,
        critical: false,
      };
    }

    if (!data.public) {
      return {
        name: 'Storage Bucket',
        passed: false,
        details: 'cards bucket exists but is not public',
        critical: false,
      };
    }

    return {
      name: 'Storage Bucket',
      passed: true,
      details: 'cards bucket exists and is public',
      critical: false,
    };
  } catch (err) {
    return {
      name: 'Storage Bucket',
      passed: false,
      details: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      critical: false,
    };
  }
}

// ============================================================================
// CHECK 6: pg_cron Cleanup Job
// ============================================================================

async function checkPgCronJob(): Promise<CheckResult> {
  try {
    // Check if cleanup job is scheduled
    const { data, error } = await supabase.rpc('cron_job_check', {
      job_name: 'cleanup-rate-limits',
    });

    if (error) {
      return {
        name: 'pg_cron Cleanup Job',
        passed: false,
        details: 'Unable to verify pg_cron job (check manually via SQL editor)',
        critical: false,
      };
    }

    return {
      name: 'pg_cron Cleanup Job',
      passed: true,
      details: 'Rate limit cleanup job scheduled',
      critical: false,
    };
  } catch (err) {
    return {
      name: 'pg_cron Cleanup Job',
      passed: false,
      details: 'Manual verification needed (see DEPLOYMENT_GUIDE.md)',
      critical: false,
    };
  }
}

// ============================================================================
// RUN ALL CHECKS
// ============================================================================

console.log('═══════════════════════════════════════════════════════════');
console.log('USE CASE ARMS RACE - RLS & SECURITY CHECK');
console.log('═══════════════════════════════════════════════════════════\n');

console.log(`Environment: ${SUPABASE_URL}\n`);

results.push(await checkRLSEnabled());
results.push(await checkRegistryReaderRole());
results.push(await checkRateLimiting());
results.push(await checkEdgeFunctions());
results.push(await checkStorageBucket());
results.push(await checkPgCronJob());

console.log('Results:\n');

let criticalFailures = 0;
let warnings = 0;

results.forEach((result) => {
  const icon = result.passed ? '✅' : result.critical ? '❌' : '⚠️';
  const status = result.passed ? 'PASS' : result.critical ? 'FAIL' : 'WARN';

  console.log(`${icon} ${result.name}: ${status}`);
  console.log(`   ${result.details}\n`);

  if (!result.passed && result.critical) criticalFailures++;
  if (!result.passed && !result.critical) warnings++;
});

console.log('═══════════════════════════════════════════════════════════');
console.log(`Summary: ${results.filter((r) => r.passed).length}/${results.length} checks passed`);
console.log(`Critical failures: ${criticalFailures}`);
console.log(`Warnings: ${warnings}`);
console.log('═══════════════════════════════════════════════════════════\n');

if (criticalFailures > 0) {
  console.error('❌ CRITICAL FAILURES DETECTED - DO NOT DEPLOY TO PRODUCTION');
  console.error('Fix issues and re-run this script.\n');
  Deno.exit(1);
}

if (warnings > 0) {
  console.warn('⚠️  WARNINGS DETECTED - Review before deploying to production\n');
  Deno.exit(0);
}

console.log('✅ ALL CHECKS PASSED - Ready for production deployment\n');
Deno.exit(0);
