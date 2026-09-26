-- PROPOSED DEMO DATA ONLY.
-- Run manually in Supabase SQL Editor after the innovation phase 2/3/4 SQL is installed.
-- No real people, institutions, formal partnerships, credentials, or private production data are used.

BEGIN;

CREATE TABLE IF NOT EXISTS public.innovation_challenge_team_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.innovation_challenges(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES public.innovation_partners(id) ON DELETE SET NULL,
  role_key text NOT NULL CHECK (role_key IN ('government_owner','faculty_mentor','student_team','technology_partner','csr_partner')),
  role_label text NOT NULL,
  display_name text NOT NULL,
  organization_name text,
  member_count integer CHECK (member_count IS NULL OR member_count >= 0),
  status text NOT NULL CHECK (status IN ('Potential Partner','Invited','Accepted','Active Team','Declined')),
  demo_disclaimer text NOT NULL DEFAULT 'Demo Data — Verification and institutional consent required before production use.',
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, role_key)
);

CREATE TABLE IF NOT EXISTS public.innovation_challenge_partner_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.innovation_challenges(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.innovation_partners(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('Potential Partner','Invited','Accepted','Active Team','Declined')),
  note text,
  demo_disclaimer text NOT NULL DEFAULT 'Demo Data — Verification and institutional consent required before production use.',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, partner_id, status)
);

CREATE UNIQUE INDEX IF NOT EXISTS innovation_challenge_timeline_demo_unique
  ON public.innovation_challenge_timeline (challenge_id, stage, title);

REVOKE ALL ON public.innovation_challenge_team_roles, public.innovation_challenge_partner_status_history FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.innovation_challenge_team_roles, public.innovation_challenge_partner_status_history TO authenticated;
GRANT ALL ON public.innovation_challenge_team_roles, public.innovation_challenge_partner_status_history TO service_role;

ALTER TABLE public.innovation_challenge_team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovation_challenge_partner_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ecosystem team staff" ON public.innovation_challenge_team_roles;
CREATE POLICY "ecosystem team staff" ON public.innovation_challenge_team_roles
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "ecosystem status staff" ON public.innovation_challenge_partner_status_history;
CREATE POLICY "ecosystem status staff" ON public.innovation_challenge_partner_status_history
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Existing partner rows are reused. Contact values below are fictional demo labels only.
INSERT INTO public.innovation_partners
  (partner_kind, name, organization_type, city, state, expertise_categories, expertise_labels, innovation_domains,
   available_team_capacity, current_workload, active_status, contact_person_name, contact_email, demo_note)
VALUES
  ('university', 'Central City Institute of Technology', 'University', 'Central City', 'Demo State', '{waste,streetlight}', '{IoT,Data Analytics,Energy Systems}', '{Waste prediction,Streetlight monitoring,Urban systems}', 5, 0, true, 'Fictional Demo Faculty Liaison', 'faculty-liaison@demo.invalid', 'Demo Data — Verification and institutional consent required before production use.'),
  ('university', 'Regional Engineering College', 'University', 'Greenfield', 'Demo State', '{water}', '{Water Systems,Civil Engineering,Field Research}', '{Handpump monitoring,Rural water reliability}', 4, 0, true, 'Fictional Demo Faculty Liaison', 'water-liaison@demo.invalid', 'Demo Data — Verification and institutional consent required before production use.'),
  ('university', 'Digital Innovation University', 'University', 'Central City', 'Demo State', '{safety}', '{GIS,Human-centred Design,Data Analytics}', '{Road safety,Near-miss analytics,Public mobility}', 6, 0, true, 'Fictional Demo Faculty Liaison', 'safety-liaison@demo.invalid', 'Demo Data — Verification and institutional consent required before production use.'),
  ('partner', 'GreenRoute Technologies', 'Startup', 'Central City', 'Demo State', '{waste}', '{IoT Sensors,Route Optimization,Data Platforms}', '{Waste overflow prediction,Collection optimization}', 4, 0, true, 'Fictional Demo Partner Contact', 'greenroute-contact@demo.invalid', 'Demo Data — Verification and institutional consent required before production use.'),
  ('partner', 'AquaSense Solutions', 'Startup', 'Greenfield', 'Demo State', '{water}', '{Sensors,Water Quality,Field Monitoring}', '{Handpump monitoring,Water reliability}', 3, 0, true, 'Fictional Demo Partner Contact', 'aquasense-contact@demo.invalid', 'Demo Data — Verification and institutional consent required before production use.'),
  ('partner', 'SafeStreet Mobility Labs', 'Industry Partner', 'Central City', 'Demo State', '{safety}', '{Traffic Analytics,GIS,Transport Safety}', '{Junction safety,Near-miss reduction}', 4, 0, true, 'Fictional Demo Partner Contact', 'safestreet-contact@demo.invalid', 'Demo Data — Verification and institutional consent required before production use.'),
  ('partner', 'LuminaGrid Systems', 'Industry Partner', 'Central City', 'Demo State', '{streetlight}', '{Fault Detection,Energy Monitoring,IoT}', '{Streetlight maintenance,Energy saving}', 4, 0, true, 'Fictional Demo Partner Contact', 'luminagrid-contact@demo.invalid', 'Demo Data — Verification and institutional consent required before production use.'),
  ('partner', 'CleanCity Community Foundation', 'CSR Partner', 'Central City', 'Demo State', '{waste,safety,streetlight}', '{Community Programs,Urban Services,Impact Measurement}', '{Clean markets,Safe mobility,Energy saving}', 3, 0, true, 'Fictional Demo CSR Contact', 'cleancity-contact@demo.invalid', 'Demo Data — Verification and institutional consent required before production use.'),
  ('partner', 'RuralConnect Foundation', 'CSR Partner', 'Greenfield', 'Demo State', '{water}', '{Rural Services,Community Outreach,Impact Measurement}', '{Water access,Rural resilience}', 3, 0, true, 'Fictional Demo CSR Contact', 'ruralconnect-contact@demo.invalid', 'Demo Data — Verification and institutional consent required before production use.'),
  ('partner', 'City Mobility CSR Forum', 'CSR Partner', 'Central City', 'Demo State', '{safety}', '{Road Safety,Community Outreach,Impact Measurement}', '{Safe junctions,Public mobility}', 3, 0, true, 'Fictional Demo CSR Contact', 'citymobility-contact@demo.invalid', 'Demo Data — Verification and institutional consent required before production use.'),
  ('partner', 'Bright Communities CSR Initiative', 'CSR Partner', 'Central City', 'Demo State', '{streetlight}', '{Energy Access,Community Programs,Impact Measurement}', '{Streetlight reliability,Energy saving}', 3, 0, true, 'Fictional Demo CSR Contact', 'brightcommunities-contact@demo.invalid', 'Demo Data — Verification and institutional consent required before production use.')
ON CONFLICT (name) DO UPDATE SET
  demo_note = EXCLUDED.demo_note,
  contact_person_name = EXCLUDED.contact_person_name,
  contact_email = EXCLUDED.contact_email;

-- Fictional source and related reports. They contain no citizen identity or precise private location.
INSERT INTO public.reports
  (public_issue_id, demo_owner_email, reporter_name, title, description, category_key, district, area_type, priority, status, is_innovation)
VALUES
  ('JH-ECO-DEMO-WASTE-001', 'ecosystem-demo@demo.invalid', 'Demo Ecosystem Record', 'Overflowing bins at Central Market', 'Demo Data — Verification and institutional consent required before production use. Repeated market-bin overflow is used only to illustrate the Smart Waste Overflow Prediction challenge.', 'waste', 'Central City', 'urban', 'high', 'submitted', true),
  ('JH-ECO-DEMO-WASTE-002', 'ecosystem-demo@demo.invalid', 'Demo Ecosystem Record', 'Waste collection route delay at Central Market', 'Demo Data — Verification and institutional consent required before production use.', 'waste', 'Central City', 'urban', 'medium', 'submitted', true),
  ('JH-ECO-DEMO-WATER-001', 'ecosystem-demo@demo.invalid', 'Demo Ecosystem Record', 'Handpump reliability in Greenfield village', 'Demo Data — Verification and institutional consent required before production use. This fictional record illustrates rural water monitoring.', 'water', 'Greenfield', 'rural', 'high', 'submitted', true),
  ('JH-ECO-DEMO-WATER-002', 'ecosystem-demo@demo.invalid', 'Demo Ecosystem Record', 'Delayed rural handpump repair', 'Demo Data — Verification and institutional consent required before production use.', 'water', 'Greenfield', 'rural', 'medium', 'submitted', true),
  ('JH-ECO-DEMO-ROAD-001', 'ecosystem-demo@demo.invalid', 'Demo Ecosystem Record', 'Near-miss incidents at Central Bus Stand Junction', 'Demo Data — Verification and institutional consent required before production use. This fictional record illustrates road-safety analytics.', 'safety', 'Central City', 'urban', 'high', 'submitted', true),
  ('JH-ECO-DEMO-ROAD-002', 'ecosystem-demo@demo.invalid', 'Demo Ecosystem Record', 'Unsafe crossing pattern at Central Bus Stand Junction', 'Demo Data — Verification and institutional consent required before production use.', 'safety', 'Central City', 'urban', 'medium', 'submitted', true),
  ('JH-ECO-DEMO-LIGHT-001', 'ecosystem-demo@demo.invalid', 'Demo Ecosystem Record', 'Repeated streetlight faults in Central City wards', 'Demo Data — Verification and institutional consent required before production use. This fictional record illustrates fault detection and energy saving.', 'streetlight', 'Central City', 'urban', 'high', 'submitted', true),
  ('JH-ECO-DEMO-LIGHT-002', 'ecosystem-demo@demo.invalid', 'Demo Ecosystem Record', 'Delayed streetlight fault resolution', 'Demo Data — Verification and institutional consent required before production use.', 'streetlight', 'Central City', 'urban', 'medium', 'submitted', true)
ON CONFLICT (public_issue_id) DO NOTHING;

-- Challenges are public-safe summaries only; staff-only records are stored separately below.
INSERT INTO public.innovation_challenges
  (challenge_code, title, problem_statement, public_summary, category_key, category_label, area_type, district, location,
   priority, related_report_count, department_name, officer_name, solution, target_metric, expected_impact, stage, progress_pct, is_public, is_demo)
VALUES
  ('IC-ECO-DEMO-WASTE', 'Smart Waste Overflow Prediction for Central Market', 'Fictional recurring overflow at Central Market is being studied for a predictive collection workflow.', 'Demo Data — Verification and institutional consent required before production use. A fictional smart-bin and route-planning challenge for Central Market.', 'waste', 'Waste Management', 'urban', 'Central City', 'Central Market', 'high', 2, 'Municipal Waste Management Department', 'Ravi Kumar', 'Fictional fill-level sensing and collection-route planning.', 'Reduce overflow reports by 40% in 90 days', 'Fictional measurable reduction in overflow reports.', 'prototype', 55, true, true),
  ('IC-ECO-DEMO-WATER', 'Rural Water Reliability and Handpump Monitoring', 'Fictional rural handpump interruptions are being studied for earlier detection and repair routing.', 'Demo Data — Verification and institutional consent required before production use. A fictional rural water reliability challenge for Greenfield.', 'water', 'Water Supply', 'rural', 'Greenfield', 'Greenfield villages', 'high', 2, 'Rural Water and Sanitation Department', 'Mohan Lal', 'Fictional low-connectivity handpump monitoring and response workflow.', 'Reduce repair response time by 30% in 120 days', 'Fictional improvement in repair response time.', 'research', 38, true, true),
  ('IC-ECO-DEMO-ROAD', 'Smart Road Safety for Central Bus Stand Junction', 'Fictional near-miss patterns at a busy junction are being studied for safer movement and decision support.', 'Demo Data — Verification and institutional consent required before production use. A fictional road-safety challenge for Central Bus Stand Junction.', 'safety', 'Public Safety', 'urban', 'Central City', 'Central Bus Stand Junction', 'high', 2, 'Urban Public Safety and Traffic Department', 'Arjun Singh', 'Fictional near-miss mapping and junction-risk analysis.', 'Reduce reported near-miss incidents by 25%', 'Fictional reduction in reported near-miss incidents.', 'partner_matching', 22, true, true),
  ('IC-ECO-DEMO-LIGHT', 'Smart Streetlight Fault Detection and Energy Saving', 'Fictional repeated streetlight faults are being studied for earlier detection and lower energy waste.', 'Demo Data — Verification and institutional consent required before production use. A fictional streetlight reliability challenge for Central City wards.', 'streetlight', 'Streetlight', 'urban', 'Central City', 'Central City wards', 'high', 2, 'Streetlight and Electrical Maintenance Department', 'Meera Iyer', 'Fictional fault detection and energy-monitoring workflow.', 'Reduce fault-resolution time by 35% in 90 days', 'Fictional improvement in fault-resolution time and energy use.', 'field_pilot', 70, true, true)
ON CONFLICT (challenge_code) DO UPDATE SET
  title = EXCLUDED.title,
  public_summary = EXCLUDED.public_summary,
  target_metric = EXCLUDED.target_metric,
  stage = EXCLUDED.stage,
  progress_pct = EXCLUDED.progress_pct,
  is_public = EXCLUDED.is_public,
  is_demo = EXCLUDED.is_demo;

-- Link the fictional source and related report rows.
INSERT INTO public.innovation_challenge_reports (challenge_id, report_id)
SELECT c.id, r.id
FROM public.innovation_challenges c
JOIN public.reports r ON r.public_issue_id IN (
  CASE c.challenge_code WHEN 'IC-ECO-DEMO-WASTE' THEN 'JH-ECO-DEMO-WASTE-001' WHEN 'IC-ECO-DEMO-WATER' THEN 'JH-ECO-DEMO-WATER-001' WHEN 'IC-ECO-DEMO-ROAD' THEN 'JH-ECO-DEMO-ROAD-001' WHEN 'IC-ECO-DEMO-LIGHT' THEN 'JH-ECO-DEMO-LIGHT-001' END,
  CASE c.challenge_code WHEN 'IC-ECO-DEMO-WASTE' THEN 'JH-ECO-DEMO-WASTE-002' WHEN 'IC-ECO-DEMO-WATER' THEN 'JH-ECO-DEMO-WATER-002' WHEN 'IC-ECO-DEMO-ROAD' THEN 'JH-ECO-DEMO-ROAD-002' WHEN 'IC-ECO-DEMO-LIGHT' THEN 'JH-ECO-DEMO-LIGHT-002' END
)
WHERE c.challenge_code IN ('IC-ECO-DEMO-WASTE','IC-ECO-DEMO-WATER','IC-ECO-DEMO-ROAD','IC-ECO-DEMO-LIGHT')
ON CONFLICT DO NOTHING;

-- Existing matching rows reuse the current invitation_status values; detailed badges/history are staff-only below.
INSERT INTO public.innovation_challenge_partners (challenge_id, partner_id, group_key, match_score, match_reason, shortlisted, selected_role, invitation_status)
SELECT c.id, p.id, x.group_key, x.match_score, 'Demo Data — Verification and institutional consent required before production use. Fictional match rationale.', true, x.selected_role, x.invitation_status
FROM (VALUES
  ('IC-ECO-DEMO-WASTE','Central City Institute of Technology','university',88,'lead_university','accepted'),
  ('IC-ECO-DEMO-WASTE','GreenRoute Technologies','industry',92,'tech_partner','accepted'),
  ('IC-ECO-DEMO-WASTE','CleanCity Community Foundation','csr',78,'csr_partner','sent'),
  ('IC-ECO-DEMO-WATER','Regional Engineering College','university',90,'lead_university','accepted'),
  ('IC-ECO-DEMO-WATER','AquaSense Solutions','industry',86,'tech_partner','sent'),
  ('IC-ECO-DEMO-WATER','RuralConnect Foundation','csr',80,'csr_partner','none'),
  ('IC-ECO-DEMO-ROAD','Digital Innovation University','university',89,'lead_university','sent'),
  ('IC-ECO-DEMO-ROAD','SafeStreet Mobility Labs','industry',91,'tech_partner','none'),
  ('IC-ECO-DEMO-ROAD','City Mobility CSR Forum','csr',76,'csr_partner','none'),
  ('IC-ECO-DEMO-LIGHT','Central City Institute of Technology','university',87,'lead_university','accepted'),
  ('IC-ECO-DEMO-LIGHT','LuminaGrid Systems','industry',94,'tech_partner','accepted'),
  ('IC-ECO-DEMO-LIGHT','Bright Communities CSR Initiative','csr',82,'csr_partner','accepted')
) AS x(challenge_code, partner_name, group_key, match_score, selected_role, invitation_status)
JOIN public.innovation_challenges c ON c.challenge_code = x.challenge_code
JOIN public.innovation_partners p ON p.name = x.partner_name
ON CONFLICT (challenge_id, partner_id) DO UPDATE SET
  match_score = EXCLUDED.match_score,
  match_reason = EXCLUDED.match_reason,
  shortlisted = EXCLUDED.shortlisted,
  selected_role = EXCLUDED.selected_role,
  invitation_status = EXCLUDED.invitation_status;

-- Team role cards are staff-only and contain no real personal data.
INSERT INTO public.innovation_challenge_team_roles
  (challenge_id, partner_id, role_key, role_label, display_name, organization_name, member_count, status, demo_disclaimer)
SELECT c.id, p.id, x.role_key, x.role_label, x.display_name, x.organization_name, x.member_count, x.status,
  'Demo Data — Verification and institutional consent required before production use.'
FROM (VALUES
  ('IC-ECO-DEMO-WASTE','government_owner','Government Owner','Ravi Kumar','Municipal Waste Management Department',NULL,'Active Team'),
  ('IC-ECO-DEMO-WASTE','faculty_mentor','Faculty Mentor','Dr. Asha Menon — Demo Faculty Profile','Central City Institute of Technology',NULL,'Accepted'),
  ('IC-ECO-DEMO-WASTE','student_team','Student Innovation Team','EcoSense Student Innovation Team','Central City Institute of Technology',5,'Active Team'),
  ('IC-ECO-DEMO-WASTE','technology_partner','Technology Partner','GreenRoute Technologies','GreenRoute Technologies',NULL,'Active Team'),
  ('IC-ECO-DEMO-WASTE','csr_partner','CSR Partner','CleanCity Community Foundation','CleanCity Community Foundation',NULL,'Invited'),
  ('IC-ECO-DEMO-WATER','government_owner','Government Owner','Mohan Lal','Rural Water and Sanitation Department',NULL,'Active Team'),
  ('IC-ECO-DEMO-WATER','faculty_mentor','Faculty Mentor','Dr. R. K. Iyer — Demo Faculty Profile','Regional Engineering College',NULL,'Active Team'),
  ('IC-ECO-DEMO-WATER','student_team','Student Innovation Team','JalRakshak Student Innovation Team','Regional Engineering College',4,'Active Team'),
  ('IC-ECO-DEMO-WATER','technology_partner','Technology Partner','AquaSense Solutions','AquaSense Solutions',NULL,'Invited'),
  ('IC-ECO-DEMO-WATER','csr_partner','CSR Partner','RuralConnect Foundation','RuralConnect Foundation',NULL,'Potential Partner'),
  ('IC-ECO-DEMO-ROAD','government_owner','Government Owner','Arjun Singh','Urban Public Safety and Traffic Department',NULL,'Active Team'),
  ('IC-ECO-DEMO-ROAD','faculty_mentor','Faculty Mentor','Dr. Neha Varma — Demo Faculty Profile','Digital Innovation University',NULL,'Invited'),
  ('IC-ECO-DEMO-ROAD','student_team','Student Innovation Team','SafeRoute Student Innovation Team','Digital Innovation University',6,'Invited'),
  ('IC-ECO-DEMO-ROAD','technology_partner','Technology Partner','SafeStreet Mobility Labs','SafeStreet Mobility Labs',NULL,'Potential Partner'),
  ('IC-ECO-DEMO-ROAD','csr_partner','CSR Partner','City Mobility CSR Forum','City Mobility CSR Forum',NULL,'Potential Partner'),
  ('IC-ECO-DEMO-LIGHT','government_owner','Government Owner','Meera Iyer','Streetlight and Electrical Maintenance Department',NULL,'Active Team'),
  ('IC-ECO-DEMO-LIGHT','faculty_mentor','Faculty Mentor','Dr. Vivek Rao — Demo Faculty Profile','Central City Institute of Technology',NULL,'Active Team'),
  ('IC-ECO-DEMO-LIGHT','student_team','Student Innovation Team','LightWatch Student Innovation Team','Central City Institute of Technology',5,'Active Team'),
  ('IC-ECO-DEMO-LIGHT','technology_partner','Technology Partner','LuminaGrid Systems','LuminaGrid Systems',NULL,'Active Team'),
  ('IC-ECO-DEMO-LIGHT','csr_partner','CSR Partner','Bright Communities CSR Initiative','Bright Communities CSR Initiative',NULL,'Accepted')
) AS x(challenge_code, role_key, role_label, display_name, organization_name, member_count, status)
JOIN public.innovation_challenges c ON c.challenge_code = x.challenge_code
LEFT JOIN public.innovation_partners p ON p.name = x.organization_name
ON CONFLICT (challenge_id, role_key) DO UPDATE SET
  partner_id = EXCLUDED.partner_id,
  role_label = EXCLUDED.role_label,
  display_name = EXCLUDED.display_name,
  organization_name = EXCLUDED.organization_name,
  member_count = EXCLUDED.member_count,
  status = EXCLUDED.status,
  demo_disclaimer = EXCLUDED.demo_disclaimer;

-- Staff-only invitation/status history, including all requested badge states.
INSERT INTO public.innovation_challenge_partner_status_history (challenge_id, partner_id, status, note)
SELECT c.id, p.id, x.status, 'Demo Data — Verification and institutional consent required before production use. Fictional invitation history.'
FROM (VALUES
  ('IC-ECO-DEMO-WASTE','Central City Institute of Technology','Accepted'),
  ('IC-ECO-DEMO-WASTE','Central City Institute of Technology','Active Team'),
  ('IC-ECO-DEMO-WASTE','GreenRoute Technologies','Accepted'),
  ('IC-ECO-DEMO-WASTE','GreenRoute Technologies','Active Team'),
  ('IC-ECO-DEMO-WASTE','CleanCity Community Foundation','Potential Partner'),
  ('IC-ECO-DEMO-WASTE','CleanCity Community Foundation','Invited'),
  ('IC-ECO-DEMO-WATER','Regional Engineering College','Accepted'),
  ('IC-ECO-DEMO-WATER','Regional Engineering College','Active Team'),
  ('IC-ECO-DEMO-WATER','AquaSense Solutions','Potential Partner'),
  ('IC-ECO-DEMO-WATER','AquaSense Solutions','Invited'),
  ('IC-ECO-DEMO-WATER','RuralConnect Foundation','Potential Partner'),
  ('IC-ECO-DEMO-ROAD','Digital Innovation University','Potential Partner'),
  ('IC-ECO-DEMO-ROAD','Digital Innovation University','Invited'),
  ('IC-ECO-DEMO-ROAD','SafeStreet Mobility Labs','Potential Partner'),
  ('IC-ECO-DEMO-ROAD','City Mobility CSR Forum','Potential Partner'),
  ('IC-ECO-DEMO-LIGHT','Central City Institute of Technology','Accepted'),
  ('IC-ECO-DEMO-LIGHT','Central City Institute of Technology','Active Team'),
  ('IC-ECO-DEMO-LIGHT','LuminaGrid Systems','Accepted'),
  ('IC-ECO-DEMO-LIGHT','LuminaGrid Systems','Active Team'),
  ('IC-ECO-DEMO-LIGHT','Bright Communities CSR Initiative','Accepted')
) AS x(challenge_code, partner_name, status)
JOIN public.innovation_challenges c ON c.challenge_code = x.challenge_code
JOIN public.innovation_partners p ON p.name = x.partner_name
ON CONFLICT (challenge_id, partner_id, status) DO NOTHING;

-- Staff-only plans. No budgets, proposals, or private contacts are stored.
INSERT INTO public.innovation_challenge_plans (challenge_id, pilot_location, timeline_text, internal_note, budget_note, updated_by_name)
SELECT c.id, x.pilot_location, x.timeline_text,
  'Demo Data — Verification and institutional consent required before production use. Fictional internal planning note.',
  NULL, 'Demo Operations Team'
FROM (VALUES
  ('IC-ECO-DEMO-WASTE','Central Market, Central City','90-day fictional prototype and measurement window.'),
  ('IC-ECO-DEMO-WATER','Selected Greenfield villages','120-day fictional research and field validation window.'),
  ('IC-ECO-DEMO-ROAD','Central Bus Stand Junction','Fictional partner-matching and pilot-readiness review.'),
  ('IC-ECO-DEMO-LIGHT','Selected Central City wards','90-day fictional field-pilot and measurement window.')
) AS x(challenge_code, pilot_location, timeline_text)
JOIN public.innovation_challenges c ON c.challenge_code = x.challenge_code
ON CONFLICT (challenge_id) DO UPDATE SET
  pilot_location = EXCLUDED.pilot_location,
  timeline_text = EXCLUDED.timeline_text,
  internal_note = EXCLUDED.internal_note,
  budget_note = NULL,
  updated_by_name = EXCLUDED.updated_by_name;

-- Public-safe timeline records. Details contain only fictional/demo disclaimers.
INSERT INTO public.innovation_challenge_timeline (challenge_id, stage, title, detail, step_status, is_public, sort_order, created_by_name)
SELECT c.id, x.stage, x.title, 'Demo Data — Verification and institutional consent required before production use. Fictional timeline entry.', x.step_status, true, x.sort_order, 'Demo Operations Team'
FROM (VALUES
  ('IC-ECO-DEMO-WASTE','approved','Government review completed','completed',1),
  ('IC-ECO-DEMO-WASTE','partner_matching','Fictional ecosystem partners shortlisted','completed',2),
  ('IC-ECO-DEMO-WASTE','prototype','Prototype development','in_progress',3),
  ('IC-ECO-DEMO-WATER','government_review','Government review completed','completed',1),
  ('IC-ECO-DEMO-WATER','research','Research planning','in_progress',2),
  ('IC-ECO-DEMO-WATER','field_pilot','Field validation planned','upcoming',3),
  ('IC-ECO-DEMO-ROAD','government_review','Government review completed','completed',1),
  ('IC-ECO-DEMO-ROAD','partner_matching','Partner matching','in_progress',2),
  ('IC-ECO-DEMO-ROAD','prototype','Prototype planning','upcoming',3),
  ('IC-ECO-DEMO-LIGHT','approved','Government review completed','completed',1),
  ('IC-ECO-DEMO-LIGHT','prototype','Prototype completed','completed',2),
  ('IC-ECO-DEMO-LIGHT','field_pilot','Field pilot','in_progress',3)
) AS x(challenge_code, stage, title, step_status, sort_order)
JOIN public.innovation_challenges c ON c.challenge_code = x.challenge_code
ON CONFLICT (challenge_id, stage, title) DO NOTHING;

COMMIT;
