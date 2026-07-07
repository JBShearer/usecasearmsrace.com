/**
 * USE CASE ARMS RACE - Inference Prompts
 * Templates for each generation action
 */

export const EXTRACT_TRIPLE_PROMPT = `You are extracting semantic triples from a news article about AI use cases for the USE CASE ARMS RACE card game.

ARTICLE:
Title: {{title}}
Source: {{source_url}}
Content: {{content}}

Extract the semantic triple chain that tells this story. A semantic triple is: [SUBJECT] --verb--> [OBJECT]

For each position, provide 3 plausible choices that could fit the article:

Return JSON:
\`\`\`json
{
  "who_choices": [
    {"value": "Exact entity from article", "confidence": 0.95},
    {"value": "Alternative interpretation", "confidence": 0.7},
    {"value": "Broader category", "confidence": 0.5}
  ],
  "action_choices": [
    {"value": "deployed", "confidence": 0.9},
    {"value": "implemented", "confidence": 0.7},
    {"value": "tested", "confidence": 0.5}
  ],
  "whom_choices": [
    {"value": "Specific target from article", "confidence": 0.95},
    {"value": "Alternative framing", "confidence": 0.7},
    {"value": "Broader impact group", "confidence": 0.5}
  ],
  "full_chain": [
    {"subject": "...", "verb": "...", "object": "..."},
    {"subject": "...", "verb": "...", "object": "..."},
    {"subject": "...", "verb": "...", "object": "..."}
  ],
  "article_quote": "Most striking direct quote from the article",
  "suggested_faction": "heaven|hell",
  "faction_reasoning": "One sentence explaining why"
}
\`\`\`

RULES:
- Choices should be factually grounded in the article
- First choice should be the most accurate/specific
- Include direct quotes where possible
- The full_chain should be 3-6 connected triples showing cause -> effect
- Each triple's OBJECT often becomes the next triple's SUBJECT`;

export const GENERATE_STORY_PROMPT = `Generate a 3-scene Evil Brain Labs story for this AI use case.

CASE DATA:
- Title: {{nvn_title}}
- Triple Chain: {{triple_chain}}
- Article Quote: {{article_quote}}
- Category: {{category}}
- Faction: {{faction}}
- Location: {{location}}

Generate the story following this structure:

SCENE 1 - THE DISCOVERY:
Brain dramatically reveals the case. Use the first triple as focus.
- Brain intro (pompous, dramatic)
- Chip asks a dumb question
- Brain explains with the triple
- Brain teases the twist

SCENE 2 - THE COMPLICATION:
The chain unfolds, voting moment.
- Show middle triples as complications
- Glitch delivers paranoid take based on category
- Vera states the REAL article quote, then the de-escalated cartoon version
- Spark tries to spin it positive
- Brain poses the Heaven/Hell question

SCENE 3A - HEAVEN ENDING:
- Brain reluctantly admits it helped
- Brain short-circuits briefly
- Chip asks if they're the good guys
- Brain insists "WE ARE NEVER THE GOOD GUYS"
- Card mints with heavenly glow

SCENE 3B - HELL ENDING:
- Brain celebrates humanity's hubris
- Glitch runs in circles saying "I TOLD YOU"
- Brain files it under Hell
- Brain starts dramatic monologue, Vera cuts him off
- Card mints with hellfire effect

Return JSON:
\`\`\`json
{
  "scene_1": {
    "title": "THE DISCOVERY",
    "script": "Full dialogue with character names and stage directions in *asterisks*",
    "choices": [
      {"text": "Tell me more, Brain!", "tone": "eager"},
      {"text": "That sounds concerning...", "tone": "worried"},
      {"text": "How do we exploit this?", "tone": "scheming"}
    ],
    "triple_focus": {"subject": "...", "verb": "...", "object": "..."}
  },
  "scene_2": {
    "title": "THE COMPLICATION",
    "script": "Full dialogue...",
    "choices": [
      {"text": "HEAVEN - Good for humanity!", "vote": "heaven"},
      {"text": "HELL - Dystopian nightmare!", "vote": "hell"},
      {"text": "Can't it be both?", "vote": "both"}
    ],
    "quote_original": "The real article quote",
    "quote_cartoon": "The de-escalated cartoon version"
  },
  "scene_3_heaven": {
    "title": "THE VERDICT: HEAVEN",
    "script": "Full dialogue...",
    "faction": "heaven"
  },
  "scene_3_hell": {
    "title": "THE VERDICT: HELL",
    "script": "Full dialogue...",
    "faction": "hell"
  }
}
\`\`\`

CHARACTER VOICE RULES:
- BRAIN: Pompous, dramatic, uses CAPS for emphasis, thinks he's terrifying
- CHIP: Eager, confused, asks obvious questions
- GLITCH: Paranoid, conspiracy-minded, based on category (Surveillance=Big Brother, Healthcare=Big Pharma, etc.)
- VERA: Deadpan, factual, delivers the real quote then cartoon version
- SPARK: Aggressively positive, corporate buzzwords, everything is an opportunity`;

export const GENERATE_CARD_PROMPT = `Generate card content for this approved AI use case.

CASE DATA:
- Original Title: {{title}}
- Organization: {{organization}}
- Description: {{description}}
- Category: {{category}}
- Triple Chain: {{triple_chain}}
- Article Quote: {{article_quote}}
- Faction: {{faction}}

Generate card content:

Return JSON:
\`\`\`json
{
  "nvn_titles": [
    "Subject Verb Object (under 35 chars, past tense, no articles)",
    "Alternative Triple 2",
    "Alternative Triple 3"
  ],
  "flavor_quotes": {
    "sarcastic": "Darkly funny one-liner",
    "corporate": "Corporate doublespeak version that sounds positive but is horrifying",
    "grandma": "Worried grandma reaction starting with 'Oh dear...'"
  },
  "faction": "heaven|hell",
  "faction_reasoning": "One paragraph explaining the faction choice, referencing specific harm or benefit",
  "impact_score": 1-5,
  "impact_reasoning": "Why this impact level",
  "card_motif_suggestion": "Brief description for the tarot/propaganda style art (e.g., 'surveillance eye with radiating lines')",
  "categories": ["Primary", "Secondary", "Tertiary"]
}
\`\`\`

TITLE RULES:
- Under 35 characters
- Format: [Who] [Did What] [To What/Whom]
- No articles (the, a, an)
- Past tense verbs preferred
- Examples: "School AI Flags Student", "Bank Denies Loan", "Police Deploy Drones"

FLAVOR QUOTE RULES:
- Sarcastic: Dark humor, punchy, could be a tweet
- Corporate: Sounds like a press release defending the indefensible
- Grandma: Starts with reaction like "Oh dear..." or "Well I never..."

CATEGORIES (pick 3): Surveillance, Discrimination, Labor Exploitation, Privacy Violation, Manipulation, Misinformation, Accessibility, Healthcare, Education, Safety, Environmental, Efficiency, Automation, Personalization, Prediction, Content Generation`;

export const GENERATE_NOTES_PROMPT = `Generate Mad Libs-style blanks for the case notes section.

CASE DATA:
- Title: {{nvn_title}}
- Description: {{description}}
- Triple Chain: {{triple_chain}}
- Category: {{category}}

The case notes have a blank that needs filling. Generate 3 choices for the blank.

CONTEXT: {{notes_context}}
BLANK TYPE: {{blank_type}}

Return JSON:
\`\`\`json
{
  "blank_prompt": "The sentence with _____ where the blank goes",
  "choices": [
    {"text": "Accurate/serious choice", "tone": "factual"},
    {"text": "Absurdist/funny choice", "tone": "absurd"},
    {"text": "Corporate doublespeak choice", "tone": "corporate"}
  ],
  "context_hint": "Brief hint about what kind of word fits"
}
\`\`\`

BLANK TYPES:
- consequence: What happened as a result
- reaction: How someone responded
- excuse: How it was justified
- prediction: What happens next
- comparison: What this is similar to

RULES:
- First choice should be factually grounded
- Second choice should be absurdist but internally consistent
- Third choice should sound like corporate PR
- All choices should grammatically fit the sentence`;

/**
 * Fill template placeholders with values
 */
export function fillTemplate(
  template: string,
  values: Record<string, string | object>
): string {
  let result = template;

  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{{${key}}}`;
    const stringValue =
      typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    result = result.replaceAll(placeholder, stringValue);
  }

  return result;
}
