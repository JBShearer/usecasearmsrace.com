/**
 * USE CASE ARMS RACE - Inference Pipeline Edge Function
 * Handles content generation via Hyperspace proxy or direct Anthropic API
 *
 * Endpoints:
 * POST /functions/v1/generate-content
 * Body: { action: 'extract'|'story'|'card'|'notes', ...params }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { SYSTEM_PROMPT, deEscalate } from "./bible.ts";
import {
  EXTRACT_TRIPLE_PROMPT,
  GENERATE_STORY_PROMPT,
  GENERATE_CARD_PROMPT,
  GENERATE_NOTES_PROMPT,
  fillTemplate,
} from "./prompts.ts";

// =============================================================================
// Types
// =============================================================================

type Action = "extract" | "story" | "card" | "notes";

interface RequestBody {
  action: Action;
  // Extract params
  title?: string;
  source_url?: string;
  content?: string;
  // Story params
  nvn_title?: string;
  triple_chain?: Array<{ subject: string; verb: string; object: string }>;
  article_quote?: string;
  category?: string;
  faction?: "heaven" | "hell";
  location?: string;
  // Card params
  organization?: string;
  description?: string;
  // Notes params
  notes_context?: string;
  blank_type?: "consequence" | "reaction" | "excuse" | "prediction" | "comparison";
}

interface AnthropicConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  isHyperspace: boolean;
}

interface ErrorResponse {
  error: string;
  code: string;
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

const REQUEST_TIMEOUT_MS = 30000;

function getConfig(): AnthropicConfig {
  // Check for Hyperspace first (preferred)
  const hyperspaceUrl = Deno.env.get("HYPERSPACE_URL");
  const hyperspaceToken = Deno.env.get("HYPERSPACE_AUTH_TOKEN");

  if (hyperspaceUrl && hyperspaceToken) {
    return {
      baseUrl: hyperspaceUrl,
      model: Deno.env.get("HYPERSPACE_MODEL") || "anthropic--claude-4-sonnet",
      apiKey: hyperspaceToken,
      isHyperspace: true,
    };
  }

  // Fallback to direct Anthropic API
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    return {
      baseUrl: "https://api.anthropic.com",
      model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-20250514",
      apiKey: anthropicKey,
      isHyperspace: false,
    };
  }

  throw new Error("No API configuration found. Set HYPERSPACE_URL/HYPERSPACE_AUTH_TOKEN or ANTHROPIC_API_KEY.");
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id",
    "Access-Control-Max-Age": "86400",
  };
}

// =============================================================================
// Anthropic API Client
// =============================================================================

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  config: AnthropicConfig,
  maxTokens: number
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    };

    // Hyperspace uses Bearer token, Anthropic uses x-api-key
    if (config.isHyperspace) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    } else {
      headers["x-api-key"] = config.apiKey;
    }

    const body = {
      model: config.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    };

    const endpoint = config.isHyperspace
      ? `${config.baseUrl}/v1/messages`
      : `${config.baseUrl}/v1/messages`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error: ${response.status}`, errorText);
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// JSON Extraction & Validation
// =============================================================================

function extractJson(text: string): string {
  // Try to extract from markdown code fence first
  const jsonFenceMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonFenceMatch) {
    return jsonFenceMatch[1].trim();
  }

  // Try generic code fence
  const genericFenceMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (genericFenceMatch) {
    return genericFenceMatch[1].trim();
  }

  // Assume the entire response is JSON
  return text.trim();
}

function parseJsonResponse<T>(text: string, action: Action): T {
  const jsonStr = extractJson(text);

  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error(`JSON parse error for action ${action}:`, e);
    console.error("Raw text:", text.substring(0, 500));
    throw new Error(`Failed to parse response as JSON for action: ${action}`);
  }
}

// =============================================================================
// Action Handlers
// =============================================================================

async function handleExtract(
  body: RequestBody,
  config: AnthropicConfig
): Promise<object> {
  const { title, source_url, content } = body;

  if (!content) {
    throw new Error("Missing required parameter: content");
  }

  const prompt = fillTemplate(EXTRACT_TRIPLE_PROMPT, {
    title: title || "Untitled",
    source_url: source_url || "Unknown source",
    content: content,
  });

  const response = await callAnthropic(SYSTEM_PROMPT, prompt, config, 2000);
  return parseJsonResponse(response, "extract");
}

async function handleStory(
  body: RequestBody,
  config: AnthropicConfig
): Promise<object> {
  const { nvn_title, triple_chain, article_quote, category, faction, location } = body;

  if (!nvn_title || !triple_chain) {
    throw new Error("Missing required parameters: nvn_title, triple_chain");
  }

  const prompt = fillTemplate(GENERATE_STORY_PROMPT, {
    nvn_title: nvn_title,
    triple_chain: triple_chain,
    article_quote: article_quote || "",
    category: category || "Unknown",
    faction: faction || "hell",
    location: location || "somewhere mysterious",
  });

  const response = await callAnthropic(SYSTEM_PROMPT, prompt, config, 4000);
  const parsed = parseJsonResponse<{
    scene_2?: { quote_original?: string; quote_cartoon?: string };
  }>(response, "story");

  // Apply de-escalation to the cartoon quote if present
  if (parsed.scene_2?.quote_original && !parsed.scene_2?.quote_cartoon) {
    parsed.scene_2.quote_cartoon = deEscalate(parsed.scene_2.quote_original);
  }

  return parsed;
}

async function handleCard(
  body: RequestBody,
  config: AnthropicConfig
): Promise<object> {
  const { title, organization, description, category, triple_chain, article_quote, faction } = body;

  if (!title || !description) {
    throw new Error("Missing required parameters: title, description");
  }

  const prompt = fillTemplate(GENERATE_CARD_PROMPT, {
    title: title,
    organization: organization || "Unknown Organization",
    description: description,
    category: category || "Unknown",
    triple_chain: triple_chain || [],
    article_quote: article_quote || "",
    faction: faction || "",
  });

  const response = await callAnthropic(SYSTEM_PROMPT, prompt, config, 2000);
  return parseJsonResponse(response, "card");
}

async function handleNotes(
  body: RequestBody,
  config: AnthropicConfig
): Promise<object> {
  const { nvn_title, description, triple_chain, category, notes_context, blank_type } = body;

  if (!nvn_title || !description) {
    throw new Error("Missing required parameters: nvn_title, description");
  }

  const prompt = fillTemplate(GENERATE_NOTES_PROMPT, {
    nvn_title: nvn_title,
    description: description,
    triple_chain: triple_chain || [],
    category: category || "Unknown",
    notes_context: notes_context || "",
    blank_type: blank_type || "consequence",
  });

  const response = await callAnthropic(SYSTEM_PROMPT, prompt, config, 1000);
  return parseJsonResponse(response, "notes");
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
    return new Response(
      JSON.stringify({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" } as ErrorResponse),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Parse request body
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", code: "INVALID_JSON" } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate action
    const { action } = body;
    if (!action || !["extract", "story", "card", "notes"].includes(action)) {
      return new Response(
        JSON.stringify({
          error: "Invalid or missing action. Must be one of: extract, story, card, notes",
          code: "INVALID_ACTION",
        } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get API configuration
    let config: AnthropicConfig;
    try {
      config = getConfig();
    } catch (e) {
      console.error("Configuration error:", e);
      return new Response(
        JSON.stringify({
          error: "Service temporarily unavailable",
          code: "CONFIG_ERROR",
        } as ErrorResponse),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Route to appropriate handler
    let result: object;
    switch (action) {
      case "extract":
        result = await handleExtract(body, config);
        break;
      case "story":
        result = await handleStory(body, config);
        break;
      case "card":
        result = await handleCard(body, config);
        break;
      case "notes":
        result = await handleNotes(body, config);
        break;
      default:
        // This should never happen due to validation above
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Log the full error for debugging
    console.error("Request failed:", error);

    // Check for timeout
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(
        JSON.stringify({
          error: "Request timed out",
          code: "TIMEOUT",
        } as ErrorResponse),
        {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check for validation errors (expose message)
    if (error instanceof Error && error.message.startsWith("Missing required")) {
      return new Response(
        JSON.stringify({
          error: error.message,
          code: "VALIDATION_ERROR",
        } as ErrorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generic error (don't expose internal details)
    return new Response(
      JSON.stringify({
        error: "An error occurred processing your request",
        code: "INTERNAL_ERROR",
      } as ErrorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
