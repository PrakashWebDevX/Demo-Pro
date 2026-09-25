-- Smart Assignment (phase 1). Run once in your Supabase SQL editor. Safe to re-run.
-- Demo Data — Replace with Verified Government and Partner Directory in Production.

-- 0) Urban / Rural on reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS area_type text
  CHECK (area_type IN ('urban','rural'));

-- 1) Government departments directory
CREATE TABLE IF NOT EXISTS public.gov_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_name text NOT NULL UNIQUE,
  department_type text NOT NULL CHECK (department_type IN ('Urban','Rural','District','State')),
  service_categories text[] NOT NULL DEFAULT '{}',   -- report category keys
  service_category_labels text[] NOT NULL DEFAULT '{}',
  district text NOT NULL,
  state text NOT NULL DEFAULT 'Demo State',
  service_area_description text,
  contact_email text,
  active_status boolean NOT NULL DEFAULT true,
  workload_count int NOT NULL DEFAULT 0,
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Officers directory
CREATE TABLE IF NOT EXISTS public.gov_officers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL UNIQUE,
  designation text NOT NULL,
  department_id uuid REFERENCES public.gov_departments(id) ON DELETE SET NULL,
  district text NOT NULL,
  urban_or_rural_area text NOT NULL CHECK (urban_or_rural_area IN ('urban','rural','both')),
  categories_handled text[] NOT NULL DEFAULT '{}',
  active_status boolean NOT NULL DEFAULT true,
  current_open_assignments int NOT NULL DEFAULT 0,
  max_assignment_capacity int NOT NULL DEFAULT 10,
  email text,
  phone_demo text,
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Universities + industry / startup / CSR partners
CREATE TABLE IF NOT EXISTS public.innovation_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_kind text NOT NULL CHECK (partner_kind IN ('university','partner')),
  name text NOT NULL UNIQUE,
  organization_type text NOT NULL,           -- University / Startup / Industry / CSR Partner
  city text NOT NULL,
  state text NOT NULL DEFAULT 'Demo State',
  location_latitude double precision,
  location_longitude double precision,
  expertise_categories text[] NOT NULL DEFAULT '{}',  -- report category keys
  expertise_labels text[] NOT NULL DEFAULT '{}',
  innovation_domains text[] NOT NULL DEFAULT '{}',
  available_team_capacity int NOT NULL DEFAULT 3,
  current_workload int NOT NULL DEFAULT 0,
  active_status boolean NOT NULL DEFAULT true,
  contact_person_name text,
  contact_email text,
  demo_note text DEFAULT 'Demo Partner Data',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Persisted AI suggestion + final officer decision (one per report)
CREATE TABLE IF NOT EXISTS public.report_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL UNIQUE REFERENCES public.reports(id) ON DELETE CASCADE,
  -- AI suggestion
  suggested_resolution_type text NOT NULL CHECK (suggested_resolution_type IN ('standard','innovation')),
  suggested_priority text,
  area_type text,
  suggested_department_id uuid REFERENCES public.gov_departments(id),
  suggested_officer_id uuid REFERENCES public.gov_officers(id),
  suggested_university_id uuid REFERENCES public.innovation_partners(id),
  suggested_partner_id uuid REFERENCES public.innovation_partners(id),
  suggested_innovation_theme text,
  reasoning text,
  confidence int CHECK (confidence BETWEEN 0 AND 100),
  related_count int NOT NULL DEFAULT 0,
  suggested_location text,
  top_matches jsonb NOT NULL DEFAULT '{}',
  recommendation_status text NOT NULL DEFAULT 'pending'
    CHECK (recommendation_status IN ('pending','approved','changed','rejected')),
  -- Final (officer approved)
  final_resolution_type text CHECK (final_resolution_type IN ('standard','innovation')),
  final_department_id uuid REFERENCES public.gov_departments(id),
  final_officer_id uuid REFERENCES public.gov_officers(id),
  final_university_id uuid REFERENCES public.innovation_partners(id),
  final_partner_id uuid REFERENCES public.innovation_partners(id),
  final_owner_name text,
  due_date date,
  officer_note text,           -- internal
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grants (citizens never get officer phone/email: column-level grants)
REVOKE ALL ON public.gov_departments, public.gov_officers, public.innovation_partners, public.report_assignments FROM anon, authenticated;
GRANT SELECT ON public.gov_departments TO authenticated;
GRANT UPDATE (workload_count) ON public.gov_departments TO authenticated;
GRANT SELECT (id, full_name, designation, department_id, district, urban_or_rural_area,
              categories_handled, active_status, current_open_assignments,
              max_assignment_capacity, is_demo, created_at) ON public.gov_officers TO authenticated;
GRANT UPDATE (current_open_assignments) ON public.gov_officers TO authenticated;
GRANT SELECT (id, partner_kind, name, organization_type, city, state, location_latitude,
              location_longitude, expertise_categories, expertise_labels, innovation_domains,
              available_team_capacity, current_workload, active_status, demo_note, created_at)
  ON public.innovation_partners TO authenticated;
GRANT UPDATE (current_workload) ON public.innovation_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.report_assignments TO authenticated;
GRANT ALL ON public.gov_departments, public.gov_officers, public.innovation_partners, public.report_assignments TO service_role;

ALTER TABLE public.gov_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gov_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovation_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dir read" ON public.gov_departments;
CREATE POLICY "dir read" ON public.gov_departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staff update" ON public.gov_departments;
CREATE POLICY "staff update" ON public.gov_departments FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "dir read" ON public.gov_officers;
CREATE POLICY "dir read" ON public.gov_officers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staff update" ON public.gov_officers;
CREATE POLICY "staff update" ON public.gov_officers FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "dir read" ON public.innovation_partners;
CREATE POLICY "dir read" ON public.innovation_partners FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staff update" ON public.innovation_partners;
CREATE POLICY "staff update" ON public.innovation_partners FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Assignment: readable by anyone allowed to read the report; created by staff only;
-- only staff can decide (update). Citizens therefore never trigger an assignment.
DROP POLICY IF EXISTS "assign read" ON public.report_assignments;
CREATE POLICY "assign read" ON public.report_assignments FOR SELECT TO authenticated
  USING (public.can_read_report(report_id));
DROP POLICY IF EXISTS "assign insert" ON public.report_assignments;
CREATE POLICY "assign insert" ON public.report_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "assign update" ON public.report_assignments;
CREATE POLICY "assign update" ON public.report_assignments FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Realtime (only the tables that need live updates)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['reports','report_updates','notifications','report_assignments'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ---------------- Seed (fictional demo data) ----------------
INSERT INTO public.gov_departments (department_name, department_type, service_categories, service_category_labels, district, service_area_description, contact_email) VALUES
 ('Municipal Waste Management Department','Urban','{waste}','{Waste Management,Garbage Collection,Illegal Dumping}','Central City','Central City / Urban wards','waste.dept@demo.gov'),
 ('Municipal Roads and Public Works Department','Urban','{road_damage,drainage}','{Potholes,Road Damage,Footpaths,Drainage Repair}','Central City','Central City / Urban wards','roads.dept@demo.gov'),
 ('Water Supply and Sewerage Department','Urban','{water,drainage}','{Water Leakage,Water Supply,Sewage Overflow,Drainage}','Central City','Urban and peri-urban wards','water.dept@demo.gov'),
 ('Streetlight and Electrical Maintenance Department','Urban','{streetlight}','{Broken Streetlight,Electrical Hazard,Public Lighting}','Central City','Urban wards','lights.dept@demo.gov'),
 ('Urban Public Safety and Traffic Department','Urban','{safety}','{Traffic Safety,Unsafe Junction,Public Safety}','Central City','Urban wards','safety.dept@demo.gov'),
 ('Rural Development and Panchayat Department','Rural','{other,education,health}','{Village Roads,Community Assets,Rural Infrastructure}','Greenfield','Rural villages','rural.dev@demo.gov'),
 ('Rural Water and Sanitation Department','Rural','{water,waste,drainage}','{Drinking Water,Handpump,Sanitation,Rural Waste}','Greenfield','Rural villages','rural.water@demo.gov'),
 ('Rural Roads and Infrastructure Department','Rural','{road_damage}','{Rural Road Damage,Culverts,Connectivity}','Greenfield','Rural villages','rural.roads@demo.gov'),
 ('Agriculture and Irrigation Department','Rural','{water}','{Irrigation,Crop Water,Farm Infrastructure}','Farmville','Rural and agricultural zones','agri.dept@demo.gov')
ON CONFLICT (department_name) DO NOTHING;

INSERT INTO public.gov_officers (full_name, designation, department_id, district, urban_or_rural_area, categories_handled, max_assignment_capacity, email, phone_demo)
SELECT o.full_name, o.designation, d.id, o.district, o.area, o.cats, o.cap, o.email, '+00-DEMO-0000'
FROM (VALUES
 ('Ananya Sharma','Municipal Commissioner',NULL,'Central City','urban','{waste,road_damage,water,streetlight,safety,drainage}'::text[],30,'ananya@demo.gov'),
 ('Ravi Kumar','Waste Management Officer','Municipal Waste Management Department','Central City','urban','{waste}'::text[],10,'ravi@demo.gov'),
 ('Priya Nair','Executive Engineer','Municipal Roads and Public Works Department','Central City','urban','{road_damage,drainage}'::text[],10,'priya@demo.gov'),
 ('Suresh Patel','Water Supply Officer','Water Supply and Sewerage Department','Central City','urban','{water,drainage}'::text[],10,'suresh@demo.gov'),
 ('Meera Iyer','Electrical Maintenance Officer','Streetlight and Electrical Maintenance Department','Central City','urban','{streetlight}'::text[],10,'meera@demo.gov'),
 ('Arjun Singh','Public Safety Officer','Urban Public Safety and Traffic Department','Central City','urban','{safety}'::text[],10,'arjun@demo.gov'),
 ('Kavita Devi','Block Development Officer','Rural Development and Panchayat Department','Greenfield','rural','{other,education,health}'::text[],10,'kavita@demo.gov'),
 ('Mohan Lal','Rural Water Officer','Rural Water and Sanitation Department','Greenfield','rural','{water,waste,drainage}'::text[],10,'mohan@demo.gov'),
 ('Deepak Verma','Rural Roads Engineer','Rural Roads and Infrastructure Department','Greenfield','rural','{road_damage}'::text[],10,'deepak@demo.gov'),
 ('Nisha Gupta','Agriculture Extension Officer','Agriculture and Irrigation Department','Farmville','rural','{water}'::text[],10,'nisha@demo.gov')
) AS o(full_name, designation, dept, district, area, cats, cap, email)
LEFT JOIN public.gov_departments d ON d.department_name = o.dept
ON CONFLICT (full_name) DO NOTHING;
-- Commissioner starts busier so specialists win ties.
UPDATE public.gov_officers SET current_open_assignments = 12 WHERE full_name = 'Ananya Sharma' AND current_open_assignments = 0;

INSERT INTO public.innovation_partners (partner_kind, name, organization_type, city, expertise_categories, expertise_labels, innovation_domains, contact_person_name, contact_email) VALUES
 ('university','Central City Institute of Technology','University','Central City','{waste,safety,streetlight}','{AI,IoT,Smart Cities,Data Analytics}','{Waste prediction,Traffic,Public safety,Urban analytics}','Dr. Demo Rao','ccit@demo.edu'),
 ('university','Regional Engineering College','University','Greenfield','{road_damage,drainage,water}','{Civil Engineering,Water Systems,Rural Infrastructure}','{Roads,Drainage,Water supply,Rural infrastructure}','Dr. Demo Menon','rec@demo.edu'),
 ('university','State Agricultural Innovation University','University','Farmville','{water}','{Agriculture,Irrigation,Soil,Water Conservation}','{Irrigation,Crop water,Rural sustainability}','Dr. Demo Reddy','saiu@demo.edu'),
 ('university','Digital Innovation University','University','Tech Park','{other,education,health,safety}','{Mobile Apps,AI,GIS,Accessibility}','{Digital services,Maps,Accessibility,AI workflows}','Dr. Demo Das','diu@demo.edu'),
 ('partner','GreenRoute Technologies','Startup','Central City','{waste}','{Smart Waste Bins,IoT Sensors,Route Optimization}','{Waste overflow,Collection optimization}','Demo Contact A','greenroute@demo.co'),
 ('partner','AquaSense Solutions','Startup','Central City','{water,drainage}','{Water Sensors,Leakage Detection,Water Quality}','{Water supply,Leakage}','Demo Contact B','aquasense@demo.co'),
 ('partner','SafeStreet Mobility Labs','Industry Partner','Central City','{safety,road_damage,streetlight}','{Traffic Analytics,Road Safety,Smart Signals}','{Traffic safety,Road risk}','Demo Contact C','safestreet@demo.co'),
 ('partner','RuralConnect Foundation','CSR Partner','Greenfield','{water,waste,other,road_damage}','{Rural Water,Sanitation,Village Infrastructure}','{Rural infrastructure,Sanitation}','Demo Contact D','ruralconnect@demo.org')
ON CONFLICT (name) DO NOTHING;
