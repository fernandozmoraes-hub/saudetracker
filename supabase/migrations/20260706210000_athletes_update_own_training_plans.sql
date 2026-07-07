-- Permite ao atleta atualizar seus próprios treinos planejados
-- (necessário para o botão "marcar como concluído" no app;
-- o webhook do Strava usa service role e não depende desta policy)
CREATE POLICY "Athletes can update their training plans"
ON public.training_plans
FOR UPDATE TO authenticated
USING (auth.uid() = athlete_id)
WITH CHECK (auth.uid() = athlete_id);
