import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { format, subDays } from 'date-fns';
import { TrainingPlan } from './useTrainingPlans';

export interface ComplianceStats {
  total: number;        // planos no passado (últimos 30 dias)
  completed: number;    // status = 'completed'
  skipped: number;      // status = 'skipped'
  missed: number;       // status = 'planned' + data no passado
  rate: number | null;  // % de adesão (completed / total * 100)
  consecutiveMissed: number; // quantos planos seguidos foram ignorados/pulados
}

export function computeCompliance(plans: TrainingPlan[]): ComplianceStats {
  const today = format(new Date(), 'yyyy-MM-dd');
  const last30 = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const pastPlans = plans.filter((p) => p.date <= today && p.date >= last30);
  const completed = pastPlans.filter((p) => p.status === 'completed').length;
  const skipped = pastPlans.filter((p) => p.status === 'skipped').length;
  const missed = pastPlans.filter((p) => p.status === 'planned' && p.date < today).length;
  const total = completed + skipped + missed;
  const rate = total > 0 ? Math.round((completed / total) * 100) : null;

  // Conta quantos planos consecutivos (do mais recente para o mais antigo) foram
  // ignorados ou pulados — indica que o atleta parou de seguir o plano
  const sortedDesc = [...pastPlans]
    .filter((p) => p.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  let consecutiveMissed = 0;
  for (const plan of sortedDesc) {
    if (plan.status === 'skipped' || (plan.status === 'planned' && plan.date < today)) {
      consecutiveMissed++;
    } else {
      break;
    }
  }

  return { total, completed, skipped, missed, rate, consecutiveMissed };
}

export function useCoachCompliance() {
  const { user } = useAuth();
  const [plansByAthlete, setPlansByAthlete] = useState<Map<string, TrainingPlan[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }

    const last30 = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('training_plans')
      .select('*')
      .eq('coach_id', user.id)
      .gte('date', last30)
      .lte('date', today)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching compliance data:', error);
      setIsLoading(false);
      return;
    }

    const map = new Map<string, TrainingPlan[]>();
    for (const plan of (data as unknown as TrainingPlan[]) || []) {
      const existing = map.get(plan.athlete_id) ?? [];
      map.set(plan.athlete_id, [...existing, plan]);
    }
    setPlansByAthlete(map);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const getAthleteCompliance = (athleteId: string): ComplianceStats => {
    return computeCompliance(plansByAthlete.get(athleteId) ?? []);
  };

  return { getAthleteCompliance, isLoading };
}
