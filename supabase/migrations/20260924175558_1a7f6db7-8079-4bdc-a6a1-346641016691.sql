
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_partner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_department(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_report(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_report_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_report_defaults() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_partner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_department(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_report(uuid) TO authenticated;
