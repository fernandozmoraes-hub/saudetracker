CREATE POLICY "Athletes can update their training plans"
ON public.training_plans
FOR UPDATE TO authenticated
USING (auth.uid() = athlete_id)
WITH CHECK (auth.uid() = athlete_id);