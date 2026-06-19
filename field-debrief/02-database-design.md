# Doc 02 — Database Design Document

---

## Migration Order

Run in order. Each file lives in `/supabase/migrations/`.

---

### Migration 001 — Enable Extensions

```sql
-- 001_extensions.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
```

---

### Migration 002 — Profiles

```sql
-- 002_profiles.sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('officer','manager','admin')),
  region      TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'officer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

### Migration 003 — Locations

```sql
-- 003_locations.sql
CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  district    TEXT,
  state       TEXT DEFAULT 'Karnataka',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with real data from The/Nudge contact (replace placeholders)
INSERT INTO locations (name, district, is_verified) VALUES
  ('Placeholder Village 1', 'District A', TRUE),
  ('Placeholder Village 2', 'District B', TRUE);
```

---

### Migration 004 — Visits

```sql
-- 004_visits.sql
CREATE TABLE visits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id            UUID NOT NULL REFERENCES profiles(id),
  location_id           UUID NOT NULL REFERENCES locations(id),
  visit_date            DATE NOT NULL CHECK (visit_date <= CURRENT_DATE),
  program_area          TEXT NOT NULL,
  stakeholders          TEXT[],
  text_notes            TEXT,
  voice_memo_path       TEXT,
  transcript            TEXT,
  transcription_status  TEXT DEFAULT 'none'
    CHECK (transcription_status IN ('none','pending','done','failed')),
  debrief_status        TEXT DEFAULT 'pending'
    CHECK (debrief_status IN ('pending','done','failed')),
  debrief_raw           TEXT,
  retry_count           INT DEFAULT 0,
  embedding             VECTOR(1536),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Migration 005 — Debriefs

```sql
-- 005_debriefs.sql
CREATE TABLE debriefs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id            UUID NOT NULL UNIQUE REFERENCES visits(id),
  key_findings        TEXT[] NOT NULL DEFAULT '{}',
  blockers            TEXT[] DEFAULT '{}',
  community_sentiment TEXT CHECK (community_sentiment IN ('Positive','Mixed','Negative')),
  follow_ups          TEXT[] DEFAULT '{}',
  nudge_flag          TEXT CHECK (nudge_flag IN ('Routine','Needs Attention','Escalate')),
  recurring_issues    TEXT[] DEFAULT '{}',
  summary             TEXT NOT NULL,
  officer_note        TEXT,
  generated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Migration 006 — Audit Logs

```sql
-- 006_audit.sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  actor_id    UUID REFERENCES profiles(id),
  visit_id    UUID REFERENCES visits(id),
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Migration 007 — Indexes

```sql
-- 007_indexes.sql
CREATE INDEX visits_location_date_idx ON visits(location_id, visit_date DESC);
CREATE INDEX visits_officer_idx        ON visits(officer_id);
CREATE INDEX visits_pending_idx        ON visits(debrief_status)
  WHERE debrief_status = 'pending';
CREATE INDEX debriefs_nudge_flag_idx   ON debriefs(nudge_flag);
```

---

### Migration 008 — Row Level Security

```sql
-- 008_rls.sql
ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits    ENABLE ROW LEVEL SECURITY;
ALTER TABLE debriefs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own profile; admin sees all
CREATE POLICY profiles_self ON profiles FOR SELECT
  USING (id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Visits: officer sees own; manager sees own region; admin sees all
CREATE POLICY visits_officer_select ON visits FOR SELECT
  USING (
    officer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles o
      JOIN profiles m ON m.id = auth.uid()
      WHERE o.id = visits.officer_id
        AND o.region = m.region
        AND m.role IN ('manager','admin')
    )
    OR EXISTS (SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY visits_officer_insert ON visits FOR INSERT
  WITH CHECK (officer_id = auth.uid());

-- Debriefs follow visit access
CREATE POLICY debriefs_select ON debriefs FOR SELECT
  USING (EXISTS (SELECT 1 FROM visits v WHERE v.id = visit_id));

-- Locations: all authenticated users can read
CREATE POLICY locations_read ON locations FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

---

## RLS Test Matrix

Run these queries while logged in as each role to verify policies before going live.

| Query | Officer A | Officer B (same region) | Manager (region X) | Admin |
|---|---|---|---|---|
| `SELECT * FROM visits WHERE officer_id = officer_a_id` | ✅ Sees own | ❌ Blocked | ✅ Sees (same region) | ✅ Sees all |
| `SELECT * FROM visits WHERE officer_id = officer_b_id` | ❌ Blocked | ✅ Sees own | ✅ Sees (same region) | ✅ Sees all |
| `INSERT INTO visits ...` | ✅ Own officer_id | ✅ Own officer_id | ❌ No insert policy | ✅ Via service role |
| `SELECT * FROM debriefs ...` | ✅ Own visits | ✅ Own visits | ✅ Region visits | ✅ All |

---

## Entity Relationship Summary

```
auth.users (Supabase managed)
    │
    └─── profiles (1:1)
              │
              └─── visits (1:many)
                        │
                        ├─── debriefs (1:1)
                        ├─── audit_logs (1:many)
                        └─── locations (many:1)
```
