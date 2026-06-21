-- Migration 006: Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  actor_id    UUID REFERENCES profiles(id),
  visit_id    UUID REFERENCES visits(id),
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
