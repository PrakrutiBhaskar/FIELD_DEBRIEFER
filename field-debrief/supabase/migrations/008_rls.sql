-- Migration 008: Row Level Security

ALTER TABLE profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE debriefs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to avoid infinite recursion
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles policies
DROP POLICY IF EXISTS profiles_self ON profiles;
CREATE POLICY profiles_self ON profiles FOR SELECT
  USING (id = auth.uid() OR get_my_role() = 'admin');

DROP POLICY IF EXISTS profiles_admin_update ON profiles;
CREATE POLICY profiles_admin_update ON profiles FOR UPDATE
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- Visits policies
DROP POLICY IF EXISTS visits_officer_select ON visits;
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
    OR get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS visits_officer_insert ON visits;
CREATE POLICY visits_officer_insert ON visits FOR INSERT
  WITH CHECK (officer_id = auth.uid());

DROP POLICY IF EXISTS visits_officer_update ON visits;
CREATE POLICY visits_officer_update ON visits FOR UPDATE
  USING (officer_id = auth.uid())
  WITH CHECK (officer_id = auth.uid());

DROP POLICY IF EXISTS visits_no_delete ON visits;
CREATE POLICY visits_no_delete ON visits FOR DELETE
  USING (get_my_role() = 'admin');

-- Debriefs policies
DROP POLICY IF EXISTS debriefs_select ON debriefs;
CREATE POLICY debriefs_select ON debriefs FOR SELECT
  USING (EXISTS (SELECT 1 FROM visits v WHERE v.id = visit_id));

DROP POLICY IF EXISTS debriefs_insert_service_only ON debriefs;
CREATE POLICY debriefs_insert_service_only ON debriefs FOR INSERT
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS debriefs_update_officer_note ON debriefs;
CREATE POLICY debriefs_update_officer_note ON debriefs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM visits v WHERE v.id = visit_id AND v.officer_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM visits v WHERE v.id = visit_id AND v.officer_id = auth.uid()
  ));

DROP POLICY IF EXISTS debriefs_no_delete ON debriefs;
CREATE POLICY debriefs_no_delete ON debriefs FOR DELETE
  USING (FALSE);

-- Locations policies
DROP POLICY IF EXISTS locations_read ON locations;
CREATE POLICY locations_read ON locations FOR SELECT
  USING (
    is_verified = true
    OR get_my_role() IN ('manager', 'admin')
  );

-- Audit logs policies
DROP POLICY IF EXISTS audit_logs_admin_only ON audit_logs;
CREATE POLICY audit_logs_admin_only ON audit_logs FOR SELECT
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE POLICY audit_logs_no_delete ON audit_logs FOR DELETE
  USING (FALSE);
