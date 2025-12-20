import { DailyCheck, Workout } from '@/types/health';
import { supabase } from '@/integrations/supabase/client';

// Get current user ID
async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Daily Checks
export async function getDailyChecks(): Promise<DailyCheck[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('daily_checks')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching daily checks:', error);
    return [];
  }

  return data.map(row => ({
    date: row.date,
    hrv: row.hrv,
    restingHr: row.resting_hr,
    sleepHours: Number(row.sleep_hours),
    sleepQuality: row.sleep_quality,
    mood: row.mood ?? undefined,
    bodyBattery: row.body_battery ?? undefined,
    notes: row.notes ?? undefined,
  }));
}

export async function saveDailyCheck(check: DailyCheck): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from('daily_checks')
    .upsert({
      user_id: userId,
      date: check.date,
      hrv: check.hrv,
      resting_hr: check.restingHr,
      sleep_hours: check.sleepHours,
      sleep_quality: check.sleepQuality,
      mood: check.mood ?? null,
      body_battery: check.bodyBattery ?? null,
      notes: check.notes ?? null,
    }, {
      onConflict: 'user_id,date',
    });

  if (error) {
    console.error('Error saving daily check:', error);
    return false;
  }

  return true;
}

export async function getDailyCheckByDate(date: string): Promise<DailyCheck | undefined> {
  const userId = await getUserId();
  if (!userId) return undefined;

  const { data, error } = await supabase
    .from('daily_checks')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return {
    date: data.date,
    hrv: data.hrv,
    restingHr: data.resting_hr,
    sleepHours: Number(data.sleep_hours),
    sleepQuality: data.sleep_quality,
    mood: data.mood ?? undefined,
    bodyBattery: data.body_battery ?? undefined,
    notes: data.notes ?? undefined,
  };
}

// Workouts
export async function getWorkouts(): Promise<Workout[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching workouts:', error);
    return [];
  }

  return data.map(row => ({
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
  }));
}

export async function saveWorkout(workout: Workout): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from('workouts')
    .upsert({
      id: workout.id,
      user_id: userId,
      date: workout.date,
      type: workout.type,
      duration_min: workout.durationMin,
      rpe: workout.rpe,
      tss_subjective: workout.tssSubjective,
      validated: workout.validated,
      distance_km: workout.distanceKm ?? null,
      avg_hr: workout.avgHr ?? null,
    }, {
      onConflict: 'id',
    });

  if (error) {
    console.error('Error saving workout:', error);
    return false;
  }

  return true;
}

export async function getWorkoutsByDate(date: string): Promise<Workout[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching workouts by date:', error);
    return [];
  }

  return data.map(row => ({
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
  }));
}

export async function deleteWorkout(id: string): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;

  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting workout:', error);
    return false;
  }

  return true;
}
