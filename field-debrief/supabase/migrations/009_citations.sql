-- 009_citations.sql
-- Adds source_citations to debriefs so each finding/blocker links back
-- to the exact sentence(s) in the transcript or text_notes that produced it.

ALTER TABLE debriefs
  ADD COLUMN IF NOT EXISTS source_citations JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN debriefs.source_citations IS
  'Array of {field, index, sentence_indices[], source} objects.
   field: key_findings|blockers|follow_ups|recurring_issues
   index: position in that field array (0-based)
   sentence_indices: which sentences in the source text support this item
   source: "transcript" | "notes"
   Example: [{"field":"blockers","index":0,"sentence_indices":[2,3],"source":"transcript"}]';
