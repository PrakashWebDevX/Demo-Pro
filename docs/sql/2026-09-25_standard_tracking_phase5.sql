-- Phase 5: Standard issue tracking — adds "Citizen Feedback" and "Closed" stages.
-- Flow: submitted -> under_review -> assigned -> in_progress -> resolved -> citizen_feedback -> closed
-- Safe to re-run.

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check CHECK (status IN (
  'submitted','under_review','approved','assigned','in_progress','resolved',
  'citizen_feedback','closed','rejected','info_requested'));

-- When the citizen submits feedback on a resolved report, move it to "citizen_feedback"
-- and record the step in the timeline (runs with definer rights; citizens cannot edit reports directly).
CREATE OR REPLACE FUNCTION public.advance_on_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur text;
BEGIN
  SELECT status INTO cur FROM public.reports WHERE id = NEW.report_id;
  IF cur = 'resolved' THEN
    UPDATE public.reports SET status = 'citizen_feedback', updated_at = now() WHERE id = NEW.report_id;
    INSERT INTO public.report_updates (report_id, updated_by, updated_by_name, old_status, new_status, remark)
    VALUES (NEW.report_id, NEW.citizen_id, 'Citizen', 'resolved', 'citizen_feedback',
            'Citizen feedback: ' || COALESCE(NEW.rating::text, '-') || '/5');
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.advance_on_feedback() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS feedback_advance_status ON public.feedback;
CREATE TRIGGER feedback_advance_status AFTER INSERT ON public.feedback
FOR EACH ROW EXECUTE FUNCTION public.advance_on_feedback();

-- Realtime for citizen tracking (ignore if already added)
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
