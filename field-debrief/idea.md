---

# Field Visit Debrief Tool — Complete Project Baseline

---

## 1. Product Definition

**Vision**
A mobile-first field intelligence platform that converts raw field officer observations into structured institutional knowledge — making every visit discoverable, every pattern visible, and every blocker actionable for The/Nudge's program teams.

**Problem Statement**
The/Nudge's field officers collectively generate thousands of ground-level observations annually. This knowledge currently lives in personal notebooks, WhatsApp messages, and memory. Managers have no systematic visibility into recurring blockers, community sentiment trends, or unresolved follow-ups across geographies. The same problems get rediscovered. Institutional learning doesn't compound.

**Target Users & Personas**

| Persona | Profile | Primary Pain | Tech Comfort |
|---|---|---|---|
| Field Officer (Arjun) | 26, on-ground in Karnataka, submits 3–5 visits/week, uses Android, often on 4G/2G | Logging takes too long, loses notes | Medium |
| Program Manager (Divya) | 34, manages 8–12 officers across 2 districts, reviews weekly | No consolidated view, misses patterns | Medium-High |
| Org Admin (Shalini) | 40, The/Nudge leadership, wants strategic oversight | Can't see org-wide field intelligence | High |

**User Roles**

| Role | Capabilities |
|---|---|
| Field Officer | Submit visits, view own visits, see own debriefs |
| Manager | View all visits in assigned region, generate pattern reports, flag escalations |
| Admin | All access, user management, all regions |

**Success Metrics**
- Visit log submission time < 2 minutes
- AI debrief generation < 15 seconds
- Manager identifies a recurring pattern in < 30 seconds on dashboard
- Zero visit submissions lost to network errors
- Debrief structured field completeness > 90% (Groq extracts all required fields)

**In Scope (V1)**
- Visit log form (structured + voice + text)
- AI debrief generation via Groq
- Longitudinal village intelligence panel
- Manager dashboard with filters + Groq pattern narrative
- Two roles: Field Officer, Manager
- Google SSO auth
- Mobile-first responsive web

**Out of Scope (V1)**
- Offline PWA with background sync
- Photo upload + AI image analysis
- Multi-language input (Kannada/Hindi)
- Follow-up resolution tracking
- PDF/Excel export
- Email/push notifications
- Native mobile app
- Third-party CRM integrations

---

## 2. Functional Requirements

### Core Features

**F1 — Visit Log Submission**
- Structured fields: Location (dropdown + "other"), Date (default today), Program Area (dropdown), Stakeholders Met (multi-select + free text), Duration
- Free-text notes field (optional if voice provided)
- Voice memo upload (max 90 seconds, MP3/WAV/WebM)
- On submit: voice → Whisper transcript → merged with text notes → Groq generates debrief → saved to DB
- Officer sees debrief card immediately after submission
- Officer can add a manual note to the debrief (append only, not edit AI output)

**F2 — AI Debrief Generation**
Groq receives: structured fields + merged transcript + text notes + last 3 visits to same location (if any)

Groq returns strict JSON:
```json
{
  "key_findings": ["string"],
  "blockers": ["string"],
  "community_sentiment": "Positive | Mixed | Negative",
  "follow_ups": ["string"],
  "nudge_flag": "Routine | Needs Attention | Escalate",
  "recurring_issues": ["string"],
  "summary": "string (2-3 sentences)"
}
```

Validation: Zod schema on response. If validation fails → retry once with stricter prompt. If retry fails → save raw Groq text as `debrief_raw`, flag visit as `debrief_status: failed` for manual review.

**F3 — Longitudinal Village Panel**
- When officer selects a location in the form, a side panel (or bottom sheet on mobile) loads the last 3 visits to that location
- Shows: date, officer name, nudge_flag, top 2 blockers, summary
- Purpose: officer reads before submitting so they're aware of history

**F4 — Manager Dashboard**
- Visit feed: all visits in manager's region, sorted by date desc
- Filters: location, program area, nudge_flag, date range, officer
- Each visit card: officer name, location, date, nudge_flag colour badge, summary
- Click to expand: full debrief
- "Generate Pattern Report" button: sends last N filtered visits to Groq → returns 3-paragraph narrative identifying recurring themes, sentiment trends, escalation recommendations
- Pattern report is displayed inline and can be copied to clipboard

**F5 — Admin Panel**
- User management: invite officers/managers, assign regions, deactivate accounts
- View all visits org-wide
- Same dashboard as manager but no region restriction

### Business Rules
- An officer can only submit one visit per location per day (duplicate warning, not hard block — they can override with confirmation)
- Pattern report requires minimum 3 visits in the filter set — below this, show a warning instead
- nudge_flag = "Escalate" visits are highlighted in red on the manager dashboard
- Officers cannot see other officers' visits
- Managers can only see visits from officers in their assigned region
- Location dropdown is seeded with The/Nudge operational geographies; "Other" opens a text field which creates a pending location entry

### Validation Rules
- Date: cannot be future date
- Voice memo: max 90 seconds, max 10MB, accepted formats MP3/WAV/WebM
- At least one of: text notes OR voice memo must be provided
- Location: required
- Program Area: required (seeded list: Rural Livelihoods, Agriculture, Skilling, Economic Inclusion, Other)
- Stakeholders Met: optional but encouraged (tooltip shown if empty)

### Error Handling Rules
- Network timeout on submit: show retry button, do not lose form data (persist in sessionStorage)
- Whisper API failure: save visit without transcript, flag as `transcription_status: failed`, show officer a message that voice processing failed but visit was saved
- Groq API failure: save visit with `debrief_status: pending`, retry async via a queue (simple Supabase Edge Function cron), officer sees "Debrief generating..." state
- Groq returns invalid JSON after retry: save raw text, flag `debrief_status: failed`, admin notified

---

## 3. Non-Functional Requirements

### Performance
- Visit form load: < 1.5s on 4G
- Debrief generation end-to-end (voice upload → transcript → Groq → display): < 20s P95
- Dashboard load (50 visits): < 2s
- Pattern report generation: < 15s (shown with streaming if possible)
- Longitudinal panel load: < 500ms (indexed query)

### Reliability
- Uptime target: 99.5% (appropriate for an NGO prototype — not a financial system)
- Supabase handles automated daily backups (Point-in-Time Recovery on Pro plan)
- No custom disaster recovery for V1 — Supabase's built-in is sufficient
- Failed debriefs retried via cron every 15 minutes, max 3 retries

### Scalability
- V1 assumption: 50 field officers, 200 visits/week, 10K visits/year
- Supabase free/pro tier handles this comfortably
- pgvector index on visit embeddings supports semantic search up to ~100K records without tuning
- Next.js on Vercel auto-scales serverless functions — no manual scaling needed at this volume

### Maintainability
- All Groq prompts in a single `lib/prompts.ts` file — version controlled, easy to tune
- Zod schemas for all API inputs and Groq outputs in `lib/schemas.ts`
- Environment variables documented in `.env.example`
- README covers: local setup, env vars, Supabase migration, deployment

---

## 4. Security Baseline

### Authentication
**Decision:** Supabase Auth with Google OAuth (SSO)
- Rationale: The/Nudge staff use Google Workspace; zero password management; takes 30 minutes to configure
- Session: Supabase manages JWT tokens, 1-hour expiry with refresh token rotation
- No username/password fallback in V1 (reduces attack surface)

### Authorization
- Row Level Security (RLS) enforced at Supabase DB level — not just application layer
- Officers: `SELECT` only their own visits (`auth.uid() = officer_id`)
- Managers: `SELECT` visits where `region = manager.region`
- Admins: full access via service role, only used in admin panel server actions
- All Next.js API routes validate session server-side before any DB call

### Data Protection
- **Assumption (documented):** Visit notes may contain community-level observations but should not contain named beneficiary PII. A visible disclaimer on the form states: *"Do not enter names of individual beneficiaries or personal details."*
- Voice memos stored in Supabase Storage with private bucket — only accessible via signed URLs (15-minute expiry)
- Signed URLs generated server-side, never exposed in client bundle
- Database: Supabase encrypts at rest by default (AES-256)
- Transit: TLS enforced on all Supabase and Vercel endpoints

### API Security
- All Next.js API routes are server-side — Anthropic API key and Supabase service role key never reach the client
- Rate limiting: Vercel Edge middleware limits `/api/*` to 30 requests/minute per IP
- Input sanitization: all user inputs run through Zod validation before any DB write or Groq call
- Groq prompt injection mitigation: user-provided text is clearly delimited in prompts with XML tags (`<officer_notes>...</officer_notes>`) and Groq is instructed to treat content between tags as data, not instructions

### Secrets Management
- All secrets in Vercel environment variables (encrypted at rest)
- `.env.example` committed with placeholder values, `.env.local` in `.gitignore`
- Secrets: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ASSEMBLYAI_API_KEY`
- No secrets hardcoded anywhere — enforced by pre-commit hook (simple grep check)

### Logging & Audit
- Every Groq API call logged: timestamp, officer_id, visit_id, tokens_used, latency, success/fail
- Every visit submission logged with officer_id and IP (for abuse detection)
- Logs stored in a `audit_logs` Supabase table, not exposed in UI, accessible to admin only
- No PII logged — notes content never written to logs

---

## 5. Technical Architecture

```
┌─────────────────────────────────────────────┐
│           Next.js 14 (App Router)            │
│                                              │
│  /app                                        │
│    /(auth)     → Login page                  │
│    /(officer)  → Visit form, My visits       │
│    /(manager)  → Dashboard, Pattern reports  │
│    /(admin)    → User management             │
│  /api                                        │
│    /visits     → POST submit visit           │
│    /debrief    → POST generate debrief       │
│    /pattern    → POST generate pattern       │
│    /locations  → GET location list           │
│    /transcript → POST voice → transcript     │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   Supabase              External APIs
   - PostgreSQL          - Groq API
   - pgvector            - AssemblyAI
   - Auth                  (Whisper)
   - Storage
   - Edge Functions
     (async retry cron)
        │
   Vercel
   (deployment + edge middleware)
```

**Frontend:** Next.js 14 App Router with server components for data fetching, client components only where interactivity is needed (form, dashboard filters). Tailwind + shadcn/ui for mobile-first design. Recharts for dashboard charts.

**Backend:** Next.js API routes (server actions where appropriate). No separate FastAPI — unnecessary complexity for this data flow.

**Database:** Supabase PostgreSQL with RLS. pgvector extension enabled for future semantic visit search (not used in V1 UI but embeddings stored on each visit for V2).

**File Storage:** Supabase Storage private bucket for voice memos.

**AI Pipeline:**
1. Voice file → AssemblyAI API → transcript text
2. Transcript + form fields + location history → Groq API → structured JSON debrief
3. Zod validation → save to DB

**Async retry:** Supabase Edge Function on cron (every 15 min) picks up visits with `debrief_status: pending` and retries Groq call.

**Deployment:** Vercel (Next.js native, zero config, auto-scaling). Supabase cloud (managed Postgres).

---

## 6. Data Model

```sql
-- Users (extended from Supabase auth.users)
profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name       TEXT NOT NULL,
  role            TEXT CHECK (role IN ('officer','manager','admin')) NOT NULL,
  region          TEXT,                    -- null for admin
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

-- Canonical location registry
locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  district        TEXT,
  state           TEXT DEFAULT 'Karnataka',
  is_verified     BOOLEAN DEFAULT FALSE,   -- admin-verified vs officer-submitted
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

-- Visit submissions
visits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id      UUID NOT NULL REFERENCES profiles(id),
  location_id     UUID NOT NULL REFERENCES locations(id),
  visit_date      DATE NOT NULL CHECK (visit_date <= CURRENT_DATE),
  program_area    TEXT NOT NULL,
  stakeholders    TEXT[],                  -- array of names/roles
  text_notes      TEXT,
  voice_memo_url  TEXT,                    -- Supabase Storage path
  transcript      TEXT,
  transcription_status TEXT DEFAULT 'none'
                  CHECK (transcription_status IN ('none','pending','done','failed')),
  debrief_status  TEXT DEFAULT 'pending'
                  CHECK (debrief_status IN ('pending','done','failed')),
  debrief_raw     TEXT,                    -- raw Groq output if JSON parse fails
  retry_count     INT DEFAULT 0,
  embedding       VECTOR(1536),            -- stored for V2 semantic search
  created_at      TIMESTAMPTZ DEFAULT NOW()
)

-- Structured debrief output
debriefs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id        UUID NOT NULL UNIQUE REFERENCES visits(id),
  key_findings    TEXT[] NOT NULL,
  blockers        TEXT[],
  community_sentiment TEXT CHECK (community_sentiment IN ('Positive','Mixed','Negative')),
  follow_ups      TEXT[],
  nudge_flag      TEXT CHECK (nudge_flag IN ('Routine','Needs Attention','Escalate')),
  recurring_issues TEXT[],
  summary         TEXT NOT NULL,
  officer_note    TEXT,                    -- append-only officer annotation
  generated_at    TIMESTAMPTZ DEFAULT NOW()
)

-- Audit log
audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,           -- 'visit_submit','Groq_call','auth_login' etc
  actor_id        UUID REFERENCES profiles(id),
  visit_id        UUID REFERENCES visits(id),
  metadata        JSONB,                   -- tokens_used, latency, success, etc
  created_at      TIMESTAMPTZ DEFAULT NOW()
)
```

**Indexes:**
```sql
CREATE INDEX visits_location_date_idx ON visits(location_id, visit_date DESC);
CREATE INDEX visits_officer_idx ON visits(officer_id);
CREATE INDEX visits_debrief_status_idx ON visits(debrief_status) WHERE debrief_status = 'pending';
CREATE INDEX debriefs_nudge_flag_idx ON debriefs(nudge_flag);
```

**Future expansion:** `follow_up_actions` table (visit_id, action_text, assigned_to, resolved_at), `pattern_reports` table (cached manager reports), `locations.coordinates` (POINT type for map view).

---

## 7. API Design Baseline

**Convention:** RESTful, JSON, all routes under `/api/v1/`

**Auth:** Every request validated server-side via `supabase.auth.getUser()` from session cookie. 401 returned if invalid.

**Error format (consistent across all routes):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "visit_date cannot be in the future",
    "field": "visit_date"
  }
}
```

**Routes:**

```
POST   /api/v1/visits           Submit new visit (multipart: fields + audio file)
GET    /api/v1/visits           List visits (manager/admin; officer sees own)
GET    /api/v1/visits/:id       Single visit with debrief
PATCH  /api/v1/visits/:id/note  Officer appends note to debrief

POST   /api/v1/transcript       Upload audio → returns transcript text (called before visit submit)
POST   /api/v1/pattern          Generate pattern report (manager+ only); body: { visit_ids: [] }

GET    /api/v1/locations        List canonical locations
POST   /api/v1/locations        Create pending location (officer)
PATCH  /api/v1/locations/:id    Verify location (admin only)

GET    /api/v1/admin/users      List users (admin only)
POST   /api/v1/admin/users      Invite user
PATCH  /api/v1/admin/users/:id  Update role/region/status
```

**Versioning:** `/api/v1/` prefix. V2 when breaking changes needed — old version maintained for 30 days.

**Groq prompt versioning:** Each prompt has a version string in `lib/prompts.ts` (`DEBRIEF_PROMPT_V2`). Version stored in `audit_logs.metadata` so you can correlate output quality to prompt version.

---

## 8. Operational Baseline

### Monitoring
- Vercel Analytics: page load times, function execution times, error rates (built-in, zero config)
- Supabase Dashboard: DB query performance, storage usage, auth events
- Custom: `audit_logs` table queryable by admin for Groq call success rates and token spend

### Alerting (V1 — lightweight)
- Vercel sends email on function error spike (built-in)
- Manual: admin checks `debrief_status: failed` count weekly
- V2: set up Supabase webhook → Slack for Escalate-flagged visits

### CI/CD
```
GitHub → push to main
  → Vercel auto-deploy (preview on PR, production on merge to main)
  → Supabase migrations: run via `supabase db push` in deploy script
  → No automated test runner in V1 (time constraint) — manual smoke test checklist
```

### Testing Strategy
**V1 (realistic for 1 week):**
- Manual smoke test checklist: submit visit with voice, submit without voice, trigger Groq failure, test RLS (log in as officer, verify you can't see other officer visits), test manager dashboard filters
- Zod schemas act as runtime validation tests
- Groq prompt tested with 5 fixture inputs before launch

**V2:**
- Jest unit tests for utility functions and Zod schemas
- Playwright E2E for critical paths (submit visit → debrief appears)
- Groq prompt regression tests with fixture inputs and expected output structure

### Release Process
- Feature branches → PR → review (self-review for solo build) → merge to main → Vercel auto-deploys
- Supabase migrations committed to `/supabase/migrations/` and applied before or with deploy
- Rollback: Vercel one-click rollback to previous deployment; Supabase PITR if DB rollback needed

---

## 9. Edge Cases and Failure Scenarios

| Scenario | Mitigation |
|---|---|
| Officer submits with no text and empty/silent voice memo | Minimum transcript length check (> 20 words) before Groq call; show validation error "Please add notes or a voice memo with observations" |
| Same officer, same location, same day — double submit | Warning modal on second attempt: "You already logged a visit here today. Submit anyway?" — soft block |
| Groq prompt injection via officer notes | Notes delimited with XML tags in prompt; Groq instructed to treat as data; Zod validation on output structure catches instruction-following failures |
| AssemblyAI returns transcript in wrong language | Transcript quality check not done in V1 — documented as known limitation; officer can see transcript and flag issues |
| Pattern report on 0–2 visits | UI blocks "Generate Report" button with tooltip: "Select at least 3 visits to generate a pattern report" |
| Location "Other" text creates inconsistent names | Queued for admin verification; shown with ⚠️ badge until verified; longitudinal matching only runs on verified locations |
| Manager region changes — old visits stranded | Visits are attributed to `location_id` not manager region. Manager sees visits based on their current region assignment. Historical visits in old region become invisible to them — documented limitation, acceptable for V1 |
| Voice file too large (> 10MB) | Client-side validation before upload; clear error message with file size shown |
| Supabase Storage upload succeeds but DB write fails | Wrapped in a transaction-like pattern: DB write first, Storage upload second; if Storage fails, visit is saved without voice but with error flag |
| Groq API returns 429 (rate limit) | Exponential backoff retry (1s, 3s, 9s); if all fail, visit saved as `debrief_status: pending` for cron retry |
| Officer submits future date | Client-side and server-side validation; Zod rejects `visit_date > today` |
| Admin deletes a user — orphaned visits | Soft delete only: `profiles.is_active = false`; visits remain with `officer_id` intact; deactivated user cannot log in |

---

## 10. Final Architecture Review (Hostile Reviewer Mode)

**Attack 1: "Your longitudinal panel is useless if location names are inconsistent"**
*Weakness:* Officer types "Hunasagi" and another typed "Hunasagi village" — they don't match, longitudinal panel shows nothing.
*Fix applied:* Location is a dropdown from a canonical `locations` table, not free text. "Other" creates a pending entry that only becomes canonical after admin verification. Longitudinal matching only runs on canonical location IDs (UUIDs), not strings.

**Attack 2: "Groq will hallucinate blockers that weren't in the notes"**
*Weakness:* Groq is generative — it can add plausible-sounding but fabricated blockers.
*Fix applied:* Groq prompt explicitly instructs: *"Only extract information explicitly present in the officer notes and transcript. Do not infer, assume, or add context not provided. If a field has no relevant content, return an empty array."* Officer can append a correction note to the debrief if they spot an error.

**Attack 3: "RLS is only as good as your policy definitions — one wrong policy and data leaks"**
*Weakness:* RLS misconfiguration is a common Supabase gotcha.
*Fix applied:* RLS policies written and manually tested with three test accounts (officer A, officer B, manager for region X) before any real data. Policies committed to `/supabase/migrations/` and reviewed. Test: officer A cannot query officer B's visits via direct Supabase client call.

**Attack 4: "Pattern report with 50 visits will blow your context window and cost a lot"**
*Weakness:* 50 full visit transcripts sent to Groq = potentially 100K+ tokens.
*Fix applied:* Pattern report sends only the `debrief.summary` and `debrief.blockers` for each visit, not full transcripts. Max 30 visits per pattern report (UI enforces). Estimated token cost per report: ~3K tokens = ~$0.01. Logged in audit_logs.

**Attack 5: "AssemblyAI async transcription means the officer waits — what if they navigate away?"**
*Weakness:* If transcription is async (polling), officer might close tab before debrief appears.
*Fix applied:* AssemblyAI offers a synchronous endpoint for files < 90 seconds. Use synchronous mode for V1. If it exceeds timeout (rare), fall back to saving visit without transcript + async retry. Officer sees "Visit saved — debrief generating" state.

**Attack 6: "Vercel serverless functions have a 10-second default timeout — Groq might exceed this"**
*Weakness:* Groq + AssemblyAI sequentially could hit 15–20 seconds.
*Fix applied:* Vercel Pro allows 60-second function timeout. Set `maxDuration = 60` on the submit route. Alternatively, decouple: submit saves visit immediately, debrief generation is triggered async via Supabase Edge Function. Officer sees optimistic UI — "Visit saved, debrief generating..." — then polls for result. This is the more robust architecture and is the final decision.

**Improved flow:**
```
Officer submits → API saves visit (< 1s) → triggers Supabase Edge Function async
→ Officer sees "Visit saved!" immediately
→ Edge Function: AssemblyAI → Groq → update debrief → set debrief_status: done
→ Client polls /api/v1/visits/:id every 3s → when done, debrief card appears
→ Total wait: 10–20s in background, officer not blocked
```

---

## 11. Readiness Certification

| Dimension | Score | Notes |
|---|---|---|
| Product Clarity | 19/20 | All features defined; minor: program area taxonomy not confirmed with The/Nudge |
| Technical Clarity | 18/20 | Stack, data model, API all specified; async flow adds slight implementation complexity |
| Security | 17/20 | RLS, auth, secrets all defined; penetration testing not done (not expected for prototype) |
| Scalability | 18/20 | Well within Supabase/Vercel limits at projected volume; pgvector ready for V2 |
| Reliability | 16/20 | Async retry cron covers Groq failures; no chaos testing; acceptable for NGO prototype |
| Maintainability | 18/20 | Prompts versioned, schemas centralized, migrations committed; no automated tests in V1 |
| Implementation Readiness | 18/20 | One remaining unknown: Vercel function timeout config needs Pro plan confirmation |

### **Final Score: 124/140 → 89/100**

**Remaining 11 points — what would close them:**

1. **(4pts) Confirm program area taxonomy** with The/Nudge before seeding the DB. If wrong, officers hit "Other" constantly and the filter analytics become useless.
2. **(4pts) Automated test suite** — even 5 Playwright E2E tests on critical paths would catch regressions. Not feasible in 1 week but document it as immediate V2 action.
3. **(3pts) Vercel Pro plan** — confirm you have access or the 60-second function timeout fix doesn't apply. Fallback is the async Edge Function approach (already designed above), which works on free tier.

---

## Build Sequence (Day-by-Day)

Now that the baseline is locked, here's the optimal build order:

| Day | Focus |
|---|---|
| 1 | Supabase setup (schema, RLS, auth, storage bucket), Next.js project scaffold, Google SSO working end-to-end |
| 2 | Visit submission form (all fields, validation), AssemblyAI voice upload + transcription |
| 3 | Groq debrief generation (prompt, Zod validation, async Edge Function, polling UI) |
| 4 | Longitudinal village panel, My Visits page for officers |
| 5 | Manager dashboard (visit feed, filters, nudge_flag badges, debrief expand) |
| 6 | Pattern report generation, Recharts charts, admin user management |
| 7 | Mobile-first polish, error states, README, Loom demo recording |

---
