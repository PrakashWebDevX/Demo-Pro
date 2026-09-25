-- Master Problem Classification. Run once in Supabase SQL editor. Safe to re-run.
-- Reuses public.report_assignments (AI recommendation already stored there as
-- suggested_resolution_type: 'standard' = Simple Issue, 'innovation' = Innovation Problem).
-- Adds only the officer's final classification + audit fields. Existing RLS applies.

ALTER TABLE public.report_assignments
  ADD COLUMN IF NOT EXISTS classification_status text NOT NULL DEFAULT 'pending_review'
    CHECK (classification_status IN ('pending_review','approved','changed','rejected')),
  ADD COLUMN IF NOT EXISTS classification_final_type text
    CHECK (classification_final_type IN ('standard','innovation')),
  ADD COLUMN IF NOT EXISTS classification_change_reason text,
  ADD COLUMN IF NOT EXISTS classification_note text,          -- internal, staff only
  ADD COLUMN IF NOT EXISTS classified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS classified_by_name text,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Demo case C: aggregated related-report count for Central Market.
UPDATE public.report_assignments ra
   SET related_count = GREATEST(ra.related_count, 18)
  FROM public.reports r
 WHERE r.id = ra.report_id
   AND ra.suggested_resolution_type = 'innovation'
   AND r.category_key = 'waste'
   AND r.district = 'Central City';

-- Realtime: citizen tracking already subscribes per report (filtered by report_id).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.report_assignments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
