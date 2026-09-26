-- PROPOSED ONLY: review and run manually if the connected database still rejects 'critical'.
-- Existing low, medium, and high values are preserved.

DO $$
DECLARE
  priority_constraint text;
BEGIN
  SELECT conname INTO priority_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.reports'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%priority%'
    AND pg_get_constraintdef(oid) ILIKE '%low%'
    AND pg_get_constraintdef(oid) ILIKE '%medium%'
    AND pg_get_constraintdef(oid) ILIKE '%high%'
  LIMIT 1;

  IF priority_constraint IS NULL THEN
    RAISE NOTICE 'No matching reports priority constraint found; verify the connected schema before changing it.';
  ELSE
    EXECUTE format('ALTER TABLE public.reports DROP CONSTRAINT %I', priority_constraint);
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_priority_check
      CHECK (priority IN ('low', 'medium', 'high', 'critical'));
  END IF;
END $$;
