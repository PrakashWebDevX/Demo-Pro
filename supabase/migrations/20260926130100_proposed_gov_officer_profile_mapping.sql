-- PROPOSED ONLY: run manually after reviewing the connected schema.
-- No automatic demo mapping is inserted because auth.users UUIDs are deployment-specific.

ALTER TABLE public.gov_officers
  ADD COLUMN IF NOT EXISTS profile_id uuid
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gov_officers_profile_id_unique
  ON public.gov_officers(profile_id)
  WHERE profile_id IS NOT NULL;

COMMENT ON COLUMN public.gov_officers.profile_id IS
  'Optional trusted mapping to the authenticated public.profiles row. Configure manually after sign-in; never infer by name or email.';

-- Manual demo setup after signing in as officer@demo.jh:
-- 1. Find the authenticated profile UUID:
--    SELECT id FROM public.profiles WHERE email = 'officer@demo.jh';
-- 2. Find the intended directory row:
--    SELECT id, full_name FROM public.gov_officers WHERE full_name = 'Officer R. Kumar';
-- 3. Apply the mapping with the returned UUIDs:
--    UPDATE public.gov_officers
--    SET profile_id = '<authenticated-profile-uuid>'
--    WHERE id = '<gov-officer-uuid>' AND profile_id IS NULL;
