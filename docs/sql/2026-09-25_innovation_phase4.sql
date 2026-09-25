-- Phase 4: partner accounts linked to innovation challenges + acceptance-test demo scenarios.
-- Run once in your Supabase SQL editor AFTER 2026-09-25_innovation_phase3.sql. Safe to re-run.
-- Demo Data — Replace with Verified Government and Partner Directory in Production.

-- 1) Link a partner directory record to a login account (demo accounts)
ALTER TABLE public.innovation_partners ADD COLUMN IF NOT EXISTS account_email text;

GRANT SELECT (account_email) ON public.innovation_partners TO authenticated;

UPDATE public.innovation_partners SET account_email = 'university@demo.jh'
  WHERE name = 'Central City Institute of Technology' AND account_email IS NULL;
UPDATE public.innovation_partners SET account_email = 'industry@demo.jh'
  WHERE name = 'GreenRoute Technologies' AND account_email IS NULL;

-- 2) Helper: does the current user own this partner record?
CREATE OR REPLACE FUNCTION public.is_my_partner(_partner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.innovation_partners p
    JOIN auth.users u ON lower(u.email) = lower(p.account_email)
    WHERE p.id = _partner_id AND u.id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_my_partner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_partner(uuid) TO authenticated;

-- 3) Challenges a partner is matched to become readable by that partner
CREATE OR REPLACE FUNCTION public.can_read_challenge(_challenge_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.innovation_challenges c WHERE c.id = _challenge_id AND c.is_public)
    OR EXISTS (
      SELECT 1 FROM public.innovation_challenge_reports l
      JOIN public.reports r ON r.id = l.report_id
      WHERE l.challenge_id = _challenge_id AND r.citizen_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.innovation_challenge_partners cp
      JOIN public.innovation_partners p ON p.id = cp.partner_id
      JOIN auth.users u ON lower(u.email) = lower(p.account_email)
      WHERE cp.challenge_id = _challenge_id AND u.id = auth.uid()
        AND cp.invitation_status IN ('sent','accepted')
    );
$$;

-- 4) Partner can read (and only respond to) its own invitation rows
DROP POLICY IF EXISTS "icp partner read" ON public.innovation_challenge_partners;
CREATE POLICY "icp partner read" ON public.innovation_challenge_partners FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_my_partner(partner_id));

-- 5) Invitation response happens through a controlled function (keeps stage + timeline consistent)
CREATE OR REPLACE FUNCTION public.partner_respond_invitation(_row_id uuid, _accepted boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.innovation_challenge_partners%ROWTYPE;
  c public.innovation_challenges%ROWTYPE;
  pname text;
  rolelabel text;
  nextsort int;
BEGIN
  SELECT * INTO r FROM public.innovation_challenge_partners WHERE id = _row_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF NOT public.is_my_partner(r.partner_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF r.invitation_status <> 'sent' THEN RAISE EXCEPTION 'No pending invitation'; END IF;

  SELECT * INTO c FROM public.innovation_challenges WHERE id = r.challenge_id;
  SELECT name INTO pname FROM public.innovation_partners WHERE id = r.partner_id;
  rolelabel := COALESCE(CASE r.selected_role
    WHEN 'lead_university' THEN 'Lead University'
    WHEN 'tech_partner' THEN 'Technical Startup / Industry Partner'
    WHEN 'csr_partner' THEN 'CSR / Funding Partner' END, 'Partner');

  UPDATE public.innovation_challenge_partners
     SET invitation_status = CASE WHEN _accepted THEN 'accepted' ELSE 'declined' END,
         updated_at = now()
   WHERE id = _row_id;

  SELECT COALESCE(max(sort_order), 0) + 1 INTO nextsort
    FROM public.innovation_challenge_timeline WHERE challenge_id = c.id;

  INSERT INTO public.innovation_challenge_timeline
    (challenge_id, stage, title, detail, step_status, is_public, sort_order, created_by_name)
  VALUES (c.id, c.stage,
    CASE WHEN _accepted THEN rolelabel || ' joined the project team'
         ELSE rolelabel || ' declined the invitation' END,
    COALESCE(NULLIF(_note, ''), pname), 'completed', _accepted, nextsort, pname);

  IF _accepted THEN
    IF c.stage = 'partner_matching' THEN
      UPDATE public.innovation_challenges SET stage = 'research', progress_pct = 38, updated_at = now() WHERE id = c.id;
    END IF;
  ELSE
    UPDATE public.innovation_challenges SET stage = 'partner_matching', progress_pct = 22, updated_at = now() WHERE id = c.id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.partner_respond_invitation(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_respond_invitation(uuid, boolean, text) TO authenticated;

-- ---------------- Acceptance-test demo scenarios (fictional) ----------------
-- Scenario A: urban pothole  ->  Roads department / Priya Nair
INSERT INTO public.reports (public_issue_id, demo_owner_email, reporter_name, title, description,
  category_key, district, municipality, village_or_ward, area_type, priority, status)
VALUES ('JH-DEMO-A001', 'citizen@demo.jh', 'Demo Citizen',
  'Large pothole near Central Bus Stand',
  'A large pothole has formed on the main road near Central Bus Stand. Two-wheelers are skidding and it worsens after rain.',
  'road_damage', 'Central City', 'Central City Municipal Corporation', 'Ward 7', 'urban', 'high', 'submitted')
ON CONFLICT (public_issue_id) DO NOTHING;

-- Scenario B: rural handpump  ->  Rural Water and Sanitation / Mohan Lal
INSERT INTO public.reports (public_issue_id, demo_owner_email, reporter_name, title, description,
  category_key, district, block, village_or_ward, area_type, priority, status)
VALUES ('JH-DEMO-B001', 'citizen@demo.jh', 'Demo Citizen',
  'Handpump not working in Greenfield village',
  'The village handpump has stopped working. Families are walking more than a kilometre for drinking water.',
  'water', 'Greenfield', 'Greenfield Block', 'Greenfield Village', 'rural', 'high', 'submitted')
ON CONFLICT (public_issue_id) DO NOTHING;

-- Attach the seeded reports to the demo citizen account when it exists
UPDATE public.reports r SET citizen_id = u.id
FROM auth.users u
WHERE lower(u.email) = 'citizen@demo.jh'
  AND r.public_issue_id IN ('JH-DEMO-A001','JH-DEMO-B001')
  AND r.citizen_id IS NULL;

-- Persisted AI recommendation for scenario A
INSERT INTO public.report_assignments (report_id, suggested_resolution_type, suggested_priority, area_type,
  suggested_department_id, suggested_officer_id, reasoning, confidence, related_count, suggested_location)
SELECT r.id, 'standard', 'high', 'urban', d.id, o.id,
  'Road damage in an urban ward of Central City. Municipal Roads and Public Works Department handles potholes and road repair; Priya Nair (Executive Engineer) covers this category and has capacity.',
  88, 1, 'Ward 7, Central City'
FROM public.reports r
JOIN public.gov_departments d ON d.department_name = 'Municipal Roads and Public Works Department'
JOIN public.gov_officers o ON o.full_name = 'Priya Nair'
WHERE r.public_issue_id = 'JH-DEMO-A001'
ON CONFLICT (report_id) DO NOTHING;

-- Persisted AI recommendation for scenario B
INSERT INTO public.report_assignments (report_id, suggested_resolution_type, suggested_priority, area_type,
  suggested_department_id, suggested_officer_id, reasoning, confidence, related_count, suggested_location)
SELECT r.id, 'standard', 'high', 'rural', d.id, o.id,
  'Drinking-water failure in a rural village of Greenfield. Rural Water and Sanitation Department handles handpumps and drinking water; Mohan Lal (Rural Water Officer) covers this rural category.',
  90, 1, 'Greenfield Village, Greenfield'
FROM public.reports r
JOIN public.gov_departments d ON d.department_name = 'Rural Water and Sanitation Department'
JOIN public.gov_officers o ON o.full_name = 'Mohan Lal'
WHERE r.public_issue_id = 'JH-DEMO-B001'
ON CONFLICT (report_id) DO NOTHING;
