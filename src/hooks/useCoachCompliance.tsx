import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { TrainingPlan } from './useTrainingPlans';
import { format, subDays } from 'date-fns';

export interface ComplianceStats {
  total: number;
  completed: number;
  skipped: number;
  missed: number;
  rate: number;
  consecutiveMissed: number;
}

export function computeCompliance(plans: TrainingPlan[]): ComplianceStats {
  const today = format(new Date(), 'yyyy-MM-dd');
  const completed = plans.filter(p => p.status === 'completed').length;
  const skipped = plans.filter(p => p.status === 'skipped').length;
  const missed = plans.filter(p => p.status === 'planned' && p.date < today).length;
  const total = completed + skipped + missed;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Count consecutive missed/skipped from most recent
  const sorted = [...plans].sort((a, b) => b.date.localeCompare(a.date));
  let consecutiveMissed = 0;
  for (const p of sorted) {
    if (p.status === 'skipped' || (p.status === 'planned' && p.date < today)) {
      consecutiveMissed++;
    } else {
      break;
    }
  }

  return { total, completed, skipped, missed, rate, consecutiveMissed };
}

export function useCoachCompliance() {
  const { user } = useAuth();
  const [complianceMap, setComplianceMap] = useState<Map<string, ComplianceStats>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      const since = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('training_plans')
        .select('*')
        .eq('coach_id', user.id)
        .gte('date', since);

      if (error) {
        console.error('Error fetching compliance data:', error);
        setIsLoading(false);
        return;
      }

      const grouped = new Map<string, TrainingPlan[]>();
      for (const plan of (data as unknown as TrainingPlan[]) || []) {
        const list = grouped.get(plan.athlete_id) || [];
        list.push(plan);
        grouped.set(plan.athlete_id, list);
      }

      const result = new Map<string, ComplianceStats>();
      grouped.forEach((plans, athleteId) => {
        result.set(athleteId, computeCompliance(plans));
      });

      setComplianceMap(result);
      setIsLoading(false);
    };

    fetch();
  }, [user]);

  return { complianceMap, isLoading };
}
