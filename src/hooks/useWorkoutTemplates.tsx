import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface WorkoutTemplate {
  id: string;
  coach_id: string;
  name: string;
  type: string;
  planned_duration_min: number | null;
  planned_zone: string | null;
  planned_tss: number | null;
  notes: string | null;
  created_at: string;
}

export function useWorkoutTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }

    const { data, error } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching templates:', error);
    setTemplates((data as WorkoutTemplate[]) || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const createTemplate = async (
    template: Omit<WorkoutTemplate, 'id' | 'coach_id' | 'created_at'>,
  ): Promise<string | null> => {
    if (!user) return 'Usuário não autenticado.';

    const { error } = await supabase
      .from('workout_templates')
      .insert({ ...template, coach_id: user.id } as any);

    if (error) {
      console.error('Error creating template:', error);
      return 'Erro ao salvar template. Tente novamente.';
    }

    await fetchTemplates();
    return null;
  };

  const deleteTemplate = async (id: string): Promise<string | null> => {
    if (!user) return 'Usuário não autenticado.';

    const { error } = await supabase
      .from('workout_templates')
      .delete()
      .eq('id', id)
      .eq('coach_id', user.id);

    if (error) {
      console.error('Error deleting template:', error);
      return 'Erro ao remover template.';
    }

    await fetchTemplates();
    return null;
  };

  return { templates, isLoading, createTemplate, deleteTemplate };
}
