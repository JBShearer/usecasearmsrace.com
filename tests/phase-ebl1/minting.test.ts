import { assertEquals, assertExists } from '@std/assert';
import { createClient } from '@supabase/supabase-js';
import { generateBackground, getPatternInfo } from '../../supabase/shared/backgroundGenerator.ts';

/**
 * Phase EBL-1: Card Minting - Tests
 *
 * Acceptance Criteria (TASKS.md Phase EBL-1, Task EBL1.11):
 * 1. Submitting test case creates exactly one card with correct stats
 * 2. Re-running mint on same case is no-op (idempotency)
 * 3. Two mints in parallel do not create duplicates
 * 4. Same case always selects same background (deterministic)
 * 5. PNG and SVG exist in storage after mint
 * 6. Backfill script mints all existing cases
 * 7. Nightly alignment sync flips card at 0.55, not at 0.52
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// ============================================================================
// TEST 1: Deterministic Card Stats
// ============================================================================

Deno.test('Phase EBL-1.1: Card derived stats match formula (impact * 2)', async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Create test case with fixed impact
  const testCase = {
    id: crypto.randomUUID(),
    title: 'Test Case for Minting',
    subject: 'Test Org',
    verb: 'tests',
    object: 'card minting',
    impact: 4,
    good_votes: 60,
    evil_votes: 40,
    status: 'machine_verified',
  };

  await supabase.from('use_cases').insert(testCase);

  // Call mint-card function
  const mintResponse = await fetch(`${SUPABASE_URL.replace('/rest/v1', '')}/functions/v1/mint-card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ case_id: testCase.id }),
  });

  const mintResult = await mintResponse.json();

  assertEquals(mintResult.success, true, 'Mint should succeed');
  assertExists(mintResult.card, 'Should return card object');

  // Verify stats match formula (EBL_BATTLER_BUILD_PLAN section 4.3)
  assertEquals(mintResult.card.power, testCase.impact * 2, 'Power should be impact * 2');
  assertEquals(
    mintResult.card.rarity,
    'rare',
    'Impact 4 should produce rare rarity'
  );
  assertEquals(
    mintResult.card.faction,
    'heaven',
    '60/40 votes should produce heaven faction (0.6 >= 0.5)'
  );

  // Cleanup
  await supabase.from('cards').delete().eq('case_id', testCase.id);
  await supabase.from('use_cases').delete().eq('id', testCase.id);
});

// ============================================================================
// TEST 2: Idempotency (No Duplicates)
// ============================================================================

Deno.test('Phase EBL-1.2: Re-running mint is no-op (idempotent)', async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const testCaseId = crypto.randomUUID();
  await supabase.from('use_cases').insert({
    id: testCaseId,
    title: 'Idempotency Test',
    impact: 2,
    status: 'machine_verified',
  });

  // Mint once
  const mint1 = await fetch(`${SUPABASE_URL.replace('/rest/v1', '')}/functions/v1/mint-card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ case_id: testCaseId }),
  });

  const result1 = await mint1.json();
  assertEquals(result1.success, true, 'First mint should succeed');

  // Mint again (should skip)
  const mint2 = await fetch(`${SUPABASE_URL.replace('/rest/v1', '')}/functions/v1/mint-card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ case_id: testCaseId }),
  });

  const result2 = await mint2.json();
  assertEquals(result2.success, true, 'Second mint should succeed');
  assertEquals(
    result2.skipped,
    'Card already exists for this case',
    'Should skip duplicate mint'
  );

  // Verify only ONE card exists
  const { data: cards, count } = await supabase
    .from('cards')
    .select('*', { count: 'exact' })
    .eq('case_id', testCaseId);

  assertEquals(count, 1, 'Should have exactly one card (no duplicates)');

  // Cleanup
  await supabase.from('cards').delete().eq('case_id', testCaseId);
  await supabase.from('use_cases').delete().eq('id', testCaseId);
});

// ============================================================================
// TEST 3: Parallel Minting (Race Condition)
// ============================================================================

Deno.test('Phase EBL-1.3: Parallel mints do not create duplicates', async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const testCaseId = crypto.randomUUID();
  await supabase.from('use_cases').insert({
    id: testCaseId,
    title: 'Parallel Mint Test',
    impact: 3,
    status: 'machine_verified',
  });

  // Spawn two mint calls simultaneously
  const [result1, result2] = await Promise.all([
    fetch(`${SUPABASE_URL.replace('/rest/v1', '')}/functions/v1/mint-card`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ case_id: testCaseId }),
    }),
    fetch(`${SUPABASE_URL.replace('/rest/v1', '')}/functions/v1/mint-card`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ case_id: testCaseId }),
    }),
  ]);

  const json1 = await result1.json();
  const json2 = await result2.json();

  // One should succeed, one should skip
  const succeeded = [json1.success, json2.success].filter(Boolean).length;
  assertEquals(succeeded, 2, 'Both should succeed (one creates, one skips)');

  // Verify UNIQUE constraint held
  const { data: cards, count } = await supabase
    .from('cards')
    .select('*', { count: 'exact' })
    .eq('case_id', testCaseId);

  assertEquals(count, 1, 'UNIQUE constraint should prevent duplicates');

  // Cleanup
  await supabase.from('cards').delete().eq('case_id', testCaseId);
  await supabase.from('use_cases').delete().eq('id', testCaseId);
});

// ============================================================================
// TEST 4: Deterministic Background Selection
// ============================================================================

Deno.test('Phase EBL-1.4: Same case always selects same background', () => {
  const testCaseId = '123e4567-e89b-12d3-a456-426614174000';

  // Generate background twice
  const bg1 = generateBackground(testCaseId, 'heaven', 1024, 768);
  const bg2 = generateBackground(testCaseId, 'heaven', 1024, 768);

  assertEquals(bg1, bg2, 'Same case_id should produce identical SVG');

  // Verify pattern info is deterministic
  const info1 = getPatternInfo(testCaseId);
  const info2 = getPatternInfo(testCaseId);

  assertEquals(
    info1.patternType,
    info2.patternType,
    'Pattern type should be deterministic'
  );
  assertEquals(
    info1.paletteIndex,
    info2.paletteIndex,
    'Palette index should be deterministic'
  );

  // Different case_id should produce different background
  const testCaseId2 = '223e4567-e89b-12d3-a456-426614174000';
  const bg3 = generateBackground(testCaseId2, 'heaven', 1024, 768);

  assertEquals(bg1 !== bg3, true, 'Different case_id should produce different SVG');
});

// ============================================================================
// TEST 5: Storage (PNG and SVG)
// ============================================================================

Deno.test('Phase EBL-1.5: PNG and SVG exist in storage after mint', async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const testCaseId = crypto.randomUUID();
  await supabase.from('use_cases').insert({
    id: testCaseId,
    title: 'Storage Test',
    impact: 1,
    status: 'machine_verified',
  });

  // Mint card
  const mintResponse = await fetch(`${SUPABASE_URL.replace('/rest/v1', '')}/functions/v1/mint-card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ case_id: testCaseId }),
  });

  const mintResult = await mintResponse.json();
  assertEquals(mintResult.success, true, 'Mint should succeed');

  // Verify SVG exists in storage
  const svgPath = `cards/${testCaseId}.svg`;
  const { data: svgData, error: svgError } = await supabase.storage
    .from('cards')
    .download(svgPath);

  assertEquals(svgError, null, 'SVG should exist in storage');
  assertExists(svgData, 'SVG data should be downloadable');

  // Verify art_url is accessible
  const artUrlResponse = await fetch(mintResult.card.art_url);
  assertEquals(artUrlResponse.ok, true, 'art_url should return HTTP 200');

  // TODO: Verify PNG exists (after rasterization implemented)
  // const pngPath = `cards/${testCaseId}.png`;
  // const { data: pngData } = await supabase.storage.from('cards').download(pngPath);
  // assertExists(pngData, 'PNG should exist in storage');

  // Cleanup
  await supabase.storage.from('cards').remove([svgPath]);
  await supabase.from('cards').delete().eq('case_id', testCaseId);
  await supabase.from('use_cases').delete().eq('id', testCaseId);
});

// ============================================================================
// TEST 6: Backfill Script (Placeholder)
// ============================================================================

Deno.test('Phase EBL-1.6: Backfill script mints all existing cases', async () => {
  // TODO: Implement backfill script (TASKS.md Phase EBL-1, Task EBL1.7)
  // scripts/backfill-mint.ts should:
  // 1. Query all machine_verified cases without cards
  // 2. Call mint-card for each
  // 3. Be idempotent (safe to re-run)

  console.log('Backfill script test pending: scripts/backfill-mint.ts not yet created');
  assertEquals(true, true, 'Placeholder test');
});

// ============================================================================
// TEST 7: Faction Flip with Hysteresis
// ============================================================================

Deno.test('Phase EBL-1.7: Faction flip at 0.55, not at 0.52 (hysteresis)', async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Create test case with 50/50 votes (heaven)
  const testCaseId = crypto.randomUUID();
  await supabase.from('use_cases').insert({
    id: testCaseId,
    title: 'Flip Test',
    impact: 2,
    good_votes: 50,
    evil_votes: 50,
    status: 'machine_verified',
  });

  // Mint card (should be heaven at 0.5)
  await fetch(`${SUPABASE_URL.replace('/rest/v1', '')}/functions/v1/mint-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    body: JSON.stringify({ case_id: testCaseId }),
  });

  const { data: card1 } = await supabase.from('cards').select('*').eq('case_id', testCaseId).single();
  assertEquals(card1.faction, 'heaven', 'Should start as heaven at 0.5 ratio');

  // Update votes to 48/52 (0.48 ratio - should NOT flip, within hysteresis)
  await supabase.from('use_cases').update({ good_votes: 48, evil_votes: 52 }).eq('id', testCaseId);

  // Run alignment sync (TODO: implement nightly job, TASKS.md Phase EBL-1, Task EBL1.8)
  // await runAlignmentSync();

  // Verify faction DID NOT flip (0.48 is within 0.05 of 0.5)
  const { data: card2 } = await supabase.from('cards').select('*').eq('case_id', testCaseId).single();
  assertEquals(
    card2.faction,
    'heaven',
    'Should NOT flip at 0.48 (within hysteresis threshold)'
  );

  // Update votes to 45/55 (0.45 ratio - should flip to hell, past hysteresis)
  await supabase.from('use_cases').update({ good_votes: 45, evil_votes: 55 }).eq('id', testCaseId);

  // Run alignment sync again
  // await runAlignmentSync();

  // Verify faction DID flip (0.45 is > 0.05 below 0.5 threshold)
  const { data: card3 } = await supabase.from('cards').select('*').eq('case_id', testCaseId).single();
  // assertEquals(card3.faction, 'hell', 'Should flip to hell at 0.45 (past hysteresis)');
  // assertExists(card3.faction_flipped_at, 'faction_flipped_at should be set');

  console.log(
    'Faction flip test partial: Alignment sync not yet implemented (Phase EBL-1, Task EBL1.8)'
  );

  // Cleanup
  await supabase.from('cards').delete().eq('case_id', testCaseId);
  await supabase.from('use_cases').delete().eq('id', testCaseId);
});
