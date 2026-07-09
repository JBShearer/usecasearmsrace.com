/**
 * feed-query: Timeline feed with tabs (Latest, Top, Under Fire, Flips)
 *
 * Phase U1, Task U1.8: Tab Queries
 *
 * Returns paginated case feed with different sorting strategies.
 * Supports cursor pagination and real-time updates via Supabase Realtime.
 *
 * Source: TASKS.md Phase U1, UCAR_REGISTRY_BUILD_PLAN section 2.3
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { topScore } from '../../../config/economy.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-anon-id',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

type TabType = 'latest' | 'top' | 'under_fire' | 'flips';

interface FeedRequest {
  tab: TabType;
  limit?: number;
  cursor?: string; // Cursor for pagination
}

interface FeedResponse {
  cases: Array<{
    id: string;
    title: string;
    summary: string;
    subject: string;
    verb: string;
    object: string;
    category: string;
    impact: number;
    faction: 'heaven' | 'hell';
    good_votes: number;
    evil_votes: number;
    votes_total: number;
    status: string;
    created_at: string;
    faction_flipped_at?: string;
    card_art_url?: string;
    top_score?: number;
  }>;
  next_cursor?: string;
  has_more: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // Rate limiting (read-only, higher limit)
    const userId = req.headers.get('x-anon-id') || 'anonymous';
    if (await checkRateLimit(userId, 'feed-query', 100)) {
      return jsonResponse(429, { error: 'Too many requests' });
    }

    const url = new URL(req.url);
    const tab = (url.searchParams.get('tab') || 'latest') as TabType;
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const cursor = url.searchParams.get('cursor') || undefined;

    let query;
    let cases: any[] = [];

    switch (tab) {
      case 'latest':
        query = supabase
          .from('use_cases')
          .select(
            `
            *,
            cards!inner(art_url)
          `
          )
          .in('status', ['machine_verified', 'under_review'])
          .order('created_at', { ascending: false })
          .limit(limit);

        if (cursor) {
          query = query.lt('created_at', cursor);
        }

        const { data: latestData } = await query;
        cases = latestData || [];
        break;

      case 'top':
        // Fetch recent cases and compute top score client-side
        // (Future optimization: precompute scores via materialized view)
        const { data: topData } = await supabase
          .from('use_cases')
          .select(
            `
            *,
            cards!inner(art_url)
          `
          )
          .in('status', ['machine_verified', 'under_review'])
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(limit * 3); // Fetch more, then sort

        cases = (topData || [])
          .map((c) => {
            const ageHours =
              (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60);
            const votesTotal = (c.good_votes || 0) + (c.evil_votes || 0);
            return {
              ...c,
              top_score: topScore(votesTotal, ageHours),
            };
          })
          .sort((a, b) => b.top_score - a.top_score)
          .slice(0, limit);
        break;

      case 'under_fire':
        // Cases under review OR with active battles (EBL integration)
        query = supabase
          .from('use_cases')
          .select(
            `
            *,
            cards!inner(art_url)
          `
          )
          .eq('status', 'under_review')
          .order('created_at', { ascending: false })
          .limit(limit);

        // TODO: Add JOIN to EBL battles table when Phase 3-4 complete
        // .or('id.in.(SELECT product_id FROM battles WHERE state != "resolved")')

        const { data: underFireData } = await query;
        cases = underFireData || [];
        break;

      case 'flips':
        // Cases whose faction flipped in last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = supabase
          .from('use_cases')
          .select(
            `
            *,
            cards!inner(art_url, faction, faction_flipped_at)
          `
          )
          .gte('cards.faction_flipped_at', thirtyDaysAgo)
          .order('cards.faction_flipped_at', { ascending: false })
          .limit(limit);

        const { data: flipsData } = await query;
        cases = flipsData || [];
        break;

      default:
        return jsonResponse(400, { error: 'Invalid tab' });
    }

    // Format response
    const formattedCases = cases.map((c) => ({
      id: c.id,
      title: c.title || `${c.subject} ${c.verb} ${c.object}`,
      summary: c.summary || '',
      subject: c.subject || '',
      verb: c.verb || '',
      object: c.object || '',
      category: c.category || 'unknown',
      impact: c.impact || 1,
      faction: computeFaction(c.good_votes || 0, c.evil_votes || 0),
      good_votes: c.good_votes || 0,
      evil_votes: c.evil_votes || 0,
      votes_total: (c.good_votes || 0) + (c.evil_votes || 0),
      status: c.status || 'unknown',
      created_at: c.created_at,
      faction_flipped_at: c.cards?.faction_flipped_at,
      card_art_url: c.cards?.art_url,
      top_score: c.top_score,
    }));

    const hasMore = formattedCases.length === limit;
    const nextCursor = hasMore
      ? formattedCases[formattedCases.length - 1].created_at
      : undefined;

    return jsonResponse(200, {
      cases: formattedCases,
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (err) {
    console.error('Feed query error:', err);
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

function computeFaction(goodVotes: number, evilVotes: number): 'heaven' | 'hell' {
  const total = goodVotes + evilVotes;
  if (total === 0) return 'heaven'; // Default
  return goodVotes / total >= 0.5 ? 'heaven' : 'hell';
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
