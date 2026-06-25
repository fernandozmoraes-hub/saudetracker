import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type CoachEntryType = 'chat' | 'weekly_report';

export interface CoachHistoryEntry {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  intent_detected: string;
  data_sections_used: string[];
  tags: string[];
  favorite: boolean;
  created_at: string;
  entry_type: CoachEntryType;
  report_period_start: string | null;
  report_period_end: string | null;
}

interface SaveInput {
  question: string;
  answer: string;
  intent: string;
  sections: string[];
  tags: string[];
  entryType?: CoachEntryType;
  reportPeriodStart?: string;
  reportPeriodEnd?: string;
}

export function usePerformanceCoachHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<CoachHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('performance_coach_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('history fetch error', error);
    } else {
      setEntries((data ?? []) as CoachHistoryEntry[]);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const save = useCallback(
    async (input: SaveInput) => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('performance_coach_history')
        .insert({
          user_id: user.id,
          question: input.question,
          answer: input.answer,
          intent_detected: input.intent,
          data_sections_used: input.sections,
          tags: input.tags,
        })
        .select()
        .single();
      if (error) {
        console.error('history save error', error);
        return null;
      }
      const entry = data as CoachHistoryEntry;
      setEntries(prev => [entry, ...prev]);
      return entry;
    },
    [user]
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const target = entries.find(e => e.id === id);
      if (!target) return;
      const next = !target.favorite;
      setEntries(prev => prev.map(e => (e.id === id ? { ...e, favorite: next } : e)));
      const { error } = await supabase
        .from('performance_coach_history')
        .update({ favorite: next })
        .eq('id', id);
      if (error) {
        setEntries(prev => prev.map(e => (e.id === id ? { ...e, favorite: !next } : e)));
        toast({ title: 'Erro ao favoritar', variant: 'destructive' });
      }
    },
    [entries, toast]
  );

  const remove = useCallback(
    async (id: string) => {
      const prev = entries;
      setEntries(p => p.filter(e => e.id !== id));
      const { error } = await supabase
        .from('performance_coach_history')
        .delete()
        .eq('id', id);
      if (error) {
        setEntries(prev);
        toast({ title: 'Erro ao excluir', variant: 'destructive' });
      }
    },
    [entries, toast]
  );

  return { entries, isLoading, save, toggleFavorite, remove, refresh: fetchEntries };
}
