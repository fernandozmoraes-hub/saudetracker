import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface CoachAthlete {
  id: string;
  coach_id: string;
  athlete_id: string;
  status: string;
  created_at: string;
  athlete_email?: string;
}

export function useCoachAthletes() {
  const { user } = useAuth();
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAthletes = useCallback(async () => {
    if (!user) {
      setAthletes([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('coach_athletes')
        .select('*')
        .eq('coach_id', user.id);

      if (error) throw error;
      setAthletes((data as CoachAthlete[]) || []);
    } catch (err) {
      console.error('Error fetching athletes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAthletes();
  }, [fetchAthletes]);

  const inviteAthlete = async (athleteEmail: string): Promise<boolean> => {
    if (!user) return false;

    // Look up user by email via a simple approach - we store email for reference
    // The athlete_id will be set when the athlete accepts
    // For now, we use a placeholder approach
    const { error } = await supabase
      .from('coach_athletes')
      .insert({
        coach_id: user.id,
        athlete_id: user.id, // placeholder - needs athlete lookup
        status: 'pending',
      } as any);

    if (error) {
      console.error('Error inviting athlete:', error);
      return false;
    }

    await fetchAthletes();
    return true;
  };

  const updateStatus = async (relationId: string, status: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('coach_athletes')
      .update({ status } as any)
      .eq('id', relationId);

    if (error) {
      console.error('Error updating status:', error);
      return false;
    }

    await fetchAthletes();
    return true;
  };

  const removeAthlete = async (relationId: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('coach_athletes')
      .delete()
      .eq('id', relationId);

    if (error) {
      console.error('Error removing athlete:', error);
      return false;
    }

    await fetchAthletes();
    return true;
  };

  return {
    athletes,
    activeAthletes: athletes.filter(a => a.status === 'active'),
    pendingAthletes: athletes.filter(a => a.status === 'pending'),
    isLoading,
    inviteAthlete,
    updateStatus,
    removeAthlete,
    refresh: fetchAthletes,
  };
}
