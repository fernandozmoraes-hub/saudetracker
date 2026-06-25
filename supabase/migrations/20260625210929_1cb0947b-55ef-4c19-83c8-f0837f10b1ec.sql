CREATE TABLE public.performance_coach_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  intent_detected text NOT NULL,
  data_sections_used text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_coach_history TO authenticated;
GRANT ALL ON public.performance_coach_history TO service_role;

ALTER TABLE public.performance_coach_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select_pch" ON public.performance_coach_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_insert_pch" ON public.performance_coach_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update_pch" ON public.performance_coach_history
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_delete_pch" ON public.performance_coach_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX performance_coach_history_user_created_idx
  ON public.performance_coach_history (user_id, created_at DESC);