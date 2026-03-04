import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { DailyCheck, Workout } from '@/types/health';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface DataContextType {
  dailyChecks: DailyCheck[];
  workouts: Workout[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  saveDailyCheck: (check: DailyCheck) => Promise<boolean>;
  saveWorkout: (workout: Workout) => Promise<boolean>;
  deleteWorkout: (id: string) => Promise<boolean>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [dailyChecks, setDailyChecks] = useState<DailyCheck[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) {
      setDailyChecks([]);
      setWorkouts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch daily checks
      const { data: checksData, error: checksError } = await supabase
        .from('daily_checks')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (checksError) throw checksError;

      const checks: DailyCheck[] = (checksData || []).map(row => ({
        date: row.date,
        hrv: row.hrv,
        restingHr: row.resting_hr,
        sleepHours: Number(row.sleep_hours),
        sleepQuality: row.sleep_quality,
        mood: row.mood ?? undefined,
        bodyBattery: row.body_battery ?? undefined,
        notes: row.notes ?? undefined,
        alcoholYesterday: (row as any).alcohol_yesterday ?? undefined,
      }));
      setDailyChecks(checks);

      // Fetch workouts
      const { data: workoutsData, error: workoutsError } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (workoutsError) throw workoutsError;

      const workoutsArr: Workout[] = (workoutsData || []).map(row => ({
        id: row.id,
        date: row.date,
        type: row.type as Workout['type'],
        sessionType: ((row as any).session_type ?? 'legacy') as Workout['sessionType'],
        tssVersion: ((row as any).tss_version ?? 'v1_rpe') as Workout['tssVersion'],
        durationMin: Number(row.duration_min),
        rpe: row.rpe,
        tssSubjective: row.tss_subjective,
        tssFinal: Number((row as any).tss_final ?? row.tss_subjective),
        validated: row.validated,
        distanceKm: row.distance_km ? Number(row.distance_km) : undefined,
        avgHr: row.avg_hr ?? undefined,
        lthrUsed: (row as any).lthr_used ?? undefined,
        muscleGroups: (row as any).muscle_groups ?? undefined,
        equipmentId: (row as any).equipment_id ?? undefined,
      }));
      setWorkouts(workoutsArr);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveDailyCheckFn = async (check: DailyCheck): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('daily_checks')
      .upsert({
        user_id: user.id,
        date: check.date,
        hrv: check.hrv,
        resting_hr: check.restingHr,
        sleep_hours: check.sleepHours,
        sleep_quality: check.sleepQuality,
        mood: check.mood ?? null,
        body_battery: check.bodyBattery ?? null,
        notes: check.notes ?? null,
        alcohol_yesterday: check.alcoholYesterday ?? false,
      } as any, {
        onConflict: 'user_id,date',
      });

    if (error) {
      console.error('Error saving daily check:', error);
      return false;
    }

    await fetchData();
    return true;
  };

  const saveWorkoutFn = async (workout: Workout): Promise<boolean> => {
    if (!user) return false;

    // Check if it's a new workout (no valid UUID id)
    const isNewWorkout = !workout.id || workout.id === '' || !workout.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    if (isNewWorkout) {
      // Insert new workout - let Supabase generate the UUID
      const { error } = await supabase
        .from('workouts')
        .insert({
          user_id: user.id,
          date: workout.date,
          type: workout.type,
          session_type: workout.sessionType,
          tss_version: workout.tssVersion,
          duration_min: workout.durationMin,
          rpe: workout.rpe,
          tss_subjective: workout.tssSubjective,
          tss_final: workout.tssFinal,
          validated: workout.validated,
          distance_km: workout.distanceKm ?? null,
          avg_hr: workout.avgHr ?? null,
          lthr_used: workout.lthrUsed ?? null,
          muscle_groups: workout.muscleGroups ?? null,
          equipment_id: workout.equipmentId ?? null,
        });

      if (error) {
        console.error('Error saving workout:', error);
        return false;
      }
    } else {
      // Update existing workout
      const { error } = await supabase
        .from('workouts')
        .update({
          date: workout.date,
          type: workout.type,
          session_type: workout.sessionType,
          tss_version: workout.tssVersion,
          duration_min: workout.durationMin,
          rpe: workout.rpe,
          tss_subjective: workout.tssSubjective,
          tss_final: workout.tssFinal,
          validated: workout.validated,
          distance_km: workout.distanceKm ?? null,
          avg_hr: workout.avgHr ?? null,
          lthr_used: workout.lthrUsed ?? null,
          muscle_groups: workout.muscleGroups ?? null,
          equipment_id: workout.equipmentId ?? null,
        })
        .eq('id', workout.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating workout:', error);
        return false;
      }
    }

    await fetchData();
    return true;
  };

  const deleteWorkoutFn = async (id: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting workout:', error);
      return false;
    }

    await fetchData();
    return true;
  };

  return (
    <DataContext.Provider value={{
      dailyChecks,
      workouts,
      isLoading,
      refreshData: fetchData,
      saveDailyCheck: saveDailyCheckFn,
      saveWorkout: saveWorkoutFn,
      deleteWorkout: deleteWorkoutFn,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
