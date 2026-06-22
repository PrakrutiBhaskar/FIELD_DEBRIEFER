# Doc 01 — Implementation Blueprint

> Your daily build guide. Follow sequentially. Each day has a clear output.

---

## Pre-Day 0 Checklist (Before Writing Any Code)

- [ ] Message The/Nudge contact: request program area list (5–8 items) and top 20 operational village/location names
- [ ] Create Google OAuth app in Google Cloud Console → save Client ID + Secret
- [ ] Create Supabase project → enable pgvector extension → create private storage bucket `voice-memos`
- [ ] Create Vercel project linked to GitHub repo
- [ ] Create Anthropic API key and AssemblyAI API key
- [ ] Test each API key independently (curl / playground) before wiring into code
- [ ] Populate `.env.local` with all secrets (see Doc 6 for full list)

---

## Day 1 — Foundation (Auth + Schema + Deploy Shell)

**Goal:** A deployed empty app where Google SSO works end-to-end.

- [ ] `npx create-next-app@latest field-debrief --typescript --tailwind --app`
- [ ] Install: `@supabase/supabase-js @supabase/ssr shadcn/ui recharts zod`
- [ ] Run all Supabase migrations (see Doc 2 for full SQL)
- [ ] Implement Google OAuth via Supabase Auth — `/auth/callback` route
- [ ] Create `middleware.ts` for session refresh on every request
- [ ] Create profiles table trigger: auto-insert profile on `auth.users` INSERT
- [ ] Test with 3 dummy accounts: `officer-a@test.com`, `officer-b@test.com`, `manager-x@test.com`
- [ ] Deploy shell to Vercel — confirm build passes and SSO works on production URL

**End-of-day check:** Can you log in via Google on the Vercel URL and see your role?

---

## Day 2 — Visit Submission Form

**Goal:** Officer can fill and submit a visit (no AI yet).

- [ ] Build `/officer/submit` page with all structured fields
- [ ] Fields: Location (dropdown from DB), Date (default today, no future), Program Area (dropdown), Stakeholders Met (multi-select + free text), Duration, Text Notes
- [ ] Validation: Zod schema client-side + server-side in API route
- [ ] Voice memo upload: file input (MP3/WAV/WebM, max 10MB, max 90s) → upload to Supabase Storage → store signed URL path in visits row
- [ ] `sessionStorage` persistence: on every field change, save form state; on load, restore if present
- [ ] `POST /api/v1/visits`: validate → insert visits row with `debrief_status='pending'` → return visit ID
- [ ] Officer redirected to `/officer/visits/:id` with "Visit saved — debrief generating..." state
- [ ] Test: submit with voice, submit without voice, test file size rejection, test future date rejection

**End-of-day check:** Visit row appears in Supabase dashboard with correct `officer_id`.

---

## Day 3 — Async AI Pipeline (Most Critical Day)

**Goal:** Voice → Transcript → Groq Debrief → DB, fully async.

> Build and test this pipeline in isolation FIRST before wiring to the form.

- [ ] **Step 1:** Create Supabase Edge Function `process-debrief`
- [ ] **Step 2:** Set up DB Webhook: INSERT on `visits` table → triggers `process-debrief` Edge Function
- [ ] **Step 3:** Edge Function logic:

```
1. Fetch visit row (id, voice_memo_url, text_notes, location_id, officer_id)
2. If voice_memo_url: generate signed URL → POST to AssemblyAI → poll until done → get transcript
3. Fetch last 3 visits to same location (for context)
4. Build Groq prompt (see Doc 4 for exact prompt text)
5. POST to Anthropic API → parse JSON → validate with Zod
6. If valid: INSERT into debriefs, UPDATE visits SET debrief_status='done'
7. If invalid: retry once with stricter prompt
8. If retry fails: UPDATE visits SET debrief_status='failed', debrief_raw=rawText
```

- [ ] Client: use Supabase Realtime subscription on visits row — when `debrief_status` changes to `done` or `failed`, update UI
- [ ] Test the full loop with a dummy visit insert before connecting to the form

**End-of-day check:** Insert a dummy visit row manually → debrief appears in `debriefs` table within 20s.

---

## Day 4 — Officer Experience

**Goal:** Complete officer journey from login to debrief review.

- [ ] Longitudinal village panel: when officer selects location in form, side panel loads last 3 visits (date, officer name, nudge_flag, top 2 blockers, summary)
- [ ] My Visits page `/officer/visits`: list of own visits sorted by date desc, nudge_flag badge, summary preview
- [ ] Visit detail page `/officer/visits/:id`: full debrief card with all 7 fields
- [ ] Officer note append: `PATCH /api/v1/visits/:id/note` — append-only text field below AI debrief
- [ ] All failure states with human-readable messages (see Doc 4 for exact copy)

**End-of-day check:** End-to-end officer journey works on a real Android phone.

---

## Day 5 — Manager Dashboard

**Goal:** Manager can see all regional visits and generate pattern reports.

- [ ] `/manager/dashboard`: visit feed filtered to manager's region, sorted date desc
- [ ] Filters: location, program area, nudge_flag, date range, officer — all combinable
- [ ] Visit card: officer name, location, date, nudge_flag colour badge, summary
- [ ] Click to expand: full debrief inline
- [ ] Escalate-flagged visits highlighted with red left border
- [ ] "Generate Pattern Report" button: enabled only when 3+ visits in current filter
- [ ] `POST /api/v1/pattern`: sends last 30 filtered visit summaries + blockers to Groq → streams 3-paragraph narrative
- [ ] Pattern report displayed inline with copy-to-clipboard button

**End-of-day check:** Manager account sees only their region's visits, not other regions.

---

## Day 6 — Admin Panel + Mobile Polish

**Goal:** Admin can manage users; app works well on real Android hardware.

- [ ] `/admin/users`: list all users with role, region, status
- [ ] Invite user: `POST /api/v1/admin/users` — creates Supabase auth invite link
- [ ] Edit role/region: `PATCH /api/v1/admin/users/:id` — admin only
- [ ] Deactivate user: soft delete (`is_active=false`) — user can no longer log in
- [ ] Mobile: test all forms on 390px viewport, fix touch targets < 44px, fix bottom sheet longitudinal panel
- [ ] Error states: network timeout retry, AssemblyAI failure message, Groq failure message
- [ ] Seed 10 realistic visits across 3 locations with The/Nudge's actual taxonomies

**End-of-day check:** All 3 roles work correctly from a real phone.

---

## Day 7 — Delivery

**Goal:** Demo video + live link + 2-page report.

- [ ] Final deployment check — all env vars set in Vercel production
- [ ] Run manual smoke test checklist (see Doc 5)
- [ ] Record Loom: officer submits visit with voice → debrief appears → manager views dashboard → pattern report generated
- [ ] Write 2-page summary report (problem, solution, architecture, metrics, V2 roadmap)
- [ ] Send The/Nudge contact: live URL + Loom link + report

---

## Complete Folder Structure

```
field-debrief/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (auth)/auth/callback/route.ts
│   ├── (officer)/submit/page.tsx
│   ├── (officer)/visits/page.tsx
│   ├── (officer)/visits/[id]/page.tsx
│   ├── (manager)/dashboard/page.tsx
│   ├── (admin)/users/page.tsx
│   └── api/v1/
│       ├── visits/route.ts
│       ├── visits/[id]/route.ts
│       ├── visits/[id]/note/route.ts
│       ├── pattern/route.ts
│       ├── locations/route.ts
│       ├── transcript/route.ts
│       └── admin/users/route.ts
├── components/
│   ├── ui/                     ← shadcn components
│   ├── visit-form/
│   ├── debrief-card/
│   ├── longitudinal-panel/
│   ├── dashboard/
│   └── admin/
├── lib/
│   ├── prompts.ts              ← ALL Groq prompts versioned here
│   ├── schemas.ts              ← ALL Zod schemas here
│   ├── supabase/
│   │   ├── client.ts           ← browser client
│   │   ├── server.ts           ← server client (cookies)
│   │   └── middleware.ts
│   └── utils.ts
├── supabase/
│   ├── migrations/             ← all SQL migrations
│   └── functions/
│       └── process-debrief/index.ts
├── middleware.ts
├── .env.example
└── .env.local
```
