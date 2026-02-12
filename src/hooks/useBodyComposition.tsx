import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BodyCompositionEntry, DataSource } from '@/types/health';
import { useToast } from '@/hooks/use-toast';

export function useBodyComposition() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<BodyCompositionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('body_composition')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching body composition:', error);
    } else {
      setEntries((data || []).map(mapRow));
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const mapRow = (row: any): BodyCompositionEntry => ({
    id: row.id,
    userId: row.user_id,
    date: row.date,
    weightKg: Number(row.weight_kg),
    muscleMassKg: Number(row.muscle_mass_kg),
    bodyFatPct: Number(row.body_fat_pct),
    dataSource: row.data_source as DataSource,
    notes: row.notes,
    flaggedInconsistent: row.flagged_inconsistent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const saveEntry = async (entry: Partial<BodyCompositionEntry>): Promise<boolean> => {
    if (!user) return false;
    const row = {
      user_id: user.id,
      date: entry.date,
      weight_kg: entry.weightKg,
      muscle_mass_kg: entry.muscleMassKg,
      body_fat_pct: entry.bodyFatPct,
      data_source: entry.dataSource || 'manual',
      notes: entry.notes || null,
      flagged_inconsistent: entry.flaggedInconsistent || false,
    };

    const { error } = await supabase
      .from('body_composition')
      .upsert(row, { onConflict: 'user_id,date' });

    if (error) {
      console.error('Error saving body composition:', error);
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchEntries();
    return true;
  };

  const deleteEntry = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('body_composition').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchEntries();
    return true;
  };

  const toggleInconsistent = async (id: string): Promise<boolean> => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return false;
    const { error } = await supabase
      .from('body_composition')
      .update({ flagged_inconsistent: !entry.flaggedInconsistent })
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchEntries();
    return true;
  };

  const getLatest = useMemo(() => {
    const consistent = entries.filter(e => !e.flaggedInconsistent);
    return consistent.length > 0 ? consistent[0] : null;
  }, [entries]);

  const getFilteredEntries = useCallback((days: number) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return entries.filter(e => !e.flaggedInconsistent && e.date >= cutoffStr)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [entries]);

  return {
    entries,
    isLoading,
    saveEntry,
    deleteEntry,
    toggleInconsistent,
    getLatest,
    getFilteredEntries,
    refreshEntries: fetchEntries,
  };
}
