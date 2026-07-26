INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.cv_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  ats_score integer,
  strengths text[] NOT NULL DEFAULT '{}',
  weaknesses text[] NOT NULL DEFAULT '{}',
  missing_skills text[] NOT NULL DEFAULT '{}',
  improvement_tips text[] NOT NULL DEFAULT '{}',
  track_fit boolean,
  track_fit_reason text,
  summary text,
  raw_response jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_attempted_at timestamptz
);

ALTER TABLE public.cv_analyses ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.cv_analyses TO authenticated;
GRANT ALL ON public.cv_analyses TO service_role;

CREATE POLICY "Staff can view cv analyses"
  ON public.cv_analyses FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Service role can manage cv analyses"
  ON public.cv_analyses FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_cv_analyses_updated
  BEFORE UPDATE ON public.cv_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.cv_analyses;
