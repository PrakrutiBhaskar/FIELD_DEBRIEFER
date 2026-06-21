# Security Architecture
## Field Visit Debrief Tool — The/Nudge Foundation

**Last updated:** June 2026  
**Security score (post-fixes):** 84/100

---

## Authentication

- Google OAuth only via Supabase Auth (no password flow)
- Sessions stored in HTTP-only cookies via `@supabase/ssr`
- Session refresh on every request via `proxy.ts`
- Global signout (`scope: 'global'`) invalidates all sessions

## Authorization

Three roles: `officer`, `manager`, `admin`

- Officers: see/submit only their own visits
- Managers: see all visits in their region
- Admins: full access

Enforced at two layers:
1. Application layer (API routes check ownership explicitly)
2. Database layer (RLS policies on all tables)

## RLS Policies (live as of June 2026)

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | own + admin | via trigger | admin only | blocked |
| visits | own + region + admin | own officer_id | own officer_id | admin only |
| debriefs | follows visit access | service role only | own visit officer | blocked |
| locations | verified only (manager/admin see all) | — | — | — |
| audit_logs | admin only | service role | — | blocked |

## Edge Function Security

- `process-debrief` requires `x-webhook-secret` header
- Secret set via `supabase secrets set WEBHOOK_SECRET=...`
- DB webhook configured to send this header
- Idempotency guard: skips already-processed visits

## Rate Limiting

Via Upstash Redis (Mumbai region) + `@upstash/ratelimit`:

| Endpoint | Limit |
|---|---|
| `/api/v1/visits` | 30/min per IP |
| `/api/v1/pattern` | 5/min per IP |
| `/api/v1/upload` | 10/min per IP |

Fails open if Redis unavailable.

## Secrets

| Secret | Location | Client-exposed? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel env | Never |
| `GROQ_API_KEY` | Vercel env | Never |
| `ASSEMBLYAI_API_KEY` | Vercel env + Supabase secrets | Never |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env + Supabase secrets | Never |
| `WEBHOOK_SECRET` | Supabase secrets | Never |
| `UPSTASH_REDIS_REST_URL` | Vercel env | Never |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel env | Never |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env | Yes (safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env | Yes (safe — RLS enforces) |

## Known Gaps (V2 roadmap)

- No PII redaction before sending to Groq/AssemblyAI (see PRIVACY.md)
- No automated data retention/deletion jobs
- CSP uses `unsafe-inline` for scripts (Next.js 16 hydration requirement)
- No Supabase migrations in version control (tracked manually)
- No `process-debrief-cron` retry function for stuck pending visits

## Smoke Test Checklist

Run before every deployment:

- [ ] Unauthenticated request to `/visits` → redirects to `/login`
- [ ] Officer A cannot see Officer B's visits
- [ ] Manager sees only own-region visits
- [ ] Officer calling `/api/v1/admin/users` → 403
- [ ] Submit visit with future date → rejected
- [ ] Upload file > 10MB → rejected client-side
- [ ] Upload non-audio file → rejected server-side
- [ ] Rate limit: 31 rapid POST to `/api/v1/visits` → 429 on 31st
- [ ] Pattern report with < 3 visits → toast error, no API call
- [ ] Admin cannot demote last admin → blocked with message
- [ ] Sign out clears session on all devices
