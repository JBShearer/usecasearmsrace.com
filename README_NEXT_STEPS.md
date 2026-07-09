# 🧠 USE CASE ARMS RACE - READY FOR PHASE 0

**Status:** Production roadmap complete | Git pipeline established | Phase 0 ready to begin  
**Location:** `/Users/I530341/Documents/Evil Brain Production/usecasearmsrace.com`  
**Repository:** https://github.com/JBShearer/usecasearmsrace.com

---

## 🎯 WHAT WAS ACCOMPLISHED (2026-07-08)

### 1. Complete Gap Analysis
Evaluated current implementation (10-15% complete) against three build plans:
- UCAR_REGISTRY_BUILD_PLAN.md (Registry + verification pipeline)
- EBL_BATTLER_BUILD_PLAN.md (Card battler game)
- SHOW_LAUNCH_RUNBOOK.md (Daily episode automation)

**Key Finding:** Site is demo-functional but nowhere near production-ready. Missing critical infrastructure for content moderation, legal safety, and show automation.

---

### 2. Production Documentation Suite

#### 📋 TASKS.md (Primary Implementation Guide)
- **100+ atomic tasks** across 7 phases
- Every task includes: file location, grep commands, acceptance criteria
- Phases: 0 (Hardening) → U1 (Feed) → U2 (AutoVerify) → U3 (Complaints) → EBL-1 (Minting) → SHOW (Episodes)
- Estimated timeline: 18 weeks for MVP, 6-9 months for full launch

#### 📊 BUILD_STATUS.md (Executive Summary)
- Current state (what works, what's missing)
- Phase-by-phase breakdown with timelines
- Launch readiness checklist (T-14, T-7, T-1, Launch Day)
- Success metrics and team roles
- Known issues and technical debt

#### ⚙️ config/economy.ts (All Tunable Constants)
- 50+ values extracted from build plans with source citations
- Helper functions for card derivation, scoring, reputation
- Examples: `claimCost(seatNumber)`, `shouldFlipFaction(oldRatio, newRatio)`
- Ready to use: `import { ECONOMY, cardPower } from './config/economy.ts'`

#### 📝 CONTENT_TODO.md (Placeholder Tracking)
- Tracks all `[COPY: *]` placeholders for OWNER review
- Character dialogue templates (Evil Brain, GI, Gary, Supes)
- UI copy (tooltips, banners, disclaimers)
- Legal notices requiring counsel review
- 20+ pending items logged

#### 🔒 db/POLICIES.md (Security Audit)
- **CRITICAL:** 0 RLS policies found on 11 tables (production blocker)
- Complete policy specifications (4 tiers: public read, user scoped, audit logs, registry read-only)
- Registry read-only role design (EBL isolation)
- Rate limiting schema and implementation guide
- Phase 0 acceptance criteria (5 tests)

#### 🧪 deno.json (Test Framework)
- Test commands for all phases: `deno task test:phase0`, `test:u1`, etc.
- Dependency imports (Supabase, Anthropic, std testing)
- Linting and formatting rules

---

### 3. Git Commits (2 Commits Pushed)

**Commit 1: `9fb109f`** - Production roadmap & configuration foundation
- TASKS.md, BUILD_STATUS.md, config/economy.ts, CONTENT_TODO.md, deno.json

**Commit 2: `1c22371`** - Database security audit: RLS missing (BLOCKER)
- db/POLICIES.md with complete RLS requirements

**Repository State:** Clean, all docs committed and pushed to `main`

---

## 🚨 CRITICAL FINDINGS

### Security (BLOCKER)
❌ **No Row Level Security** - All 11 tables lack RLS policies  
❌ **No rate limiting** - Spam/DOS vectors wide open  
❌ **Anonymous x-anon-id** - No email authentication  
❌ **SERVICE_ROLE_KEY** - Edge functions have full database access  
❌ **No registry isolation** - EBL functions can write to UCAR tables

**Risk Level:** CRITICAL - Cannot deploy to production  
**Resolution:** Phase 0 (2-3 weeks) must complete before any other work

### Content Moderation (BLOCKER)
❌ **No verification pipeline** - Cases go live without review  
❌ **Embedding search disabled** - Duplicate detection broken  
❌ **No complaint system** - Legal liability exposure  
❌ **No admin queue** - No way to review flagged content

**Risk Level:** HIGH - Legal and quality issues  
**Resolution:** Phases U2-U3 (4-6 weeks combined)

### Daily Show (MISSING)
❌ **No episodes table** - Can't track show schedule  
❌ **No steward brief** - Morning automation missing  
❌ **No Card of the Day** - Featured case logic doesn't exist  
❌ **No social links** - YouTube/TikTok/LinkedIn are placeholders only

**Risk Level:** MEDIUM - Show can't launch  
**Resolution:** Phase SHOW (1-2 weeks after U1, U2, EBL-1)

---

## 🎬 NEXT ACTIONS (In Order)

### Immediate (This Week)
1. **Review TASKS.md** - Confirm phasing approach with OWNER
2. **Quick Win: Fix SVG theme** (30 min) - 58 hardcoded colors in index.html
3. **Admin backdoor audit** (15 min) - `grep -rn "email.*brain" supabase/functions/`
4. **Set up test directories** - Create `tests/phase0/`, `tests/phase-u1/`, etc.

### Week 1-2: Phase 0 Start
5. **Migration 003: RLS policies** (~200 lines) - Enable security on 11 tables
6. **Migration 004: Rate limiting** (~20 lines) - Add rate_limits table
7. **Create shared/rateLimit.ts** - Rate limit checking logic
8. **Update edge functions** - Add auth checks and rate limit calls
9. **Write Phase 0 tests** - 5 acceptance criteria

### Week 3: Phase 0 Complete
10. **Deploy to staging** - Test RLS policies with real edge function calls
11. **Run acceptance tests** - All 5 must pass
12. **Document in db/POLICIES.md** - Mark policies as ✅ implemented
13. **Merge Phase 0 PR** - One PR with full checklist

### Week 4+: Continue to Phase U1
14. **Begin feed/timeline work** - Votes table, timeline UI, realtime subscriptions

---

## 📁 FILE LOCATIONS (Quick Reference)

```
usecasearmsrace.com/
├── TASKS.md                 ← Primary implementation guide (100+ tasks)
├── BUILD_STATUS.md          ← Executive summary and timeline
├── CONTENT_TODO.md          ← Placeholder tracking (20+ items)
├── config/
│   └── economy.ts           ← All tunable constants + helper functions
├── db/
│   └── POLICIES.md          ← Security audit + RLS requirements
├── deno.json                ← Test framework config
├── index.html               ← Landing page (2028 lines, needs SVG theme fix)
├── game2.html               ← Semantic triple flow (functional demo)
├── supabase/
│   ├── migrations/          ← 2 exist, 10+ needed
│   ├── functions/           ← 5 functions, 10+ needed
│   └── shared/              ← Card stats, consensus, story (3 modules)
└── tests/                   ← TODO: Create directories for all phases

External Docs:
├── /Downloads/UCAR/UCAR_REGISTRY_BUILD_PLAN.md       ← Registry spec
├── /Downloads/EBL_BATTLER_BUILD_PLAN.md              ← Game spec
└── /Downloads/UCAR/SHOW_LAUNCH_RUNBOOK.md            ← Show spec
```

---

## 🎯 DECISION POINTS FOR OWNER

### 1. Phase Sequencing
**Question:** Tackle quick wins first (SVG theme, admin audit) or dive straight into Phase 0?  
**Recommendation:** Quick wins first (1-2 hours), then Phase 0

### 2. MVP Scope
**Question:** Launch with UCAR + Show only, or wait for EBL game economy?  
**Current Plan:** UCAR + Show can launch after Phase SHOW (~18 weeks)  
**EBL Phases 2-6:** Add 13-20 weeks (battles, mining, quests)

### 3. Tunable Values
**Action Needed:** Review `config/economy.ts` and confirm all defaults  
**Examples needing confirmation:**
- Card of the Day duration: 24 hours (SHOW_CONFIG.CARD_OF_DAY_DURATION_HOURS)
- Episode target runtime: 5 minutes (SHOW_CONFIG.TARGET_RUNTIME_MINUTES)
- Autoverify SLA: 48 hours (UCAR_CONFIG.AUTOVERIFY_SLA_HOURS)

### 4. Content Placeholders
**Action Needed:** Review `CONTENT_TODO.md` and prioritize which copy to finalize first  
**Critical for launch:**
- Satire notice (legal review required)
- Verification badge tooltip (transparency)
- Under review banner (complaint flow)

### 5. Background Art Assets
**Action Needed:** Provide art files for card minting  
**Current:** 3 solid fallback colors (cream, brain-pink, gray)  
**Needed:** Final background library for deterministic card art

---

## 🔧 TECHNICAL SETUP

### Prerequisites
- **Deno:** `curl -fsSL https://deno.land/install.sh | sh`
- **Supabase CLI:** `brew install supabase/tap/supabase` (or npm install)
- **Git:** Already configured and connected

### Running Tests (When Written)
```bash
cd "/Users/I530341/Documents/Evil Brain Production/usecasearmsrace.com"
deno task test              # Run all tests
deno task test:phase0       # Run Phase 0 only
deno task test:u1           # Run Phase U1 only
```

### Creating Migrations
```bash
supabase migration new rls_hardening        # Creates 003_rls_hardening.sql
supabase db push --project-ref YOUR_REF     # Deploy to staging
```

### Feature Flags (Environment Variables)
Set in Supabase dashboard → Edge Functions → Secrets:
```
FLAG_FEED=false
FLAG_AUTOVERIFY=false
FLAG_COMPLAINTS=false
FLAG_MINT_V2=false
FLAG_SHOW=false
```

---

## 📞 QUESTIONS FOR OWNER

1. **Approval to proceed with Phase 0?** (RLS + rate limiting + auth)
2. **Confirm timeline expectations:** 18 weeks for MVP acceptable?
3. **Legal counsel contact for satire notice review?**
4. **K'Dee video production workflow documentation?** (mentioned in runbook but not specified)
5. **Clarify season length:** Six episodes per week, but how many weeks per season?

---

## 🎉 DELIVERABLES SUMMARY

✅ **Gap Analysis Complete** - 10-15% current vs 100% target  
✅ **Implementation Roadmap** - 7 phases, 100+ atomic tasks  
✅ **Configuration System** - All tunable constants extracted  
✅ **Security Audit** - Critical RLS gaps identified  
✅ **Test Framework** - Ready for acceptance test development  
✅ **Git Pipeline** - Branch strategy, PR process, feature flags  
✅ **Documentation Suite** - 6 comprehensive markdown files  

**Repository State:** Production-ready pipeline established  
**Next Milestone:** Phase 0 complete by 2026-07-22 (2 weeks)  
**Launch Target:** Q1 2027 (MVP: UCAR + Show)

---

**The site has been evaluated, gaps identified, and a complete Git→Supabase refinement pipeline built. All documentation committed and pushed. Ready to begin Phase 0: Hardening.**

🚀 **Let's build the daily show on a production-ready foundation.**
