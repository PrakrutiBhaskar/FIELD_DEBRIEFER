# Doc 06 — Deployment Runbook

Follow in order. Each step depends on the previous.

---

## Step 1 — Supabase Project Setup

- [ ] Create new project at [supabase.com](https://supabase.com) → choose **Singapore** region (lowest latency from Karnataka)
- [ ] Dashboard → **Database** → **Extensions** → search `vector` → enable **pgvector**
- [ ] Dashboard → **Storage** → **New Bucket**
  - Name: `voice-memos`
  - Toggle: **Private** (not public)
- [ ] Dashboard → **Authentication** → **Providers** → **Google** → enable
  - Paste Google OAuth Client ID and Client Secret
- [ ] Dashboard → **Authentication** → **URL Configuration**
  - Site URL: `https://your-app.vercel.app`
  - Redirect URLs: `https://your-app.vercel.app/auth/callback`

---

## Step 2 — Run Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link to your project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Apply all migrations in order
supabase db push

# Verify all 8 tables exist
supabase db inspect
```

Expected tables after migration:
- `profiles`
- `locations`
- `visits`
- `debriefs`
- `audit_logs`

Expected extensions: `vector`, `uuid-ossp`

---

## Step 3 — Deploy Edge Function

```bash
# Deploy the process-debrief function
supabase functions deploy process-debrief

# Set all secrets the Edge Function needs
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
supabase secrets set ASSEMBLYAI_API_KEY=your-assemblyai-key-here
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Set Up DB Webhook

1. Supabase Dashboard → **Database** → **Webhooks**
2. Click **Create a new hook**
3. Settings:
   - Name: `trigger-debrief-on-visit`
   - Table: `public.visits`
   - Events: `INSERT` only
   - Type: **Supabase Edge Functions**
   - Edge Function: `process-debrief`
4. Save

### Set Up Cron Retry (Scheduled Function)

1. Supabase Dashboard → **Edge Functions** → **Schedules**
2. Create schedule:
   - Function: `process-debrief-cron`
   - Schedule: `*/15 * * * *` (every 15 minutes)

---

## Step 4 — Vercel Setup

```bash
# Install Vercel CLI
npm install -g vercel

# Link project to Vercel
vercel link

# Add all environment variables to production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel env add ASSEMBLYAI_API_KEY production

# Deploy to production
vercel --prod
```

---

## Complete `.env.example`

```bash
# ── Supabase (safe to expose — RLS handles access control) ────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── Supabase (PRIVATE — server only, never NEXT_PUBLIC) ──────────────────
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── AI APIs (PRIVATE — server only) ──────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-...
ASSEMBLYAI_API_KEY=your-assemblyai-key
```

---

## Go-Live Checklist

### Infrastructure
- [ ] All 5 env vars set in Vercel **production** environment (not just preview)
- [ ] pgvector extension enabled in Supabase
- [ ] `voice-memos` storage bucket is **Private**
- [ ] Google OAuth redirect URL matches Vercel production URL **exactly** (trailing slash matters)
- [ ] DB Webhook points to **deployed** Edge Function URL, not localhost
- [ ] All 8 migrations applied — verify with `supabase db inspect`

### Security
- [ ] `.env.local` is in `.gitignore` — verify with `git status`
- [ ] Pre-commit hook installed: `chmod +x .git/hooks/pre-commit`
- [ ] No secrets visible in browser Network tab

### Functional
- [ ] RLS tested with 3 dummy accounts on **production** (not just local)
- [ ] End-to-end smoke test checklist passed (see Doc 5) on production URL
- [ ] Voice memo upload + debrief flow tested on real Android device

---

## Rollback Strategy

| Scenario | Rollback Method | Time to Recover |
|---|---|---|
| Broken frontend deployment | Vercel Dashboard → Deployments → previous deploy → **Promote to Production** | < 2 min |
| Bad DB migration | Write and apply reverse migration SQL via `supabase db push` | 5–15 min |
| Edge Function broken | `git revert` + `supabase functions deploy process-debrief` | < 5 min |
| Wrong env var | `vercel env rm KEY` → `vercel env add KEY` → `vercel --prod` | < 5 min |
| Corrupted visit data | Supabase Dashboard → Backups → restore (daily backup on free tier) | 30–60 min |

---

## Monitoring (Free Tier — No Extra Cost)

| What to Monitor | Where | Frequency |
|---|---|---|
| Failed debriefs | `SELECT COUNT(*) FROM visits WHERE debrief_status='failed'` | Daily |
| Pending visits older than 1 hour | `SELECT * FROM visits WHERE debrief_status='pending' AND created_at < NOW() - INTERVAL '1 hour'` | Daily |
| Groq API spend | Anthropic Console → Usage | Weekly |
| Edge Function errors | Supabase Dashboard → Edge Functions → Logs | On deploy |
| Auth failures | Supabase Dashboard → Authentication → Logs | Weekly |
| Storage usage | Supabase Dashboard → Storage → Usage | Weekly |
| Vercel function errors | Vercel Dashboard → Functions → Error rate | On deploy |

---

## Incident Response

### Debrief pipeline stops working

```bash
# 1. Check Edge Function logs
supabase functions logs process-debrief --limit 50

# 2. Check for failed visits
# Run in Supabase SQL editor:
SELECT id, created_at, retry_count, debrief_raw
FROM visits
WHERE debrief_status = 'failed'
ORDER BY created_at DESC
LIMIT 20;

# 3. Manually re-trigger a visit
# Insert a dummy update to fire the webhook again:
UPDATE visits SET retry_count = 0 WHERE id = 'visit-uuid-here';
```

### API key expired or rate limited

```bash
# Rotate the key:
vercel env rm ANTHROPIC_API_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel --prod  # redeploy to pick up new key
```

### Database connection issues

- Check Supabase Status: [status.supabase.com](https://status.supabase.com)
- Free tier has connection limits — if hitting limits, implement connection pooling via Supabase's built-in pgBouncer (Dashboard → Database → Connection Pooling)
