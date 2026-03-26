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

  const fetchPlans = useCallback(async () => {
    if (!user) {
      setPlans([]);
      setIsLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('training_plans')
        .select('*')
        .order('date', { ascending: false });

      if (athleteId) {
        query = query.eq('athlete_id', athleteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPlans((data as unknown as TrainingPlan[]) || []);
    } catch (err) {
      console.error('Error fetching training plans:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, athleteId]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const createPlan = async (plan: Omit<TrainingPlan, 'id' | 'created_at'>): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('training_plans')
      .insert(plan as any);

    if (error) {
      console.error('Error creating training plan:', error);
      return false;
    }

    await fetchPlans();
    return true;
  };

  const updatePlan = async (id: string, updates: Partial<TrainingPlan>): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('training_plans')
      .update(updates as any)
      .eq('id', id);

    if (error) {
      console.error('Error updating training plan:', error);
      return false;
    }

    await fetchPlans();
    return true;
  };

  const deletePlan = async (id: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('training_plans')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting training plan:', error);
      return false;
    }

    await fetchPlans();
    return true;
  };

  return {
    plans,
    isLoading,
    createPlan,
    updatePlan,
    deletePlan,
    refresh: fetchPlans,
  };
}
