import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PendingInvite {
  id: string;
  coach_id: string;
  status: string;
  created_at: string;
  coach_name?: string;
  coach_email?: string;
}

export function usePendingInvites() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    if (!user) {
      setInvites([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('coach_athletes')
        .select('*')
        .eq('athlete_id', user.id)
        .eq('status', 'pending');

      if (fetchError) throw fetchError;

      const relations = (data as any[]) || [];

      if (relations.length > 0) {
        const coachIds = relations.map((r) => r.coach_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', coachIds);

        const profileMap = new Map(
          (profiles || []).map((p: any) => [p.user_id, p])
        );

        const enriched: PendingInvite[] = relations.map((r) => {
          const profile = profileMap.get(r.coach_id) as any;
          return {
            id: r.id,
            coach_id: r.coach_id,
            status: r.status,
            created_at: r.created_at,
            coach_name: profile?.display_name ?? undefined,
            coach_email: profile?.email ?? undefined,
          };
        });

        setInvites(enriched);
      } else {
        setInvites([]);
      }
    } catch (err: any) {
      console.error('Error fetching invites:', err);
      setError('Não foi possível carregar os convites.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  /** Aceita convite → muda status para 'active' */
  const acceptInvite = async (inviteId: string): Promise<string | null> => {
    const { error: updateError } = await supabase
      .from('coach_athletes')
      .update({ status: 'active' } as any)
      .eq('id', inviteId)
      .eq('athlete_id', user?.id);

    if (updateError) {
      console.error('Error accepting invite:', updateError);
      return 'Erro ao aceitar convite. Tente novamente.';
    }

    await fetchInvites();
    return null;
  };

  /** Recusa convite → remove o registro */
  const rejectInvite = async (inviteId: string): Promise<string | null> => {
    const { error: deleteError } = await supabase
      .from('coach_athletes')
      .delete()
      .eq('id', inviteId)
      .eq('athlete_id', user?.id);

    if (deleteError) {
      console.error('Error rejecting invite:', deleteError);
      return 'Erro ao recusar convite. Tente novamente.';
    }

    await fetchInvites();
    return null;
  };

  return {
    invites,
    isLoading,
    error,
    acceptInvite,
    rejectInvite,
    refresh: fetchInvites,
  };
}
