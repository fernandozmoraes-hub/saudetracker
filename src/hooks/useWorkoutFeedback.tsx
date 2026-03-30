import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface WorkoutFeedback {
  id: string;
  workout_id: string;
  coach_id: string;
  athlete_id: string;
  text: string;
  created_at: string;
  coach_name?: string;
}

/** Coach side: feedback para um atleta específico */
export function useWorkoutFeedback(athleteId?: string) {
  const { user } = useAuth();
  const [feedbackByWorkout, setFeedbackByWorkout] = useState<Map<string, WorkoutFeedback[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const fetchFeedback = useCallback(async () => {
    if (!user || !athleteId) return;
    setIsLoading(true);

    const { data, error } = await supabase
      .from('workout_feedback')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('coach_id', user.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const map = new Map<string, WorkoutFeedback[]>();
      for (const fb of data as WorkoutFeedback[]) {
        const existing = map.get(fb.workout_id) ?? [];
        map.set(fb.workout_id, [...existing, fb]);
      }
      setFeedbackByWorkout(map);
    }
    setIsLoading(false);
  }, [user, athleteId]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  const addFeedback = async (workoutId: string, text: string): Promise<string | null> => {
    if (!user || !athleteId) return 'Usuário não autenticado.';
    if (!text.trim()) return 'Escreva um feedback.';

    const { error } = await supabase
      .from('workout_feedback')
      .insert({ workout_id: workoutId, coach_id: user.id, athlete_id: athleteId, text: text.trim() } as any);

    if (error) { console.error(error); return 'Erro ao salvar feedback.'; }
    await fetchFeedback();
    return null;
  };

  const deleteFeedback = async (id: string): Promise<string | null> => {
    if (!user) return 'Usuário não autenticado.';
    const { error } = await supabase.from('workout_feedback').delete().eq('id', id).eq('coach_id', user.id);
    if (error) { console.error(error); return 'Erro ao remover feedback.'; }
    await fetchFeedback();
    return null;
  };

  return { feedbackByWorkout, isLoading, addFeedback, deleteFeedback, refresh: fetchFeedback };
}

/** Athlete side: todo feedback recebido */
export function useAthleteFeedback() {
  const { user } = useAuth();
  const [feedbackByWorkout, setFeedbackByWorkout] = useState<Map<string, WorkoutFeedback[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }

    const fetch = async () => {
      const { data, error } = await supabase
        .from('workout_feedback')
        .select('*')
        .eq('athlete_id', user.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const map = new Map<string, WorkoutFeedback[]>();
        for (const fb of data as WorkoutFeedback[]) {
          const existing = map.get(fb.workout_id) ?? [];
          map.set(fb.workout_id, [...existing, fb]);
        }
        setFeedbackByWorkout(map);
      }
      setIsLoading(false);
    };
    fetch();
  }, [user]);

  return { feedbackByWorkout, isLoading };
}
