-- Feature 8: Feedback de coach em treinos
CREATE TABLE public.workout_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages own feedback" ON public.workout_feedback
  FOR ALL TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Athlete reads own feedback" ON public.workout_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = athlete_id);

CREATE INDEX idx_workout_feedback_workout_id ON public.workout_feedback(workout_id);
CREATE INDEX idx_workout_feedback_athlete_id ON public.workout_feedback(athlete_id);

-- Feature 11: Mensagens entre coach e atleta
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

CREATE POLICY "Participants can send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (auth.uid() = coach_id OR auth.uid() = athlete_id)
  );

CREATE POLICY "Recipient can mark as read" ON public.messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = coach_id OR auth.uid() = athlete_id)
  WITH CHECK (true);

CREATE INDEX idx_messages_coach_athlete ON public.messages(coach_id, athlete_id, created_at DESC);