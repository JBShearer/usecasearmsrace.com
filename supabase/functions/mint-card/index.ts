/**
 * mint-card: Deterministic card minting from registry cases
 *
 * Phase EBL-1, Task EBL1.2: Mint Function
 *
 * Features:
 * - Deterministic: same case_id → same card always
 * - Procedural backgrounds (no external assets)
 * - SVG → PNG rasterization (1024x768)
 * - Idempotent: safe to re-run
 * - Triggers on case approval (autoverify → machine_verified)
 *
 * Source: TASKS.md Phase EBL-1, EBL_BATTLER_BUILD_PLAN section 4
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { generateBackground } from '../../shared/backgroundGenerator.ts';
import { cardPower, cardFaction, cardRarity } from '../../../config/economy.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface MintRequest {
  case_id: string;
}

interface MintResponse {
  success: boolean;
  card?: {
    id: string;
    case_id: string;
    name: string;
    power: number;
    rarity: string;
    faction: string;
    art_url: string;
  };
  error?: string;
  skipped?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const { case_id }: MintRequest = await req.json();

    if (!case_id) {
      return jsonResponse(400, { success: false, error: 'case_id required' });
    }

    // Check if card already exists (idempotency)
    const { data: existing } = await supabase
      .from('cards')
      .select('id, art_url')
      .eq('case_id', case_id)
      .single();

    if (existing) {
      return jsonResponse(200, {
        success: true,
        skipped: 'Card already exists for this case',
        card: existing,
      });
    }

    // Fetch case details
    const { data: useCase, error: fetchError } = await supabase
      .from('use_cases')
      .select('*')
      .eq('id', case_id)
      .single();

    if (fetchError || !useCase) {
      return jsonResponse(404, {
        success: false,
        error: `Case not found: ${case_id}`,
      });
    }

    // Derive card stats (EBL_BATTLER_BUILD_PLAN section 4.3)
    const impact = useCase.impact || 1;
    const goodVotes = useCase.good_votes || 0;
    const evilVotes = useCase.evil_votes || 0;
    const totalVotes = goodVotes + evilVotes;

    const power = cardPower(impact);
    const alignmentRatio = totalVotes > 0 ? goodVotes / totalVotes : 0.5;
    const faction = cardFaction(alignmentRatio);
    const rarity = cardRarity(impact);

    // Generate procedural background
    const backgroundSvg = generateBackground(case_id, faction, 1024, 768);

    // Render card SVG (simplified version - integrate with existing SVG renderer)
    const cardSvg = renderCardSVG({
      name: useCase.title || useCase.subject || 'Untitled Case',
      category: useCase.category || 'unknown',
      impact,
      power,
      faction,
      rarity,
      background: backgroundSvg,
      sourceUrl: useCase.source_url,
      caseId: case_id,
    });

    // TODO: Rasterize SVG → PNG (requires external service or Deno canvas)
    // For now, store SVG directly and generate PNG URL placeholder
    const artSeed = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(case_id)
    );
    const artSeedHex = Array.from(new Uint8Array(artSeed))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Store SVG in Supabase Storage
    const svgPath = `cards/${case_id}.svg`;
    const { error: uploadError } = await supabase.storage
      .from('cards')
      .upload(svgPath, cardSvg, {
        contentType: 'image/svg+xml',
        upsert: true,
      });

    if (uploadError) {
      console.error('SVG upload error:', uploadError);
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('cards').getPublicUrl(svgPath);
    const artUrl = urlData.publicUrl;

    // Insert card into database
    const { data: card, error: insertError } = await supabase
      .from('cards')
      .insert({
        case_id,
        name: useCase.title || useCase.subject || 'Untitled Case',
        category: useCase.category || 'unknown',
        impact,
        power,
        rarity,
        faction,
        alignment_ratio: alignmentRatio,
        art_url: artUrl,
        art_seed: artSeedHex,
        source_url: useCase.source_url || '',
      })
      .select()
      .single();

    if (insertError) {
      return jsonResponse(500, {
        success: false,
        error: `Failed to insert card: ${insertError.message}`,
      });
    }

    // Log card event
    await supabase.from('card_events').insert({
      card_id: card.id,
      type: 'minted',
      payload: { case_id, impact, faction, rarity },
    });

    return jsonResponse(200, {
      success: true,
      card: {
        id: card.id,
        case_id: card.case_id,
        name: card.name,
        power: card.power,
        rarity: card.rarity,
        faction: card.faction,
        art_url: card.art_url,
      },
    });
  } catch (err) {
    console.error('Mint card error:', err);
    return jsonResponse(500, {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

function renderCardSVG(params: {
  name: string;
  category: string;
  impact: number;
  power: number;
  faction: 'heaven' | 'hell';
  rarity: string;
  background: string;
  sourceUrl: string;
  caseId: string;
}): string {
  const { name, category, impact, power, faction, rarity, background, sourceUrl, caseId } =
    params;

  // Color schemes
  const colors = {
    heaven: {
      frame: '#D4A84C',
      text: '#1A1817',
      accent: '#B89A3C',
    },
    hell: {
      frame: '#C1121F',
      text: '#F5F0E6',
      accent: '#8B0000',
    },
  };

  const c = colors[faction];

  // Impact pips (stars)
  const pips = Array.from({ length: impact }, (_, i) => {
    const x = 50 + i * 30;
    return `<circle cx="${x}" cy="50" r="8" fill="${c.accent}" />`;
  }).join('');

  // Rarity indicator
  const rarityColor =
    rarity === 'legendary'
      ? '#FFD700'
      : rarity === 'rare'
      ? '#9B59B6'
      : rarity === 'uncommon'
      ? '#3498DB'
      : '#95A5A6';

  return `<svg width="1024" height="768" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  ${background}

  <!-- Frame -->
  <rect x="20" y="20" width="984" height="728" fill="none" stroke="${c.frame}" stroke-width="8" rx="10"/>
  <rect x="30" y="30" width="964" height="708" fill="none" stroke="${c.frame}" stroke-width="4" rx="8" opacity="0.5"/>

  <!-- Title -->
  <text x="512" y="80" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="${c.text}" text-anchor="middle">
    ${escapeXml(name)}
  </text>

  <!-- Category -->
  <text x="512" y="120" font-family="Arial, sans-serif" font-size="20" fill="${c.text}" text-anchor="middle" opacity="0.7">
    ${escapeXml(category.toUpperCase())}
  </text>

  <!-- Impact Pips -->
  <g transform="translate(362, 680)">
    ${pips}
  </g>

  <!-- Power -->
  <text x="100" y="700" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="${c.frame}">
    ${power}
  </text>
  <text x="100" y="730" font-family="Arial, sans-serif" font-size="16" fill="${c.text}" opacity="0.7">
    POWER
  </text>

  <!-- Rarity Badge -->
  <rect x="850" y="660" width="120" height="40" fill="${rarityColor}" opacity="0.8" rx="5"/>
  <text x="910" y="688" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#FFFFFF" text-anchor="middle">
    ${rarity.toUpperCase()}
  </text>

  <!-- Faction Badge -->
  <text x="512" y="160" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${c.frame}" text-anchor="middle">
    ${faction === 'heaven' ? '☀️ HEAVEN' : '🔥 HELL'}
  </text>

  <!-- Source URL (small) -->
  <text x="512" y="750" font-family="monospace" font-size="12" fill="${c.text}" text-anchor="middle" opacity="0.5">
    ${escapeXml(sourceUrl)}
  </text>

  <!-- Case ID (very small) -->
  <text x="1000" y="760" font-family="monospace" font-size="10" fill="${c.text}" text-anchor="end" opacity="0.3">
    ${caseId.slice(0, 8)}
  </text>
</svg>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
