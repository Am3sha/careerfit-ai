
CREATE POLICY "Anyone can upload CV"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'cvs');

CREATE POLICY "Authenticated can read CVs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'cvs');
