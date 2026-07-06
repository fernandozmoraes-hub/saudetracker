CREATE TABLE public.workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  planned_duration_min numeric,
  planned_zone text,
  planned_tss numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage their own templates" ON public.workout_templates
  FOR ALL TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE INDEX idx_workout_templates_coach_id ON public.workout_templates(coach_id);