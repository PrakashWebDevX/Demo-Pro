-- Innovation Challenge & University / Industry Matching (phase 2).
-- Run once in your Supabase SQL editor AFTER 2026-09-25_smart_assignment.sql. Safe to re-run.
-- Demo Data — Replace with Verified Government and Partner Directory in Production.

-- 1) Challenge (public-safe fields only; private data lives in separate staff-only tables)
CREATE TABLE IF NOT EXISTS public.innovation_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_code text NOT NULL UNIQUE,
  source_report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  title text NOT NULL,
  problem_statement text NOT NULL,
  public_summary text,
  category_key text,
  category_label text,
  area_type text CHECK (area_type IN ('urban','rural')),
  district text,
  location text,
  priority text,
  related_report_count int NOT NULL DEFAULT 1,
  ai_reason text,
  department_name text,
  officer_name text,
  solution text,
  target_metric text,
  expected_impact text,
  stage text NOT NULL DEFAULT 'approved' CHECK (stage IN
    ('government_review','approved','partner_matching','research','prototype',
     'field_pilot','evaluation','deployment_approval','scaled_closed')),
  progress_pct int NOT NULL DEFAULT 10 CHECK (progress_pct BETWEEN 0 AND 100),
  is_public boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Linked citizen reports (original + duplicates)
CREATE TABLE IF NOT EXISTS public.innovation_challenge_reports (
  challenge_id uuid NOT NULL REFERENCES public.innovation_challenges(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, report_id)
);

-- 3) Partner shortlist / selection / invitation state (STAFF ONLY — contains scores)
CREATE TABLE IF NOT EXISTS public.innovation_challenge_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.innovation_challenges(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.innovation_partners(id) ON DELETE CASCADE,
  group_key text NOT NULL CHECK (group_key IN ('university','industry','csr')),
  match_score int,
  match_reason text,
  shortlisted boolean NOT NULL DEFAULT false,
  selected_role text CHECK (selected_role IN ('lead_university','tech_partner','csr_partner')),
  invitation_status text NOT NULL DEFAULT 'none'
    CHECK (invitation_status IN ('none','sent','accepted','declined')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, partner_id)
);

-- 4) Private plan (STAFF ONLY — internal note, budget)
CREATE TABLE IF NOT EXISTS public.innovation_challenge_plans (
  challenge_id uuid PRIMARY KEY REFERENCES public.innovation_challenges(id) ON DELETE CASCADE,
  pilot_location text,
  timeline_text text,
  internal_note text,
  budget_note text,
  updated_by_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Timeline (is_public = false rows are staff-only)
CREATE TABLE IF NOT EXISTS public.innovation_challenge_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.innovation_challenges(id) ON DELETE CASCADE,
  stage text,
  title text NOT NULL,
  detail text,
  step_status text NOT NULL DEFAULT 'completed' CHECK (step_status IN ('completed','in_progress','upcoming')),
  is_public boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Access helper: staff, public challenges, or citizens linked through a report they can read.
CREATE OR REPLACE FUNCTION public.can_read_challenge(_challenge_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.innovation_challenges c WHERE c.id = _challenge_id AND c.is_public)
    OR EXISTS (
      SELECT 1 FROM public.innovation_challenge_reports l
      JOIN public.reports r ON r.id = l.report_id
      WHERE l.challenge_id = _challenge_id AND r.citizen_id = auth.uid()
    );
$$;

-- Grants
REVOKE ALL ON public.innovation_challenges, public.innovation_challenge_reports,
  public.innovation_challenge_partners, public.innovation_challenge_plans,
  public.innovation_challenge_timeline FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.innovation_challenges TO authenticated;
GRANT SELECT, INSERT ON public.innovation_challenge_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.innovation_challenge_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.innovation_challenge_plans TO authenticated;
GRANT SELECT, INSERT ON public.innovation_challenge_timeline TO authenticated;
GRANT ALL ON public.innovation_challenges, public.innovation_challenge_reports,
  public.innovation_challenge_partners, public.innovation_challenge_plans,
  public.innovation_challenge_timeline TO service_role;

ALTER TABLE public.innovation_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovation_challenge_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovation_challenge_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovation_challenge_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovation_challenge_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ic read" ON public.innovation_challenges;
CREATE POLICY "ic read" ON public.innovation_challenges FOR SELECT TO authenticated
  USING (public.can_read_challenge(id));
DROP POLICY IF EXISTS "ic staff insert" ON public.innovation_challenges;
CREATE POLICY "ic staff insert" ON public.innovation_challenges FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "ic staff update" ON public.innovation_challenges;
CREATE POLICY "ic staff update" ON public.innovation_challenges FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "icr read" ON public.innovation_challenge_reports;
CREATE POLICY "icr read" ON public.innovation_challenge_reports FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.can_read_report(report_id));
DROP POLICY IF EXISTS "icr staff insert" ON public.innovation_challenge_reports;
CREATE POLICY "icr staff insert" ON public.innovation_challenge_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "icp staff" ON public.innovation_challenge_partners;
CREATE POLICY "icp staff" ON public.innovation_challenge_partners FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "icplan staff" ON public.innovation_challenge_plans;
CREATE POLICY "icplan staff" ON public.innovation_challenge_plans FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "ict read" ON public.innovation_challenge_timeline;
CREATE POLICY "ict read" ON public.innovation_challenge_timeline FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR (is_public AND public.can_read_challenge(challenge_id)));
DROP POLICY IF EXISTS "ict staff insert" ON public.innovation_challenge_timeline;
CREATE POLICY "ict staff insert" ON public.innovation_challenge_timeline FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- Realtime (RLS still applies to realtime payloads)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['innovation_challenges','innovation_challenge_partners','innovation_challenge_timeline'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ---------------- Seed (fictional demo data) ----------------
INSERT INTO public.innovation_partners (partner_kind, name, organization_type, city, expertise_categories, expertise_labels, innovation_domains, available_team_capacity, contact_person_name, contact_email) VALUES
 ('partner','Clean City CSR Foundation','CSR Partner','Central City','{waste}','{Sanitation,Community Outreach,Sensor Procurement}','{Waste overflow,Community engagement}',4,'Demo Contact E','cleancity@demo.org')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.innovation_challenges (challenge_code, title, problem_statement, public_summary, category_key, category_label,
  area_type, district, location, priority, related_report_count, ai_reason, department_name, officer_name, solution,
  target_metric, expected_impact, stage, progress_pct, is_public, is_demo)
VALUES ('IC-CC-0001','Smart Waste Overflow Prediction for Central Market',
  'Waste bins at Central Market overflow repeatedly despite routine collection, causing litter, odour and health risks for traders and shoppers.',
  'Bins at Central Market keep overflowing. A smart-bin sensor and route-optimization pilot is being developed to fix it.',
  'waste','Waste Management','urban','Central City','Central Market','high',18,
  'Repeated high-priority waste-overflow reports in the same area show that routine collection is not enough. A smart-bin sensor and route-optimization pilot is recommended.',
  'Municipal Waste Management Department','Ravi Kumar — Waste Management Officer',
  'Smart bin fill-level sensors and collection-route optimization dashboard.',
  'Reduce waste-overflow reports by 40% within 90 days.',
  'Cleaner market area with fewer overflowing bins and faster collection.',
  'prototype',55,true,true)
ON CONFLICT (challenge_code) DO NOTHING;

INSERT INTO public.innovation_challenge_partners (challenge_id, partner_id, group_key, match_score, match_reason, shortlisted, selected_role, invitation_status)
SELECT c.id, p.id, v.g, v.s, v.r, true, v.role, 'accepted'
FROM (VALUES
 ('Central City Institute of Technology','university',92,'Expertise in IoT, AI, data analytics, and smart-city systems. Located in Central City. Student innovation team and faculty mentor available.','lead_university'),
 ('GreenRoute Technologies','industry',89,'Expertise in smart waste bins, IoT sensors, collection-route optimization, and dashboard development.','tech_partner'),
 ('Clean City CSR Foundation','csr',84,'Sanitation and community-outreach focus. Can support sensor procurement and pilot engagement.','csr_partner')
) AS v(name, g, s, r, role)
JOIN public.innovation_partners p ON p.name = v.name
JOIN public.innovation_challenges c ON c.challenge_code = 'IC-CC-0001'
ON CONFLICT (challenge_id, partner_id) DO NOTHING;

INSERT INTO public.innovation_challenge_plans (challenge_id, pilot_location, timeline_text, internal_note, updated_by_name)
SELECT id, 'Central Market — 12 bins, Ward 4', '90 days (prototype 30 · pilot 45 · evaluation 15)',
  'Demo internal note: coordinate bin access with market association.', 'Ravi Kumar'
FROM public.innovation_challenges WHERE challenge_code = 'IC-CC-0001'
ON CONFLICT (challenge_id) DO NOTHING;

INSERT INTO public.innovation_challenge_timeline (challenge_id, stage, title, step_status, sort_order, created_by_name, created_at)
SELECT c.id, v.stage, v.title, v.st, v.o, 'Demo', now() - (v.days || ' days')::interval
FROM (VALUES
 ('government_review','Government Review','completed',1,40),
 ('approved','Approved for Innovation','completed',2,36),
 ('partner_matching','Partner Matching','completed',3,32),
 ('partner_matching','University Selected — Central City Institute of Technology','completed',4,30),
 ('partner_matching','Startup Selected — GreenRoute Technologies','completed',5,29),
 ('research','Research','completed',6,20),
 ('prototype','Prototype Development','in_progress',7,6),
 ('field_pilot','Field Pilot','upcoming',8,0)
) AS v(stage, title, st, o, days)
CROSS JOIN public.innovation_challenges c
WHERE c.challenge_code = 'IC-CC-0001'
  AND NOT EXISTS (SELECT 1 FROM public.innovation_challenge_timeline t WHERE t.challenge_id = c.id);
