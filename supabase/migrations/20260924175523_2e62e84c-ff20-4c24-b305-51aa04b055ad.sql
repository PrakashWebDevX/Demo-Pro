
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('citizen','officer','dept_admin','university','partner','admin');

-- =========================
-- DEPARTMENTS
-- =========================
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  name_hi text,
  contact_role text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- =========================
-- ISSUE CATEGORIES
-- =========================
CREATE TABLE public.issue_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  name_hi text,
  description text,
  default_department text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.issue_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_categories TO authenticated;
GRANT ALL ON public.issue_categories TO service_role;
ALTER TABLE public.issue_categories ENABLE ROW LEVEL SECURITY;

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  mobile text,
  email text,
  district text,
  block text,
  municipality text,
  village_or_ward text,
  organization_name text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  preferred_language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================
-- USER ROLES
-- =========================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('officer','dept_admin','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_partner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('university','partner')
  );
$$;

CREATE OR REPLACE FUNCTION public.my_department(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM public.profiles WHERE id = _user_id;
$$;

-- =========================
-- REPORTS
-- =========================
CREATE SEQUENCE public.report_public_seq START 1;

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_issue_id text NOT NULL UNIQUE,
  citizen_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  demo_owner_email text,
  reporter_name text,
  title text NOT NULL,
  description text NOT NULL,
  category_key text NOT NULL,
  district text NOT NULL,
  block text,
  municipality text,
  village_or_ward text,
  latitude double precision,
  longitude double precision,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','approved','assigned','in_progress','resolved','rejected','info_requested')),
  ai_category text,
  ai_priority text,
  ai_duplicate_count integer NOT NULL DEFAULT 0,
  ai_recommended_department text,
  ai_next_action text,
  assigned_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  assigned_officer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  officer_remark text,
  is_innovation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX reports_citizen_idx ON public.reports(citizen_id);
CREATE INDEX reports_status_idx ON public.reports(status);
CREATE INDEX reports_district_idx ON public.reports(district);
CREATE INDEX reports_department_idx ON public.reports(assigned_department_id);
CREATE INDEX reports_demo_email_idx ON public.reports(demo_owner_email);
GRANT SELECT ON public.reports TO anon;
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_report(_report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = _report_id
      AND (
        r.citizen_id = auth.uid()
        OR public.is_staff(auth.uid())
        OR (r.is_innovation AND public.is_partner(auth.uid()))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.set_report_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.public_issue_id IS NULL OR NEW.public_issue_id = '' THEN
    NEW.public_issue_id := 'JH-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.report_public_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reports_set_defaults BEFORE INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.set_report_defaults();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_TABLE_NAME = 'reports' AND NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved') THEN
    NEW.resolved_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reports_touch BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- REPORT MEDIA
-- =========================
CREATE TABLE public.report_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_media_report_idx ON public.report_media(report_id);
GRANT SELECT ON public.report_media TO anon;
GRANT SELECT, INSERT, DELETE ON public.report_media TO authenticated;
GRANT ALL ON public.report_media TO service_role;
ALTER TABLE public.report_media ENABLE ROW LEVEL SECURITY;

-- =========================
-- REPORT UPDATES (timeline)
-- =========================
CREATE TABLE public.report_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_name text,
  old_status text,
  new_status text,
  remark text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_updates_report_idx ON public.report_updates(report_id);
GRANT SELECT ON public.report_updates TO anon;
GRANT SELECT, INSERT ON public.report_updates TO authenticated;
GRANT ALL ON public.report_updates TO service_role;
ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;

-- =========================
-- NOTIFICATIONS
-- =========================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  demo_owner_email text,
  report_id uuid REFERENCES public.reports(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =========================
-- FEEDBACK
-- =========================
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  citizen_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  demo_owner_email text,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  resolved_successfully boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX feedback_report_unique ON public.feedback(report_id);
GRANT SELECT ON public.feedback TO anon;
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- =========================
-- INNOVATION PROJECTS
-- =========================
CREATE TABLE public.innovation_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  district text,
  category_key text,
  expected_outcome text,
  deadline date,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','partner_assigned','research','prototype','field_pilot','deployment_review','deployed')),
  assigned_partner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  research_notes text,
  prototype_url text,
  pilot_notes text,
  deployment_approved boolean NOT NULL DEFAULT false,
  government_comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.innovation_projects TO anon;
GRANT SELECT, INSERT, UPDATE ON public.innovation_projects TO authenticated;
GRANT ALL ON public.innovation_projects TO service_role;
ALTER TABLE public.innovation_projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER innovation_touch BEFORE UPDATE ON public.innovation_projects
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- PARTNER APPLICATIONS
-- =========================
CREATE TABLE public.partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  innovation_project_id uuid NOT NULL REFERENCES public.innovation_projects(id) ON DELETE CASCADE,
  applicant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_name text,
  support_type text,
  proposal text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.partner_applications TO authenticated;
GRANT ALL ON public.partner_applications TO service_role;
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

-- =========================
-- POLICIES
-- =========================
CREATE POLICY departments_read_all ON public.departments FOR SELECT USING (true);
CREATE POLICY departments_admin_write ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY categories_read_all ON public.issue_categories FOR SELECT USING (true);
CREATE POLICY categories_admin_write ON public.issue_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY reports_public_resolved ON public.reports FOR SELECT TO anon
  USING (status = 'resolved');
CREATE POLICY reports_select ON public.reports FOR SELECT TO authenticated
  USING (
    citizen_id = auth.uid()
    OR public.is_staff(auth.uid())
    OR (is_innovation AND public.is_partner(auth.uid()))
    OR status = 'resolved'
  );
CREATE POLICY reports_insert_own ON public.reports FOR INSERT TO authenticated
  WITH CHECK (citizen_id = auth.uid());
CREATE POLICY reports_update_staff ON public.reports FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY reports_update_own_early ON public.reports FOR UPDATE TO authenticated
  USING (citizen_id = auth.uid() AND status IN ('submitted','info_requested'))
  WITH CHECK (citizen_id = auth.uid());

CREATE POLICY media_public_resolved ON public.report_media FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.status = 'resolved'));
CREATE POLICY media_select ON public.report_media FOR SELECT TO authenticated
  USING (public.can_read_report(report_id));
CREATE POLICY media_insert ON public.report_media FOR INSERT TO authenticated
  WITH CHECK (public.can_read_report(report_id));
CREATE POLICY media_delete ON public.report_media FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.citizen_id = auth.uid()));

CREATE POLICY updates_public_resolved ON public.report_updates FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.status = 'resolved'));
CREATE POLICY updates_select ON public.report_updates FOR SELECT TO authenticated
  USING (public.can_read_report(report_id));
CREATE POLICY updates_insert_staff ON public.report_updates FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND updated_by = auth.uid());

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY feedback_read_all ON public.feedback FOR SELECT USING (true);
CREATE POLICY feedback_insert_own ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (citizen_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.citizen_id = auth.uid() AND r.status = 'resolved'));

CREATE POLICY innovation_read ON public.innovation_projects FOR SELECT USING (true);
CREATE POLICY innovation_staff_write ON public.innovation_projects FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY innovation_partner_update ON public.innovation_projects FOR UPDATE TO authenticated
  USING (assigned_partner_id = auth.uid()) WITH CHECK (assigned_partner_id = auth.uid());

CREATE POLICY applications_select ON public.partner_applications FOR SELECT TO authenticated
  USING (applicant_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY applications_insert_own ON public.partner_applications FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid());
CREATE POLICY applications_update_staff ON public.partner_applications FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================
-- NOTIFICATION TRIGGERS
-- =========================
CREATE OR REPLACE FUNCTION public.notify_on_report_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, report_id, title, message)
  VALUES (NEW.citizen_id, NEW.id, 'Report submitted successfully',
    'Your issue ' || NEW.public_issue_id || ' has been received and will be reviewed by the concerned team.');
  RETURN NEW;
END;
$$;
CREATE TRIGGER reports_notify_insert AFTER INSERT ON public.reports
FOR EACH ROW WHEN (NEW.citizen_id IS NOT NULL) EXECUTE FUNCTION public.notify_on_report_insert();

CREATE OR REPLACE FUNCTION public.notify_on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  label text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.citizen_id IS NOT NULL THEN
    label := CASE NEW.status
      WHEN 'under_review' THEN 'Your report is under review'
      WHEN 'approved' THEN 'Your report was approved'
      WHEN 'assigned' THEN 'Your report was assigned to a department'
      WHEN 'in_progress' THEN 'Field action has started'
      WHEN 'resolved' THEN 'Your report has been resolved'
      WHEN 'rejected' THEN 'Your report was closed after review'
      WHEN 'info_requested' THEN 'An officer requested more information'
      ELSE 'Your report status changed'
    END;
    INSERT INTO public.notifications (user_id, report_id, title, message)
    VALUES (NEW.citizen_id, NEW.id, label,
      'Issue ' || NEW.public_issue_id || ': ' || label ||
      CASE WHEN NEW.status = 'resolved' THEN '. Please share your feedback.' ELSE '.' END);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reports_notify_status AFTER UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.notify_on_status_change();

-- =========================
-- NEW USER HANDLING (profile + role + demo data claim)
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wanted_role public.app_role;
  dept_id uuid;
BEGIN
  BEGIN
    wanted_role := COALESCE(NEW.raw_user_meta_data->>'role', 'citizen')::public.app_role;
  EXCEPTION WHEN others THEN
    wanted_role := 'citizen';
  END;

  IF NEW.raw_user_meta_data->>'department_name' IS NOT NULL THEN
    SELECT id INTO dept_id FROM public.departments WHERE name = NEW.raw_user_meta_data->>'department_name';
  END IF;

  INSERT INTO public.profiles (id, full_name, mobile, email, district, organization_name, department_id, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'mobile',
    NEW.email,
    NEW.raw_user_meta_data->>'district',
    NEW.raw_user_meta_data->>'organization_name',
    dept_id,
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, wanted_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- link seeded demo content to the matching demo account
  UPDATE public.reports SET citizen_id = NEW.id WHERE demo_owner_email = NEW.email AND citizen_id IS NULL;
  UPDATE public.notifications SET user_id = NEW.id WHERE demo_owner_email = NEW.email AND user_id IS NULL;
  UPDATE public.feedback SET citizen_id = NEW.id WHERE demo_owner_email = NEW.email AND citizen_id IS NULL;

  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- SEED DATA
-- =========================
INSERT INTO public.departments (name, name_hi, contact_role) VALUES
 ('Urban Development and Housing','नगर विकास एवं आवास','Deputy Municipal Commissioner'),
 ('Drinking Water and Sanitation','पेयजल एवं स्वच्छता','Executive Engineer'),
 ('Road Construction','पथ निर्माण','Assistant Engineer'),
 ('Rural Development','ग्रामीण विकास','Block Development Officer'),
 ('Energy','ऊर्जा','Junior Electrical Engineer'),
 ('Health','स्वास्थ्य','Civil Surgeon Office'),
 ('School Education','स्कूली शिक्षा','District Education Officer'),
 ('Municipal Administration','नगरपालिका प्रशासन','Ward Sanitation Officer');

INSERT INTO public.issue_categories (key, name, name_hi, description, default_department) VALUES
 ('road_damage','Road Damage','सड़क क्षति','Potholes, broken roads, damaged culverts','Road Construction'),
 ('waste','Waste Management','कचरा प्रबंधन','Garbage collection, dumping, bins','Municipal Administration'),
 ('water','Water Supply','जल आपूर्ति','Pipeline leaks, no supply, contamination','Drinking Water and Sanitation'),
 ('streetlight','Streetlight','स्ट्रीट लाइट','Non-working or missing street lights','Energy'),
 ('drainage','Drainage','नाली','Blocked drains, waterlogging','Urban Development and Housing'),
 ('safety','Public Safety','सार्वजनिक सुरक्षा','Unsafe structures, open wires, accident risk','Urban Development and Housing'),
 ('education','School / Education','विद्यालय / शिक्षा','School building, teachers, facilities','School Education'),
 ('health','Health','स्वास्थ्य','Health centre facilities, sanitation, medicines','Health'),
 ('other','Other','अन्य','Any other civic issue','Rural Development');

-- Demo reports (linked to demo accounts by email on first sign-in)
INSERT INTO public.reports
 (public_issue_id, demo_owner_email, reporter_name, title, description, category_key, district, block, municipality, village_or_ward,
  latitude, longitude, priority, status, ai_category, ai_priority, ai_duplicate_count, ai_recommended_department, ai_next_action,
  assigned_department_id, officer_remark, is_innovation, created_at, resolved_at)
VALUES
 ('JH-2026-0001','citizen@demo.jh','Demo Citizen','Garbage not collected near Harmu Colony',
  'Garbage has not been collected for eight days near the Harmu Colony market. The waste is spreading and it is unsafe for children.',
  'waste','Ranchi','Ranchi Sadar','Ranchi Municipal Corporation','Ward 24',23.3600,85.3100,'high','resolved',
  'Waste Management','high',1,'Municipal Administration','Assign to Municipal Administration for immediate clearance',
  (SELECT id FROM public.departments WHERE name='Municipal Administration'),
  'Ward sanitation team cleared the site and daily pickup restored.',false, now() - interval '14 days', now() - interval '6 days'),

 ('JH-2026-0002','citizen@demo.jh','Demo Citizen','Streetlights not working on Kanke Road',
  'Six streetlights near the Kanke Road bus stop are dark. It is unsafe for women walking home after work.',
  'streetlight','Ranchi','Kanke','Ranchi Municipal Corporation','Ward 08',23.4020,85.2900,'high','in_progress',
  'Streetlight','high',0,'Energy','Assign to Energy department for pole-wise inspection',
  (SELECT id FROM public.departments WHERE name='Energy'),
  'Approved. Material requisition raised with Energy division.',false, now() - interval '9 days', NULL),

 ('JH-2026-0003','citizen@demo.jh','Demo Citizen','Water pipeline leaking in Doranda',
  'A pipeline leak near Doranda market is wasting drinking water since three days.',
  'water','Ranchi','Ranchi Sadar','Ranchi Municipal Corporation','Ward 31',23.3350,85.3200,'medium','under_review',
  'Water Supply','medium',0,'Drinking Water and Sanitation','Verify with Executive Engineer before assignment',
  NULL,NULL,false, now() - interval '3 days', NULL),

 ('JH-2026-0004','citizen@demo.jh','Demo Citizen','Deep pothole causing accidents in Hatia',
  'A dangerous pothole on the Hatia approach road caused two bike accidents this week. Urgent repair needed.',
  'road_damage','Ranchi','Hatia','Ranchi Municipal Corporation','Ward 45',23.3050,85.3000,'high','submitted',
  'Road Damage','high',1,'Road Construction','Immediate site inspection recommended',
  NULL,NULL,false, now() - interval '1 day', NULL),

 ('JH-2026-0005',NULL,'Rakesh Mahto','Pothole near Hatia railway crossing',
  'Road damage and potholes near the Hatia railway crossing. Similar issue already reported by another citizen.',
  'road_damage','Ranchi','Hatia','Ranchi Municipal Corporation','Ward 45',23.3060,85.3010,'medium','submitted',
  'Road Damage','medium',1,'Road Construction','Possible duplicate — verify against JH-2026-0004',
  NULL,NULL,false, now() - interval '1 day', NULL),

 ('JH-2026-0006',NULL,'Sunita Devi','Overflowing drain in Dhanbad Bank More',
  'The drain near Bank More is blocked and dirty water is entering shops.',
  'drainage','Dhanbad','Dhanbad Sadar','Dhanbad Municipal Corporation','Ward 12',23.7950,86.4300,'medium','assigned',
  'Drainage','medium',0,'Urban Development and Housing','Assign to Urban Development for desilting',
  (SELECT id FROM public.departments WHERE name='Urban Development and Housing'),
  'Approved and assigned for desilting.',false, now() - interval '11 days', NULL),

 ('JH-2026-0007',NULL,'Imran Ansari','Hand pump not working in Jamshedpur village',
  'The only hand pump in our village has been out of order for two weeks. Women walk 2 km for water.',
  'water','East Singhbhum','Potka',NULL,'Kharangajhar',22.8000,86.2000,'high','in_progress',
  'Water Supply','high',0,'Drinking Water and Sanitation','Assign to Drinking Water and Sanitation on priority',
  (SELECT id FROM public.departments WHERE name='Drinking Water and Sanitation'),
  'Mechanic team deployed.',false, now() - interval '8 days', NULL),

 ('JH-2026-0008',NULL,'Priya Kumari','School toilet unusable in Bokaro',
  'The girls toilet in the middle school is broken and unusable. Students are affected.',
  'education','Bokaro','Chas',NULL,'Ward 06',23.6700,86.1500,'medium','resolved',
  'School / Education','medium',0,'School Education','Forward to District Education Officer',
  (SELECT id FROM public.departments WHERE name='School Education'),
  'Repair completed and verified by the headmaster.',false, now() - interval '25 days', now() - interval '10 days'),

 ('JH-2026-0009',NULL,'Mohan Yadav','Garbage dumping beside Deoghar temple road',
  'Waste is being dumped openly along the temple approach road, creating a bad smell for pilgrims.',
  'waste','Deoghar','Deoghar Sadar','Deoghar Municipal Corporation','Ward 15',24.4800,86.7000,'medium','under_review',
  'Waste Management','medium',1,'Municipal Administration','Verify dumping spot with ward officer',
  NULL,NULL,false, now() - interval '4 days', NULL),

 ('JH-2026-0010',NULL,'Anita Soren','Waste dumped near Deoghar temple approach',
  'Open garbage dumping near the temple road. Same location as reported earlier.',
  'waste','Deoghar','Deoghar Sadar','Deoghar Municipal Corporation','Ward 15',24.4805,86.7008,'low','submitted',
  'Waste Management','medium',1,'Municipal Administration','Possible duplicate — verify against JH-2026-0009',
  NULL,NULL,false, now() - interval '2 days', NULL),

 ('JH-2026-0011',NULL,'Sanjay Kumar','Broken road in Dumka block',
  'Village road damaged after rains, tractors cannot pass.',
  'road_damage','Dumka','Jarmundi',NULL,'Kathikund',24.2600,87.2400,'medium','assigned',
  'Road Damage','medium',0,'Rural Development','Assign to Rural Development',
  (SELECT id FROM public.departments WHERE name='Rural Development'),
  'Estimate under preparation.',false, now() - interval '18 days', NULL),

 ('JH-2026-0012',NULL,'Rita Kumari','Health sub-centre has no regular staff in Hazaribagh',
  'The sub-centre remains closed most days and patients travel to the district hospital.',
  'health','Hazaribagh','Barhi',NULL,'Barhi Ward 3',24.0000,85.3600,'high','under_review',
  'Health','high',0,'Health','Escalate to Civil Surgeon office',
  NULL,NULL,false, now() - interval '5 days', NULL),

 ('JH-2026-0013',NULL,'Dinesh Prasad','Dark stretch near Giridih bus stand',
  'No street lighting near the bus stand, unsafe at night.',
  'streetlight','Giridih','Giridih Sadar','Giridih Municipality','Ward 09',24.1900,86.3000,'medium','resolved',
  'Streetlight','medium',0,'Energy','Assign to Energy',
  (SELECT id FROM public.departments WHERE name='Energy'),
  'Six LED lights installed and tested.',false, now() - interval '30 days', now() - interval '12 days'),

 ('JH-2026-0014',NULL,'Basanti Oraon','Open electric wire near Gumla market',
  'A live wire is hanging low near the vegetable market. Very dangerous for shoppers.',
  'safety','Gumla','Gumla Sadar','Gumla Municipality','Ward 04',23.0400,84.5400,'high','in_progress',
  'Public Safety','high',0,'Energy','Immediate action by Energy department',
  (SELECT id FROM public.departments WHERE name='Energy'),
  'Line team dispatched same day.',false, now() - interval '6 days', NULL),

 ('JH-2026-0015',NULL,'Ramesh Singh','Drinking water quality problem in Palamu',
  'Water from the supply line is muddy and has a smell. Many households affected.',
  'water','Palamu','Medininagar','Medininagar Municipality','Ward 11',24.0400,84.0700,'high','submitted',
  'Water Supply','high',0,'Drinking Water and Sanitation','Collect sample for testing',
  NULL,NULL,false, now() - interval '2 days', NULL),

 ('JH-2026-0016',NULL,'Ward Committee Ranchi','Repeated waterlogging needs a long-term solution',
  'Ward 24 floods every monsoon despite yearly desilting. A low-cost drainage and early-warning solution is needed.',
  'drainage','Ranchi','Ranchi Sadar','Ranchi Municipal Corporation','Ward 24',23.3610,85.3110,'high','approved',
  'Drainage','high',0,'Urban Development and Housing','Convert to innovation challenge',
  (SELECT id FROM public.departments WHERE name='Urban Development and Housing'),
  'Approved as an innovation challenge for university and startup partners.',true, now() - interval '20 days', NULL),

 ('JH-2026-0017',NULL,'Bokaro Citizens Forum','Smart waste collection route planning needed',
  'Waste collection vehicles miss several lanes. A data-driven route plan could improve coverage.',
  'waste','Bokaro','Chas','Chas Municipal Corporation','Ward 18',23.6420,86.1510,'medium','approved',
  'Waste Management','medium',0,'Municipal Administration','Convert to innovation challenge',
  (SELECT id FROM public.departments WHERE name='Municipal Administration'),
  'Approved for innovation partners.',true, now() - interval '16 days', NULL);

-- Timeline entries for the complete demo journey (JH-2026-0001)
INSERT INTO public.report_updates (report_id, updated_by_name, old_status, new_status, remark, created_at)
SELECT id, 'Demo Citizen', NULL, 'submitted', 'Issue submitted by citizen with photo evidence.', created_at FROM public.reports WHERE public_issue_id='JH-2026-0001'
UNION ALL
SELECT id, 'Officer R. Kumar', 'submitted', 'under_review', 'Report opened for review. AI suggestion noted.', created_at + interval '4 hours' FROM public.reports WHERE public_issue_id='JH-2026-0001'
UNION ALL
SELECT id, 'Officer R. Kumar', 'under_review', 'approved', 'Verified with ward officer. Approved for action.', created_at + interval '1 day' FROM public.reports WHERE public_issue_id='JH-2026-0001'
UNION ALL
SELECT id, 'Officer R. Kumar', 'approved', 'assigned', 'Assigned to Municipal Administration.', created_at + interval '1 day 2 hours' FROM public.reports WHERE public_issue_id='JH-2026-0001'
UNION ALL
SELECT id, 'Ward Sanitation Officer', 'assigned', 'in_progress', 'Cleaning vehicle and team deployed.', created_at + interval '3 days' FROM public.reports WHERE public_issue_id='JH-2026-0001'
UNION ALL
SELECT id, 'Ward Sanitation Officer', 'in_progress', 'resolved', 'Site cleared, daily pickup schedule restored.', created_at + interval '8 days' FROM public.reports WHERE public_issue_id='JH-2026-0001';

INSERT INTO public.report_updates (report_id, updated_by_name, old_status, new_status, remark, created_at)
SELECT id, 'Officer R. Kumar', 'submitted', 'under_review', 'Under review by the electrical division.', created_at + interval '1 day' FROM public.reports WHERE public_issue_id='JH-2026-0002'
UNION ALL
SELECT id, 'Officer R. Kumar', 'under_review', 'in_progress', 'Approved and forwarded to Energy department.', created_at + interval '2 days' FROM public.reports WHERE public_issue_id='JH-2026-0002';

-- Demo notifications for the demo citizen
INSERT INTO public.notifications (demo_owner_email, report_id, title, message, read, created_at)
SELECT 'citizen@demo.jh', id, 'Your report has been resolved', 'Issue JH-2026-0001: the site was cleared and daily pickup restored. Please share your feedback.', false, now() - interval '6 days' FROM public.reports WHERE public_issue_id='JH-2026-0001'
UNION ALL
SELECT 'citizen@demo.jh', id, 'Field action has started', 'Issue JH-2026-0002: the Energy department team has started work.', false, now() - interval '5 days' FROM public.reports WHERE public_issue_id='JH-2026-0002'
UNION ALL
SELECT 'citizen@demo.jh', id, 'Your report is under review', 'Issue JH-2026-0003: an officer is reviewing your report.', true, now() - interval '3 days' FROM public.reports WHERE public_issue_id='JH-2026-0003'
UNION ALL
SELECT 'citizen@demo.jh', id, 'Report submitted successfully', 'Issue JH-2026-0004 has been received and will be reviewed by the concerned team.', false, now() - interval '1 day' FROM public.reports WHERE public_issue_id='JH-2026-0004'
UNION ALL
SELECT 'citizen@demo.jh', id, 'Feedback requested', 'Issue JH-2026-0001 is resolved. Please rate the service you received.', false, now() - interval '5 days' FROM public.reports WHERE public_issue_id='JH-2026-0001';

-- Demo feedback
INSERT INTO public.feedback (report_id, demo_owner_email, rating, comment, resolved_successfully, created_at)
SELECT id, NULL, 5, 'Very good work, the area is clean now.', true, now() - interval '9 days' FROM public.reports WHERE public_issue_id='JH-2026-0008'
UNION ALL
SELECT id, NULL, 4, 'Lights are working, took some time.', true, now() - interval '11 days' FROM public.reports WHERE public_issue_id='JH-2026-0013';

-- Innovation challenges
INSERT INTO public.innovation_projects (source_report_id, title, description, district, category_key, expected_outcome, deadline, status)
SELECT id, 'Low-cost monsoon waterlogging early-warning and drainage plan for Ward 24',
 'Ward 24 in Ranchi floods every monsoon despite annual desilting. We need a low-cost sensor or community-reporting based early-warning approach plus a practical drainage improvement plan that the municipal body can implement.',
 'Ranchi','drainage','A working pilot in one ward with measurable reduction in waterlogging complaints', current_date + 90, 'open'
FROM public.reports WHERE public_issue_id='JH-2026-0016'
UNION ALL
SELECT id, 'Data-driven waste collection route optimisation for Chas',
 'Waste collection vehicles miss several lanes in Ward 18. We invite student teams and startups to build a simple route planning and coverage tracking solution usable by ward supervisors on a phone.',
 'Bokaro','waste','Route plan covering all lanes with daily coverage tracking', current_date + 120, 'open'
FROM public.reports WHERE public_issue_id='JH-2026-0017';
