-- Run once in your Supabase SQL editor.
-- Multiple images + optional video per report. Reuses public.report_media (one row per file)
-- and the private 'report-media' bucket. Table RLS unchanged; only storage policies tightened.

-- 1) Uploads: only into the uploader's own folder (<uid>/<report_id>/...).
DROP POLICY IF EXISTS "report media upload" ON storage.objects;
CREATE POLICY "report media upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2) Reads: the uploader, or anyone allowed to read the linked report (citizen owner,
--    staff/officers, partners for innovation reports) via existing can_read_report().
DROP POLICY IF EXISTS "report media read" ON storage.objects;
CREATE POLICY "report media read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'report-media'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.report_media m
        WHERE m.file_url = storage.objects.name AND public.can_read_report(m.report_id)
      )
    )
  );

-- 3) Allow files up to 20 MB (video) and only the accepted types.
UPDATE storage.buckets
SET file_size_limit = 20971520,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp',
                               'video/mp4','video/quicktime','video/webm','application/pdf']
WHERE id = 'report-media';
