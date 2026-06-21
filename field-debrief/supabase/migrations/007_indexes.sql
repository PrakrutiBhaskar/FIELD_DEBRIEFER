-- Migration 007: Indexes
CREATE INDEX IF NOT EXISTS visits_location_date_idx ON visits(location_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS visits_officer_idx        ON visits(officer_id);
CREATE INDEX IF NOT EXISTS visits_pending_idx        ON visits(debrief_status) WHERE debrief_status = 'pending';
CREATE INDEX IF NOT EXISTS visits_created_at_idx     ON visits(created_at DESC);
CREATE INDEX IF NOT EXISTS debriefs_nudge_flag_idx   ON debriefs(nudge_flag);
CREATE INDEX IF NOT EXISTS profiles_role_idx         ON profiles(role);
