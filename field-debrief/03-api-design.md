# Doc 03 — API Design Document

All routes under `/api/v1/`. All require a valid Supabase session cookie.

---

## Standard Error Format

Every error across every route returns this shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "field": "field_name (optional)"
  }
}
```

---

## Authentication Pattern (Every Route)

```ts
// At the top of every API route handler:
const supabase = createServerClient(cookies())
const { data: { user }, error } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
const profile = await getProfile(user.id)  // fetch role + region
```

---

## Endpoint Overview

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/api/v1/visits` | officer | Submit new visit |
| GET | `/api/v1/visits` | officer / manager / admin | List visits (RLS-filtered) |
| GET | `/api/v1/visits/:id` | officer / manager / admin | Single visit + debrief |
| PATCH | `/api/v1/visits/:id/note` | officer (own only) | Append officer note to debrief |
| POST | `/api/v1/transcript` | officer | Upload audio → get transcript |
| POST | `/api/v1/pattern` | manager / admin | Generate pattern report |
| GET | `/api/v1/locations` | all | List canonical locations |
| POST | `/api/v1/locations` | officer | Submit new pending location |
| PATCH | `/api/v1/locations/:id` | admin | Verify location |
| GET | `/api/v1/admin/users` | admin | List all users |
| POST | `/api/v1/admin/users` | admin | Invite user |
| PATCH | `/api/v1/admin/users/:id` | admin | Update role / region / status |

---

## POST /api/v1/visits

**Request** (`multipart/form-data`):

```
location_id:    UUID        required
visit_date:     YYYY-MM-DD  required, not future
program_area:   string      required, must match seeded enum
stakeholders:   string[]    optional
duration_mins:  number      optional
text_notes:     string      optional — required if no voice file
voice_memo:     File        optional — required if no text_notes
                            max 10MB, MP3 / WAV / WebM
```

**Success `201`:**

```json
{ "visit_id": "uuid", "debrief_status": "pending" }
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing required fields or invalid values |
| `FUTURE_DATE` | 400 | `visit_date` is in the future |
| `FILE_TOO_LARGE` | 400 | `voice_memo` exceeds 10 MB |
| `UNSUPPORTED_FORMAT` | 400 | `voice_memo` not MP3 / WAV / WebM |
| `NOTES_REQUIRED` | 400 | Neither `text_notes` nor `voice_memo` provided |
| `DUPLICATE_VISIT` | 409 | Same officer + location + date already exists |
| `UNAUTHORIZED` | 401 | No valid session |

---

## GET /api/v1/visits

**Query parameters:**

```
location_id:    UUID                              optional
program_area:   string                            optional
nudge_flag:     Routine | Needs Attention | Escalate  optional
date_from:      YYYY-MM-DD                        optional
date_to:        YYYY-MM-DD                        optional
officer_id:     UUID                              optional, manager/admin only
page:           number                            default 1
page_size:      number                            default 20, max 50
```

**Success `200`:**

```json
{
  "visits": [{ "id": "uuid", "visit_date": "...", "summary": "...", "nudge_flag": "..." }],
  "total": 42,
  "page": 1,
  "page_size": 20
}
```

---

## GET /api/v1/visits/:id

**Success `200`:**

```json
{
  "visit": {
    "id": "uuid",
    "officer_id": "uuid",
    "location": { "id": "uuid", "name": "Village Name" },
    "visit_date": "2025-06-01",
    "program_area": "Rural Livelihoods",
    "stakeholders": ["Gram Panchayat head", "SHG leader"],
    "duration_mins": 90,
    "text_notes": "...",
    "debrief_status": "done",
    "debrief": {
      "key_findings": ["..."],
      "blockers": ["..."],
      "community_sentiment": "Mixed",
      "follow_ups": ["..."],
      "nudge_flag": "Needs Attention",
      "recurring_issues": ["..."],
      "summary": "...",
      "officer_note": "..."
    }
  }
}
```

---

## PATCH /api/v1/visits/:id/note

**Request:**

```json
{ "note": "string — appended to existing officer_note, not replaced" }
```

**Rules:**
- Officer can only append to own visits
- Appends with timestamp prefix: `[2025-06-01 14:32] {note}`
- Max 2000 chars per append

**Success `200`:**

```json
{ "officer_note": "full updated note string" }
```

---

## POST /api/v1/pattern

**Request:**

```json
{
  "visit_ids": ["uuid", "uuid"],
  "filter_context": {
    "location": "Village Name",
    "program_area": "Agriculture",
    "date_range": { "from": "2025-05-01", "to": "2025-06-01" }
  }
}
```

**Rules:**
- Minimum 3 visit IDs, maximum 30
- All visit IDs must be accessible to requesting manager (RLS)
- Rate limited: 5 requests per minute per user

**Response** (`text/event-stream`):

```
data: {"delta": "Across 12 visits in..."}
data: {"delta": " the most recurring theme..."}
data: {"done": true}
```

---

## POST /api/v1/admin/users

**Request:**

```json
{
  "email": "officer@thenudge.org",
  "full_name": "Arjun Kumar",
  "role": "officer",
  "region": "North Karnataka"
}
```

**Action:** Sends Supabase magic link invite to email. Profile pre-created with given role and region.

**Success `201`:**

```json
{ "user_id": "uuid", "invite_sent": true }
```

---

## Zod Schemas — `lib/schemas.ts`

```ts
import { z } from 'zod'

export const PROGRAM_AREAS = [
  'Rural Livelihoods',
  'Agriculture',
  'Skilling',
  'Economic Inclusion',
  'Other',
] as const

export const visitSubmitSchema = z.object({
  location_id:   z.string().uuid(),
  visit_date:    z.string().refine(d => new Date(d) <= new Date(), {
    message: 'Visit date cannot be in the future',
  }),
  program_area:  z.enum(PROGRAM_AREAS),
  stakeholders:  z.array(z.string()).optional(),
  duration_mins: z.number().positive().optional(),
  text_notes:    z.string().optional(),
})

export const debriefOutputSchema = z.object({
  key_findings:        z.array(z.string()).min(1),
  blockers:            z.array(z.string()),
  community_sentiment: z.enum(['Positive', 'Mixed', 'Negative']),
  follow_ups:          z.array(z.string()),
  nudge_flag:          z.enum(['Routine', 'Needs Attention', 'Escalate']),
  recurring_issues:    z.array(z.string()),
  summary:             z.string().min(20),
})

export const patternRequestSchema = z.object({
  visit_ids:      z.array(z.string().uuid()).min(3).max(30),
  filter_context: z.object({
    location:     z.string().optional(),
    program_area: z.string().optional(),
    date_range:   z.object({
      from: z.string(),
      to:   z.string(),
    }).optional(),
  }).optional(),
})

export const officerNoteSchema = z.object({
  note: z.string().min(1).max(2000),
})
```
