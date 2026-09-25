-- Phase 3: citizen pilot feedback + impact measurement.
-- Run once in your Supabase SQL editor AFTER 2026-09-25_innovation_phase2.sql. Safe to re-run.

-- 1) Impact measurement columns (public-safe aggregate numbers)
ALTER TABLE public.innovation_challenges
  ADD COLUMN IF NOT EXISTS baseline_reports int,          -- related reports before the pilot
  ADD COLUMN IF NOT EXISTS current_reports int,           -- related reports in the latest period
  ADD COLUMN IF NOT EXISTS target_reduction_pct int,      -- e.g. 40
  ADD COLUMN IF NOT EXISTS measurement_period text,       -- e.g. "Last 30 days of pilot"
  ADD COLUMN IF NOT EXISTS impact_measured_at timestamptz;

-- 2) Citizen feedback on a challenge (after field pilot)
CREATE TABLE IF NOT EXISTS public.innovation_challenge_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.innovation_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (char_length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

REVOKE ALL ON public.innovation_challenge_feedback FROM anon, authenticated;
GRANT SELECT, INSERT ON public.innovation_challenge_feedback TO authenticated;
GRANT ALL ON public.innovation_challenge_feedback TO service_role;
ALTER TABLE public.innovation_challenge_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "icf read" ON public.innovation_challenge_feedback;
CREATE POLICY "icf read" ON public.innovation_challenge_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "icf insert" ON public.innovation_challenge_feedback;
CREATE POLICY "icf insert" ON public.innovation_challenge_feedback FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_read_challenge(challenge_id)
    AND EXISTS (SELECT 1 FROM public.innovation_challenges c WHERE c.id = challenge_id
                AND c.stage IN ('field_pilot','evaluation','deployment_approval','scaled_closed'))
  );

-- Public-safe average rating (no individual comments exposed to citizens)
CREATE OR REPLACE FUNCTION public.challenge_feedback_summary(_challenge_id uuid)
RETURNS TABLE (responses int, avg_rating numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int, round(avg(rating)::numeric, 1)
  FROM public.innovation_challenge_feedback
  WHERE challenge_id = _challenge_id AND public.can_read_challenge(_challenge_id);
$$;
REVOKE ALL ON FUNCTION public.challenge_feedback_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_feedback_summary(uuid) TO authenticated;

-- 3) Seed impact numbers for the Central Market demo (fictional)
UPDATE public.innovation_challenges
SET baseline_reports = COALESCE(baseline_reports, 18),
    current_reports = COALESCE(current_reports, 13),
    target_reduction_pct = COALESCE(target_reduction_pct, 40),
    measurement_period = COALESCE(measurement_period, 'Early prototype readings (demo)'),
    impact_measured_at = COALESCE(impact_measured_at, now())
WHERE challenge_code = 'IC-CC-0001';
