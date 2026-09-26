ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS client_submission_id uuid,
  ADD COLUMN IF NOT EXISTS location_accuracy_meters double precision,
  ADD COLUMN IF NOT EXISTS location_captured_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS reports_citizen_client_submission_idx
  ON public.reports (citizen_id, client_submission_id)
  WHERE client_submission_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.reports
    WHERE location_accuracy_meters IS NOT NULL
      AND location_accuracy_meters < 0
  ) THEN
    RAISE EXCEPTION 'Cannot add reports_location_accuracy_nonnegative: existing negative location accuracy values found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_location_accuracy_nonnegative'
      AND conrelid = 'public.reports'::regclass
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_location_accuracy_nonnegative
      CHECK (location_accuracy_meters IS NULL OR location_accuracy_meters >= 0);
  END IF;
END $$;
