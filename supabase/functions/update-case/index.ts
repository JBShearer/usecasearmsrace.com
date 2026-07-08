/**
 * USE CASE ARMS RACE - Update Case Semantic Data
 * Handles updating semantic triples, modifiers, ratings, and comedy tags
 *
 * Endpoints:
 * POST /functions/v1/update-case
 * Body: { case_id, action: 'rate_source'|'tag_comedy'|'set_triple'|'add_modifier', ...params }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// Types
// =============================================================================

type Action = "rate_source" | "tag_comedy" | "set_triple" | "add_modifier" | "submit_notes";

interface RequestBody {
  case_id: string;
  action: Action;
  // rate_source params
  quality?: "good" | "evil";
  // tag_comedy params
  comedy_style?: string;
  // set_triple params
  subject?: string;
  verb?: string;
  object?: string;
  // add_modifier params
  category?: "who" | "action" | "whom";
  modifier?: string;
  modifier_type?: string;
  // submit_notes params
  notes?: string;
  user_id?: string;
  session_id?: string;
}

// =============================================================================
// Configuration
// =============================================================================

const CORS_ORIGINS = [
  "https://usecasearmsrace.com",
  "https://www.usecasearmsrace.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// =============================================================================
// Supabase Client
// =============================================================================

function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration");
  }

  return createClient(supabaseUrl, supabaseKey);
}

// =============================================================================
// Action Handlers
// =============================================================================

async function handleRateSource(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  quality: "good" | "evil"
): Promise<object> {
  const column = quality === "good" ? "source_good_votes" : "source_evil_votes";

  const { data, error } = await supabase.rpc("increment_column", {
    table_name: "use_cases",
    column_name: column,
    row_id: caseId,
  });

  // Fallback if RPC doesn't exist - direct update
  if (error?.code === "42883") {
    // Function doesn't exist
    const { data: currentData } = await supabase
      .from("use_cases")
      .select(column)
      .eq("id", caseId)
      .single();

    const currentValue = currentData?.[column] || 0;

    const { error: updateError } = await supabase
      .from("use_cases")
      .update({ [column]: currentValue + 1 })
      .eq("id", caseId);

    if (updateError) throw updateError;

    return { success: true, [column]: currentValue + 1 };
  }

  if (error) throw error;

  return { success: true, data };
}

async function handleTagComedy(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  comedyStyle: string
): Promise<object> {
  // Get current comedy tags
  const { data: currentData, error: fetchError } = await supabase
    .from("use_cases")
    .select("comedy_tags")
    .eq("id", caseId)
    .single();

  if (fetchError) throw fetchError;

  const currentTags = currentData?.comedy_tags || {};
  const newCount = (currentTags[comedyStyle] || 0) + 1;

  const updatedTags = {
    ...currentTags,
    [comedyStyle]: newCount,
  };

  const { error: updateError } = await supabase
    .from("use_cases")
    .update({ comedy_tags: updatedTags })
    .eq("id", caseId);

  if (updateError) throw updateError;

  return { success: true, comedy_tags: updatedTags };
}

async function handleSetTriple(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  subject?: string,
  verb?: string,
  object?: string
): Promise<object> {
  const updates: Record<string, string> = {};
  if (subject) updates.subject = subject;
  if (verb) updates.verb = verb;
  if (object) updates.object = object;

  if (Object.keys(updates).length === 0) {
    throw new Error("No triple fields provided");
  }

  const { error } = await supabase.from("use_cases").update(updates).eq("id", caseId);

  if (error) throw error;

  return { success: true, updated: updates };
}

async function handleAddModifier(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  category: "who" | "action" | "whom",
  modifier: string
): Promise<object> {
  // Get current modifiers
  const { data: currentData, error: fetchError } = await supabase
    .from("use_cases")
    .select("modifiers")
    .eq("id", caseId)
    .single();

  if (fetchError) throw fetchError;

  const currentModifiers = currentData?.modifiers || { who: [], action: [], whom: [] };
  const categoryMods = currentModifiers[category] || [];

  // Add if not already present
  if (!categoryMods.includes(modifier)) {
    categoryMods.push(modifier);
  }

  const updatedModifiers = {
    ...currentModifiers,
    [category]: categoryMods,
  };

  const { error: updateError } = await supabase
    .from("use_cases")
    .update({ modifiers: updatedModifiers })
    .eq("id", caseId);

  if (updateError) throw updateError;

  // Also track in semantic_modifiers table for vocabulary building
  await supabase.from("semantic_modifiers").upsert(
    {
      category,
      label: modifier,
      modifier_type: "specific", // Default, can be enhanced later
    },
    { onConflict: "category,label" }
  );

  return { success: true, modifiers: updatedModifiers };
}

async function handleSubmitNotes(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  notes: string,
  userId?: string,
  sessionId?: string
): Promise<object> {
  // Calculate coin reward based on length
  let reward = 0;
  if (notes.length >= 200) reward = 25;
  else if (notes.length >= 100) reward = 15;
  else if (notes.length >= 50) reward = 10;
  else if (notes.length >= 10) reward = 5;

  // Store in case_notes table (or triple_submissions for now)
  const { data, error } = await supabase.from("case_notes").insert({
    case_id: caseId,
    user_id: userId,
    session_id: sessionId,
    notes,
    reward_coins: reward,
    status: "pending_review", // For quality analysis later
  });

  // If case_notes table doesn't exist, use a fallback
  if (error?.code === "42P01") {
    // Table doesn't exist - just return success
    console.log("case_notes table doesn't exist yet, skipping storage");
    return { success: true, reward, stored: false };
  }

  if (error) throw error;

  return { success: true, reward, stored: true };
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: RequestBody = await req.json();
    const { case_id, action } = body;

    if (!case_id || !action) {
      return new Response(
        JSON.stringify({ error: "Missing case_id or action" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = getSupabaseClient();
    let result: object;

    switch (action) {
      case "rate_source":
        if (!body.quality) throw new Error("Missing quality parameter");
        result = await handleRateSource(supabase, case_id, body.quality);
        break;

      case "tag_comedy":
        if (!body.comedy_style) throw new Error("Missing comedy_style parameter");
        result = await handleTagComedy(supabase, case_id, body.comedy_style);
        break;

      case "set_triple":
        result = await handleSetTriple(supabase, case_id, body.subject, body.verb, body.object);
        break;

      case "add_modifier":
        if (!body.category || !body.modifier) {
          throw new Error("Missing category or modifier parameter");
        }
        result = await handleAddModifier(supabase, case_id, body.category, body.modifier);
        break;

      case "submit_notes":
        if (!body.notes) throw new Error("Missing notes parameter");
        result = await handleSubmitNotes(
          supabase,
          case_id,
          body.notes,
          body.user_id,
          body.session_id
        );
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
