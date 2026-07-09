# USE CASE ARMS RACE - PRODUCTION BUILD STATUS & ROADMAP

**Last Updated:** 2026-07-08  
**Current Completion:** 10-15%  
**Target Launch:** Q1 2027 (all phases)  
**Next Milestone:** Phase 0 complete by 2026-07-22

---

## EXECUTIVE SUMMARY

The Use Case Arms Race project exists across three domains:
1. **usecasearmsrace.com** (UCAR) - Registry + Daily Show + Search
2. **evilbrainlabs.com** (EBL) - Card battler game  
3. **Daily Show** - YouTube Shorts / TikTok / LinkedIn content

**Current State:** Demo functional with semantic triple extraction, basic search, and reputation system. **NOT production-ready.** Missing: content verification pipeline, complaint system, card persistence, battle system, show automation.

**Critical Blockers for Launch:**
- ❌ Database hardening (RLS, rate limits, read isolation)
- ❌ Feed/Timeline system with persistent voting
- ❌ Content verification pipeline (autoverify, moderation)
- ❌ Complaint system for legal safety
- ❌ Card minting with storage persistence
- ❌ Daily show integration (episodes table, automation)

---

## PROJECT STRUCTURE

```
usecasearmsrace.com/
├── index.html              # Landing page (2028 lines, theme system partial)
├── game.html               # Legacy game flow
├── game2.html              # Current semantic triple flow (functional demo)
├── admin.html              # Basic admin interface
├── TASKS.md                # ✅ Complete atomic task breakdown (this session)
├── REQUIREMENTS.md         # Full feature specification
├── config/
│   └── economy.ts          # ✅ All tunable constants (this session)
├── CONTENT_TODO.md         # ✅ Placeholder tracking for OWNER review
├── deno.json               # ✅ Test framework config (this session)
├── supabase/
│   ├── migrations/
│   │   ├── 001_did_reputation.sql      # ✅ Reputation + cards (exists)
│   │   ├── 002_semantic_triples.sql    # ✅ Semantic model (exists)
│   │   ├── 003_rls_hardening.sql       # ⬜ TODO Phase 0
│   │   ├── 004_rate_limiting.sql       # ⬜ TODO Phase 0
│   │   ├── 007_feed_tables.sql         # ⬜ TODO Phase U1
│   │   ├── 009_verification_tables.sql # ⬜ TODO Phase U2
│   │   ├── 010_complaints.sql          # ⬜ TODO Phase U3
│   │   ├── 011_cards.sql               # ⬜ TODO Phase EBL-1
│   │   └── 013_episodes.sql            # ⬜ TODO Phase SHOW
│   ├── functions/
│   │   ├── search-cases/               # ⚠️ Partial (embedding disabled)
│   │   ├── submit-verdict/             # ✅ Works (no persistent votes)
│   │   ├── generate-content/           # ✅ Works (story generation)
│   │   ├── vote-on-case/               # ⬜ TODO Phase U1
│   │   ├── autoverify/                 # ⬜ TODO Phase U2
│   │   ├── file-complaint/             # ⬜ TODO Phase U3
│   │   ├── mint-card/                  # ⬜ TODO Phase EBL-1
│   │   └── steward-brief/              # ⬜ TODO Phase SHOW
│   └── shared/
│       ├── cardstats.ts                # ✅ Card derivation formulas
│       ├── consensus.ts                # ✅ Triple consensus extraction
│       ├── story.ts                    # ✅ Narrative generation
│       ├── rateLimit.ts                # ⬜ TODO Phase 0
│       └── renderCard.ts               # ⬜ TODO Phase EBL-1
└── tests/                              # ⬜ TODO All phases
    ├── phase0/
    ├── phase-u1/
    ├── phase-u2/
    ├── phase-u3/
    ├── phase-ebl1/
    └── phase-show/
```

---

## PHASED IMPLEMENTATION TIMELINE

### PHASE 0: HARDENING (2-3 weeks) - BLOCKER
**Status:** ❌ Not started  
**Goal:** Database safe to attach economy

**Tasks:**
- [ ] Row Level Security (RLS) policies on all tables
- [ ] Registry read-only role (SELECT-only access from EBL)
- [ ] Rate limiting table + logic (30 calls/min default)
- [ ] Remove admin backdoors (role-based only)
- [ ] Email magic link authentication
- [ ] Document all policies in `db/POLICIES.md`

**Acceptance:** 5 tests must pass before proceeding to Phase U1

---

### PHASE U1: FEED (2-3 weeks)
**Status:** ❌ Not started  
**Goal:** Twitter-style timeline with voting, realtime updates

**Dependencies:** Phase 0 complete

**Tasks:**
- [ ] Create `votes`, `watches`, `case_status_log` tables
- [ ] Build timeline UI with tabs (Latest, Top, Under Fire, Flips)
- [ ] Implement vote-on-case edge function with Realtime broadcast
- [ ] Server-side rendering for first paint (top 20 cards inlined)
- [ ] OpenGraph + Twitter Card meta tags for unfurls
- [ ] Infinite scroll with cursor pagination

**Acceptance:** 4 tests pass (first paint, vote persistence, unfurl, realtime)

---

### PHASE U2: AUTOVERIFY (3-4 weeks)
**Status:** ❌ Not started (embedding dependencies broken)  
**Goal:** 7-stage content verification pipeline

**Dependencies:** Phase U1 complete

**Tasks:**
- [ ] Fix embedding dependencies in search-cases
- [ ] Create `verifications`, `model_actions` tables
- [ ] Implement deterministic checks (schema, source fetch, dedupe)
- [ ] Implement model checks (prohibited content, claim-source consistency, classification)
- [ ] Build admin queue UI for `needs_human` review
- [ ] Nightly reconciliation job (vote counter integrity)

**Acceptance:** 5 tests pass (dedupe, model routing, p95 latency < 2min)

---

### PHASE U3: COMPLAINTS (1-2 weeks)
**Status:** ❌ Not started  
**Goal:** Complaint filing, triage, review, EBL propagation

**Dependencies:** Phase U2 complete

**Tasks:**
- [ ] Create `complaints`, `review_queue` tables
- [ ] Build complaint filing UI with named-party fast lane
- [ ] Implement triage function (steward model + manual rules)
- [ ] Update admin queue for case review (reinstate/correct/retract)
- [ ] Add EBL propagation hooks (case status → card claim/battle rules)
- [ ] Public status log on case pages

**Acceptance:** 6 tests pass (triage speed, EBL integration, status transparency)

---

### PHASE EBL-1: CARD MINTING (1-2 weeks)
**Status:** ⚠️ 30% (formula logic exists, no persistence)  
**Goal:** Cards persist to storage with deterministic art

**Dependencies:** Phase U1 complete (can run parallel to U2-U3)

**Tasks:**
- [ ] Create `cards`, `card_instances`, `backgrounds` tables
- [ ] Implement mint-card function (SVG → PNG rasterization)
- [ ] Extract SVG renderer to shared module
- [ ] Seed backgrounds library (3 fallbacks + OWNER assets)
- [ ] Trigger minting on case approval
- [ ] Write backfill script for existing cases
- [ ] Implement nightly alignment sync (faction flips with hysteresis)
- [ ] Update UI to use storage URLs instead of inline SVG

**Acceptance:** 7 tests pass (determinism, idempotency, storage, backfill, flip logic)

---

### PHASE SHOW: DAILY SHOW INTEGRATION (1-2 weeks)
**Status:** ❌ 5% (video embed placeholder only)  
**Goal:** Episodes table, steward brief, Card of the Day automation

**Dependencies:** Phase U1, U2, EBL-1 complete

**Tasks:**
- [ ] Create `episodes` table
- [ ] Implement steward brief function (05:30 UTC cron)
- [ ] Build episode editor in admin with pre-publish checklist
- [ ] Implement Card of the Day logic (24h free-to-play flag)
- [ ] Update index.html with episode carousel
- [ ] Add YouTube Shorts / TikTok / LinkedIn social links
- [ ] Create standards page (legal disclosure, AI transparency, complaints process)
- [ ] Create steward's own registry entry
- [ ] Implement battle export for show (depends on EBL Phase 6)

**Acceptance:** 5 tests pass (checklist enforcement, Card of Day flag, brief automation)

---

### EBL PHASES 2-6: GAME ECONOMY & BATTLES (13-20 weeks)
**Status:** ❌ Not started (separate from UCAR, not blocker for show launch)

**Phases:**
- Phase 2: Portfolio economy (products, mining, wallets) - 4-6 weeks
- Phase 3: Battle core (turn reducer, defense, bots) - 4-6 weeks
- Phase 4: Realtime multiplayer (60s join, spectators) - 2-3 weeks
- Phase 5: Quests + scratch-offs (faucet, rewards) - 2-3 weeks
- Phase 6: Replays + export (deterministic replay viewer) - 1-2 weeks

**Note:** These are for evilbrainlabs.com game. UCAR can launch without these (show + registry only).

---

## IMMEDIATE PRIORITIES (Next 2 Weeks)

### Quick Wins (This Session - 2026-07-08)
- [x] Create TASKS.md with atomic task breakdown
- [x] Create config/economy.ts with all tunable constants
- [x] Create CONTENT_TODO.md for placeholder tracking
- [x] Create deno.json for test framework
- [ ] **Fix SVG theme colors** (30 min - ~58 hardcoded `#EDE6D6` values)
- [ ] Create db/POLICIES.md (RLS audit)
- [ ] Set up test framework (directories + fixture data)

### Critical Path (Next Sprint)
1. **Phase 0 Week 1:** RLS policies + rate limiting
2. **Phase 0 Week 2:** Auth upgrade + acceptance tests
3. **Phase U1 Week 1:** Feed tables + vote function
4. **Phase U1 Week 2:** Timeline UI + realtime

---

## BUILD PLAN REFERENCES

All specifications documented in:
- `TASKS.md` - Atomic implementation tasks (100+ tasks, 7 phases)
- `/Downloads/UCAR/UCAR_REGISTRY_BUILD_PLAN.md` - Registry phases U1-U3
- `/Downloads/EBL_BATTLER_BUILD_PLAN.md` - Game phases 0-6
- `/Downloads/UCAR/SHOW_LAUNCH_RUNBOOK.md` - Daily show automation

---

## GIT + SUPABASE PIPELINE

### Current Setup
- **Repo:** GitHub (usecasearmsrace.com)
- **Hosting:** GitHub Pages (static HTML)
- **Database:** Supabase (Postgres + pgvector + edge functions)
- **Migrations:** Supabase CLI (`supabase migration new`, `supabase db push`)

### Deployment Process
1. **Feature branch:** `phase-{n}-{slug}` (e.g., `phase-0-hardening`)
2. **One PR per phase** with acceptance checklist pasted
3. **Staging first:** Deploy to Supabase staging project with flag OFF
4. **Run acceptance tests** in staging environment
5. **Merge to main** when all tests pass
6. **Production rollout:** Enable feature flag when OWNER approves
7. **Rollback:** Disable flag, never edit migrations

### Feature Flags (Environment Variables)
```bash
FLAG_FEED=false           # Phase U1
FLAG_AUTOVERIFY=false     # Phase U2
FLAG_COMPLAINTS=false     # Phase U3
FLAG_MINT_V2=false        # Phase EBL-1
FLAG_SHOW=false           # Phase SHOW
# ... (11 total flags)
```

---

## LAUNCH READINESS CHECKLIST

### T-14 Days
- [ ] Phases 0, U1, U2, U3, EBL-1 complete
- [ ] All acceptance tests passing
- [ ] Backfill minted (every case has card art)
- [ ] Standards page legal-reviewed
- [ ] Steward prompts frozen at v1

### T-7 Days
- [ ] Phase SHOW complete
- [ ] 6 Case of the Day candidates shortlisted
- [ ] 2 dress-rehearsal episodes produced
- [ ] OpenGraph unfurls verified on x.com
- [ ] Steward's registry entry filed

### T-1 Day
- [ ] Episode 1 recorded + scheduled
- [ ] Admin paging tested
- [ ] Rollback rehearsed

### Launch Day
- [ ] Publish episode 1
- [ ] Confirm Card of the Day live
- [ ] Monitor review queue + rate limits for 6 hours

---

## KNOWN ISSUES & TECHNICAL DEBT

### High Priority
1. **Embedding search disabled** - Dependencies broken in search-cases function
2. **No RLS policies** - Database vulnerable to unauthorized writes
3. **No rate limiting** - Spam/DOS vectors open
4. **Anonymous auth only** - No email magic links implemented
5. **SVG theme incomplete** - 58 hardcoded color values need dynamic theming

### Medium Priority
6. **No tests** - Zero test coverage (framework now in place)
7. **No admin queue** - needs_human cases have no review UI
8. **No complaint system** - No way to flag misinformation
9. **Card formula exists but no persistence** - Minting generates objects, doesn't store
10. **No show automation** - Episode creation is manual only

### Low Priority (Post-Launch)
11. **EBL game economy** - Mining, battles, quests not implemented
12. **Realtime subscriptions** - Feed doesn't update live yet
13. **Social cross-posting** - YouTube/TikTok/LinkedIn are manual links only

---

## SUCCESS METRICS (Week 1 Post-Launch)

**Baseline targets (not goals, just measurement):**
- Episode completion rate: Track % of viewers who finish video
- Cases submitted per day: Organic submissions via search
- Vote actions per visitor: Engagement on Good/Evil voting
- Share-outs to X: Twitter card unfurls driving traffic
- Complaint volume: Track complaint filing rate
- Complaint dismissal rate: Steward triage accuracy
- Card of the Day claim count: Free-to-play EBL engagement

---

## TEAM ROLES

- **OWNER (Jason Shearer):** All design decisions, satire copy, character voices, episode picks, launch approval
- **AI Agent (Claude):** Implementation per build plans, no design authority, must use `[COPY: *]` placeholders
- **Legal Counsel:** Review satire notice before launch (standards page section 7)
- **K'Dee Production:** Video production workflow (OWNER specified, not documented)

---

## CONTACT & QUESTIONS

All technical questions → Refer to:
1. `TASKS.md` for implementation details
2. Build plans in `/Downloads/UCAR/` for specifications
3. `config/economy.ts` for tunable values
4. `CONTENT_TODO.md` for pending OWNER decisions

All OWNER decisions → Tag as `[OWNER]` and block until Jason provides direction

---

**Status:** Foundational documents created, Phase 0 ready to begin  
**Next Action:** Fix SVG theme colors (30 min quick win), then start RLS audit
