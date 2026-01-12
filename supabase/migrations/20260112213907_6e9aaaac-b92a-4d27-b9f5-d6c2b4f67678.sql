-- Create workout_evaluations table
CREATE TABLE public.workout_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  
  -- Dados extras do formulário
  feeling_after TEXT,
  pain_discomfort TEXT,
  observations TEXT,
  max_hr INTEGER,
  
  -- Resposta do agente (4 blocos)
  summary_technical TEXT,
  efficiency_quality TEXT,
  risks_redflags TEXT,
  general_suggestions TEXT,
  
  -- Perguntas adicionais (JSON array)
  follow_up_qa JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.workout_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own evaluations"
  ON public.workout_evaluations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own evaluations"
  ON public.workout_evaluations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own evaluations"
  ON public.workout_evaluations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evaluations"
  ON public.workout_evaluations FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_workout_evaluations_updated_at
  BEFORE UPDATE ON public.workout_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_workout_evaluations_user_id ON public.workout_evaluations(user_id);
CREATE INDEX idx_workout_evaluations_workout_id ON public.workout_evaluations(workout_id);