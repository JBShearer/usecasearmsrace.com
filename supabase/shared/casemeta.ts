// UCAR 2.0 case metadata. Mined from the July session history: the filing
// form's controlled vocabularies and the article-quote card field.

export const TECH_TYPES = [
  "LLM/Chatbot", "Computer Vision", "Facial Recognition", "Recommendation",
  "Predictive", "Voice Recognition", "Generative", "NLP", "Biometric Analysis",
] as const;

export const DATA_TYPES = [
  "Biometric", "Location/GPS", "Social", "Financial", "Health Records",
  "Public", "Scraped Web", "Purchased", "Behavioral",
] as const;

const normWS = (s: string) =>
  s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ").trim();

// A quote earns its place on the card only if it actually appears in the
// source. Fabricated quotes die at the gate; this is a hard invariant
// because the card format lends the quote the authority of the record.
export function validateQuote(
  quote: unknown, sourceText: string,
): string | null {
  if (typeof quote !== "string") return null;
  const q = quote.trim().replace(/^["'\u201C\u2018]+|["'\u201D\u2019]+$/g, "");
  if (q.length < 8 || q.length > 240) return null;
  return normWS(sourceText).includes(normWS(q)) ? q : null;
}

export function filterTypes(
  values: unknown, allow: readonly string[],
): string[] {
  if (!Array.isArray(values)) return [];
  const set = new Set(allow.map((a) => a.toLowerCase()));
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const hit = allow.find((a) => a.toLowerCase() === v.trim().toLowerCase());
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out.slice(0, 5);
}
