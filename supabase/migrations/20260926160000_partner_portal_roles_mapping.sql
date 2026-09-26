-- PROPOSED ONLY: run manually in Supabase SQL Editor after reviewing existing phase 2/3/4 SQL.
-- No auth users, passwords, emails, or fixed UUIDs are created here.

CREATE TABLE IF NOT EXISTS public.innovation_partner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.innovation_partners(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  demo_note text NOT NULL DEFAULT 'Demo Data — Verification and institutional consent required before production use.',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, partner_id)
);

CREATE INDEX IF NOT EXISTS innovation_partner_profiles_partner_idx
  ON public.innovation_partner_profiles(partner_id)
  WHERE active;

REVOKE ALL ON public.innovation_partner_profiles FROM anon, authenticated;
GRANT SELECT ON public.innovation_partner_profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.innovation_partner_profiles TO authenticated;
GRANT ALL ON public.innovation_partner_profiles TO service_role;
ALTER TABLE public.innovation_partner_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner profile staff manage" ON public.innovation_partner_profiles;
CREATE POLICY "partner profile staff manage" ON public.innovation_partner_profiles
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "partner profile self read" ON public.innovation_partner_profiles;
CREATE POLICY "partner profile self read" ON public.innovation_partner_profiles
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() AND active);

CREATE OR REPLACE FUNCTION public.is_partner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('university','partner','university_partner','industry_partner')
  );
$$;

CREATE OR REPLACE FUNCTION public.my_partner_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT partner_id
  FROM public.innovation_partner_profiles
  WHERE profile_id = _user_id AND active
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.my_partner_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_partner_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.partner_can_read_challenge(_challenge_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.innovation_partner_profiles pp
    JOIN public.innovation_challenge_partners cp ON cp.partner_id = pp.partner_id
    WHERE pp.profile_id = _user_id
      AND pp.active
      AND cp.challenge_id = _challenge_id
      AND cp.invitation_status IN ('sent','accepted','declined')
  );
$$;
REVOKE ALL ON FUNCTION public.partner_can_read_challenge(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_can_read_challenge(uuid, uuid) TO authenticated;

-- Partners see only challenges linked to their explicit organization mapping.
CREATE OR REPLACE FUNCTION public.can_read_challenge(_challenge_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(auth.uid())
    OR (public.is_partner(auth.uid()) AND public.partner_can_read_challenge(_challenge_id, auth.uid()))
    OR (NOT public.is_partner(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.innovation_challenges c
      WHERE c.id = _challenge_id AND c.is_public
    ))
    OR (NOT public.is_partner(auth.uid()) AND EXISTS (
      SELECT 1
      FROM public.innovation_challenge_reports l
      JOIN public.reports r ON r.id = l.report_id
      WHERE l.challenge_id = _challenge_id AND r.citizen_id = auth.uid()
    ));
$$;

DROP POLICY IF EXISTS "icp partner read" ON public.innovation_challenge_partners;
CREATE POLICY "icp partner read" ON public.innovation_challenge_partners
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.innovation_partner_profiles pp
      WHERE pp.profile_id = auth.uid()
        AND pp.partner_id = innovation_challenge_partners.partner_id
        AND pp.active
    )
  );

CREATE TABLE IF NOT EXISTS public.innovation_challenge_team_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.innovation_challenges(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES public.innovation_partners(id) ON DELETE SET NULL,
  role_key text NOT NULL,
  role_label text NOT NULL,
  display_name text NOT NULL,
  organization_name text,
  member_count integer,
  status text NOT NULL,
  skills text[],
  role_details text,
  task_list text,
  progress_pct integer,
  public_summary text,
  demo_disclaimer text NOT NULL DEFAULT 'Demo Data — Verification and institutional consent required before production use.',
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, role_key)
);

CREATE TABLE IF NOT EXISTS public.innovation_challenge_partner_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.innovation_challenges(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.innovation_partners(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  demo_disclaimer text NOT NULL DEFAULT 'Demo Data — Verification and institutional consent required before production use.',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, partner_id, status)
);

REVOKE ALL ON public.innovation_challenge_team_roles, public.innovation_challenge_partner_status_history FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.innovation_challenge_team_roles, public.innovation_challenge_partner_status_history TO authenticated;
GRANT ALL ON public.innovation_challenge_team_roles, public.innovation_challenge_partner_status_history TO service_role;
ALTER TABLE public.innovation_challenge_team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovation_challenge_partner_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner team staff" ON public.innovation_challenge_team_roles;
CREATE POLICY "partner team staff" ON public.innovation_challenge_team_roles
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "partner status staff" ON public.innovation_challenge_partner_status_history;
CREATE POLICY "partner status staff" ON public.innovation_challenge_partner_status_history
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Add safe structured fields to the existing staff-managed team-role table when present.
ALTER TABLE IF EXISTS public.innovation_challenge_team_roles
  ADD COLUMN IF NOT EXISTS skills text[],
  ADD COLUMN IF NOT EXISTS role_details text,
  ADD COLUMN IF NOT EXISTS task_list text,
  ADD COLUMN IF NOT EXISTS progress_pct integer CHECK (progress_pct IS NULL OR progress_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS public_summary text;

DROP POLICY IF EXISTS "ecosystem team partner read" ON public.innovation_challenge_team_roles;
CREATE POLICY "ecosystem team partner read" ON public.innovation_challenge_team_roles
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.innovation_partner_profiles pp
      WHERE pp.profile_id = auth.uid()
        AND pp.partner_id = innovation_challenge_team_roles.partner_id
        AND pp.active
    )
  );

DROP POLICY IF EXISTS "ecosystem status partner read" ON public.innovation_challenge_partner_status_history;
CREATE POLICY "ecosystem status partner read" ON public.innovation_challenge_partner_status_history
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.innovation_partner_profiles pp
      WHERE pp.profile_id = auth.uid()
        AND pp.partner_id = innovation_challenge_partner_status_history.partner_id
        AND pp.active
    )
  );

CREATE TABLE IF NOT EXISTS public.innovation_partner_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.innovation_challenges(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.innovation_partners(id) ON DELETE CASCADE,
  submitted_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  update_type text NOT NULL CHECK (update_type IN ('clarification_request','research_update','technical_approach','prototype_update','field_pilot_update','resource_estimate','deliverable_metadata','ready_for_review')),
  title text NOT NULL,
  public_summary text,
  private_details text,
  safe_file_reference text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','accepted','needs_changes')),
  is_public boolean NOT NULL DEFAULT false,
  demo_note text NOT NULL DEFAULT 'Demo Data — Verification and institutional consent required before production use.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS innovation_partner_updates_scope_idx
  ON public.innovation_partner_updates(partner_id, challenge_id, created_at DESC);

REVOKE ALL ON public.innovation_partner_updates FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.innovation_partner_updates TO authenticated;
GRANT ALL ON public.innovation_partner_updates TO service_role;
ALTER TABLE public.innovation_partner_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner updates staff" ON public.innovation_partner_updates;
CREATE POLICY "partner updates staff" ON public.innovation_partner_updates
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "partner updates own read" ON public.innovation_partner_updates;
CREATE POLICY "partner updates own read" ON public.innovation_partner_updates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.innovation_partner_profiles pp
      WHERE pp.profile_id = auth.uid()
        AND pp.partner_id = innovation_partner_updates.partner_id
        AND pp.active
        AND public.partner_can_read_challenge(innovation_partner_updates.challenge_id, auth.uid())
    )
    AND (is_public OR submitted_by_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "partner updates own insert" ON public.innovation_partner_updates;
CREATE POLICY "partner updates own insert" ON public.innovation_partner_updates
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by_profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.innovation_partner_profiles pp
      WHERE pp.profile_id = auth.uid()
        AND pp.partner_id = innovation_partner_updates.partner_id
        AND pp.active
        AND public.partner_can_read_challenge(innovation_partner_updates.challenge_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "partner updates own update" ON public.innovation_partner_updates;
CREATE POLICY "partner updates own update" ON public.innovation_partner_updates
  FOR UPDATE TO authenticated
  USING (submitted_by_profile_id = auth.uid())
  WITH CHECK (submitted_by_profile_id = auth.uid());

CREATE OR REPLACE FUNCTION public.partner_respond_invitation_by_profile(
  _row_id uuid,
  _accepted boolean,
  _note text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  invitation public.innovation_challenge_partners%ROWTYPE;
  challenge public.innovation_challenges%ROWTYPE;
  partner_name text;
BEGIN
  SELECT cp.* INTO invitation
  FROM public.innovation_challenge_partners cp
  JOIN public.innovation_partner_profiles pp ON pp.partner_id = cp.partner_id
  WHERE cp.id = _row_id AND pp.profile_id = auth.uid() AND pp.active;

  IF invitation.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF invitation.invitation_status <> 'sent' THEN RAISE EXCEPTION 'Invitation is no longer pending'; END IF;

  SELECT * INTO challenge FROM public.innovation_challenges WHERE id = invitation.challenge_id;
  SELECT name INTO partner_name FROM public.innovation_partners WHERE id = invitation.partner_id;

  UPDATE public.innovation_challenge_partners
  SET invitation_status = CASE WHEN _accepted THEN 'accepted' ELSE 'declined' END,
      updated_at = now()
  WHERE id = invitation.id;

  INSERT INTO public.innovation_challenge_partner_status_history
    (challenge_id, partner_id, status, note)
  VALUES (
    invitation.challenge_id,
    invitation.partner_id,
    CASE WHEN _accepted THEN 'Accepted' ELSE 'Declined' END,
    COALESCE(NULLIF(_note, ''), 'Demo partner response')
  );

  INSERT INTO public.innovation_challenge_timeline
    (challenge_id, stage, title, detail, step_status, is_public, sort_order, created_by_name)
  SELECT challenge.id, challenge.stage,
    CASE WHEN _accepted THEN 'Partner invitation accepted' ELSE 'Partner invitation declined' END,
    'Partner response is staff-only.', 'completed', false,
    COALESCE(max(sort_order), 0) + 1, partner_name
  FROM public.innovation_challenge_timeline
  WHERE challenge_id = challenge.id;
END $$;
REVOKE ALL ON FUNCTION public.partner_respond_invitation_by_profile(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_respond_invitation_by_profile(uuid, boolean, text) TO authenticated;

COMMIT;

-- Manual fictional demo setup after creating the accounts through Supabase Auth:
-- 1. Create the fictional accounts manually; do not put passwords in source or SQL.
-- 2. Confirm each account's public.profiles.id after sign-in.
-- 3. Confirm the existing fictional innovation_partners.id by organization name in the SQL editor.
-- 4. Insert exactly one role and one explicit mapping per demo profile:
--    INSERT INTO public.user_roles (user_id, role) VALUES ('<profile-uuid>', 'university_partner');
--    INSERT INTO public.innovation_partner_profiles (profile_id, partner_id)
--      VALUES ('<profile-uuid>', '<central-city-institute-partner-uuid>');
--    INSERT INTO public.user_roles (user_id, role) VALUES ('<profile-uuid>', 'industry_partner');
--    INSERT INTO public.innovation_partner_profiles (profile_id, partner_id)
--      VALUES ('<profile-uuid>', '<greenroute-partner-uuid>');
