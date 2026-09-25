
CREATE POLICY "report media upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-media');
CREATE POLICY "report media read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-media');
CREATE POLICY "report media owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-media' AND owner = auth.uid());
