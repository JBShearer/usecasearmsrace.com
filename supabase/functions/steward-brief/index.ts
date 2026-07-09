/**
 * steward-brief: Daily morning brief for show production
 *
 * Phase SHOW, Task SHOW.2: Steward Brief Function
 *
 * Runs at 05:30 UTC via pg_cron (configurable in SHOW_CONFIG)
 * Compiles candidate cases for "Case of the Day" selection.
 *
 * Output: Neutral prose, case IDs cited, no jokes (steward voice)
 * Delivery: Admin inbox + dashboard
 *
 * Source: SHOW_LAUNCH_RUNBOOK section 3
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface BriefSection {
  title: string;
  items: Array<{
    case_id: string;
    title: string;
    summary: string;
    votes_total: number;
    created_at: string;
    reason: string;
  }>;
}

interface StewartBrief {
  date: string;
  sections: {
    topNewCases: BriefSection;
    overnightFlips: BriefSection;
    battleResults: BriefSection;
    reviewOutcomes: BriefSection;
    anomalies: BriefSection;
  };
  recommendations: string[];
}

Deno.serve(async (req) => {
  try {
    console.log('Steward Brief: Starting daily compilation...');

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Section 1: Top New Cases (last 24h, by votes)
    const { data: newCases } = await supabase
      .from('use_cases')
      .select('*')
      .eq('status', 'machine_verified')
      .gte('created_at', yesterday)
      .order('good_votes', { ascending: false })
      .order('evil_votes', { ascending: false })
      .limit(10);

    const topNewCases: BriefSection = {
      title: 'Top New Cases (Last 24 Hours)',
      items: (newCases || []).map((c) => ({
        case_id: c.id,
        title: c.title || `${c.subject} ${c.verb} ${c.object}`,
        summary: c.summary || 'No summary',
        votes_total: (c.good_votes || 0) + (c.evil_votes || 0),
        created_at: c.created_at,
        reason: `${c.votes_total} votes, ${c.impact}/5 impact`,
      })),
    };

    // Section 2: Overnight Flips (faction changed in last 24h)
    const { data: flips } = await supabase
      .from('cards')
      .select('*, use_cases!inner(*)')
      .gte('faction_flipped_at', yesterday)
      .order('faction_flipped_at', { ascending: false });

    const overnightFlips: BriefSection = {
      title: 'Overnight Faction Flips',
      items: (flips || []).map((c) => ({
        case_id: c.case_id,
        title: c.name,
        summary: c.use_cases?.summary || '',
        votes_total: (c.use_cases?.good_votes || 0) + (c.use_cases?.evil_votes || 0),
        created_at: c.faction_flipped_at || '',
        reason: `Flipped to ${c.faction} at ${new Date(c.faction_flipped_at).toLocaleTimeString()}`,
      })),
    };

    // Section 3: Battle Results (requires EBL Phase 3-4)
    // TODO: Query battles table when available
    const battleResults: BriefSection = {
      title: 'Battle Results',
      items: [],
      // Future: SELECT * FROM battles WHERE resolved_at >= yesterday
    };

    // Section 4: Review Outcomes (complaints resolved)
    const { data: reviewOutcomes } = await supabase
      .from('case_status_log')
      .select('*, use_cases!inner(*)')
      .gte('created_at', yesterday)
      .in('to_status', ['machine_verified', 'retracted'])
      .order('created_at', { ascending: false });

    const reviewOutcomesSection: BriefSection = {
      title: 'Review Outcomes (Complaints Resolved)',
      items: (reviewOutcomes || []).map((log) => ({
        case_id: log.case_id,
        title: log.use_cases?.title || 'Unknown case',
        summary: log.reason || 'No reason provided',
        votes_total: 0,
        created_at: log.created_at,
        reason: `${log.from_status} → ${log.to_status} by ${log.actor}`,
      })),
    };

    // Section 5: Anomalies (high complaint volume, dead sources, etc.)
    const { data: highComplaintCases } = await supabase
      .from('complaints')
      .select('case_id, count(*)')
      .gte('created_at', yesterday)
      .eq('status', 'open')
      .group('case_id')
      .having('count(*)', 'gt', 3);

    const anomalies: BriefSection = {
      title: 'Anomalies & Alerts',
      items: (highComplaintCases || []).map((c: any) => ({
        case_id: c.case_id,
        title: 'Case under heavy complaint',
        summary: `${c.count} open complaints filed`,
        votes_total: 0,
        created_at: today,
        reason: `Potential brigade or factual issue - review urgently`,
      })),
    };

    // Generate recommendations for Case of the Day
    const recommendations = generateRecommendations(topNewCases, overnightFlips);

    const brief: StewartBrief = {
      date: today,
      sections: {
        topNewCases,
        overnightFlips,
        battleResults,
        reviewOutcomes: reviewOutcomesSection,
        anomalies,
      },
      recommendations,
    };

    // Format as neutral prose (steward voice)
    const briefText = formatBriefAsText(brief);

    // Store in admin inbox (future: send email)
    console.log('Steward Brief compiled:');
    console.log(briefText);

    // TODO: Store in admin_inbox table or send email
    // await supabase.from('admin_inbox').insert({
    //   subject: `Steward Brief: ${today}`,
    //   body: briefText,
    //   created_at: new Date().toISOString()
    // });

    return new Response(
      JSON.stringify({
        success: true,
        brief,
        briefText,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Steward Brief error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateRecommendations(
  newCases: BriefSection,
  flips: BriefSection
): string[] {
  const recommendations: string[] = [];

  // Recommend top 3 new cases by vote volume
  const topByVotes = newCases.items.slice(0, 3);
  topByVotes.forEach((c, i) => {
    recommendations.push(
      `Rank ${i + 1}: ${c.case_id.slice(0, 8)} - ${c.votes_total} votes, ${c.reason}`
    );
  });

  // Recommend flips (dramatic narrative)
  if (flips.items.length > 0) {
    recommendations.push(
      `Notable flip: ${flips.items[0].case_id.slice(0, 8)} - ${flips.items[0].reason}`
    );
  }

  return recommendations;
}

function formatBriefAsText(brief: StewartBrief): string {
  let text = `USE CASE ARMS RACE - STEWARD BRIEF\nDate: ${brief.date}\n\n`;

  text += '═══════════════════════════════════════════════════════════\n';
  text += 'TOP NEW CASES (Last 24 Hours)\n';
  text += '═══════════════════════════════════════════════════════════\n\n';

  brief.sections.topNewCases.items.forEach((item, i) => {
    text += `${i + 1}. ${item.title}\n`;
    text += `   Case ID: ${item.case_id}\n`;
    text += `   Summary: ${item.summary}\n`;
    text += `   Votes: ${item.votes_total} | ${item.reason}\n\n`;
  });

  if (brief.sections.overnightFlips.items.length > 0) {
    text += '\n═══════════════════════════════════════════════════════════\n';
    text += 'OVERNIGHT FACTION FLIPS\n';
    text += '═══════════════════════════════════════════════════════════\n\n';

    brief.sections.overnightFlips.items.forEach((item, i) => {
      text += `${i + 1}. ${item.title}\n`;
      text += `   Case ID: ${item.case_id}\n`;
      text += `   ${item.reason}\n\n`;
    });
  }

  if (brief.sections.reviewOutcomes.items.length > 0) {
    text += '\n═══════════════════════════════════════════════════════════\n';
    text += 'REVIEW OUTCOMES\n';
    text += '═══════════════════════════════════════════════════════════\n\n';

    brief.sections.reviewOutcomes.items.forEach((item, i) => {
      text += `${i + 1}. ${item.title}\n`;
      text += `   ${item.reason}\n\n`;
    });
  }

  if (brief.sections.anomalies.items.length > 0) {
    text += '\n═══════════════════════════════════════════════════════════\n';
    text += 'ANOMALIES & ALERTS\n';
    text += '═══════════════════════════════════════════════════════════\n\n';

    brief.sections.anomalies.items.forEach((item, i) => {
      text += `${i + 1}. ${item.title}\n`;
      text += `   Case ID: ${item.case_id}\n`;
      text += `   ${item.summary}\n`;
      text += `   Action: ${item.reason}\n\n`;
    });
  }

  text += '\n═══════════════════════════════════════════════════════════\n';
  text += 'CASE OF THE DAY RECOMMENDATIONS\n';
  text += '═══════════════════════════════════════════════════════════\n\n';

  brief.recommendations.forEach((rec) => {
    text += `• ${rec}\n`;
  });

  text += '\n═══════════════════════════════════════════════════════════\n';
  text += 'END OF BRIEF\n';
  text += '═══════════════════════════════════════════════════════════\n';

  return text;
}
