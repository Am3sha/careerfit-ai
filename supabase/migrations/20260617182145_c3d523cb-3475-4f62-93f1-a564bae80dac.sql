
CREATE TABLE public.applicants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  track TEXT NOT NULL,
  years_experience TEXT NOT NULL,
  why_this_track TEXT NOT NULL,
  challenges TEXT,
  previous_experience TEXT,
  linkedin_url TEXT,
  cv_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.applicants TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.applicants TO authenticated;
GRANT ALL ON public.applicants TO service_role;

ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an application
CREATE POLICY "Anyone can submit application"
ON public.applicants FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only authenticated staff can read submissions
CREATE POLICY "Authenticated users can view applicants"
ON public.applicants FOR SELECT
TO authenticated
USING (true);
