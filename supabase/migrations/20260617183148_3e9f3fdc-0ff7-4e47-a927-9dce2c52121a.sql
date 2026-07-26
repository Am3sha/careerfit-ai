
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'ops', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','ops')
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Projects
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_projects_updated
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Placements
CREATE TABLE public.placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'assigned',
  notes text,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (applicant_id, project_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.placements TO authenticated;
GRANT ALL ON public.placements TO service_role;

ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view placements"
  ON public.placements FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert placements"
  ON public.placements FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update placements"
  ON public.placements FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can delete placements"
  ON public.placements FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_placements_updated
  BEFORE UPDATE ON public.placements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_placements_project ON public.placements(project_id);
CREATE INDEX idx_placements_applicant ON public.placements(applicant_id);

-- Tighten applicants SELECT to staff only (was: all authenticated)
DROP POLICY IF EXISTS "Authenticated users can view applicants" ON public.applicants;
CREATE POLICY "Staff can view applicants"
  ON public.applicants FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
