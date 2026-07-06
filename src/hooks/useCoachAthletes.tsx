import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CoachAthlete {
  id: string;
  coach_id: string;
  athlete_id: string;
  status: string;
  created_at: string;
  athlete_name?: string;
  athlete_email?: string;
}

export function useCoachAthletes() {
  const { user } = useAuth();
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAthletes = useCallback(async () => {
    if (!user) {
      setAthletes([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('coach_athletes')
        .select('*')
        .eq('coach_id', user.id);

      if (fetchError) throw fetchError;

      const relations = (data as CoachAthlete[]) || [];

      // Enrich with athlete profile (name + email)
      if (relations.length > 0) {
        const athleteIds = relations.map((r) => r.athlete_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, email')
          .in('user_id', athleteIds);

        const profileMap = new Map(
          (profiles || []).map((p: any) => [p.user_id, p])
        );

        const enriched = relations.map((r) => {
          const profile = profileMap.get(r.athlete_id) as any;
          return {
            ...r,
            athlete_name: profile?.display_name ?? undefined,
            athlete_email: profile?.email ?? undefined,
          };
        });

        setAthletes(enriched);
      } else {
        setAthletes([]);
      }
    } catch (err: any) {
      console.error('Error fetching athletes:', err);
      setError('Não foi possível carregar os atletas.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAthletes();
  }, [fetchAthletes]);

  /**
   * Convida atleta pelo email.
   * Retorna null em caso de sucesso, ou uma mensagem de erro string.
   */
  const inviteAthlete = async (athleteEmail: string): Promise<string | null> => {
    if (!user) return 'Usuário não autenticado.';

    const email = athleteEmail.trim().toLowerCase();
    if (!email) return 'Informe o email do atleta.';

    // Busca o atleta pelo email na tabela de profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      console.error('Error looking up athlete:', profileError);
      return 'Erro ao buscar atleta. Tente novamente.';
    }

    if (!profileData) {
      return 'Atleta não encontrado. Solicite que ele crie uma conta no app primeiro.';
    }

    const athleteId = (profileData as any).user_id;

    if (athleteId === user.id) {
      return 'Você não pode se convidar.';
    }

    // Verifica se já existe relação
    const { data: existing } = await supabase
      .from('coach_athletes')
      .select('id, status')
      .eq('coach_id', user.id)
      .eq('athlete_id', athleteId)
      .maybeSingle();

    if (existing) {
      const status = (existing as any).status;
      if (status === 'active') return 'Este atleta já está ativo na sua equipe.';
      if (status === 'pending') return 'Já existe um convite pendente para este atleta.';
    }

    const { error: insertError } = await supabase
      .from('coach_athletes')
      .insert({
        coach_id: user.id,
        athlete_id: athleteId,
        status: 'pending',
      } as any);

    if (insertError) {
      console.error('Error inviting athlete:', insertError);
      return 'Erro ao enviar convite. Tente novamente.';
    }

    await fetchAthletes();
    return null;
  };

  const updateStatus = async (relationId: string, status: string): Promise<string | null> => {
    if (!user) return 'Usuário não autenticado.';

    const { error: updateError } = await supabase
      .from('coach_athletes')
      .update({ status } as any)
      .eq('id', relationId);

    if (updateError) {
      console.error('Error updating status:', updateError);
      return 'Erro ao atualizar status do atleta.';
    }

    await fetchAthletes();
    return null;
  };

  const removeAthlete = async (relationId: string): Promise<string | null> => {
    if (!user) return 'Usuário não autenticado.';

    const { error: deleteError } = await supabase
      .from('coach_athletes')
      .delete()
      .eq('id', relationId);

    if (deleteError) {
      console.error('Error removing athlete:', deleteError);
      return 'Erro ao remover atleta.';
    }

    await fetchAthletes();
    return null;
  };

  return {
    athletes,
    activeAthletes: athletes.filter((a) => a.status === 'active'),
    pendingAthletes: athletes.filter((a) => a.status === 'pending'),
    isLoading,
    error,
    inviteAthlete,
    updateStatus,
    removeAthlete,
    refresh: fetchAthletes,
  };
}
