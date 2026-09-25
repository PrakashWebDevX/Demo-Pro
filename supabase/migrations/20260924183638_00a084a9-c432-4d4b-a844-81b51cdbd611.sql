ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'status';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'Web Form';
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE OR REPLACE FUNCTION public.notify_staff(_report_id uuid, _title text, _message text, _type text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, report_id, title, message, type)
  SELECT DISTINCT ur.user_id, _report_id, _title, _message, _type
  FROM public.user_roles ur WHERE ur.role IN ('officer','admin');
$$;
REVOKE ALL ON FUNCTION public.notify_staff(uuid,text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_on_report_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cat text := COALESCE(NEW.ai_category, NEW.category_key);
BEGIN
  IF NEW.citizen_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, report_id, title, message, type)
    VALUES (NEW.citizen_id, NEW.id, 'Report submitted successfully',
      'Your issue ' || NEW.public_issue_id || ' has been received and will be reviewed by the concerned team.', 'submitted');
    IF NEW.ai_recommended_department IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, report_id, title, message, type)
      VALUES (NEW.citizen_id, NEW.id, 'Your report is under review',
        'Your ' || cat || ' report has been sent to the ' || NEW.ai_recommended_department || ' department for review.', 'ai_analysis');
    END IF;
  END IF;
  PERFORM public.notify_staff(NEW.id,
    CASE WHEN NEW.priority = 'high' THEN 'New high-priority report' ELSE 'New report submitted' END,
    'A new ' || cat || ' issue (' || NEW.public_issue_id || ', ' || NEW.district || ') requires review.'
      || CASE WHEN NEW.source <> 'Web Form' THEN ' Source: ' || NEW.source || '.' ELSE '' END,
    'submitted');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS reports_notify_insert ON public.reports;
CREATE TRIGGER reports_notify_insert AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.notify_on_report_insert();

CREATE OR REPLACE FUNCTION public.notify_on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE label text; dept text;
BEGIN
  IF NEW.citizen_id IS NOT NULL AND NEW.assigned_department_id IS DISTINCT FROM OLD.assigned_department_id
     AND NEW.assigned_department_id IS NOT NULL AND NEW.status = OLD.status THEN
    SELECT name INTO dept FROM public.departments WHERE id = NEW.assigned_department_id;
    INSERT INTO public.notifications (user_id, report_id, title, message, type)
    VALUES (NEW.citizen_id, NEW.id, 'Department assigned',
      'Issue ' || NEW.public_issue_id || ' is now handled by ' || COALESCE(dept,'a department') || '.', 'assigned');
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.citizen_id IS NOT NULL THEN
    label := CASE NEW.status
      WHEN 'under_review' THEN 'Your report is under review'
      WHEN 'approved' THEN 'Your report was approved'
      WHEN 'assigned' THEN 'Your report was assigned to a department'
      WHEN 'in_progress' THEN 'Field action has started'
      WHEN 'resolved' THEN 'Your report has been resolved'
      WHEN 'rejected' THEN 'Your report was closed after review'
      WHEN 'info_requested' THEN 'An officer requested more information'
      ELSE 'Your report status changed' END;
    INSERT INTO public.notifications (user_id, report_id, title, message, type)
    VALUES (NEW.citizen_id, NEW.id, label,
      'Issue ' || NEW.public_issue_id || ': ' || label ||
      CASE WHEN NEW.status = 'resolved' THEN '. Please share your feedback.' ELSE '.' END,
      NEW.status);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid text;
BEGIN
  SELECT public_issue_id INTO pid FROM public.reports WHERE id = NEW.report_id;
  PERFORM public.notify_staff(NEW.report_id, 'Citizen feedback submitted',
    'Feedback received for ' || COALESCE(pid,'a report') || ': ' || COALESCE(NEW.rating::text,'-') || '/5 stars.', 'feedback');
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_on_feedback() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS feedback_notify ON public.feedback;
CREATE TRIGGER feedback_notify AFTER INSERT ON public.feedback
FOR EACH ROW EXECUTE FUNCTION public.notify_on_feedback();

CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 100),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 150),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  user_type text NOT NULL CHECK (user_type IN ('Citizen','Government','University','Industry','Other')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_insert_any ON public.contact_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY contact_select_admin ON public.contact_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.contact_messages (full_name,email,subject,message,user_type,created_at) VALUES
('Sunita Oraon','sunita.oraon@example.in','Tracking my report','How long does the department take to respond after assignment?','Citizen', now() - interval '3 days'),
('Dr. Amit Kumar','amit.kumar@bitmesra.example','Student pilot collaboration','Our lab would like to pilot low-cost water quality sensors in Ranchi wards.','University', now() - interval '2 days'),
('Ravi Mahato','ravi@greenstartup.example','CSR partnership','We can fund solar streetlights in two blocks of Dumka.','Industry', now() - interval '1 day'),
('Block Office Gumla','bdo.gumla@example.gov.in','Department onboarding','Please onboard our block officers to the platform.','Government', now() - interval '5 hours');

INSERT INTO public.notifications (demo_owner_email, report_id, title, message, type, read, created_at)
SELECT 'officer@demo.jh', r.id,
  CASE WHEN r.priority='high' THEN 'New high-priority report' ELSE 'New report submitted' END,
  'A new ' || COALESCE(r.ai_category, r.category_key) || ' issue (' || r.public_issue_id || ', ' || r.district || ') requires review.',
  'submitted', false, r.created_at
FROM public.reports r WHERE r.status IN ('submitted','under_review') ORDER BY r.created_at DESC LIMIT 5;
UPDATE public.notifications n SET user_id = u.id FROM auth.users u
WHERE n.demo_owner_email = u.email AND n.user_id IS NULL;