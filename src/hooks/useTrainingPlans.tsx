import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TrainingPlan {
  id: string;
  coach_id: string;
  athlete_id: string;
  date: string;
  type: string;
  planned_duration_min: number | null;
  planned_zone: string | null;
  planned_tss: number | null;
  notes: string | null;
  status: string;
  workout_id: string | null;
  created_at: string;
}

export function useTrainingPlans(athleteId?: string) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    if (!user) {
      setPlans([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      let query = supabase
        .from('training_plans')
        .select('*')
        .order('date', { ascending: false });

      if (athleteId) {
        query = query.eq('athlete_id', athleteId);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setPlans((data as unknown as TrainingPlan[]) || []);
    } catch (err) {
      console.error('Error fetching training plans:', err);
      setError('Não foi possível carregar os treinos planejados.');
    } finally {
      setIsLoading(false);
    }
  }, [user, athleteId]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  /** Retorna null em sucesso, ou mensagem de erro */
  const createPlan = async (plan: Omit<TrainingPlan, 'id' | 'created_at'>): Promise<string | null> => {
    if (!user) return 'Usuário não autenticado.';

    const { error: insertError } = await supabase
      .from('training_plans')
      .insert(plan as any);

    if (insertError) {
      console.error('Error creating training plan:', insertError);
      return 'Erro ao criar treino. Tente novamente.';
    }

    await fetchPlans();
    return null;
  };

  const updatePlan = async (id: string, updates: Partial<TrainingPlan>): Promise<string | null> => {
    if (!user) return 'Usuário não autenticado.';

    const { error: updateError } = await supabase
      .from('training_plans')
      .update(updates as any)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating training plan:', updateError);
      return 'Erro ao atualizar treino.';
    }

    await fetchPlans();
    return null;
  };

  const deletePlan = async (id: string): Promise<string | null> => {
    if (!user) return 'Usuário não autenticado.';

    const { error: deleteError } = await supabase
      .from('training_plans')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting training plan:', deleteError);
      return 'Erro ao remover treino.';
    }

    await fetchPlans();
    return null;
  };

  return {
    plans,
    isLoading,
    error,
    createPlan,
    updatePlan,
    deletePlan,
    refresh: fetchPlans,
  };
}
