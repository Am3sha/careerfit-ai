ALTER TABLE public.cv_analyses
  ADD COLUMN IF NOT EXISTS recommended_tracks jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS best_track text,
  ADD COLUMN IF NOT EXISTS ai_agrees_with_selection boolean,
  ADD COLUMN IF NOT EXISTS disagreement_reason text;
