-- Restrict CV reads to staff only
DROP POLICY IF EXISTS "Authenticated can read CVs" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read CVs" ON storage.objects;

CREATE POLICY "Staff can read CVs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'cvs' AND public.is_staff(auth.uid()));