# FIELD_DEBRIEFER

> AI-powered field visit debriefing tool for The/Nudge Foundation  
> Take-Home Option C — AI Product Engineer

---

## What it does

Field officers log village visits on a mobile-friendly form (location, programme area, text notes, voice memo, photos). An async AI pipeline then:

1. Transcribes any voice memo (AssemblyAI)
2. Pulls the last 3 visits to the same location for longitudinal context
3. Calls an LLM to generate a structured debrief (key findings, blockers, community sentiment, follow-ups, escalation flag)
4. Emails the regional manager automatically if the visit is flagged **Escalate**

Managers see a live dashboard with debrief status, a patterns page (cross-village recurring issues), and an interactive map. Admins can manage users and roles.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 · React 19 · Tailwind CSS v4 · shadcn/ui |
| Database | Supabase (PostgreSQL 15 + pgvector + RLS) |
| Auth | Supabase Auth — Google OAuth, HTTP-only cookies |
| Transcription | AssemblyAI v2 |
| LLM | Groq — llama-3.3-70b-versatile (temp 0.1) |
| Edge Function | Supabase Edge Function (Deno) |
| Rate Limiting | Upstash Redis + @upstash/ratelimit |
| Email | Resend API |
| Maps | Leaflet / react-leaflet |
| Deployment | Vercel + Supabase Cloud |

---

## Local Setup

### Prerequisites

- Node.js 18+
- Supabase CLI (`npm install -g supabase`)
- A Supabase project (free tier is fine)
- API keys: Groq, AssemblyAI, Resend, Upstash Redis

### 1. Clone & install

```bash
git clone <repo-url>
cd field-debrief
npm install
```

### 2. Environment variables

Create `.env.local` in `field-debrief/`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
UPSTASH_REDIS_REST_URL=<url>
UPSTASH_REDIS_REST_TOKEN=<token>
```

### 3. Database migrations

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Migrations run in order: `001_extensions` → `009_citations`. RLS policies are in `008_rls.sql`.

### 4. Edge Function environment variables

Set these in your Supabase project dashboard under **Settings → Edge Functions → Secrets**:

```
GROQ_API_KEY
ASSEMBLYAI_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
WEBHOOK_SECRET
```

### 5. Deploy the Edge Function

```bash
supabase functions deploy process-debrief
```

### 6. Set up the Postgres webhook

In Supabase dashboard → **Database → Webhooks**, create a webhook:

- Table: `visits`
- Events: `INSERT`
- URL: `https://<project>.supabase.co/functions/v1/process-debrief`
- Header: `x-webhook-secret: <your-WEBHOOK_SECRET>`

### 7. Run locally

```bash
npm run dev
```

App runs at `http://localhost:3000`. First login via Google OAuth creates your profile; set your role to `admin` directly in the database for initial setup.

---

## Seed Data

Realistic seed data covering 3 Karnataka districts (Mysuru, Hassan, Mandya), 5 officers, 2 managers, 1 admin, and 30+ visits with varied debrief states and escalation flags is available in `supabase/seed.sql` (generated separately).

---

## Project Structure

```
field-debrief/
├── app/
│   ├── api/v1/          # Route Handlers (visits, patterns, admin, export, map)
│   ├── admin/           # Admin user management page
│   ├── patterns/        # Cross-village pattern analysis page
│   └── visits/          # Officer visit submission + detail pages
├── components/          # Shared UI (navbar, toast, skeleton, map, export)
├── lib/
│   ├── schemas.ts       # Zod validation schemas
│   └── supabase/        # Server + browser Supabase clients
├── supabase/
│   ├── functions/
│   │   └── process-debrief/  # Edge Function (transcription + LLM)
│   └── migrations/      # 001–009 SQL migrations
└── SECURITY.md          # Security architecture + known issues
```

---

## Roles & Access

| Role | Can do |
|---|---|
| `officer` | Submit visits, view own visits and debriefs |
| `manager` | View all visits in their region, patterns, map |
| `admin` | All of the above + user management |

Access is enforced at two independent layers: Next.js API route checks and Postgres RLS policies.

---

## Known Limitations

- **LLM**: Spec calls for Anthropic Claude; implementation uses Groq (Llama 3.3 70B). Swapping requires only changing the `callGroq` helper and env var.
- **Transcription**: English-only. Kannada/Telugu would need a different provider.
- **SQL chat**: The natural-language SQL assistant uses a service-role connection (bypasses RLS). Marked as a known risk in `SECURITY.md`.
- **No cron retry**: Visits stuck in `debrief_status = failed` must be manually re-triggered. A cron retry worker is recommended for production.

---

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs `eslint` on every push and pull request.

---

*Built June 2026 · The/Nudge Foundation Take-Home · Option C*
