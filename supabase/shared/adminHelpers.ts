/**
 * ADMIN HELPER UTILITIES
 *
 * Common functions used by admin.html and admin edge functions.
 * Provides user management, case management, and monitoring helpers.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Check if user has admin role
 */
export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_profiles')
    .select('role, rank')
    .eq('id', userId)
    .single();

  return data?.role === 'admin' || data?.rank === 'council';
}

/**
 * Get user profile with stats
 */
export async function getUserProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Grant admin role to user
 */
export async function grantAdminRole(
  supabase: SupabaseClient,
  userId: string,
  grantedBy: string
): Promise<void> {
  await supabase.from('user_profiles').update({ role: 'admin' }).eq('id', userId);

  // Log event
  await supabase.from('reputation_events').insert({
    user_id: userId,
    event: 'admin_granted',
    delta: 0,
    reason: `Admin role granted by ${grantedBy}`,
  });
}

// ============================================================================
// CASE MANAGEMENT
// ============================================================================

/**
 * Get all cases needing human review
 */
export async function getNeedsHumanQueue(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('use_cases')
    .select('*, verifications(*)')
    .eq('status', 'needs_human')
    .order('created_at', { ascending: true }); // Oldest first

  if (error) throw error;
  return data;
}

/**
 * Get all cases under review (complaints)
 */
export async function getReviewQueue(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('review_queue')
    .select(
      `
      *,
      use_cases!inner(*),
      complaints!inner(*)
    `
    )
    .order('opened_at', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Approve case (needs_human → machine_verified)
 */
export async function approveCase(
  supabase: SupabaseClient,
  caseId: string,
  adminId: string,
  reason: string
): Promise<void> {
  // Update status
  await supabase.from('use_cases').update({ status: 'machine_verified' }).eq('id', caseId);

  // Log status change
  await supabase.from('case_status_log').insert({
    case_id: caseId,
    from_status: 'needs_human',
    to_status: 'machine_verified',
    actor: `human:${adminId}`,
    reason,
  });

  // Trigger card minting
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mint-card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ case_id: caseId }),
  });
}

/**
 * Reject case (needs_human → rejected)
 */
export async function rejectCase(
  supabase: SupabaseClient,
  caseId: string,
  adminId: string,
  reason: string
): Promise<void> {
  await supabase.from('use_cases').update({ status: 'rejected' }).eq('id', caseId);

  await supabase.from('case_status_log').insert({
    case_id: caseId,
    from_status: 'needs_human',
    to_status: 'rejected',
    actor: `human:${adminId}`,
    reason,
  });
}

/**
 * Correct and reinstate case (under_review → machine_verified)
 */
export async function correctAndReinstate(
  supabase: SupabaseClient,
  caseId: string,
  updates: Record<string, any>,
  adminId: string,
  reason: string
): Promise<void> {
  // Update case fields
  await supabase.from('use_cases').update(updates).eq('id', caseId);

  // Update status
  await supabase.from('use_cases').update({ status: 'machine_verified' }).eq('id', caseId);

  // Log correction with diff
  await supabase.from('case_status_log').insert({
    case_id: caseId,
    from_status: 'under_review',
    to_status: 'machine_verified',
    actor: `human:${adminId}`,
    reason: `Corrected: ${reason}. Fields updated: ${Object.keys(updates).join(', ')}`,
  });

  // Re-mint card if title/category/impact changed
  if (updates.title || updates.category || updates.impact) {
    // Delete old card
    await supabase.from('cards').delete().eq('case_id', caseId);

    // Re-mint
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mint-card`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ case_id: caseId }),
    });
  }
}

/**
 * Retract case (terminal status)
 */
export async function retractCase(
  supabase: SupabaseClient,
  caseId: string,
  adminId: string,
  reason: string
): Promise<void> {
  await supabase.from('use_cases').update({ status: 'retracted' }).eq('id', caseId);

  await supabase.from('case_status_log').insert({
    case_id: caseId,
    from_status: 'under_review',
    to_status: 'retracted',
    actor: `human:${adminId}`,
    reason,
  });

  // Mark card as unplayable (EBL side handles dissolution)
  await supabase.from('cards').update({ status: 'retracted' }).eq('case_id', caseId);

  // Log card event
  const { data: card } = await supabase.from('cards').select('id').eq('case_id', caseId).single();
  if (card) {
    await supabase.from('card_events').insert({
      card_id: card.id,
      type: 'retracted',
      payload: { reason },
    });
  }
}

// ============================================================================
// COMPLAINT MANAGEMENT
// ============================================================================

/**
 * Dismiss complaint
 */
export async function dismissComplaint(
  supabase: SupabaseClient,
  complaintId: string,
  reason: string
): Promise<void> {
  await supabase.from('complaints').update({ status: 'dismissed', triage_memo: reason }).eq('id', complaintId);

  // Clear contested flag if no other open complaints
  const { data: complaint } = await supabase
    .from('complaints')
    .select('case_id')
    .eq('id', complaintId)
    .single();

  if (complaint) {
    const { count } = await supabase
      .from('complaints')
      .select('*', { count: 'exact' })
      .eq('case_id', complaint.case_id)
      .eq('status', 'open');

    if (count === 0) {
      await supabase.from('use_cases').update({ contested: false }).eq('id', complaint.case_id);
    }
  }
}

// ============================================================================
// MONITORING & STATS
// ============================================================================

/**
 * Get system health metrics
 */
export async function getSystemMetrics(supabase: SupabaseClient) {
  const [casesTotal, casesVerified, casesReview, usersTotal, cardsTotal] = await Promise.all([
    supabase.from('use_cases').select('*', { count: 'exact', head: true }),
    supabase.from('use_cases').select('*', { count: 'exact', head: true }).eq('status', 'machine_verified'),
    supabase.from('use_cases').select('*', { count: 'exact', head: true }).eq('status', 'under_review'),
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('cards').select('*', { count: 'exact', head: true }),
  ]);

  return {
    cases: {
      total: casesTotal.count || 0,
      verified: casesVerified.count || 0,
      underReview: casesReview.count || 0,
    },
    users: {
      total: usersTotal.count || 0,
    },
    cards: {
      total: cardsTotal.count || 0,
    },
  };
}

/**
 * Get rate limit violations in last hour
 */
export async function getRateLimitViolations(supabase: SupabaseClient) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('rate_limits')
    .select('*')
    .gte('minute_bucket', oneHourAgo)
    .gte('call_count', 30) // Above default limit
    .order('call_count', { ascending: false })
    .limit(50);

  return data || [];
}

/**
 * Get recent case submissions (last 24h)
 */
export async function getRecentSubmissions(supabase: SupabaseClient) {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('use_cases')
    .select('*, user_profiles(wallet_id, reputation)')
    .gte('created_at', yesterday)
    .order('created_at', { ascending: false })
    .limit(50);

  return data || [];
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Export case data as JSON (for backups)
 */
export async function exportCases(supabase: SupabaseClient, filters?: Record<string, any>) {
  let query = supabase.from('use_cases').select('*');

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
  }

  const { data } = await query;
  return data || [];
}

/**
 * Export user data (GDPR compliance)
 */
export async function exportUserData(supabase: SupabaseClient, userId: string) {
  const [profile, submissions, votes, cards] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', userId).single(),
    supabase.from('triple_submissions').select('*').eq('user_id', userId),
    supabase.from('votes').select('*').eq('user_id', userId),
    supabase.from('user_cards').select('*').eq('user_id', userId),
  ]);

  return {
    profile: profile.data,
    submissions: submissions.data || [],
    votes: votes.data || [],
    cards: cards.data || [],
  };
}
