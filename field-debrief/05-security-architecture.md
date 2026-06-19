# Doc 05 — Security Architecture Document

---

## Threat Model (STRIDE)

| Threat | Type | Attack Vector | Mitigation |
|---|---|---|---|
| Officer accesses another officer's visits | Information Disclosure | Direct Supabase query with known visit UUID | RLS policy blocks at DB level, not just API layer |
| Manager accesses another region's data | Information Disclosure | Modified API request or direct DB query | RLS region check on `visits` SELECT policy |
| Prompt injection via officer notes | Tampering | Officer includes instructions in text notes to override Claude | Notes delimited with XML tags; Claude instructed to treat content as data only |
| Replay attack on voice memo upload | Spoofing | Re-upload old audio to generate new debrief | Signed URLs expire in 15 min; visit row tied to `officer_id` |
| API key exposure in client bundle | Information Disclosure | Browser dev tools / source inspection | All API keys in server-only routes; never in `NEXT_PUBLIC_` env vars |
| Unauthorised admin action | Elevation of Privilege | Officer calls `/api/v1/admin/*` endpoints | Role check at start of every admin route; 403 for non-admin |
| SQL injection via filter params | Tampering | Malicious query params in visit filters | All inputs validated through Zod; parameterised queries via Supabase SDK |
| Excessive Claude API spend | Denial of Service | Rapid visit submission triggering many Claude calls | Rate limit: 30 req/min per IP via Vercel Edge middleware; 1 debrief per visit (DB unique constraint on `debriefs.visit_id`) |

---

## Authentication Flow

```
1. User visits /login
2. Clicks "Sign in with Google"
3. Supabase redirects to Google OAuth
4. Google authenticates → redirects to /auth/callback?code=...
5. /auth/callback exchanges code for Supabase session
6. Supabase sets HTTP-only session cookie (not accessible to JS)
7. profiles trigger fires → creates profile with role='officer' (default)
8. middleware.ts refreshes session on every subsequent request
9. Every API route calls supabase.auth.getUser() to validate session server-side
```

### `middleware.ts`

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* get/set/remove helpers */ } }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based route protection
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const profile = await getProfile(user?.id)
    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## Secrets Management

| Secret | Where Stored | Exposed to Client? | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel env vars | Never | Server-only routes |
| `ASSEMBLYAI_API_KEY` | Vercel env vars | Never | Server-only routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env vars | Never | Admin/Edge Function operations only |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env vars | Yes | Safe — no sensitive data |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env vars | Yes | Safe — RLS enforces all access |
| `GOOGLE_CLIENT_SECRET` | Supabase dashboard | Never | Set in Supabase Auth settings |

---

## Rate Limiting (Vercel Edge Middleware)

```ts
// middleware.ts — add before session check

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/v1/visits':   { max: 30, windowMs: 60_000 },  // 30/min per IP
  '/api/v1/pattern':  { max: 5,  windowMs: 60_000 },  // 5/min (expensive Claude call)
  '/api/v1/transcript': { max: 10, windowMs: 60_000 },
}
```

---

## Pre-commit Secret Scanner

```bash
#!/bin/bash
# .git/hooks/pre-commit — install with: chmod +x .git/hooks/pre-commit

if grep -rE 'ANTHROPIC|sk-ant|service_role|assemblyai' \
    --include='*.ts' --include='*.tsx' \
    --exclude-dir='.next' --exclude-dir='node_modules' .; then
  echo ""
  echo "ERROR: Possible secret found in source code. Aborting commit."
  echo "Use environment variables instead."
  exit 1
fi
```

---

## Storage Bucket Policy (voice-memos)

```sql
-- Officers can upload to their own folder only
-- Path pattern: {officer_id}/{visit_id}.webm

CREATE POLICY voice_memo_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-memos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Officers can read their own memos; managers can read region memos
CREATE POLICY voice_memo_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-memos' AND
    (storage.foldername(name))[1] = auth.uid()::text
    -- Extend for manager access via join if needed
  );
```

---

## Manual Smoke Test Checklist

Run before every deployment and before handing off to The/Nudge.

### Auth & Role Checks
- [ ] Log in as officer-a → submit visit with voice memo → debrief appears within 30s
- [ ] Log in as officer-a → confirm officer-b's visits are NOT visible in any UI or API
- [ ] Log in as manager → confirm only own-region visits are visible
- [ ] Log in as officer → call `GET /api/v1/admin/users` → confirm `403` returned
- [ ] Log in as manager → call `POST /api/v1/admin/users` → confirm `403` returned

### Validation Checks
- [ ] Submit visit with future date → rejected with `FUTURE_DATE` error
- [ ] Submit visit with no notes AND no voice → rejected with `NOTES_REQUIRED` error
- [ ] Upload voice file > 10 MB → rejected client-side before upload begins
- [ ] Submit voice file with `.pdf` extension → rejected with `UNSUPPORTED_FORMAT`

### Resilience Checks
- [ ] Disconnect network mid-submit → form data persists in `sessionStorage` on reload
- [ ] Manually set `debrief_status='failed'` on a visit → officer sees correct failure message
- [ ] Open visit detail page while debrief is still pending → Realtime update renders debrief without page refresh

### Security Checks
- [ ] Verify `ANTHROPIC_API_KEY` does NOT appear in browser Network tab
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` does NOT appear in browser Network tab
- [ ] Verify `voice-memos` bucket is NOT publicly accessible via direct URL
