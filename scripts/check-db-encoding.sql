-- Read-only encoding audit for the Neon database.
--
-- Scans every text/varchar column in every base table in the `public`
-- schema for the Unicode replacement character (U+FFFD), which is the
-- signature of corrupted/mojibake text (e.g. Arabic strings mangled by a
-- bad encoding conversion) — the same symptom fixed in the app's source
-- text (see scripts/check-encoding.sh).
--
-- This does NOT modify any data. Results are written to a session-local
-- temp table (discarded when the connection closes) purely so the scan
-- can report a single result set instead of one NOTICE per column.
--
-- Run it with psql or in the Neon SQL editor:
--   psql "$DATABASE_URL" -f scripts/check-db-encoding.sql

DO $$
DECLARE
  r RECORD;
  cnt BIGINT;
BEGIN
  DROP TABLE IF EXISTS _encoding_audit_result;
  CREATE TEMP TABLE _encoding_audit_result (
    table_name text,
    column_name text,
    bad_row_count bigint
  );

  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying')
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I WHERE %I LIKE %L',
      r.table_name, r.column_name, '%' || chr(65533) || '%'
    ) INTO cnt;

    IF cnt > 0 THEN
      INSERT INTO _encoding_audit_result VALUES (r.table_name, r.column_name, cnt);
    END IF;
  END LOOP;
END $$;

-- Summary: which columns have corrupted rows, and how many.
SELECT * FROM _encoding_audit_result ORDER BY bad_row_count DESC;

-- Optional follow-up once you know which table/column is affected, to see
-- the actual corrupted rows (adjust table/column names accordingly):
--   SELECT id, place, description
--   FROM violation
--   WHERE place LIKE '%' || chr(65533) || '%'
--      OR description LIKE '%' || chr(65533) || '%';
--
--   SELECT id, title, trainer
--   FROM training
--   WHERE title LIKE '%' || chr(65533) || '%'
--      OR trainer LIKE '%' || chr(65533) || '%';
