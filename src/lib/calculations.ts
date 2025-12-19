import { DailyCheck, Workout, HRVStatus, HRVMetrics, TodayMetrics, WeeklyLoad } from '@/types/health';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, getISOWeek, getYear } from 'date-fns';

export function calculateTssSubjective(durationMin: number, rpe: number): number {
  return Math.round((durationMin * rpe) / 10);
}

export function getHRVBaseline7d(date: string, dailyChecks: DailyCheck[]): number {
  const targetDate = new Date(date);
  const last7Days: number[] = [];
  
  for (let i = 1; i <= 7; i++) {
    const checkDate = format(subDays(targetDate, i), 'yyyy-MM-dd');
    const check = dailyChecks.find(c => c.date === checkDate);
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

export function getHRVMetrics(date: string, dailyChecks: DailyCheck[]): HRVMetrics | null {
  const check = dailyChecks.find(c => c.date === date);
  
  if (!check) return null;
  
  const baseline = getHRVBaseline7d(date, dailyChecks);
  const status = getHRVStatus(check.hrv, baseline);
  const factor = getHRVFactor(status);
  
  return {
    baseline7d: baseline,
    currentHrv: check.hrv,
    status,
    factor,
  };
}

export function getDailyTssEffective(date: string, dailyChecks: DailyCheck[], workouts: Workout[]): number {
  const dateWorkouts = workouts.filter(w => w.date === date);
  const hrvMetrics = getHRVMetrics(date, dailyChecks);
  const factor = hrvMetrics?.factor ?? 1.0;
  
  const totalTss = dateWorkouts.reduce((sum, w) => sum + w.tssSubjective, 0);
  return Math.round(totalTss * factor);
}

export function calculateATL(date: string, dailyChecks: DailyCheck[], workouts: Workout[]): number {
  const targetDate = new Date(date);
  let totalTss = 0;
  let days = 0;
  
  for (let i = 0; i < 7; i++) {
    const checkDate = format(subDays(targetDate, i), 'yyyy-MM-dd');
    const tss = getDailyTssEffective(checkDate, dailyChecks, workouts);
    totalTss += tss;
    days++;
  }
  
  return days > 0 ? Math.round(totalTss / days) : 0;
}

export function calculateCTL(date: string, dailyChecks: DailyCheck[], workouts: Workout[]): number {
  if (dailyChecks.length === 0 && workouts.length === 0) return 0;
  
  const targetDate = new Date(date);
  const alpha = 2 / (42 + 1); // EMA decay factor
  
  // Get all dates with data
  const allDates = new Set([
    ...dailyChecks.map(c => c.date),
    ...workouts.map(w => w.date),
  ]);
  
  const sortedDates = Array.from(allDates).sort();
  if (sortedDates.length === 0) return 0;
  
  // Initialize CTL with first week average
  const firstWeekDates = sortedDates.slice(0, 7);
  let ctl = firstWeekDates.reduce((sum, d) => sum + getDailyTssEffective(d, dailyChecks, workouts), 0) / Math.max(firstWeekDates.length, 1);
  
  // Calculate EMA up to target date
  for (const dateStr of sortedDates) {
    if (new Date(dateStr) > targetDate) break;
    const tss = getDailyTssEffective(dateStr, dailyChecks, workouts);
    ctl = alpha * tss + (1 - alpha) * ctl;
  }
  
  return Math.round(ctl);
}

export function getTodayMetrics(dailyChecks: DailyCheck[], workouts: Workout[]): TodayMetrics {
  const today = format(new Date(), 'yyyy-MM-dd');
  const check = dailyChecks.find(c => c.date === today);
  const hrvMetrics = getHRVMetrics(today, dailyChecks);
  
  const hrv = check?.hrv ?? 0;
  const baseline = hrvMetrics?.baseline7d ?? 0;
  const status = hrvMetrics?.status ?? 'OK';
  const factor = hrvMetrics?.factor ?? 1.0;
  
  const ctl = calculateCTL(today, dailyChecks, workouts);
  const atl = calculateATL(today, dailyChecks, workouts);
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
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const yesterdayHrv = getHRVMetrics(yesterday, dailyChecks);
  
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

export function getWeeklyLoad(weekOffset: number, dailyChecks: DailyCheck[], workouts: Workout[]): WeeklyLoad {
  const targetDate = subDays(new Date(), weekOffset * 7);
  const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });
  
  const weekId = `${getYear(weekStart)}-W${String(getISOWeek(weekStart)).padStart(2, '0')}`;
  
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weeklyTss = days.reduce((sum, day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return sum + getDailyTssEffective(dateStr, dailyChecks, workouts);
  }, 0);
  
  const lastDay = format(weekEnd, 'yyyy-MM-dd');
  const atl = calculateATL(lastDay, dailyChecks, workouts);
  const ctl = calculateCTL(lastDay, dailyChecks, workouts);
  const tsb = ctl - atl;
  
  return {
    weekId,
    weeklyTss,
    atl,
    ctl,
    tsb,
  };
}

export function getWeeklyHistory(weeks: number, dailyChecks: DailyCheck[], workouts: Workout[]): WeeklyLoad[] {
  const history: WeeklyLoad[] = [];
  
  for (let i = 0; i < weeks; i++) {
    history.push(getWeeklyLoad(i, dailyChecks, workouts));
  }
  
  return history;
}

export interface DailyTrendData {
  date: string;        // 'dd/MM'
  fullDate: string;    // 'yyyy-MM-dd'
  hrv: number | null;
  hrvBaseline: number;
  tsb: number;
}

export function get14DayTrend(dailyChecks: DailyCheck[], workouts: Workout[]): DailyTrendData[] {
  const today = new Date();
  const trend: DailyTrendData[] = [];
  
  for (let i = 13; i >= 0; i--) {
    const targetDate = subDays(today, i);
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    const displayDate = format(targetDate, 'dd/MM');
    
    const check = dailyChecks.find(c => c.date === dateStr);
    const baseline = getHRVBaseline7d(dateStr, dailyChecks);
    const ctl = calculateCTL(dateStr, dailyChecks, workouts);
    const atl = calculateATL(dateStr, dailyChecks, workouts);
    const tsb = ctl - atl;
    
    trend.push({
      date: displayDate,
      fullDate: dateStr,
      hrv: check?.hrv ?? null,
      hrvBaseline: baseline,
      tsb,
    });
  }
  
  return trend;
}
