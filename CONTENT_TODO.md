# CONTENT PLACEHOLDERS FOR OWNER REVIEW

All `[COPY: *]` placeholders in code are logged here for Jason to finalize.

**Status:** Active tracking as of 2026-07-08  
**Owner:** Jason Shearer (OWNER decisions only)

---

## CATEGORY: Character Dialogue

### Evil Brain (Host)
- **[COPY: cold open line]** → Context: Episode intro, pompous/dramatic tone
  - Suggested: "EXCELLENT! Another case for the archives!"
  - Location: TBD (show script generation)

### GI (General Intelligence)
- **[COPY: tactical assessment template]** → Context: Military analyst deadpan
  - Suggested: "Tactical assessment: this is either genius or disaster. History suggests disaster."
  - Location: `supabase/functions/generate-content/prompts.ts`

### Gary (AGI)
- **[COPY: tech reality check]** → Context: Optimism meets harsh reality
  - Suggested: "The algorithm is working exactly as designed. The design is the problem."
  - Location: `supabase/functions/generate-content/prompts.ts`

### Supes (Super Intelligence)
- **[COPY: empathetic stakeholder comment]** → Context: Ethics analyst
  - Suggested: "Someone should ask the affected humans. Nobody will, but someone should."
  - Location: `supabase/functions/generate-content/prompts.ts`

---

## CATEGORY: UI Copy & Tooltips

### Verification Badges
- **[COPY: verification badge tooltip]** → Context: Explain what MACHINE VERIFIED means
  - Must state: "Documentation confirmed by AI first pass; not an endorsement; not a virtue judgment"
  - Location: `index.html` (hover tooltip on badge)
  - Source: UCAR_REGISTRY_BUILD_PLAN section 3.2

### Case Status Banners
- **[COPY: under review banner]** → Context: Case suspended during complaint review
  - Must state: Why suspended, expected resolution time, transparency statement
  - Location: `index.html` (case card overlay)
  - Source: UCAR_REGISTRY_BUILD_PLAN section 4.4

### Complaint Flow
- **[COPY: named party notice]** → Context: Warning on complaint form when user selects employee/counsel relationship
  - Must state: "False declarations are bannable" + consequences
  - Location: `index.html` (complaint modal)
  - Source: UCAR_REGISTRY_BUILD_PLAN section 4.1

---

## CATEGORY: Legal & Standards Copy

### Standards Page - Satire Notice (Section 7)
- **[COPY: final satire notice wording]** → Context: Legal disclaimer for EBL game
  - Must state: "Evil Brain Labs is satirical; card ratings are community vote data; organization names appear as documented fact only; never with logos/brand identity"
  - Location: `standards.html` section 7
  - Source: SHOW_LAUNCH_RUNBOOK section 5
  - **REQUIRES: Legal counsel review before launch**

### Standards Page - AI Disclosure (Section 6)
- **[COPY: steward model disclosure]** → Context: What the model can/cannot do
  - Must reference: MODEL_STEWARD_SPEC.md sections (doc not yet found)
  - Location: `standards.html` section 6
  - Source: SHOW_LAUNCH_RUNBOOK section 5

---

## CATEGORY: Game Flavor Text

### Defense Strategies (Phase 3: Battles)
- **[COPY: legal_team strategy name]** → Current placeholder: "legal_team"
  - Suggested final: TBD (OWNER voice)
  - Location: `config/economy.ts` or battle UI
  - Source: EBL_BATTLER_BUILD_PLAN section 6.5

- **[COPY: pr_spin strategy name]** → Current placeholder: "pr_spin"
  - Location: Same as above

- **[COPY: compliance_theater strategy name]** → Current placeholder: "compliance_theater"
  - Location: Same as above

- **[COPY: vaporware_pivot strategy name]** → Current placeholder: "vaporware_pivot"
  - Location: Same as above

### Battle Lanes (Phase 3: Battles)
- **[COPY: DEV lane name]** → Current placeholder: "DEV"
  - Context: Three battle lanes need thematic names
  - Source: EBL_BATTLER_BUILD_PLAN section 6.4

- **[COPY: LEGAL lane name]** → Current placeholder: "LEGAL"
  - Location: Same as above

- **[COPY: MARKET lane name]** → Current placeholder: "MARKET"
  - Location: Same as above

### Rival PM Characters (Phase 3: Bot Opponents)
- **[COPY: RIVAL_PM_1 name and identity]** → Context: Bot opponent character
  - Source: EBL_BATTLER_BUILD_PLAN section 6.5

- **[COPY: RIVAL_PM_2 name and identity]**
  - Location: Same as above

- **[COPY: RIVAL_PM_3 name and identity]**
  - Location: Same as above

---

## CATEGORY: Show Segment Copy

### Episode Anatomy (Phase SHOW)
- **[COPY: cold open template]** → Context: Episode opening beat
  - Location: Episode script generation
  - Source: SHOW_LAUNCH_RUNBOOK section 1

- **[COPY: call to action template]** → Context: Episode closing (vote on Case of the Day)
  - Location: Episode script generation
  - Source: SHOW_LAUNCH_RUNBOOK section 1

---

## CATEGORY: Pending Decisions (Not Copy, But Owner Review)

### Episode Format Lock
- **OWNER DECISION: Target runtime** → Current suggestion: under 5 minutes
  - Location: `config/economy.ts` → `SHOW_CONFIG.TARGET_RUNTIME_MINUTES`
  - Source: SHOW_LAUNCH_RUNBOOK section 1

- **OWNER DECISION: Season length in weeks** → Not specified in runbook
  - Context: Six episodes per week, but how many weeks per season?
  - Location: TBD

### Card Minting
- **OWNER DECISION: Backgrounds art assets** → Currently 3 solid fallbacks
  - Context: Need final background library for card art
  - Location: `supabase/storage/backgrounds/`
  - Source: EBL_BATTLER_BUILD_PLAN section 4.4

### K'Dee Production Workflow
- **OWNER DECISION: Video production workflow** → Mentioned but not specified
  - Context: "K'Dee production workflow: OWNER"
  - Location: SHOW_LAUNCH_RUNBOOK section 3

---

## USAGE NOTES FOR DEVELOPERS

When you encounter a content decision in code:
1. Write the placeholder as `[COPY: short description]`
2. Add entry to this document with:
   - Context: Where/why it's used
   - Location: File and line number
   - Source: Which build plan section specifies requirements
3. Continue implementation with placeholder
4. Never write jokes, satire, or organization-specific commentary yourself

When OWNER provides final copy:
1. Update this document with ✅ status
2. Replace placeholder in code
3. Commit with message: "Copy: [description] (OWNER approved)"

---

## CHECKLIST STATUS

- [ ] All character dialogue templates finalized
- [ ] All UI tooltips and banners finalized
- [ ] Satire notice reviewed by legal counsel
- [ ] Defense strategy names finalized
- [ ] Battle lane names finalized
- [ ] Rival PM character identities finalized
- [ ] Episode script templates finalized
- [ ] Background art assets delivered

**Last updated:** 2026-07-08  
**Pending items:** 20+ placeholders
