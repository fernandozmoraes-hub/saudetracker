import { DailyCheck, Workout } from '@/types/health';

const DAILY_CHECKS_KEY = 'health_daily_checks';
const WORKOUTS_KEY = 'health_workouts';

export function getDailyChecks(): DailyCheck[] {
  const data = localStorage.getItem(DAILY_CHECKS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveDailyCheck(check: DailyCheck): void {
  const checks = getDailyChecks();
  const existingIndex = checks.findIndex(c => c.date === check.date);
  
  if (existingIndex >= 0) {
    checks[existingIndex] = check;
  } else {
    checks.push(check);
  }
  
  checks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  localStorage.setItem(DAILY_CHECKS_KEY, JSON.stringify(checks));
}

export function getDailyCheckByDate(date: string): DailyCheck | undefined {
  const checks = getDailyChecks();
  return checks.find(c => c.date === date);
}

export function getWorkouts(): Workout[] {
  const data = localStorage.getItem(WORKOUTS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveWorkout(workout: Workout): void {
  const workouts = getWorkouts();
  const existingIndex = workouts.findIndex(w => w.id === workout.id);
  
  if (existingIndex >= 0) {
    workouts[existingIndex] = workout;
  } else {
    workouts.push(workout);
  }
  
  workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  localStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
}

export function getWorkoutsByDate(date: string): Workout[] {
  const workouts = getWorkouts();
  return workouts.filter(w => w.date === date);
}

export function deleteWorkout(id: string): void {
  const workouts = getWorkouts().filter(w => w.id !== id);
  localStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
}
