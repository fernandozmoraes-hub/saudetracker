-- Tighten the UPDATE policy: only the non-sender can mark as read
DROP POLICY "Recipient can mark as read" ON public.messages;

CREATE POLICY "Recipient can mark as read" ON public.messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = coach_id OR auth.uid() = athlete_id)
  WITH CHECK (auth.uid() = coach_id OR auth.uid() = athlete_id);