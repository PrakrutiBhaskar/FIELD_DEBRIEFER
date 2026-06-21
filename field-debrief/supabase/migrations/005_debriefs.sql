-- Migration 005: Debriefs table
CREATE TABLE IF NOT EXISTS debriefs (
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
