-- PROPOSED ONLY: run manually after the partner mapping and innovation phase migrations.
-- Manual government verification only. No external UGC/AICTE/API validation is performed.

BEGIN;

CREATE TABLE IF NOT EXISTS public.innovation_partner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.innovation_partners(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, partner_id)
);

CREATE TABLE IF NOT EXISTS public.innovation_partner_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL UNIQUE REFERENCES public.innovation_partners(id) ON DELETE CASCADE,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','verification_pending','verified','verification_rejected','inactive')),
  verification_source_type text NOT NULL DEFAULT 'Demo Record'
    CHECK (verification_source_type IN ('Demo Record','UGC Reference','AICTE Reference','Manual Document Review')),
  verification_reference_url text,
  verification_reference_id text,
  verification_note text,
  verified_at timestamptz,
  verified_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  eligibility_to_invite boolean NOT NULL DEFAULT false,
  demo_note text NOT NULL DEFAULT 'Demo Verification Data — Official verification required before production use.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.innovation_partner_verification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.innovation_partners(id) ON DELETE CASCADE,
  verification_status text NOT NULL,
  verification_source_type text NOT NULL,
  verification_reference_id text,
  verification_note text,
  verified_at timestamptz,
  verified_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  eligibility_to_invite boolean NOT NULL DEFAULT false,
  demo_note text NOT NULL DEFAULT 'Demo Verification Data — Official verification required before production use.',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.innovation_challenge_partners
  ADD COLUMN IF NOT EXISTS university_role text,
  ADD COLUMN IF NOT EXISTS expected_contribution text,
  ADD COLUMN IF NOT EXISTS target_date date,
  ADD COLUMN IF NOT EXISTS non_sensitive_scope text;

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.innovation_challenge_partners'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%invitation_status%'
  LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.innovation_challenge_partners DROP CONSTRAINT %I', constraint_name);
  END IF;
  ALTER TABLE public.innovation_challenge_partners
    ADD CONSTRAINT innovation_challenge_partners_invitation_status_check
    CHECK (invitation_status IN ('none','not_invited','shortlisted','sent','invited','accepted','active_team','declined','withdrawn'));
END $$;

REVOKE ALL ON public.innovation_partner_verifications, public.innovation_partner_verification_history FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.innovation_partner_verifications TO authenticated;
GRANT SELECT ON public.innovation_partner_verification_history TO authenticated;
GRANT ALL ON public.innovation_partner_verifications, public.innovation_partner_verification_history TO service_role;
ALTER TABLE public.innovation_partner_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovation_partner_verification_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "university verification staff read" ON public.innovation_partner_verifications;
CREATE POLICY "university verification staff read" ON public.innovation_partner_verifications
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "university verification partner self read" ON public.innovation_partner_verifications;
CREATE POLICY "university verification partner self read" ON public.innovation_partner_verifications
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.innovation_partner_profiles pp
      WHERE pp.profile_id = auth.uid() AND pp.partner_id = innovation_partner_verifications.partner_id AND pp.active
    )
  );
DROP POLICY IF EXISTS "university verification staff write" ON public.innovation_partner_verifications;
CREATE POLICY "university verification staff write" ON public.innovation_partner_verifications
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "university verification history staff" ON public.innovation_partner_verification_history;
CREATE POLICY "university verification history staff" ON public.innovation_partner_verification_history
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_university_verification(
  _partner_id uuid,
  _status text,
  _source_type text,
  _reference_url text,
  _reference_id text,
  _note text,
  _eligible boolean
)
RETURNS public.innovation_partner_verifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result public.innovation_partner_verifications;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only authorized government staff can verify universities'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.innovation_partners WHERE id = _partner_id AND partner_kind = 'university') THEN
    RAISE EXCEPTION 'Verification applies only to university partners';
  END IF;
  IF _status = 'verified' AND NOT _eligible THEN
    RAISE EXCEPTION 'A verified university must be explicitly eligible to invite';
  END IF;
  INSERT INTO public.innovation_partner_verification_history
    (partner_id, verification_status, verification_source_type, verification_reference_id, verification_note, verified_at, verified_by_profile_id, eligibility_to_invite)
  SELECT _partner_id, _status, _source_type, _reference_id, _note,
    CASE WHEN _status = 'verified' THEN now() ELSE NULL END, auth.uid(), _eligible;
  INSERT INTO public.innovation_partner_verifications
    (partner_id, verification_status, verification_source_type, verification_reference_url, verification_reference_id, verification_note, verified_at, verified_by_profile_id, eligibility_to_invite)
  VALUES (_partner_id, _status, _source_type, _reference_url, _reference_id, _note,
    CASE WHEN _status = 'verified' THEN now() ELSE NULL END, auth.uid(), _eligible)
  ON CONFLICT (partner_id) DO UPDATE SET
    verification_status = EXCLUDED.verification_status,
    verification_source_type = EXCLUDED.verification_source_type,
    verification_reference_url = EXCLUDED.verification_reference_url,
    verification_reference_id = EXCLUDED.verification_reference_id,
    verification_note = EXCLUDED.verification_note,
    verified_at = EXCLUDED.verified_at,
    verified_by_profile_id = EXCLUDED.verified_by_profile_id,
    eligibility_to_invite = EXCLUDED.eligibility_to_invite,
    updated_at = now();
  SELECT * INTO result FROM public.innovation_partner_verifications WHERE partner_id = _partner_id;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.set_university_verification(uuid,text,text,text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_university_verification(uuid,text,text,text,text,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_university_invitation(
  _challenge_id uuid,
  _partner_id uuid,
  _university_role text,
  _expected_contribution text,
  _target_date date,
  _scope text
)
RETURNS public.innovation_challenge_partners
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result public.innovation_challenge_partners;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only government staff can send invitations'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.innovation_partner_verifications v JOIN public.innovation_partners p ON p.id = v.partner_id WHERE v.partner_id = _partner_id AND p.partner_kind = 'university' AND p.active_status AND v.verification_status = 'verified' AND v.eligibility_to_invite) THEN
    RAISE EXCEPTION 'University is not verified and eligible for invitation';
  END IF;
  INSERT INTO public.innovation_challenge_partners
    (challenge_id, partner_id, group_key, shortlisted, selected_role, invitation_status, university_role, expected_contribution, target_date, non_sensitive_scope, updated_at)
  VALUES (_challenge_id, _partner_id, 'university', true, 'lead_university', 'invited', _university_role, _expected_contribution, _target_date, _scope, now())
  ON CONFLICT (challenge_id, partner_id) DO UPDATE SET
    shortlisted = true,
    invitation_status = 'invited',
    university_role = EXCLUDED.university_role,
    expected_contribution = EXCLUDED.expected_contribution,
    target_date = EXCLUDED.target_date,
    non_sensitive_scope = EXCLUDED.non_sensitive_scope,
    updated_at = now();
  SELECT * INTO result FROM public.innovation_challenge_partners WHERE challenge_id = _challenge_id AND partner_id = _partner_id;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.send_university_invitation(uuid,uuid,text,text,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_university_invitation(uuid,uuid,text,text,date,text) TO authenticated;

-- Fictional demo verification records only. They do not verify real institutions.
INSERT INTO public.innovation_partner_verifications
  (partner_id, verification_status, verification_source_type, verification_reference_id, verification_note, verified_at, eligibility_to_invite, demo_note)
SELECT p.id, x.status, 'Demo Record', x.reference_id, x.note,
  CASE WHEN x.status = 'verified' THEN now() ELSE NULL END, x.eligible,
  'Demo Verification Data — Official verification required before production use.'
FROM (VALUES
  ('Central City Institute of Technology','verified','DEMO-UGC-CCIT-2026','Fictional demo verification record.',true),
  ('Regional Engineering College','verified','DEMO-AICTE-REC-2026','Fictional demo verification record.',true),
  ('Digital Innovation University','verification_pending','DEMO-VERIFY-DIU-2026','Institution profile review pending.',false)
) AS x(partner_name,status,reference_id,note,eligible)
JOIN public.innovation_partners p ON p.name = x.partner_name AND p.partner_kind = 'university'
ON CONFLICT (partner_id) DO UPDATE SET
  verification_status = EXCLUDED.verification_status,
  verification_source_type = EXCLUDED.verification_source_type,
  verification_reference_id = EXCLUDED.verification_reference_id,
  verification_note = EXCLUDED.verification_note,
  verified_at = EXCLUDED.verified_at,
  eligibility_to_invite = EXCLUDED.eligibility_to_invite,
  demo_note = EXCLUDED.demo_note,
  updated_at = now();

COMMIT;
