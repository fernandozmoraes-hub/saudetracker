import { useState, useEffect, useCallback } from 'react';
import { AlcoholIntakeEntry } from '@/types/health';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { format, subDays } from 'date-fns';
import { calculateAlcoholGrams, getDailyTotal } from '@/lib/alcoholCalcs';
import { toast } from 'sonner';

export function useAlcoholIntake() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AlcoholIntakeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!user) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('alcohol_intake' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      const mapped: AlcoholIntakeEntry[] = (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        date: row.date,
        time: row.time ?? undefined,
        drinkType: row.drink_type,
        volumeMl: Number(row.volume_ml),
        numDrinks: row.num_drinks,
        abvPercent: Number(row.abv_percent),
        alcoholGrams: Number(row.alcohol_grams),
        notes: row.notes ?? undefined,
      }));
      setEntries(mapped);
    } catch (error) {
      console.error('Error fetching alcohol intake:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const saveEntry = async (entry: Omit<AlcoholIntakeEntry, 'id' | 'userId'>): Promise<boolean> => {
    if (!user) return false;

    const alcoholGrams = calculateAlcoholGrams(entry.volumeMl, entry.numDrinks, entry.abvPercent);

    const { error } = await supabase
      .from('alcohol_intake' as any)
      .insert({
        user_id: user.id,
        date: entry.date,
        time: entry.time ?? null,
        drink_type: entry.drinkType,
        volume_ml: entry.volumeMl,
        num_drinks: entry.numDrinks,
        abv_percent: entry.abvPercent,
        alcohol_grams: alcoholGrams,
        notes: entry.notes ?? null,
      } as any);

    if (error) {
      console.error('Error saving alcohol intake:', error);
      toast.error(`Falha ao salvar registro: ${error.message}`);
      return false;
    }

    await fetchEntries();
    return true;
  };

  const deleteEntry = async (id: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('alcohol_intake' as any)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting alcohol intake:', error);
      return false;
    }

    await fetchEntries();
    return true;
  };

  const getDailyEntries = (date: string) => entries.filter(e => e.date === date);

  const getDailyTotalFn = (date: string) => getDailyTotal(entries, date);

  const getYesterdayTotal = () => {
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    return getDailyTotal(entries, yesterday);
  };

  return {
    entries,
    isLoading,
    saveEntry,
    deleteEntry,
    getDailyEntries,
    getDailyTotal: getDailyTotalFn,
    getYesterdayTotal,
    refreshData: fetchEntries,
  };
}
