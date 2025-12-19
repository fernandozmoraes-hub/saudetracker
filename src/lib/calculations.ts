import { DailyCheck, Workout, HRVStatus, HRVMetrics, TodayMetrics, WeeklyLoad } from '@/types/health';
import { getDailyChecks, getWorkouts } from './storage';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, getISOWeek, getYear } from 'date-fns';

export function calculateTssSubjective(durationMin: number, rpe: number): number {
  return Math.round((durationMin * rpe) / 10);
}

export function getHRVBaseline7d(date: string): number {
  const checks = getDailyChecks();
  const targetDate = new Date(date);
  const last7Days: number[] = [];
  
  for (let i = 1; i <= 7; i++) {
    const checkDate = format(subDays(targetDate, i), 'yyyy-MM-dd');
    const check = checks.find(c => c.date === checkDate);
    if (check?.hrv) {
      last7Days.push(check.hrv);
    }
  }
  
  if (last7Days.length === 0) return 0;
  return Math.round(last7Days.reduce((a, b) => a + b, 0) / last7Days.length);
}

export function getHRVStatus(currentHrv: number, baseline: number): HRVStatus {
  if (baseline === 0 || currentHrv >= baseline) return 'OK';
  if (currentHrv >= baseline * 0.9) return 'Alert';
  return 'Critical';
}

export function getHRVFactor(status: HRVStatus): number {
  switch (status) {
    case 'OK': return 1.0;
    case 'Alert': return 0.7;
    case 'Critical': return 0.4;
  }
}

export function getHRVMetrics(date: string): HRVMetrics | null {
  const checks = getDailyChecks();
  const check = checks.find(c => c.date === date);
  
  if (!check) return null;
  
  const baseline = getHRVBaseline7d(date);
  const status = getHRVStatus(check.hrv, baseline);
  const factor = getHRVFactor(status);
  
  return {
    baseline7d: baseline,
    currentHrv: check.hrv,
    status,
    factor,
  };
}

export function getDailyTssEffective(date: string): number {
  const workouts = getWorkouts().filter(w => w.date === date);
  const hrvMetrics = getHRVMetrics(date);
  const factor = hrvMetrics?.factor ?? 1.0;
  
  const totalTss = workouts.reduce((sum, w) => sum + w.tssSubjective, 0);
  return Math.round(totalTss * factor);
}

export function calculateATL(date: string): number {
  const targetDate = new Date(date);
  let totalTss = 0;
  let days = 0;
  
  for (let i = 0; i < 7; i++) {
    const checkDate = format(subDays(targetDate, i), 'yyyy-MM-dd');
    const tss = getDailyTssEffective(checkDate);
    totalTss += tss;
    days++;
  }
  
  return days > 0 ? Math.round(totalTss / days) : 0;
}

export function calculateCTL(date: string): number {
  const checks = getDailyChecks();
  const workouts = getWorkouts();
  
  if (checks.length === 0 && workouts.length === 0) return 0;
  
  const targetDate = new Date(date);
  const alpha = 2 / (42 + 1); // EMA decay factor
  
  // Get all dates with data
  const allDates = new Set([
    ...checks.map(c => c.date),
    ...workouts.map(w => w.date),
  ]);
  
  const sortedDates = Array.from(allDates).sort();
  if (sortedDates.length === 0) return 0;
  
  // Initialize CTL with first week average
  const firstWeekDates = sortedDates.slice(0, 7);
  let ctl = firstWeekDates.reduce((sum, d) => sum + getDailyTssEffective(d), 0) / Math.max(firstWeekDates.length, 1);
  
  // Calculate EMA up to target date
  for (const dateStr of sortedDates) {
    if (new Date(dateStr) > targetDate) break;
    const tss = getDailyTssEffective(dateStr);
    ctl = alpha * tss + (1 - alpha) * ctl;
  }
  
  return Math.round(ctl);
}

export function getTodayMetrics(): TodayMetrics {
  const today = format(new Date(), 'yyyy-MM-dd');
  const check = getDailyChecks().find(c => c.date === today);
  const hrvMetrics = getHRVMetrics(today);
  
  const hrv = check?.hrv ?? 0;
  const baseline = hrvMetrics?.baseline7d ?? 0;
  const status = hrvMetrics?.status ?? 'OK';
  const factor = hrvMetrics?.factor ?? 1.0;
  
  const ctl = calculateCTL(today);
  const atl = calculateATL(today);
  const tsb = ctl - atl;
  
  // Determine recommendation
  let recommendation: 'maintain' | 'reduce' | 'rest' = 'maintain';
  let alert: string | undefined;
  
  if (tsb < -15) {
    recommendation = 'rest';
    alert = 'TSB muito baixo. Risco de overreaching.';
  } else if (status === 'Critical') {
    recommendation = 'rest';
    alert = 'HRV crítico. Priorize recuperação.';
  } else if (status === 'Alert' || tsb < -5) {
    recommendation = 'reduce';
  }
  
  // Check consecutive critical days
  const checks = getDailyChecks();
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const yesterdayHrv = getHRVMetrics(yesterday);
  
  if (status === 'Critical' && yesterdayHrv?.status === 'Critical') {
    alert = 'HRV crítico por 2+ dias. Descanse!';
    recommendation = 'rest';
  }
  
  return {
    hrv,
    hrvBaseline: baseline,
    hrvStatus: status,
    hrvFactor: factor,
    ctl,
    atl,
    tsb,
    recommendation,
    alert,
  };
}

export function getWeeklyLoad(weekOffset: number = 0): WeeklyLoad {
  const targetDate = subDays(new Date(), weekOffset * 7);
  const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });
  
  const weekId = `${getYear(weekStart)}-W${String(getISOWeek(weekStart)).padStart(2, '0')}`;
  
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weeklyTss = days.reduce((sum, day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return sum + getDailyTssEffective(dateStr);
  }, 0);
  
  const lastDay = format(weekEnd, 'yyyy-MM-dd');
  const atl = calculateATL(lastDay);
  const ctl = calculateCTL(lastDay);
  const tsb = ctl - atl;
  
  return {
    weekId,
    weeklyTss,
    atl,
    ctl,
    tsb,
  };
}

export function getWeeklyHistory(weeks: number = 8): WeeklyLoad[] {
  const history: WeeklyLoad[] = [];
  
  for (let i = 0; i < weeks; i++) {
    history.push(getWeeklyLoad(i));
  }
  
  return history;
}
