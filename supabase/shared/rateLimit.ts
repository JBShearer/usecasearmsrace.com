/**
 * RATE LIMITING UTILITIES
 *
 * Provides per-user per-function rate limiting for edge functions.
 * Default: 30 calls per minute (configurable via UCAR_CONFIG.RATE_LIMIT_DEFAULT)
 *
 * Usage in edge functions:
 * ```typescript
 * import { checkRateLimit } from '../shared/rateLimit.ts';
 *
 * const userId = auth.user?.id || req.headers.get('x-anon-id') || 'anonymous';
 * const limited = await checkRateLimit(userId, 'submit-verdict');
 * if (limited) {
 *   return new Response('Too many requests', { status: 429 });
 * }
 * ```
 *
 * Source: TASKS.md Phase 0, Task 0.3
 */

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { UCAR_CONFIG } from '../../config/economy.ts';

/**
 * Check if user has exceeded rate limit for this function
 *
 * @param userId - User ID (UUID) or anonymous ID (x-anon-id header)
 * @param functionName - Edge function name (e.g., 'submit-verdict')
 * @param limit - Max calls per minute (default from config)
 * @returns true if rate limit exceeded, false if within limit
 */
export async function checkRateLimit(
  userId: string,
  functionName: string,
  limit: number = UCAR_CONFIG.RATE_LIMIT_DEFAULT
): Promise<boolean> {
  const supabase = getSupabaseClient();

  // Round current time to minute bucket
  const bucket = new Date();
  bucket.setSeconds(0, 0);

  try {
    // Atomically increment call count via RPC
    const { data, error } = await supabase.rpc('increment_rate_limit', {
      p_user_id: userId,
      p_function_name: functionName,
      p_bucket: bucket.toISOString(),
    });

    if (error) {
      console.error('Rate limit check error:', error);
      // On error, fail open (don't block user, but log for investigation)
      return false;
    }

    const callCount = data?.[0]?.call_count || 0;

    // Check if limit exceeded
    if (callCount > limit) {
      console.warn(`Rate limit exceeded: ${userId} / ${functionName} (${callCount}/${limit})`);
      return true;
    }

    return false;
  } catch (err) {
    console.error('Rate limit exception:', err);
    return false; // Fail open
  }
}

/**
 * Get current call count for user+function (for debugging/monitoring)
 *
 * @param userId - User ID or anonymous ID
 * @param functionName - Edge function name
 * @returns Current call count in this minute bucket, or 0 if not found
 */
export async function getCurrentCallCount(
  userId: string,
  functionName: string
): Promise<number> {
  const supabase = getSupabaseClient();

  const bucket = new Date();
  bucket.setSeconds(0, 0);

  const { data } = await supabase
    .from('rate_limits')
    .select('call_count')
    .eq('user_id', userId)
    .eq('function_name', functionName)
    .eq('minute_bucket', bucket.toISOString())
    .single();

  return data?.call_count || 0;
}

/**
 * Get rate limit stats for monitoring dashboard
 *
 * @returns Array of {user_id, function_name, call_count, minute_bucket}
 */
export async function getRateLimitStats(): Promise<
  Array<{
    user_id: string;
    function_name: string;
    call_count: number;
    minute_bucket: string;
  }>
> {
  const supabase = getSupabaseClient();

  // Get top rate-limited users in last 5 minutes
  const { data } = await supabase
    .from('rate_limits')
    .select('*')
    .gte('minute_bucket', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order('call_count', { ascending: false })
    .limit(100);

  return data || [];
}

/**
 * Clear rate limits for a user (admin function)
 *
 * @param userId - User ID to clear
 */
export async function clearRateLimits(userId: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase.from('rate_limits').delete().eq('user_id', userId);

  console.log(`Cleared rate limits for user: ${userId}`);
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

let _supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    _supabaseClient = createClient(url, key);
  }

  return _supabaseClient;
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example: Rate-limited edge function
 *
 * ```typescript
 * // supabase/functions/submit-verdict/index.ts
 * import { checkRateLimit } from '../shared/rateLimit.ts';
 *
 * Deno.serve(async (req) => {
 *   // Extract user identity
 *   const authHeader = req.headers.get('Authorization');
 *   const anonId = req.headers.get('x-anon-id');
 *   const userId = extractUserIdFromAuth(authHeader) || anonId || 'anonymous';
 *
 *   // Check rate limit
 *   if (await checkRateLimit(userId, 'submit-verdict')) {
 *     return new Response(JSON.stringify({
 *       error: 'Too many requests. Please wait a minute.',
 *       retryAfter: 60
 *     }), {
 *       status: 429,
 *       headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
 *     });
 *   }
 *
 *   // Process request...
 *   return new Response(JSON.stringify({ success: true }), {
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 * });
 * ```
 */

/**
 * Example: Monitoring dashboard endpoint
 *
 * ```typescript
 * // supabase/functions/admin-stats/index.ts
 * import { getRateLimitStats } from '../shared/rateLimit.ts';
 *
 * Deno.serve(async (req) => {
 *   // Check admin auth...
 *
 *   const stats = await getRateLimitStats();
 *   return new Response(JSON.stringify(stats), {
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 * });
 * ```
 */
