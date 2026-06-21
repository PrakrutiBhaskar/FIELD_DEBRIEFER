-- Migration 004: Visits table
CREATE TABLE IF NOT EXISTS visits (
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
  duration_mins         INTEGER,
  embedding             VECTOR(1536),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
